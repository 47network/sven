/**
 * Error classification for self-correcting agent loop.
 *
 * - transient: Retry same tool call with same parameters (network blip, temp failure)
 * - strategy:  Re-prompt LLM with error context to try a different approach
 * - fatal:     Abort and report to user (unrecoverable)
 */
export type ErrorClassification = 'transient' | 'strategy' | 'fatal';

export interface ClassifiedError {
  classification: ErrorClassification;
  reason: string;
  /** Extracted error detail from the tool output */
  errorDetail: string;
  /** Whether the original error included a stack trace */
  hasStackTrace: boolean;
}

// ── Pattern sets ──

const TRANSIENT_PATTERNS = [
  /ECONNRESET/i,
  /ECONNREFUSED/i,
  /ETIMEDOUT/i,
  /ENETUNREACH/i,
  /EHOSTUNREACH/i,
  /socket hang up/i,
  /network timeout/i,
  /request timeout/i,
  /gateway timeout/i,
  /503 service unavailable/i,
  /502 bad gateway/i,
  /504 gateway timeout/i,
  /429 too many requests/i,
  /rate limit/i,
  /temporarily unavailable/i,
  /try again later/i,
  /connection reset/i,
  /connection timed out/i,
  /ENOTFOUND/i,
  /DNS lookup failed/i,
];

const FATAL_PATTERNS = [
  /401 unauthorized/i,
  /403 forbidden/i,
  /api key.*(invalid|expired|revoked)/i,
  /authentication failed/i,
  /permission denied/i,
  /access denied/i,
  /insufficient permissions/i,
  /quota exceeded/i,
  /account (suspended|disabled|deactivated)/i,
  /invalid api key/i,
  /token.*expired/i,
  /billing.*issue/i,
  /out of (memory|disk)/i,
  /ENOMEM/i,
  /ENOSPC/i,
  /kill switch/i,
  /lockdown mode/i,
];

const STRATEGY_INDICATORS = [
  /404 not found/i,
  /400 bad request/i,
  /422 unprocessable/i,
  /invalid (parameter|argument|input|path|url|format)/i,
  /no such file/i,
  /file not found/i,
  /command not found/i,
  /not found/i,
  /does not exist/i,
  /no results/i,
  /empty response/i,
  /unsupported/i,
  /unknown (tool|command|method)/i,
  /syntax error/i,
  /parse error/i,
  /type error/i,
  /reference error/i,
  /segmentation fault/i,
];

