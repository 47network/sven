import os from 'node:os';
import dns from 'node:dns/promises';
import type pg from 'pg';
import { createLogger } from '@sven/shared';

type MdnsQuery = { name: string; type: string };
type MdnsAnswer = { name: string; type: string; data: any; ttl?: number };
type MdnsResponse = { answers?: MdnsAnswer[]; additionals?: MdnsAnswer[] };

type MdnsLike = {
  on: (event: 'query' | 'response', handler: (data: any) => void) => void;
  query: (query: MdnsQuery | MdnsQuery[]) => void;
  respond: (response: { answers?: MdnsAnswer[]; additionals?: MdnsAnswer[] }) => void;
  destroy: () => void;
};

type DiscoveryInstance = {
  id: string;
  name: string;
  host: string | null;
  address: string | null;
  port: number | null;
  url: string | null;
  version: string | null;
  last_seen: string;
  self: boolean;
};

type DiscoveryNatsLeafPeer = {
  instance_id: string;
  instance_name: string;
  nats_leaf_url: string;
  last_seen: string;
};

type DiscoveryOptions = {
  instanceName?: string;
  instanceId?: string;
  servicePort?: number;
  publicUrl?: string | null;
  mdnsFactory?: () => Promise<MdnsLike> | MdnsLike;
  dnsResolver?: typeof dns;
  now?: () => number;
};

export type DiscoveryMode = 'off' | 'minimal' | 'full';

const logger = createLogger('discovery');
const SERVICE_TYPE = '_sven._tcp.local';
const DEFAULT_TTL_MS = 120000;
const ALLOWED_DISCOVERY_NATS_SCHEMES = new Set(['nats', 'tls']);

let singleton: DiscoveryService | null = null;

function parseBool(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
  }
  if (typeof value === 'number') return value !== 0;
  return fallback;
}

function parseTxtRecord(data: any): Record<string, string> {
  const out: Record<string, string> = {};
  if (Array.isArray(data)) {
    for (const entry of data) {
      const raw = Buffer.isBuffer(entry) ? entry.toString('utf8') : String(entry || '');
      const idx = raw.indexOf('=');
      if (idx > 0) {
        out[raw.slice(0, idx)] = raw.slice(idx + 1);
      }
    }
  } else if (typeof data === 'object' && data) {
    for (const [key, value] of Object.entries(data)) {
      out[String(key)] = String(value);
    }
  }
  return out;
}

function parseDiscoveryAllowedLeafHosts(raw: string): Set<string> {
  const allowed = new Set<string>();
  for (const host of raw.split(',')) {
    const trimmed = host.trim().toLowerCase();
    if (trimmed) allowed.add(trimmed);
  }
  return allowed;
}

function normalizeAndValidateDiscoveredNatsLeafUrl(raw: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }

  const scheme = parsed.protocol.replace(':', '').toLowerCase();
  if (!ALLOWED_DISCOVERY_NATS_SCHEMES.has(scheme)) {
    return null;
  }
  if (!parsed.hostname) {
    return null;
  }
  if (parsed.username || parsed.password) {
    return null;
  }
  if (parsed.search || parsed.hash) {
    return null;
  }
  if (parsed.pathname && parsed.pathname !== '/') {
    return null;
  }

  if (parsed.port) {
    const portNum = Number(parsed.port);
    if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
      return null;
    }
  }

  const allowedHostsRaw = String(process.env.DISCOVERY_NATS_LEAF_ALLOWED_HOSTS || '').trim();
  if (allowedHostsRaw) {
    const allowedHosts = parseDiscoveryAllowedLeafHosts(allowedHostsRaw);
    if (!allowedHosts.has(parsed.hostname.toLowerCase())) {
      return null;
    }
  }

  const port = parsed.port ? `:${parsed.port}` : '';
  return `${scheme}://${parsed.hostname}${port}`;
}

async function createDefaultMdns(): Promise<MdnsLike> {
  const mod = await import('multicast-dns');
  const factory = (mod as any).default || mod;
  return factory();
}

