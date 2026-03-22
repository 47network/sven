/**
 * Web Fetch Integration
 *
 * Handles allowlist-based web fetching with HTML text extraction,
 * metadata extraction, caching, and egress proxy enforcement.
 */

import { parseDocument } from 'htmlparser2';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export interface WebFetchResult {
  url: string;
  status: number;
  contentType?: string;
  charset?: string;
  title?: string;
  description?: string;
  author?: string;
  favicon?: string;
  ogImage?: string;
  ogTitle?: string;
  ogDescription?: string;
  textContent: string;
  htmlContent?: string;
  contentLength: number;
  fetchedAt: string;
  fromCache: boolean;
  cacheExpiry?: string;
}

export interface CacheEntry {
  url: string;
  result: WebFetchResult;
  expiresAt: number;
}

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata.google.internal',
  'metadata',
  'metadata.internal',
  '169.254.169.254',
  '100.100.100.200',
  'fd00:ec2::254',
]);

function isBlockedIpv4(address: string): boolean {
  const parts = address.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a >= 224) return true;
  return false;
}

function isBlockedIpv6(address: string): boolean {
  const normalized = address.toLowerCase();
  if (normalized === '::1') return true;
  if (normalized === '::') return true;
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
  if (normalized.startsWith('fe80:')) return true;
  if (normalized.startsWith('ff')) return true;
  if (normalized.startsWith('::ffff:')) {
    const mapped = normalized.slice('::ffff:'.length);
    return isBlockedIpv4(mapped);
  }
  return false;
}

function isBlockedHostName(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase().replace(/\.$/, '');
  if (!normalized) return true;
  if (BLOCKED_HOSTNAMES.has(normalized)) return true;
  if (normalized.endsWith('.localhost')) return true;
  return false;
}

async function assertSafeFetchUrl(url: string, allowPrivateHosts: boolean): Promise<void> {
  const parsed = new URL(url);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`Unsupported URL protocol: ${parsed.protocol}`);
  }
  const hostname = parsed.hostname;
  if (!hostname) {
    throw new Error('Invalid URL hostname');
  }
  if (allowPrivateHosts) return;
  if (isBlockedHostName(hostname)) {
    throw new Error(`Blocked host: ${hostname}`);
  }
  const ipVersion = isIP(hostname);
  if (ipVersion === 4 && isBlockedIpv4(hostname)) {
    throw new Error(`Blocked IPv4 target: ${hostname}`);
  }
  if (ipVersion === 6 && isBlockedIpv6(hostname)) {
    throw new Error(`Blocked IPv6 target: ${hostname}`);
  }
  if (ipVersion === 0) {
    const resolved = await lookup(hostname, { all: true, verbatim: true });
    if (!resolved.length) {
      throw new Error(`Unable to resolve host: ${hostname}`);
    }
    for (const record of resolved) {
      if (record.family === 4 && isBlockedIpv4(record.address)) {
        throw new Error(`Blocked resolved IPv4 target: ${record.address}`);
      }
      if (record.family === 6 && isBlockedIpv6(record.address)) {
        throw new Error(`Blocked resolved IPv6 target: ${record.address}`);
      }
    }
  }
}

function isRedirectStatus(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

async function fetchWithSsrfGuards(
  initialUrl: string,
  fetchOptions: RequestInit,
  allowPrivateHosts: boolean,
  allowlist: string[] | undefined,
  maxRedirects: number,
): Promise<{ response: Response; finalUrl: string }> {
  let currentUrl = initialUrl;
  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    await assertSafeFetchUrl(currentUrl, allowPrivateHosts);
    if (allowlist && allowlist.length > 0) {
      const validation = validateDomainAllowlist(currentUrl, allowlist);
      if (!validation.valid) {
        throw new Error(validation.reason || 'URL not in allowlist');
      }
    }

    const response = await fetch(currentUrl, { ...fetchOptions, redirect: 'manual' });
    if (isRedirectStatus(response.status)) {
      const location = response.headers.get('location');
      if (!location) {
        throw new Error(`Redirect response missing location header (${response.status})`);
      }
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }
    return { response, finalUrl: currentUrl };
  }
  throw new Error(`Too many redirects (max ${maxRedirects})`);
}

