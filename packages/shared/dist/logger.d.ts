/**
 * Structured JSON logger for all Sven services.
 * Wraps pino-style structured logging.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';
export interface LogEntry {
    level: LogLevel;
    ts: string;
    service: string;
    msg: string;
    [key: string]: unknown;
}
export declare function setLoggerRedactionConfig(config: Partial<{
    redactSensitive: boolean;
    patterns: string[];
}> | null): void;
export declare function redactLogEntry(entry: LogEntry): LogEntry;
export declare function createLogger(service: string): {
    debug: (msg: string, extra?: Record<string, unknown>) => void;
    info: (msg: string, extra?: Record<string, unknown>) => void;
    warn: (msg: string, extra?: Record<string, unknown>) => void;
    error: (msg: string, extra?: Record<string, unknown>) => void;
    fatal: (msg: string, extra?: Record<string, unknown>) => void;
};
export type Logger = ReturnType<typeof createLogger>;
//# sourceMappingURL=logger.d.ts.map