export class DiscoveryService {
  private pool: pg.Pool;
  private mdns: MdnsLike | null = null;
  private enabled = false;
  private instances = new Map<string, DiscoveryInstance>();
  private queryTimer: NodeJS.Timeout | null = null;
  private pruneTimer: NodeJS.Timeout | null = null;
  private persistTimer: NodeJS.Timeout | null = null;
  private now: () => number;
  private instanceName: string;
  private instanceId: string;
  private servicePort: number;
  private publicUrl: string | null;
  private mdnsFactory: () => Promise<MdnsLike> | MdnsLike;
  private dnsResolver: typeof dns;
  private natsLeafAutoPeerEnabled = false;
  private natsLeafPeers = new Map<string, DiscoveryNatsLeafPeer>();
  private advertisedNatsLeafUrl: string | null;
  private mode: DiscoveryMode = 'full';
  private wideAreaDomains: string[] = [];

  constructor(pool: pg.Pool, options: DiscoveryOptions) {
    this.pool = pool;
    this.now = options.now || (() => Date.now());
    const hostname = os.hostname().replace(/\s+/g, '-');
    this.instanceName = options.instanceName || process.env.SVEN_INSTANCE_NAME || hostname;
    this.instanceId = options.instanceId || process.env.SVEN_INSTANCE_ID || this.instanceName;
    this.servicePort = options.servicePort || Number(process.env.GATEWAY_PORT || 3000);
    this.publicUrl = options.publicUrl || process.env.GATEWAY_URL || process.env.GATEWAY_PUBLIC_URL || null;
    this.mdnsFactory = options.mdnsFactory || createDefaultMdns;
    this.dnsResolver = options.dnsResolver || dns;
    this.advertisedNatsLeafUrl = String(process.env.DISCOVERY_NATS_LEAF_URL || process.env.NATS_LEAF_URL || '').trim() || null;
  }

  static async start(pool: pg.Pool, port: number): Promise<DiscoveryService> {
    if (singleton) return singleton;
    const service = new DiscoveryService(pool, { servicePort: port });
    await service.init();
    singleton = service;
    return service;
  }

  static getInstance(): DiscoveryService | null {
    return singleton;
  }

  private async loadEnabled(): Promise<boolean> {
    const envOverride = process.env.DISCOVERY_ENABLED;
    if (envOverride !== undefined) return parseBool(envOverride, true);
    const res = await this.pool.query(
      `SELECT value FROM settings_global WHERE key = 'discovery.enabled'`,
    );
    if (res.rows.length === 0) return true;
    return parseBool(res.rows[0].value, true);
  }

  private async loadNatsLeafAutoPeerEnabled(): Promise<boolean> {
    const envOverride = process.env.DISCOVERY_NATS_LEAF_AUTO_PEER_ENABLED;
    if (envOverride !== undefined) return parseBool(envOverride, false);
    const res = await this.pool.query(
      `SELECT value FROM settings_global WHERE key = 'discovery.natsLeafAutoPeer.enabled'`,
    );
    if (res.rows.length === 0) return false;
    return parseBool(res.rows[0].value, false);
  }