/**
 * Validates domain against allowlist patterns
 * Supports:
 * - exact: example.com
 * - wildcard: *.example.com
 * - regex: ^https://api\.example\.com/.*
 */
export function validateDomainAllowlist(url: string, allowlist: string[]): { valid: boolean; reason?: string } {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname;

    if (!hostname) {
      return { valid: false, reason: 'Invalid URL hostname' };
    }

    for (const pattern of allowlist) {
      // Exact match
      if (pattern === hostname || pattern === parsed.host) {
        return { valid: true };
      }

      // Wildcard match: *.example.com
      if (pattern.startsWith('*.')) {
        const domain = pattern.slice(2);
        if (hostname === domain || hostname.endsWith(`.${domain}`)) {
          return { valid: true };
        }
      }

      // Regex match: ^https://api\.example\.com/.*
      if (pattern.startsWith('^') || pattern.includes('$') || pattern.includes('.*')) {
        try {
          const regex = new RegExp(pattern);
          if (regex.test(url)) {
            return { valid: true };
          }
        } catch {
          // Invalid regex, continue
        }
      }
    }

    return { valid: false, reason: `Domain ${hostname} not in allowlist` };
  } catch (err) {
    return { valid: false, reason: `Invalid URL: ${err instanceof Error ? err.message : String(err)}` };
  }
}

/**
 * Extract text content from HTML
 */
export function extractTextContent(html: string, maxLength: number = 8192): string {
  try {
    const doc = parseDocument(html);
    const textParts: string[] = [];

    const traverse = (node: any): void => {
      if (node.type === 'text') {
        const text = node.data?.trim();
        if (text) {
          textParts.push(text);
        }
      } else if (node.type === 'tag') {
        // Skip script and style tags
        if (node.name !== 'script' && node.name !== 'style') {
          if (node.children) {
            for (const child of node.children) {
              traverse(child);
            }
          }
        }
      }
    };

    for (const child of doc.children) {
      traverse(child);
    }

    const fullText = textParts.join(' ').replace(/\s+/g, ' ').trim();
    return fullText.slice(0, maxLength);
  } catch (err) {
    return '';
  }
}

/**
 * Extract metadata from HTML
 */
export function extractMetadata(html: string): {
  title?: string;
  description?: string;
  author?: string;
  favicon?: string;
  ogImage?: string;
  ogTitle?: string;
  ogDescription?: string;
} {
  try {
    const doc = parseDocument(html);
    const metadata: Record<string, string | undefined> = {};

    const traverse = (node: any): void => {
      if (node.type === 'tag') {
        // Extract from <title>
        if (node.name === 'title' && node.children?.[0]?.data) {
          metadata.title = node.children[0].data.trim();
        }

        // Extract from <meta> tags
        if (node.name === 'meta') {
          const name = node.attribs?.name?.toLowerCase();
          const property = node.attribs?.property?.toLowerCase();
          const content = node.attribs?.content;

          if (name === 'description') metadata.description = content;
          if (name === 'author') metadata.author = content;
          if (property === 'og:image') metadata.ogImage = content;
          if (property === 'og:title') metadata.ogTitle = content;
          if (property === 'og:description') metadata.ogDescription = content;
        }

        // Extract favicon
        if (node.name === 'link') {
          const rel = node.attribs?.rel?.toLowerCase();
          if ((rel === 'icon' || rel === 'shortcut icon') && node.attribs?.href) {
            metadata.favicon = node.attribs.href;
          }
        }

        if (node.children) {
          for (const child of node.children) {
            traverse(child);
          }
        }
      }
    };

    for (const child of doc.children) {
      traverse(child);
    }

    return {
      title: metadata.title,
      description: metadata.description,
      author: metadata.author,
      favicon: metadata.favicon,
      ogImage: metadata.ogImage,
      ogTitle: metadata.ogTitle,
      ogDescription: metadata.ogDescription,
    };
  } catch (err) {
    return {};
  }
}

/**
 * Normalize URL for caching (remove fragments, normalize query params)
 */
export function normalizeUrlForCache(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = ''; // Remove fragment

    // Sort query params for consistency
    const params = new URLSearchParams(parsed.search);
    const sorted = new URLSearchParams([...params].sort());
    parsed.search = sorted.toString();

    return parsed.toString();
  } catch {
    return url;
  }
}

