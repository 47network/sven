/**
 * Gateway / proxy detection — header-based proxy identification.
 *
 * Detects reverse proxies, load balancers, CDNs, and gateway layers
 * from HTTP headers. Extracts the real client IP, protocol, and
 * gateway identity for trust boundary enforcement and audit logging.
 *
 * Prior art: X-Forwarded-For (Squid, 1998), X-Real-IP (nginx),
 * Forwarded RFC 7239 (2014), CF-Connecting-IP (Cloudflare),
 * X-Amzn-Trace-Id (AWS ALB), Via header (HTTP/1.1 RFC 2616).
 */

import { createLogger } from './logger.js';

const logger = createLogger('proxy-detect');

// ──── Types ──────────────────────────────────────────────────────

export type GatewayType =
  | 'nginx'
  | 'caddy'
  | 'traefik'
  | 'cloudflare'
  | 'aws-alb'
  | 'aws-apigw'
  | 'gcp-lb'
  | 'azure-frontdoor'
  | 'haproxy'
  | 'envoy'
  | 'kong'
  | 'unknown';

export interface ProxyInfo {
  /** Whether a proxy/gateway was detected */
  detected: boolean;
  /** Identified gateway type(s) — may have multiple layers */
  gateways: GatewayType[];
  /** Extracted real client IP (from trusted proxy headers) */
  clientIp: string | null;
  /** Number of proxy hops detected */
  proxyHops: number;
  /** Original protocol (http/https) as reported by the proxy/gateway */
  originalProtocol: string | null;
  /** Original host as reported by the proxy/gateway */
  originalHost: string | null;
  /** Request ID / trace ID from gateway */
  requestId: string | null;
  /** Full proxy chain (if X-Forwarded-For is multi-hop) */
  proxyChain: string[];
  /** Whether TLS termination happened at the proxy */
  tlsTerminatedUpstream: boolean;
  /** Raw headers used for detection (filtered — no sensitive data) */
  detectedViaHeaders: string[];
}

export interface ProxyDetectConfig {
  /** List of trusted proxy IP ranges (CIDR or exact) */
  trustedProxies: string[];
  /** Maximum proxy chain depth to trust */
  maxProxyDepth: number;
  /** Whether to trust X-Forwarded-For from any source */
  trustAllForwardedFor: boolean;
}

// ──── Default Config ─────────────────────────────────────────────

const DEFAULT_CONFIG: ProxyDetectConfig = {
  trustedProxies: [
    '10.0.0.0/8',
    '172.16.0.0/12',
    '192.168.0.0/16',
    '127.0.0.1',
    '::1',
  ],
  maxProxyDepth: 5,
  trustAllForwardedFor: false,
};

// ──── CIDR Matching ──────────────────────────────────────────────

/**
 * Check if an IP is within a CIDR range. Supports IPv4 only at this layer.
 */
function isInCidr(ip: string, cidr: string): boolean {
  // Exact match
  if (ip === cidr) return true;

  const parts = cidr.split('/');
  if (parts.length !== 2) return false;

  const [baseIp, prefixStr] = parts;
  const prefix = parseInt(prefixStr, 10);
  if (isNaN(prefix) || prefix < 0 || prefix > 32) return false;

  const ipNum = ipToNum(ip);
  const baseNum = ipToNum(baseIp);
  if (ipNum === null || baseNum === null) return false;

  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  return (ipNum & mask) === (baseNum & mask);
}

function ipToNum(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let num = 0;
  for (const part of parts) {
    const n = parseInt(part, 10);
    if (isNaN(n) || n < 0 || n > 255) return null;
    num = (num << 8) | n;
  }
  return num >>> 0;
}

function isTrustedProxy(ip: string, trustedRanges: string[]): boolean {
  return trustedRanges.some((range) => isInCidr(ip, range));
}

// ──── Header Extraction ──────────────────────────────────────────

type Headers = Record<string, string | string[] | undefined>;

function getHeader(headers: Headers, name: string): string | undefined {
  const key = name.toLowerCase();
  const value = headers[key];
  if (Array.isArray(value)) return value[0];
  return value;
}

function hasHeader(headers: Headers, name: string): boolean {
  return getHeader(headers, name) !== undefined;
}

// ──── Gateway Detection Logic ────────────────────────────────────

/**
 * Detect reverse proxy, gateway, and CDN layers from HTTP request headers.
 */