  private parseMode(value: unknown): DiscoveryMode {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'off' || normalized === 'minimal' || normalized === 'full') {
      return normalized;
    }
    return 'full';
  }

  private async loadMode(): Promise<DiscoveryMode> {
    const envOverride = process.env.DISCOVERY_MODE;
    if (envOverride !== undefined) return this.parseMode(envOverride);
    const res = await this.pool.query(
      `SELECT value FROM settings_global WHERE key = 'discovery.mode'`,
    );
    if (res.rows.length === 0) return 'full';
    return this.parseMode(res.rows[0].value);
  }

  private parseWideAreaDomains(raw: unknown): string[] {
    if (Array.isArray(raw)) {
      return raw.map((entry) => String(entry || '').trim()).filter(Boolean);
    }
    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) {
            return parsed.map((entry) => String(entry || '').trim()).filter(Boolean);
          }
        } catch {
          // Fall back to comma-separated parsing below.
        }
      }
    }
    return String(raw || '')
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  private async loadWideAreaDomains(): Promise<string[]> {
    const envOverride = process.env.DISCOVERY_WIDE_AREA_DNS_SD_DOMAINS;
    if (envOverride !== undefined) return this.parseWideAreaDomains(envOverride);
    const res = await this.pool.query(
      `SELECT value FROM settings_global WHERE key = 'discovery.wideAreaDomains'`,
    );
    if (res.rows.length === 0) return [];
    return this.parseWideAreaDomains(res.rows[0].value);
  }

  async init(): Promise<void> {
    this.enabled = await this.loadEnabled();
    this.mode = await this.loadMode();
    this.wideAreaDomains = await this.loadWideAreaDomains();
    this.natsLeafAutoPeerEnabled = await this.loadNatsLeafAutoPeerEnabled();
    if (!this.enabled || this.mode === 'off') {
      logger.info('Discovery disabled');
      return;
    }
    try {
      this.mdns = await this.mdnsFactory();
      this.bindMdnsHandlers();
      if (this.mode === 'full') {
        this.advertiseSelf();
      } else {
        this.recordSelf();
      }
      this.queryOnce();
      this.queryTimer = setInterval(() => this.queryOnce(), 15000);
      this.pruneTimer = setInterval(() => this.prune(), 30000);
      if (this.natsLeafAutoPeerEnabled) {
        this.persistTimer = setInterval(() => {
          void this.persistNatsLeafPeers();
        }, 30000);
      }
      logger.info('Discovery service started');
    } catch (err) {
      logger.warn('Failed to start discovery', { err: String(err) });
      this.enabled = false;
      this.mdns = null;
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  getMode(): DiscoveryMode {
    return this.mode;
  }

  getWideAreaDomains(): string[] {
    return [...this.wideAreaDomains];
  }

  listInstances(): DiscoveryInstance[] {
    this.prune();
    return Array.from(this.instances.values()).sort((a, b) => {
      return String(a.name).localeCompare(String(b.name));
    });
  }

  isNatsLeafAutoPeerEnabled(): boolean {
    return this.natsLeafAutoPeerEnabled;
  }

  listNatsLeafPeers(): DiscoveryNatsLeafPeer[] {
    this.prune();
    return Array.from(this.natsLeafPeers.values()).sort((a, b) => {
      return String(a.instance_name).localeCompare(String(b.instance_name));
    });
  }

  triggerQuery(): void {
    if (!this.mdns) return;
    this.queryOnce();
  }

  async stop(): Promise<void> {
    if (this.queryTimer) clearInterval(this.queryTimer);
    if (this.pruneTimer) clearInterval(this.pruneTimer);
    if (this.persistTimer) clearInterval(this.persistTimer);
    this.queryTimer = null;
    this.pruneTimer = null;
    this.persistTimer = null;
    if (this.mdns) {
      this.mdns.destroy();
    }
    this.mdns = null;
    this.instances.clear();
    this.natsLeafPeers.clear();
  }

  private bindMdnsHandlers(): void {
    if (!this.mdns) return;
    this.mdns.on('query', (query: { questions?: MdnsQuery[] }) => {
      if (this.mode !== 'full') return;
      const questions = query.questions || [];
      for (const q of questions) {
        if (q.name === SERVICE_TYPE && (q.type === 'PTR' || q.type === 'ANY')) {
          this.respondService();
        }
      }
    });

    this.mdns.on('response', (response: MdnsResponse) => {
      const answers = [...(response.answers || []), ...(response.additionals || [])];
      if (answers.length === 0) return;
      this.ingestAnswers(answers);
    });
  }

  private respondService(): void {
    if (!this.mdns) return;
    const instanceFqdn = `${this.instanceId}.${SERVICE_TYPE}`;
    const hostname = `${this.instanceId}.local`;
    const ip = this.getLocalAddress();
    const txt = [
      `name=${this.instanceName}`,
      `version=${process.env.SVEN_VERSION || process.env.npm_package_version || '0.1.0'}`,
      `url=${this.publicUrl || ''}`,
      `nats_leaf_url=${this.advertisedNatsLeafUrl || ''}`,
    ];
    const answers: MdnsAnswer[] = [
      { name: SERVICE_TYPE, type: 'PTR', data: instanceFqdn, ttl: 120 },
      { name: instanceFqdn, type: 'SRV', data: { port: this.servicePort, target: hostname }, ttl: 120 },
      { name: instanceFqdn, type: 'TXT', data: txt, ttl: 120 },
    ];
    const additionals: MdnsAnswer[] = ip ? [{ name: hostname, type: 'A', data: ip, ttl: 120 }] : [];
    this.mdns.respond({ answers, additionals });
  }

  private advertiseSelf(): void {
    const nowIso = new Date(this.now()).toISOString();
    this.recordSelf(nowIso);
    this.respondService();
  }

  private recordSelf(nowIso = new Date(this.now()).toISOString()): void {
    const selfInstance = `${this.instanceId}.${SERVICE_TYPE}`;
    this.ensureInstance(selfInstance, nowIso);
    this.updateInstance(selfInstance, {
      name: this.instanceName,
      host: `${this.instanceId}.local`,
      port: this.servicePort,
      url: this.publicUrl || undefined,
      version: process.env.SVEN_VERSION || process.env.npm_package_version || '0.1.0',
    }, nowIso);
  }

  private ingestAnswers(answers: MdnsAnswer[]): void {
    const nowIso = new Date(this.now()).toISOString();
    let discoveredServiceName: string | null = null;

    for (const answer of answers) {
      if (answer.type === 'PTR' && answer.name === SERVICE_TYPE) {
        discoveredServiceName = String(answer.data || '');
        if (discoveredServiceName) {
          this.ensureInstance(discoveredServiceName, nowIso);
          this.queryInstance(discoveredServiceName);
        }
      }
    }

    for (const answer of answers) {
      const name = String(answer.name || '');
      if (name.endsWith(SERVICE_TYPE)) {
        if (answer.type === 'SRV' && answer.data) {
          const srv = answer.data as { port?: number; target?: string };
          this.updateInstance(name, {
            host: srv.target ? String(srv.target) : null,
            port: typeof srv.port === 'number' ? srv.port : null,
          }, nowIso);
        }
        if (answer.type === 'TXT') {
          const txt = parseTxtRecord(answer.data);
          this.updateInstance(name, {
            name: txt.name || undefined,
            url: txt.url || undefined,
            version: txt.version || undefined,
          }, nowIso);
          this.updateNatsLeafPeer(name, txt, nowIso);
        }
      }
      if (answer.type === 'A') {
        const targetName = String(answer.name || '');
        const address = String(answer.data || '');
        for (const record of this.instances.values()) {
          if (record.host === targetName) {
            record.address = address;
            record.last_seen = nowIso;
            if (!record.url && record.port) {
              record.url = `http://${address}:${record.port}`;
            }
          }
        }
      }
    }
  }

  private ensureInstance(name: string, nowIso: string): void {
    if (this.instances.has(name)) {
      const existing = this.instances.get(name);
      if (existing) existing.last_seen = nowIso;
      return;
    }
    const selfInstance = `${this.instanceId}.${SERVICE_TYPE}`;
    this.instances.set(name, {
      id: name,
      name,
      host: null,
      address: null,
      port: null,
      url: null,
      version: null,
      last_seen: nowIso,
      self: name === selfInstance,
    });
  }

  private updateInstance(name: string, patch: Partial<DiscoveryInstance>, nowIso: string): void {
    this.ensureInstance(name, nowIso);
    const record = this.instances.get(name);
    if (!record) return;
    record.last_seen = nowIso;
    if (patch.name) record.name = patch.name;
    if (patch.host !== undefined) record.host = patch.host;
    if (patch.port !== undefined) record.port = patch.port;
    if (patch.url !== undefined) record.url = patch.url;
    if (patch.version !== undefined) record.version = patch.version;
    if (!record.url && record.host && record.port) {
      record.url = `http://${record.host}:${record.port}`;
    }
  }

  private queryInstance(serviceName: string): void {
    if (!this.mdns) return;
    this.mdns.query([
      { name: serviceName, type: 'SRV' },
      { name: serviceName, type: 'TXT' },
    ]);
  }

  private queryOnce(): void {
    if (!this.mdns || this.mode === 'off') return;
    this.mdns.query([{ name: SERVICE_TYPE, type: 'PTR' }]);
    void this.queryWideAreaDomains();
  }

  private async queryWideAreaDomains(): Promise<void> {
    if (this.wideAreaDomains.length === 0) return;
    const nowIso = new Date(this.now()).toISOString();
    for (const domain of this.wideAreaDomains) {
      const serviceName = `_sven._tcp.${domain}`;
      try {
        const srvRecords = await this.dnsResolver.resolveSrv(serviceName);
        for (const srv of srvRecords) {
          const instanceId = `${srv.name}:${srv.port}`;
          this.ensureInstance(instanceId, nowIso);
          this.updateInstance(instanceId, {
            name: srv.name,
            host: srv.name,
            port: srv.port,
            url: `http://${srv.name}:${srv.port}`,
          }, nowIso);
          try {
            const txtRecords = await this.dnsResolver.resolveTxt(serviceName);
            const flattened = txtRecords.flat().map((entry) => Buffer.isBuffer(entry) ? entry.toString('utf8') : String(entry || ''));
            const txt = parseTxtRecord(flattened);
            this.updateInstance(instanceId, {
              name: txt.name || srv.name,
              url: txt.url || `http://${srv.name}:${srv.port}`,
              version: txt.version || undefined,
            }, nowIso);
            this.updateNatsLeafPeer(instanceId, txt, nowIso);
          } catch {
            // Wide-area TXT records are optional.
          }
        }
      } catch {
        // Wide-area domain discovery is best-effort.
      }
    }
  }

  private prune(): void {
    const cutoff = this.now() - DEFAULT_TTL_MS;
    for (const [key, value] of this.instances.entries()) {
      if (new Date(value.last_seen).getTime() < cutoff) {
        this.instances.delete(key);
      }
    }
    for (const [key, value] of this.natsLeafPeers.entries()) {
      if (new Date(value.last_seen).getTime() < cutoff) {
        this.natsLeafPeers.delete(key);
      }
    }
  }

  private updateNatsLeafPeer(instanceRecordName: string, txt: Record<string, string>, nowIso: string): void {
    if (!this.natsLeafAutoPeerEnabled) return;
    const discoveredLeafUrl = String(txt.nats_leaf_url || '').trim();
    if (!discoveredLeafUrl) return;
    const natsLeafUrl = normalizeAndValidateDiscoveredNatsLeafUrl(discoveredLeafUrl);
    if (!natsLeafUrl) {
      logger.warn('Ignoring invalid discovered nats_leaf_url', {
        instance_id: instanceRecordName,
      });
      return;
    }
    const selfRecordName = `${this.instanceId}.${SERVICE_TYPE}`;
    if (instanceRecordName === selfRecordName) return;
    const instance = this.instances.get(instanceRecordName);
    const instanceName = String((instance?.name || txt.name || instanceRecordName) || instanceRecordName);
    this.natsLeafPeers.set(instanceRecordName, {
      instance_id: instanceRecordName,
      instance_name: instanceName,
      nats_leaf_url: natsLeafUrl,
      last_seen: nowIso,
    });
  }

  private async persistNatsLeafPeers(): Promise<void> {
    if (!this.natsLeafAutoPeerEnabled) return;
    try {
      const peers = this.listNatsLeafPeers();
      await this.pool.query(
        `INSERT INTO settings_global (key, value, updated_at, updated_by)
         VALUES ('discovery.natsLeafAutoPeer.peers', $1::jsonb, NOW(), 'discovery-service')
         ON CONFLICT (key)
         DO UPDATE SET value = EXCLUDED.value, updated_at = NOW(), updated_by = 'discovery-service'`,
        [JSON.stringify(peers)],
      );
    } catch (err) {
      logger.warn('Failed to persist discovery NATS leaf peers', { err: String(err) });
    }
  }

  private getLocalAddress(): string | null {
    const nets = os.networkInterfaces();
    for (const iface of Object.values(nets)) {
      for (const addr of iface || []) {
        if (addr.family === 'IPv4' && !addr.internal) {
          return addr.address;
        }
      }
    }
    return null;
  }
}

export async function initDiscoveryService(pool: pg.Pool, port: number): Promise<DiscoveryService> {
  return DiscoveryService.start(pool, port);
}

export function getDiscoveryService(): DiscoveryService | null {
  return DiscoveryService.getInstance();
}
