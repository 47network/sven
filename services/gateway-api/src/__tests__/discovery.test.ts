import { EventEmitter } from 'node:events';
import type pg from 'pg';
import { DiscoveryService } from '../services/DiscoveryService.js';

class FakeMdns extends EventEmitter {
  queries: any[] = [];
  responses: any[] = [];
  destroyed = false;

  query(q: any) {
    this.queries.push(q);
  }

  respond(res: any) {
    this.responses.push(res);
  }

  destroy() {
    this.destroyed = true;
  }
}

function makePool(
  enabled = true,
  natsLeafAutoPeerEnabled = false,
  mode: 'off' | 'minimal' | 'full' = 'full',
  wideAreaDomains: string[] = [],
): pg.Pool {
  const upserts: Array<{ sql: string; params: unknown[] | undefined }> = [];
  return {
    query: async (sql: string, params?: unknown[]) => {
      if (sql.includes('discovery.enabled')) {
        return { rows: [{ value: enabled ? 'true' : 'false' }] };
      }
      if (sql.includes('discovery.mode')) {
        return { rows: [{ value: mode }] };
      }
      if (sql.includes('discovery.wideAreaDomains')) {
        return { rows: [{ value: JSON.stringify(wideAreaDomains) }] };
      }
      if (sql.includes('discovery.natsLeafAutoPeer.enabled')) {
        return { rows: [{ value: natsLeafAutoPeerEnabled ? 'true' : 'false' }] };
      }
      if (sql.includes(`'discovery.natsLeafAutoPeer.peers'`)) {
        upserts.push({ sql, params });
        return { rows: [] };
      }
      return { rows: [] };
    },
    __upserts: upserts,
  } as unknown as pg.Pool;
}

