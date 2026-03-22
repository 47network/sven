import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { createLogger, setLoggerRedactionConfig } from '../../../../packages/shared/src/logger';

describe('logger redaction', () => {
  afterEach(() => {
    setLoggerRedactionConfig(null);
    jest.restoreAllMocks();
  });

  it('unit: API key in log output is redacted', () => {
    setLoggerRedactionConfig({ redactSensitive: true, patterns: [] });
    const logger = createLogger('test-logger');
    let line = '';
    jest.spyOn(process.stdout, 'write').mockImplementation(((chunk: any) => {
      line += String(chunk);
      return true;
    }) as any);

    logger.info('token event', {
      api_key: 'sk-supersecretabcdefghijklmnopqrstuvwxyz',
      note: 'contact dev@example.com',
      auth: 'Bearer top-secret-token-value',
    });

    const payload = JSON.parse(line.trim());
    expect(payload.api_key).toBe('[REDACTED]');
    expect(String(payload.note)).toContain('[REDACTED]');
    expect(String(payload.auth)).toContain('[REDACTED]');
  });

  it('unit: custom pattern matches and redacts', () => {
    setLoggerRedactionConfig({
      redactSensitive: false,
      patterns: ['tenant-[0-9]{4}'],
    });
    const logger = createLogger('test-logger');
    let line = '';
    jest.spyOn(process.stdout, 'write').mockImplementation(((chunk: any) => {
      line += String(chunk);
      return true;
    }) as any);

    logger.info('custom redact', { value: 'tenant-1234 should be hidden' });
    const payload = JSON.parse(line.trim());
    expect(payload.value).toContain('[REDACTED]');
    expect(payload.value).not.toContain('tenant-1234');
  });
});
