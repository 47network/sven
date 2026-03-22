export class SvenApiError extends Error {
    status;
    code;
    body;
    constructor(status, code, body, message) {
        super(message || `API ${status}`);
        this.status = status;
        this.code = code;
        this.body = body;
        this.name = 'SvenApiError';
    }
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function classifyStatus(status) {
    if (status === 401)
        return 'AUTH';
    if (status === 403)
        return 'FORBIDDEN';
    if (status === 404)
        return 'NOT_FOUND';
    if (status === 409)
        return 'CONFLICT';
    if (status === 429)
        return 'RATE_LIMIT';
    if (status >= 400 && status < 500)
        return 'VALIDATION';
    if (status >= 500)
        return 'SERVER';
    return 'UNKNOWN';
}
function isIdempotentMethod(method) {
    return method === 'GET' || method === 'PUT' || method === 'DELETE';
}
function parseRetryAfterMs(value) {
    if (!value)
        return null;
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric >= 0) {
        return numeric * 1000;
    }
    const asDate = new Date(value);
    const diff = asDate.getTime() - Date.now();
    if (Number.isFinite(diff) && diff > 0)
        return diff;
    return null;
}
function safeParseJson(text) {
    if (!text)
        return '';
    try {
        return JSON.parse(text);
    }
    catch {
        return text;
    }
}
export function createSvenHttpClient(initialConfig) {
    const config = {
        baseUrl: initialConfig.baseUrl,
        credentials: initialConfig.credentials ?? 'include',
        defaultHeaders: initialConfig.defaultHeaders ?? { 'Content-Type': 'application/json' },
        maxRetries: Math.max(0, initialConfig.maxRetries ?? 2),
        retryBaseDelayMs: Math.max(50, initialConfig.retryBaseDelayMs ?? 250),
        timeoutMs: Math.max(1000, initialConfig.timeoutMs ?? 10000),
        circuitFailureThreshold: Math.max(1, initialConfig.circuitFailureThreshold ?? 4),
        circuitOpenMs: Math.max(1000, initialConfig.circuitOpenMs ?? 10000),
        shouldAttemptRefresh: initialConfig.shouldAttemptRefresh,
        refreshSession: initialConfig.refreshSession,
    };
    let runtimeReporter = initialConfig.runtimeReporter ?? null;
    let consecutiveFailures = 0;
    let circuitOpenUntil = 0;
    function report(next) {
        runtimeReporter?.(next);
    }
    function recordFailure() {
        consecutiveFailures += 1;
        if (consecutiveFailures >= config.circuitFailureThreshold) {
            circuitOpenUntil = Date.now() + config.circuitOpenMs;
        }
    }
    function recordSuccess() {
        consecutiveFailures = 0;
        circuitOpenUntil = 0;
    }
    function setRuntimeReporter(next) {
        runtimeReporter = next;
    }
    async function doFetch(path, init) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
        try {
            return await fetch(`${config.baseUrl}${path}`, { ...init, signal: controller.signal });
        }
        finally {
            clearTimeout(timeout);
        }
    }
    async function request(method, path, body, options) {
        if (circuitOpenUntil > Date.now()) {
            report({
                health: 'degraded',
                source: 'api',
                message: 'Circuit breaker open. Waiting before retrying upstream.',
            });
            throw new SvenApiError(503, 'CIRCUIT_OPEN', null, 'Service temporarily degraded');
        }
        const headers = { ...config.defaultHeaders };
        if (options?.idempotencyKey) {
            headers['Idempotency-Key'] =
                typeof options.idempotencyKey === 'string'
                    ? options.idempotencyKey
                    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        }
        const init = {
            method,
            credentials: config.credentials,
            headers,
        };
        if (body !== undefined) {
            init.body = JSON.stringify(body);
        }
        const allowRetry = !options?.noRetry && (isIdempotentMethod(method) || Boolean(options?.idempotencyKey));
        let attempt = 0;
        let response = null;
        let lastNetworkError = null;
        while (attempt <= config.maxRetries) {
            try {
                response = await doFetch(path, init);
            }
            catch (err) {
                lastNetworkError = err;
                recordFailure();
                report({
                    health: 'offline',
                    source: 'api',
                    message: `Network request failed: ${String(path)}`,
                });
                if (!allowRetry || attempt >= config.maxRetries) {
                    const code = String(err?.name || '').toLowerCase().includes('abort')
                        ? 'TIMEOUT'
                        : 'NETWORK';
                    throw new SvenApiError(0, code, null, String(err?.message || 'Network error'));
                }
                const delay = config.retryBaseDelayMs * Math.pow(2, attempt);
                await sleep(delay);
                attempt += 1;
                continue;
            }
            if (response.status === 401 && config.shouldAttemptRefresh?.(path) && config.refreshSession) {
                const refreshed = await config.refreshSession().catch(() => false);
                if (refreshed) {
                    try {
                        response = await doFetch(path, init);
                    }
                    catch (err) {
                        lastNetworkError = err;
                    }
                }
            }
            if (!response.ok) {
                const retryableStatus = response.status >= 500 || response.status === 429;
                if (retryableStatus) {
                    recordFailure();
                    report({
                        health: 'degraded',
                        source: 'api',
                        message: `Request ${path} failed (${response.status})`,
                    });
                }
                if (allowRetry && retryableStatus && attempt < config.maxRetries) {
                    const retryAfterMs = parseRetryAfterMs(response.headers.get('Retry-After'));
                    const backoff = config.retryBaseDelayMs * Math.pow(2, attempt);
                    await sleep(retryAfterMs ?? backoff);
                    attempt += 1;
                    continue;
                }
                const text = await response.text().catch(() => '');
                const parsed = safeParseJson(text);
                throw new SvenApiError(response.status, classifyStatus(response.status), parsed, `Request failed (${response.status})`);
            }
            recordSuccess();
            report({
                health: 'online',
                source: 'api',
                message: 'Gateway responsive.',
            });
            if (response.status === 204)
                return undefined;
            return response.json();
        }
        const fallbackMessage = String(lastNetworkError?.message || 'Request failed');
        throw new SvenApiError(0, 'UNKNOWN', null, fallbackMessage);
    }
    return {
        setRuntimeReporter,
        request,
    };
}
//# sourceMappingURL=http-client.js.map