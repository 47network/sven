export type HealthState = 'online' | 'degraded' | 'offline';
export type RuntimeSignal = {
    health: HealthState;
    source: string;
    message: string;
};
export type RuntimeReporter = (next: RuntimeSignal) => void;
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type ApiErrorCode = 'NETWORK' | 'TIMEOUT' | 'AUTH' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT' | 'RATE_LIMIT' | 'VALIDATION' | 'SERVER' | 'CIRCUIT_OPEN' | 'UNKNOWN';
export declare class SvenApiError extends Error {
    status: number;
    code: ApiErrorCode;
    body: unknown;
    constructor(status: number, code: ApiErrorCode, body: unknown, message?: string);
}
export type SvenHttpClientConfig = {
    baseUrl: string;
    credentials?: 'omit' | 'same-origin' | 'include';
    defaultHeaders?: Record<string, string>;
    maxRetries?: number;
    retryBaseDelayMs?: number;
    timeoutMs?: number;
    circuitFailureThreshold?: number;
    circuitOpenMs?: number;
    shouldAttemptRefresh?: (path: string) => boolean;
    refreshSession?: () => Promise<boolean>;
    runtimeReporter?: RuntimeReporter | null;
};
type RequestOptions = {
    idempotencyKey?: string | boolean;
    noRetry?: boolean;
};
export declare function createSvenHttpClient(initialConfig: SvenHttpClientConfig): {
    setRuntimeReporter: (next: RuntimeReporter | null) => void;
    request: <T>(method: HttpMethod, path: string, body?: unknown, options?: RequestOptions) => Promise<T>;
};
export {};
//# sourceMappingURL=http-client.d.ts.map