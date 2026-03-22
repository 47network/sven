/**
 * Web Fetch Integration
 *
 * Handles allowlist-based web fetching with HTML text extraction,
 * metadata extraction, caching, and egress proxy enforcement.
 */
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
/**
 * Validates domain against allowlist patterns
 * Supports:
 * - exact: example.com
 * - wildcard: *.example.com
 * - regex: ^https://api\.example\.com/.*
 */
export declare function validateDomainAllowlist(url: string, allowlist: string[]): {
    valid: boolean;
    reason?: string;
};
/**
 * Extract text content from HTML
 */
export declare function extractTextContent(html: string, maxLength?: number): string;
/**
 * Extract metadata from HTML
 */
export declare function extractMetadata(html: string): {
    title?: string;
    description?: string;
    author?: string;
    favicon?: string;
    ogImage?: string;
    ogTitle?: string;
    ogDescription?: string;
};
/**
 * Normalize URL for caching (remove fragments, normalize query params)
 */
export declare function normalizeUrlForCache(url: string): string;
/**
 * Fetch web content with allowlist validation and proxy support
 */
export declare function fetchWebContent(url: string, options?: {
    allowlist?: string[];
    proxy?: string;
    timeout?: number;
    maxContentLength?: number;
    extractHtml?: boolean;
    cache?: Map<string, CacheEntry>;
    cacheTtlSeconds?: number;
    maxRedirects?: number;
    allowPrivateHosts?: boolean;
}): Promise<WebFetchResult>;
//# sourceMappingURL=web.d.ts.map