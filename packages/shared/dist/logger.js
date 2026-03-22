/**
 * Structured JSON logger for all Sven services.
 * Wraps pino-style structured logging.
 */
const REDACTED = '[REDACTED]';
const SENSITIVE_KEY_PATTERN = /(password|passphrase|token|secret|api[_-]?key|authorization|cookie|private[_-]?key|access[_-]?key)/i;
const BUILTIN_REDACTION_PATTERNS = [
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    /\b(?:\d[ -]*?){13,19}\b/g,
    /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
    /\bsk-[a-z0-9_-]{16,}\b/gi,
    /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g,
    /\bAKIA[0-9A-Z]{16}\b/g,
    /\b(?:xox[baprs]|xoxe)-[A-Za-z0-9-]{10,}\b/g,
    /\bBearer\s+[A-Za-z0-9._-]+\b/gi,
];
let overrideRedactionConfig = null;
const LOG_LEVEL_ORDER = {
    debug: 10,
    info: 20,
    warn: 30,
    error: 40,
    fatal: 50,
};
function resolveMinLogLevel() {
    const raw = String(process.env.LOG_LEVEL || 'info').trim().toLowerCase();
    if (raw === 'debug' || raw === 'info' || raw === 'warn' || raw === 'error' || raw === 'fatal') {
        return raw;
    }
    return 'info';
}
function parseBooleanEnv(value, fallback) {
    if (value === undefined)
        return fallback;
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized))
        return true;
    if (['0', 'false', 'no', 'off'].includes(normalized))
        return false;
    return fallback;
}
function parseCustomPatterns(raw) {
    if (!raw || !raw.trim())
        return [];
    let patterns = [];
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            patterns = parsed.map((entry) => String(entry || '')).filter(Boolean);
        }
    }
    catch {
        patterns = raw.split(',').map((entry) => entry.trim()).filter(Boolean);
    }
    const out = [];
    for (const pattern of patterns) {
        try {
            out.push(new RegExp(pattern, 'gi'));
        }
        catch {
            // Ignore invalid regex patterns.
        }
    }
    return out;
}
function currentRedactionConfig() {
    if (overrideRedactionConfig)
        return overrideRedactionConfig;
    return {
        redactSensitive: parseBooleanEnv(process.env.LOGGING_REDACT_SENSITIVE, true),
        customPatterns: parseCustomPatterns(process.env.LOGGING_REDACT_PATTERNS),
    };
}
export function setLoggerRedactionConfig(config) {
    if (!config) {
        overrideRedactionConfig = null;
        return;
    }
    const patterns = Array.isArray(config.patterns)
        ? config.patterns
            .map((pattern) => String(pattern || '').trim())
            .filter(Boolean)
            .flatMap((pattern) => {
            try {
                return [new RegExp(pattern, 'gi')];
            }
            catch {
                return [];
            }
        })
        : [];
    overrideRedactionConfig = {
        redactSensitive: config.redactSensitive ?? true,
        customPatterns: patterns,
    };
}
function redactStringValue(value, config) {
    let redacted = value;
    if (config.redactSensitive) {
        for (const pattern of BUILTIN_REDACTION_PATTERNS) {
            redacted = redacted.replace(pattern, REDACTED);
        }
    }
    for (const pattern of config.customPatterns) {
        redacted = redacted.replace(pattern, REDACTED);
    }
    return redacted;
}
function redactUnknownValue(value, config) {
    if (value === null || value === undefined)
        return value;
    if (typeof value === 'string')
        return redactStringValue(value, config);
    if (typeof value === 'number' || typeof value === 'boolean')
        return value;
    if (Array.isArray(value))
        return value.map((entry) => redactUnknownValue(entry, config));
    if (typeof value === 'object') {
        const out = {};
        for (const [key, nested] of Object.entries(value)) {
            if (config.redactSensitive && SENSITIVE_KEY_PATTERN.test(key)) {
                out[key] = REDACTED;
            }
            else {
                out[key] = redactUnknownValue(nested, config);
            }
        }
        return out;
    }
    return value;
}
export function redactLogEntry(entry) {
    const config = currentRedactionConfig();
    if (!config.redactSensitive && config.customPatterns.length === 0)
        return entry;
    return redactUnknownValue(entry, config);
}
export function createLogger(service) {
    const minLevel = resolveMinLogLevel();
    const log = (level, msg, extra) => {
        if (LOG_LEVEL_ORDER[level] < LOG_LEVEL_ORDER[minLevel])
            return;
        const entry = redactLogEntry({
            level,
            ts: new Date().toISOString(),
            service,
            msg,
            ...extra,
        });
        const line = JSON.stringify(entry);
        if (level === 'error' || level === 'fatal') {
            process.stderr.write(line + '\n');
        }
        else {
            process.stdout.write(line + '\n');
        }
    };
    return {
        debug: (msg, extra) => log('debug', msg, extra),
        info: (msg, extra) => log('info', msg, extra),
        warn: (msg, extra) => log('warn', msg, extra),
        error: (msg, extra) => log('error', msg, extra),
        fatal: (msg, extra) => log('fatal', msg, extra),
    };
}
//# sourceMappingURL=logger.js.map