export function detectProxy(
  headers: Headers,
  remoteAddr?: string,
  config?: Partial<ProxyDetectConfig>,
): ProxyInfo {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  const gateways: GatewayType[] = [];
  const detectedViaHeaders: string[] = [];
  let clientIp: string | null = null;
  let requestId: string | null = null;
  let originalProtocol: string | null = null;
  let originalHost: string | null = null;
  let proxyChain: string[] = [];
  let tlsTerminatedUpstream = false;

  // ─── Detect gateway type by signature headers ───

  // Cloudflare
  if (hasHeader(headers, 'cf-connecting-ip') || hasHeader(headers, 'cf-ray')) {
    gateways.push('cloudflare');
    detectedViaHeaders.push('cf-connecting-ip', 'cf-ray');
    clientIp = getHeader(headers, 'cf-connecting-ip') ?? null;
  }

  // AWS ALB
  if (hasHeader(headers, 'x-amzn-trace-id')) {
    gateways.push('aws-alb');
    detectedViaHeaders.push('x-amzn-trace-id');
    requestId = requestId ?? getHeader(headers, 'x-amzn-trace-id') ?? null;
  }

  // AWS API Gateway
  if (hasHeader(headers, 'x-amzn-requestid') || hasHeader(headers, 'x-amz-apigw-id')) {
    gateways.push('aws-apigw');
    detectedViaHeaders.push('x-amzn-requestid');
    requestId = requestId ?? getHeader(headers, 'x-amzn-requestid') ?? null;
  }

  // Azure Front Door
  if (hasHeader(headers, 'x-azure-ref') || hasHeader(headers, 'x-fd-healthprobe')) {
    gateways.push('azure-frontdoor');
    detectedViaHeaders.push('x-azure-ref');
  }

  // GCP LB
  if (hasHeader(headers, 'x-cloud-trace-context')) {
    gateways.push('gcp-lb');
    detectedViaHeaders.push('x-cloud-trace-context');
    requestId = requestId ?? getHeader(headers, 'x-cloud-trace-context') ?? null;
  }

  // Traefik
  const via = getHeader(headers, 'via');
  if (via && /traefik/i.test(via)) {
    gateways.push('traefik');
    detectedViaHeaders.push('via');
  }

  // Envoy
  if (hasHeader(headers, 'x-envoy-external-address') || (via && /envoy/i.test(via))) {
    gateways.push('envoy');
    detectedViaHeaders.push('x-envoy-external-address');
    clientIp = clientIp ?? getHeader(headers, 'x-envoy-external-address') ?? null;
  }

  // nginx (X-Real-IP is commonly set by nginx)
  if (hasHeader(headers, 'x-real-ip') && gateways.length === 0) {
    gateways.push('nginx');
    detectedViaHeaders.push('x-real-ip');
  }

  // HAProxy
  if (hasHeader(headers, 'x-haproxy-server-state')) {
    gateways.push('haproxy');
    detectedViaHeaders.push('x-haproxy-server-state');
  }

  // Kong
  if (hasHeader(headers, 'x-kong-proxy-latency') || hasHeader(headers, 'x-kong-request-id')) {
    gateways.push('kong');
    detectedViaHeaders.push('x-kong-request-id');
    requestId = requestId ?? getHeader(headers, 'x-kong-request-id') ?? null;
  }

  // ─── Extract real client IP ───

  // X-Forwarded-For (standard multi-hop)
  const xff = getHeader(headers, 'x-forwarded-for');
  if (xff) {
    const ips = xff.split(',').map((s) => s.trim()).filter(Boolean);
    proxyChain = ips;

    if (cfg.trustAllForwardedFor && ips.length > 0) {
      clientIp = clientIp ?? ips[0];
    } else {
      // Walk from right to left, skip trusted proxies, take first untrusted
      for (let i = ips.length - 1; i >= 0; i--) {
        if (!isTrustedProxy(ips[i], cfg.trustedProxies)) {
          clientIp = clientIp ?? ips[i];
          break;
        }
      }
    }

    // Enforce max proxy depth
    if (ips.length > cfg.maxProxyDepth) {
      logger.warn('X-Forwarded-For chain exceeds max proxy depth', {
        depth: ips.length,
        maxDepth: cfg.maxProxyDepth,
      });
      // Still use it but log the warning
    }

    detectedViaHeaders.push('x-forwarded-for');
  }

  // X-Real-IP (nginx convention — single IP)
  if (!clientIp) {
    const realIp = getHeader(headers, 'x-real-ip');
    if (realIp) {
      clientIp = realIp;
      detectedViaHeaders.push('x-real-ip');
    }
  }

  // Forwarded (RFC 7239)
  const forwarded = getHeader(headers, 'forwarded');
  if (forwarded && !clientIp) {
    const forMatch = forwarded.match(/for="?([^";,\s]+)"?/i);
    if (forMatch) {
      clientIp = forMatch[1];
      detectedViaHeaders.push('forwarded');
    }
  }

  // Fall back to remote address
  if (!clientIp && remoteAddr) {
    clientIp = remoteAddr;
  }

  // ─── Extract original protocol ───

  const xfp = getHeader(headers, 'x-forwarded-proto');
  if (xfp) {
    originalProtocol = xfp.toLowerCase();
    if (originalProtocol === 'https') {
      tlsTerminatedUpstream = true;
    }
  }

  // ─── Extract original host ───
  originalHost = getHeader(headers, 'x-forwarded-host')
    ?? getHeader(headers, 'host')
    ?? null;

  // ─── Request ID / trace ID ───
  requestId = requestId
    ?? getHeader(headers, 'x-request-id')
    ?? getHeader(headers, 'x-trace-id')
    ?? getHeader(headers, 'x-correlation-id')
    ?? null;

  // ─── Detect caddy by server header ───
  const server = getHeader(headers, 'server');
  if (server && /caddy/i.test(server)) {
    if (!gateways.includes('caddy')) gateways.push('caddy');
    detectedViaHeaders.push('server');
  }

  // If we detected proxy headers but couldn't identify the gateway
  if (gateways.length === 0 && proxyChain.length > 0) {
    gateways.push('unknown');
  }

  const detected = gateways.length > 0 || proxyChain.length > 0;
  const proxyHops = proxyChain.length;

  if (detected) {
    logger.debug('Proxy detected', {
      gateways,
      clientIp,
      proxyHops,
      tlsTerminatedUpstream,
    });
  }

  return {
    detected,
    gateways,
    clientIp,
    proxyHops,
    originalProtocol,
    originalHost,
    requestId,
    proxyChain,
    tlsTerminatedUpstream,
    detectedViaHeaders: [...new Set(detectedViaHeaders)],
  };
}

/**
 * Convenience function to extract the real client IP from headers.
 */
export function getRealClientIp(
  headers: Headers,
  remoteAddr?: string,
  config?: Partial<ProxyDetectConfig>,
): string | null {
  return detectProxy(headers, remoteAddr, config).clientIp;
}

/**
 * Convenience function to get the request/trace ID from headers.
 */
export function getRequestId(headers: Headers): string | null {
  return detectProxy(headers).requestId;
}