/**
 * Fetch web content with allowlist validation and proxy support
 */
export async function fetchWebContent(
  url: string,
  options?: {
    allowlist?: string[];
    proxy?: string;
    timeout?: number;
    maxContentLength?: number;
    extractHtml?: boolean;
    cache?: Map<string, CacheEntry>;
    cacheTtlSeconds?: number;
    maxRedirects?: number;
    allowPrivateHosts?: boolean;
  },
): Promise<WebFetchResult> {
  const allowPrivateHosts = options?.allowPrivateHosts === true;
  const maxRedirects = Math.min(10, Math.max(0, Number(options?.maxRedirects ?? 5) || 5));
  await assertSafeFetchUrl(url, allowPrivateHosts);

  // Check cache
  const cacheKey = normalizeUrlForCache(url);
  if (options?.cache) {
    const cached = options.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return { ...cached.result, fromCache: true };
    }
    if (cached) {
      options.cache.delete(cacheKey);
    }
  }

  const controller = new AbortController();
  const timeout = options?.timeout || 30000;
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const headers: Record<string, string> = {
      'User-Agent': getRandomUserAgent(),
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate',
    };

    const fetchOptions: RequestInit = {
      method: 'GET',
      headers,
      signal: controller.signal,
    };

    if (options?.proxy) {
      // Note: Node.js fetch doesn't support proxy natively
      // This would require node-fetch or similar with proxy-agent
      // For now, proxy is handled at the gateway level
    }

    const { response, finalUrl } = await fetchWithSsrfGuards(
      url,
      fetchOptions,
      allowPrivateHosts,
      options?.allowlist,
      maxRedirects,
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || 'text/html';
    const charset = contentType.includes('charset=') ? contentType.split('charset=')[1] : 'utf-8';

    let html = '';
    const buffer = await readResponseBufferWithinLimit(response, options?.maxContentLength);
    const contentLength = buffer.byteLength;

    // Convert buffer to string
    const decoder = new TextDecoder(charset);
    html = decoder.decode(buffer);

    const metadata = extractMetadata(html);
    const textContent = extractTextContent(html);

    const fetchedAt = new Date().toISOString();
    const cacheExpiry = options?.cacheTtlSeconds
      ? new Date(Date.now() + options.cacheTtlSeconds * 1000).toISOString()
      : undefined;

    const result: WebFetchResult = {
      url: finalUrl,
      status: response.status,
      contentType,
      charset,
      title: metadata.title,
      description: metadata.description,
      author: metadata.author,
      favicon: metadata.favicon,
      ogImage: metadata.ogImage,
      ogTitle: metadata.ogTitle,
      ogDescription: metadata.ogDescription,
      textContent,
      htmlContent: options?.extractHtml ? html.slice(0, 65536) : undefined,
      contentLength,
      fetchedAt,
      fromCache: false,
      cacheExpiry,
    };

    // Store in cache
    if (options?.cache && options.cacheTtlSeconds) {
      options.cache.set(cacheKey, {
        url: cacheKey,
        result,
        expiresAt: Date.now() + options.cacheTtlSeconds * 1000,
      });
    }

    return result;
  } finally {
    clearTimeout(timer);
  }
}

async function readResponseBufferWithinLimit(response: Response, maxContentLength?: number): Promise<ArrayBuffer> {
  if (response.body) {
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = value || new Uint8Array();
        total += chunk.byteLength;
        if (maxContentLength && total > maxContentLength) {
          try {
            await reader.cancel('max_content_length exceeded');
          } catch {
            // best-effort cancel for oversized response
          }
          throw new Error(`Content too large: ${total} bytes (max ${maxContentLength})`);
        }
        chunks.push(chunk);
      }
    } finally {
      reader.releaseLock();
    }

    const merged = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return merged.buffer;
  }

  const buffered = await response.arrayBuffer();
  if (maxContentLength && buffered.byteLength > maxContentLength) {
    throw new Error(`Content too large: ${buffered.byteLength} bytes (max ${maxContentLength})`);
  }
  return buffered;
}

/**
 * Get random user agent for requests
 */
function getRandomUserAgent(): string {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
  ];

  return userAgents[Math.floor(Math.random() * userAgents.length)];
}
