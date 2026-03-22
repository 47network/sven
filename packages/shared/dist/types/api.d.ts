/**
 * Shared API response types.
 */
export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: ApiError;
    meta?: PaginationMeta;
}
export interface ApiError {
    code: string;
    message: string;
    details?: Record<string, unknown>;
}
export interface PaginationMeta {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
}
export interface HealthStatus {
    status: 'healthy' | 'degraded' | 'unhealthy';
    service: string;
    version: string;
    uptime_seconds: number;
    checks: HealthCheck[];
}
export interface HealthCheck {
    name: string;
    status: 'pass' | 'fail' | 'warn';
    message?: string;
    duration_ms?: number;
}
/** Decision explanation returned by the policy engine */
export interface PolicyDecision {
    allowed: boolean;
    scope: string;
    reason: string;
    matching_rules: Array<{
        id: string;
        effect: 'allow' | 'deny';
        source: string;
    }>;
    requires_approval: boolean;
    approval_quorum?: number;
    approval_expires_in_ms?: number;
}
export type ThinkingLevel = 'off' | 'low' | 'medium' | 'high';
export interface AgentRoutingRule {
    id: string;
    agent_id: string;
    channel: string | null;
    account_id: string | null;
    peer: string | null;
    enabled: boolean;
    created_at: string;
    updated_at: string;
}
export interface AgentSummary {
    id: string;
    name: string;
    status: string;
    model?: string | null;
    capabilities?: string[];
}
export interface McpServer {
    id: string;
    name: string;
    transport: 'stdio' | 'sse' | 'http';
    url: string;
    status?: string;
    capabilities_json?: Record<string, unknown>;
    last_connected?: string | null;
}
export interface McpToolCatalogEntry {
    id: string;
    server_id: string;
    tool_name: string;
    qualified_name: string;
    description?: string | null;
    input_schema: Record<string, unknown>;
    updated_at: string;
}
export interface SoulRegistryEntry {
    slug: string;
    name: string;
    version: string;
    description?: string;
    publisher?: string;
    signature_fingerprint?: string | null;
}
export interface SoulInstallResult {
    install_id: string;
    slug: string;
    version: string;
    status: 'installed' | 'activated' | 'failed';
}
//# sourceMappingURL=api.d.ts.map