import { existsSync, readFileSync } from 'node:fs';
import { FastifyInstance } from 'fastify';
import pg from 'pg';

type TunnelStatus = {
  enabled: boolean;
  provider: string;
  public_url: string | null;
  api_base_url: string | null;
  mobile_connect_url: string | null;
  auth_modes: string[];
  qr_image_url: string | null;
  source: 'env' | 'url_file' | 'log_file' | 'none';
  url_file: string | null;
  log_file: string | null;
};

type TunnelStatusResponse = TunnelStatus & {
  redacted: boolean;
};

const HTTPS_URL_PATTERN = /https:\/\/[^\s"'<>]+/g;

function normalizeUrl(input: string): string | null {
  const raw = String(input || '').trim();
  if (!raw) return null;
  if (!/^https?:\/\//i.test(raw)) return null;
  try {
    const parsed = new URL(raw);
    return parsed.toString();
  } catch {
    return null;
  }
}

function extractUrlFromLog(logText: string): string | null {
  const matches = logText.match(HTTPS_URL_PATTERN) || [];
  if (!matches.length) return null;
  const cleaned = matches
    .map((m) => m.replace(/[),.;]+$/, ''))
    .map((m) => normalizeUrl(m))
    .filter((m): m is string => Boolean(m));
  if (!cleaned.length) return null;
  const tryCf = cleaned.find((u) => /trycloudflare\.com/i.test(u));
  return tryCf || cleaned[0];
}

function buildMobileConnectUrl(publicUrl: string | null): string | null {
  if (!publicUrl) return null;
  const params = new URLSearchParams({ url: publicUrl });
  return `sven://gateway/connect?${params.toString()}`;
}

function buildTunnelStatus(
  provider: string,
  publicUrl: string | null,
  source: TunnelStatus['source'],
  urlFile: string | null,
  logFile: string | null,
): TunnelStatus {
  return {
    enabled: Boolean(publicUrl),
    provider,
    public_url: publicUrl,
    api_base_url: publicUrl,
    mobile_connect_url: buildMobileConnectUrl(publicUrl),
    auth_modes: publicUrl ? ['password', 'bearer_token'] : [],
    qr_image_url: null,
    source,
    url_file: urlFile,
    log_file: logFile,
  };
}

export function resolveTunnelStatus(): TunnelStatus {
  const provider = String(process.env.SVEN_TUNNEL_PROVIDER || 'cloudflare');
  const urlFile = process.env.SVEN_TUNNEL_URL_FILE || null;
  const logFile = process.env.SVEN_TUNNEL_LOG_FILE || null;

  const envUrl = normalizeUrl(String(process.env.SVEN_TUNNEL_PUBLIC_URL || ''));
  if (envUrl) {
    return buildTunnelStatus(provider, envUrl, 'env', urlFile, logFile);
  }

  if (urlFile && existsSync(urlFile)) {
    const text = readFileSync(urlFile, 'utf8');
    const firstLine = text.split(/\r?\n/).find((line) => String(line || '').trim());
    const url = normalizeUrl(firstLine || '');
    if (url) {
      return buildTunnelStatus(provider, url, 'url_file', urlFile, logFile);
    }
  }

  if (logFile && existsSync(logFile)) {
    const text = readFileSync(logFile, 'utf8');
    const url = extractUrlFromLog(text);
    if (url) {
      return buildTunnelStatus(provider, url, 'log_file', urlFile, logFile);
    }
  }

  return buildTunnelStatus(provider, null, 'none', urlFile, logFile);
}

export async function registerTunnelRoutes(app: FastifyInstance, _pool: pg.Pool) {
  app.get('/tunnel/status', async (request: any, reply) => {
    const isGlobalAdmin = String(request.userRole || '').trim() === 'platform_admin';
    if (!isGlobalAdmin) {
      reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Global admin privileges required' },
      });
      return;
    }
    const orgId = String(request.orgId || '').trim();
    if (!orgId) {
      reply.status(403).send({
        success: false,
        error: { code: 'ORG_REQUIRED', message: 'Active account required' },
      });
      return;
    }
    const status = resolveTunnelStatus();
    const response: TunnelStatusResponse = { ...status, redacted: false };
    reply.send({
      success: true,
      data: response,
    });
  });
}
