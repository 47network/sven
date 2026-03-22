export type HealthState = 'online' | 'degraded' | 'offline';

export type RuntimeSignal = {
  health: HealthState;
  source: string;
  message: string;
};

export type RuntimeReporter = (next: RuntimeSignal) => void;

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type ApiErrorCode =
  | 'NETWORK'
  | 'TIMEOUT'
  | 'AUTH'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMIT'
  | 'VALIDATION'
  | 'SERVER'
  | 'CIRCUIT_OPEN'
  | 'UNKNOWN';

export class SvenApiError extends Error {
  constructor(
    public status: number,
    public code: ApiErrorCode,
    public body: unknown,
    message?: string,
  ) {
    super(message || `API ${status}`);
    this.name = 'SvenApiError';
  }
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function classifyStatus(status: number): ApiErrorCode {
  if (status === 401) return 'AUTH';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  if (status === 409) return 'CONFLICT';
  if (status === 429) return 'RATE_LIMIT';
  if (status >= 400 && status < 500) return 'VALIDATION';
  if (status >= 500) return 'SERVER';
  return 'UNKNOWN';
}

function isIdempotentMethod(method: HttpMethod): boolean {
  return method === 'GET' || method === 'PUT' || method === 'DELETE';
}

function parseRetryAfterMs(value: string | null): number | null {
  if (!value) return null;
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric >= 0) {
    return numeric * 1000;
  }
  const asDate = new Date(value);
  const diff = asDate.getTime() - Date.now();
  if (Number.isFinite(diff) && diff > 0) return diff;
  return null;
}

function safeParseJson(text: string): unknown {
  if (!text) return '';
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export function createSvenHttpClient(initialConfig: SvenHttpClientConfig) {
  const config: Required<
    Pick<
      SvenHttpClientConfig,
      | 'baseUrl'
      | 'credentials'
      | 'defaultHeaders'
      | 'maxRetries'
      | 'retryBaseDelayMs'
      | 'timeoutMs'
      | 'circuitFailureThreshold'
      | 'circuitOpenMs'
    >
  > & {
    shouldAttemptRefresh?: SvenHttpClientConfig['shouldAttemptRefresh'];
    refreshSession?: SvenHttpClientConfig['refreshSession'];
  } = {
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

  let runtimeReporter: RuntimeReporter | null = initialConfig.runtimeReporter ?? null;
  let consecutiveFailures = 0;
  let circuitOpenUntil = 0;

  function report(next: RuntimeSignal) {
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

  function setRuntimeReporter(next: RuntimeReporter | null) {
    runtimeReporter = next;
  }

  async function doFetch(path: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
    try {
      return await fetch(`${config.baseUrl}${path}`, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
  }

  async function request<T>(
    method: HttpMethod,
    path: string,
    body?: unknown,
    options?: RequestOptions,
  ): Promise<T> {
    if (circuitOpenUntil > Date.now()) {
      report({
        health: 'degraded',
        source: 'api',
        message: 'Circuit breaker open. Waiting before retrying upstream.',
      });
      throw new SvenApiError(503, 'CIRCUIT_OPEN', null, 'Service temporarily degraded');
    }

    const headers: Record<string, string> = { ...config.defaultHeaders };
    if (options?.idempotencyKey) {
      headers['Idempotency-Key'] =
        typeof options.idempotencyKey === 'string'
          ? options.idempotencyKey
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }

    const init: RequestInit = {
      method,
      credentials: config.credentials,
      headers,
    };
    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }

    const allowRetry =
      !options?.noRetry && (isIdempotentMethod(method) || Boolean(options?.idempotencyKey));
    let attempt = 0;
    let response: Response | null = null;
    let lastNetworkError: unknown = null;

    while (attempt <= config.maxRetries) {
      try {
        response = await doFetch(path, init);
      } catch (err) {
        lastNetworkError = err;
        recordFailure();
        report({
          health: 'offline',
          source: 'api',
          message: `Network request failed: ${String(path)}`,
        });
        if (!allowRetry || attempt >= config.maxRetries) {
          const code = String((err as any)?.name || '').toLowerCase().includes('abort')
            ? 'TIMEOUT'
            : 'NETWORK';
          throw new SvenApiError(0, code, null, String((err as any)?.message || 'Network error'));
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
          } catch (err) {
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
        throw new SvenApiError(
          response.status,
          classifyStatus(response.status),
          parsed,
          `Request failed (${response.status})`,
        );
      }

      recordSuccess();
      report({
        health: 'online',
        source: 'api',
        message: 'Gateway responsive.',
      });

      if (response.status === 204) return undefined as T;
      return response.json() as Promise<T>;
    }

    const fallbackMessage = String((lastNetworkError as any)?.message || 'Request failed');
    throw new SvenApiError(0, 'UNKNOWN', null, fallbackMessage);
  }

  return {
    setRuntimeReporter,
    request,
  };
}