const STACK_TRACE_PATTERN = /at\s+\S+\s+\(.*:\d+:\d+\)|Traceback \(most recent|File ".*", line \d+/;

/**
 * Classify a tool execution error for the self-correction loop.
 */
export function classifyError(
  toolName: string,
  exitCode: number | null,
  output: string,
  error: string | null,
): ClassifiedError {
  const combined = `${output || ''}\n${error || ''}`.trim();
  const hasStackTrace = STACK_TRACE_PATTERN.test(combined);

  // Check fatal patterns first (auth, permissions, resource exhaustion)
  for (const pattern of FATAL_PATTERNS) {
    if (pattern.test(combined)) {
      return {
        classification: 'fatal',
        reason: `Fatal error detected: ${pattern.source}`,
        errorDetail: extractErrorDetail(combined),
        hasStackTrace,
      };
    }
  }

  // Check transient patterns (network, temporary failures)
  for (const pattern of TRANSIENT_PATTERNS) {
    if (pattern.test(combined)) {
      return {
        classification: 'transient',
        reason: `Transient error detected: ${pattern.source}`,
        errorDetail: extractErrorDetail(combined),
        hasStackTrace,
      };
    }
  }

  // Check strategy patterns (wrong input, not found, bad params)
  for (const pattern of STRATEGY_INDICATORS) {
    if (pattern.test(combined)) {
      return {
        classification: 'strategy',
        reason: `Strategy error detected: ${pattern.source}`,
        errorDetail: extractErrorDetail(combined),
        hasStackTrace,
      };
    }
  }

  // HTTP status code heuristics
  const httpMatch = combined.match(/\b([45]\d{2})\b/);
  if (httpMatch) {
    const code = parseInt(httpMatch[1], 10);
    if (code === 429 || code === 502 || code === 503 || code === 504) {
      return {
        classification: 'transient',
        reason: `HTTP ${code} detected`,
        errorDetail: extractErrorDetail(combined),
        hasStackTrace,
      };
    }
    if (code === 401 || code === 403) {
      return {
        classification: 'fatal',
        reason: `HTTP ${code} detected (auth/permission)`,
        errorDetail: extractErrorDetail(combined),
        hasStackTrace,
      };
    }
    if (code >= 400 && code < 500) {
      return {
        classification: 'strategy',
        reason: `HTTP ${code} detected (client error)`,
        errorDetail: extractErrorDetail(combined),
        hasStackTrace,
      };
    }
    if (code >= 500) {
      return {
        classification: 'transient',
        reason: `HTTP ${code} detected (server error)`,
        errorDetail: extractErrorDetail(combined),
        hasStackTrace,
      };
    }
  }

  // Exit code heuristics
  if (exitCode !== null && exitCode !== 0) {
    // Exit code 1 is generic — could be strategy (wrong args) or transient
    // Exit code 2 is typically misuse of command (strategy)
    // Exit codes 126/127 are command not found/permission (strategy/fatal)
    // Exit code 137 is OOM kill (fatal)
    // Exit code 124 is timeout (transient)
    if (exitCode === 124) {
      return {
        classification: 'transient',
        reason: 'Exit code 124 (timeout)',
        errorDetail: extractErrorDetail(combined),
        hasStackTrace,
      };
    }
    if (exitCode === 137) {
      return {
        classification: 'fatal',
        reason: 'Exit code 137 (OOM killed)',
        errorDetail: extractErrorDetail(combined),
        hasStackTrace,
      };
    }
    if (exitCode === 126 || exitCode === 127) {
      return {
        classification: 'strategy',
        reason: `Exit code ${exitCode} (command not found/not executable)`,
        errorDetail: extractErrorDetail(combined),
        hasStackTrace,
      };
    }
    // Generic non-zero exit — default to strategy (might need different approach)
    return {
      classification: 'strategy',
      reason: `Non-zero exit code: ${exitCode}`,
      errorDetail: extractErrorDetail(combined),
      hasStackTrace,
    };
  }

  // Empty output when content expected
  if (!output || output.trim().length === 0) {
    return {
      classification: 'strategy',
      reason: 'Empty output from tool',
      errorDetail: 'Tool returned no output',
      hasStackTrace: false,
    };
  }

  // Default: if we have an error string but no patterns matched, classify as strategy
  if (error) {
    return {
      classification: 'strategy',
      reason: 'Unclassified error',
      errorDetail: extractErrorDetail(combined),
      hasStackTrace,
    };
  }

  // No error detected
  return {
    classification: 'strategy',
    reason: 'Unknown error condition',
    errorDetail: extractErrorDetail(combined),
    hasStackTrace,
  };
}

/**
 * Classify a tool result event from NATS.
 */
export function classifyToolResult(
  toolName: string,
  status: string,
  outputs: Record<string, unknown> | undefined,
  error: string | null | undefined,
): ClassifiedError | null {
  // Success or running — no error to classify
  if (status === 'success' || status === 'completed' || status === 'running') {
    return null;
  }

  // Denied — this is a policy decision, not retryable
  if (status === 'denied') {
    return {
      classification: 'fatal',
      reason: 'Tool call denied by policy engine',
      errorDetail: error || 'Denied',
      hasStackTrace: false,
    };
  }

  // Timeout — transient by default
  if (status === 'timeout') {
    return {
      classification: 'transient',
      reason: 'Tool execution timed out',
      errorDetail: error || 'Timeout',
      hasStackTrace: false,
    };
  }

  // Error status — deep classify
  const outputStr = outputs ? JSON.stringify(outputs) : '';
  const exitCode = typeof outputs?.exit_code === 'number' ? outputs.exit_code : null;

  return classifyError(toolName, exitCode, outputStr, error || null);
}

/**
 * Extract a concise error detail from combined output.
 * Takes the last non-empty lines, strips stack traces, max 500 chars.
 */
function extractErrorDetail(combined: string): string {
  if (!combined) return '(no error detail)';

  const lines = combined.split('\n').filter((l) => l.trim().length > 0);
  // Take last 5 lines as error context
  const tail = lines.slice(-5).join('\n');

  if (tail.length <= 500) return tail;
  return tail.slice(0, 497) + '...';
}