describe('DiscoveryService', () => {
  const originalAllowedHosts = process.env.DISCOVERY_NATS_LEAF_ALLOWED_HOSTS;

  afterEach(() => {
    if (originalAllowedHosts === undefined) {
      delete process.env.DISCOVERY_NATS_LEAF_ALLOWED_HOSTS;
    } else {
      process.env.DISCOVERY_NATS_LEAF_ALLOWED_HOSTS = originalAllowedHosts;
    }
  });

  it('respects discovery.enabled setting', async () => {
    const fake = new FakeMdns();
    const svc = new DiscoveryService(makePool(false), {
      mdnsFactory: () => fake,
      instanceId: 'self',
      instanceName: 'self',
      servicePort: 3000,
    });
    await svc.init();

    expect(svc.isEnabled()).toBe(false);
    expect(fake.queries.length).toBe(0);
    await svc.stop();
  });

  it('discovers instances from mDNS responses', async () => {
    const fake = new FakeMdns();
    const svc = new DiscoveryService(makePool(true), {
      mdnsFactory: () => fake,
      instanceId: 'self',
      instanceName: 'self',
      servicePort: 3000,
      now: () => 1000,
    });
    await svc.init();

    fake.emit('response', {
      answers: [
        { name: '_sven._tcp.local', type: 'PTR', data: 'remote._sven._tcp.local' },
        { name: 'remote._sven._tcp.local', type: 'SRV', data: { port: 3999, target: 'remote.local' } },
        { name: 'remote._sven._tcp.local', type: 'TXT', data: ['name=Remote', 'version=0.1.0', 'url=http://remote:3999'] },
        { name: 'remote.local', type: 'A', data: '192.168.1.20' },
      ],
    });

    const list = svc.listInstances();
    const remote = list.find((entry) => entry.id.includes('remote._sven._tcp.local'));
    expect(remote).toBeTruthy();
    expect(remote?.url).toBe('http://remote:3999');
    expect(remote?.address).toBe('192.168.1.20');
    await svc.stop();
  });

  it('supports minimal discovery mode without advertising itself', async () => {
    const fake = new FakeMdns();
    const svc = new DiscoveryService(makePool(true, false, 'minimal'), {
      mdnsFactory: () => fake,
      instanceId: 'self',
      instanceName: 'self',
      servicePort: 3000,
      now: () => 1000,
    });
    await svc.init();

    expect(svc.isEnabled()).toBe(true);
    expect(svc.getMode()).toBe('minimal');
    expect(fake.responses).toHaveLength(0);
    expect(fake.queries.length).toBeGreaterThan(0);
    await svc.stop();
  });

  it('supports wide-area DNS-SD discovery domains', async () => {
    const fake = new FakeMdns();
    const dnsResolver = {
      resolveSrv: async (name: string) => {
        expect(name).toBe('_sven._tcp.example.com');
        return [{ name: 'remote.example.com', port: 7443 }];
      },
      resolveTxt: async (name: string) => {
        expect(name).toBe('_sven._tcp.example.com');
        return [[Buffer.from('name=Remote WAN'), Buffer.from('version=0.2.0'), Buffer.from('url=https://remote.example.com')]];
      },
    } as any;
    const svc = new DiscoveryService(makePool(true, false, 'full', ['example.com']), {
      mdnsFactory: () => fake,
      dnsResolver,
      instanceId: 'self',
      instanceName: 'self',
      servicePort: 3000,
      now: () => 1000,
    });
    await svc.init();
    await (svc as any).queryWideAreaDomains();

    const list = svc.listInstances();
    const remote = list.find((entry) => entry.id === 'remote.example.com:7443');
    expect(remote).toBeTruthy();
    expect(remote?.url).toBe('https://remote.example.com');
    expect(svc.getWideAreaDomains()).toEqual(['example.com']);
    await svc.stop();
  });

  it('collects NATS leaf peer candidates when auto-peer is enabled', async () => {
    const fake = new FakeMdns();
    const pool = makePool(true, true) as any;
    const svc = new DiscoveryService(pool, {
      mdnsFactory: () => fake,
      instanceId: 'self',
      instanceName: 'self',
      servicePort: 3000,
      now: () => 1000,
    });
    await svc.init();

    fake.emit('response', {
      answers: [
        { name: '_sven._tcp.local', type: 'PTR', data: 'remote._sven._tcp.local' },
        { name: 'remote._sven._tcp.local', type: 'TXT', data: ['name=Remote', 'nats_leaf_url=nats://192.168.1.21:7422'] },
      ],
    });

    const peers = svc.listNatsLeafPeers();
    expect(peers).toHaveLength(1);
    expect(peers[0].instance_id).toContain('remote._sven._tcp.local');
    expect(peers[0].nats_leaf_url).toBe('nats://192.168.1.21:7422');

    await (svc as any).persistNatsLeafPeers();
    expect(Array.isArray(pool.__upserts)).toBe(true);
    expect(pool.__upserts.length).toBeGreaterThan(0);
    await svc.stop();
  });

  it('rejects discovered NATS leaf URLs with non-NATS schemes', async () => {
    const fake = new FakeMdns();
    const svc = new DiscoveryService(makePool(true, true), {
      mdnsFactory: () => fake,
      instanceId: 'self',
      instanceName: 'self',
      servicePort: 3000,
      now: () => 1000,
    });
    await svc.init();

    fake.emit('response', {
      answers: [
        { name: '_sven._tcp.local', type: 'PTR', data: 'remote._sven._tcp.local' },
        { name: 'remote._sven._tcp.local', type: 'TXT', data: ['name=Remote', 'nats_leaf_url=http://attacker.local:7422'] },
      ],
    });

    expect(svc.listNatsLeafPeers()).toHaveLength(0);
    await svc.stop();
  });

  it('enforces optional discovery host allowlist for NATS leaf peers', async () => {
    process.env.DISCOVERY_NATS_LEAF_ALLOWED_HOSTS = 'trusted.local';

    const fake = new FakeMdns();
    const svc = new DiscoveryService(makePool(true, true), {
      mdnsFactory: () => fake,
      instanceId: 'self',
      instanceName: 'self',
      servicePort: 3000,
      now: () => 1000,
    });
    await svc.init();

    fake.emit('response', {
      answers: [
        { name: '_sven._tcp.local', type: 'PTR', data: 'trusted._sven._tcp.local' },
        { name: 'trusted._sven._tcp.local', type: 'TXT', data: ['name=Trusted', 'nats_leaf_url=nats://trusted.local:7422'] },
        { name: '_sven._tcp.local', type: 'PTR', data: 'spoofed._sven._tcp.local' },
        { name: 'spoofed._sven._tcp.local', type: 'TXT', data: ['name=Spoofed', 'nats_leaf_url=nats://spoofed.local:7422'] },
      ],
    });

    const peers = svc.listNatsLeafPeers();
    expect(peers).toHaveLength(1);
    expect(peers[0].instance_id).toContain('trusted._sven._tcp.local');
    expect(peers[0].nats_leaf_url).toBe('nats://trusted.local:7422');
    await svc.stop();
  });
});
