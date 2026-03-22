import { describe, expect, it } from '@jest/globals';
import { classifyError, classifyToolResult } from '../error-classifier.js';

describe('Error Classifier', () => {
  describe('classifyError', () => {
    // ── Transient errors ──
    it('classifies ECONNRESET as transient', () => {
      const result = classifyError('web.fetch', 1, '', 'Error: read ECONNRESET');
      expect(result.classification).toBe('transient');
    });

    it('classifies ETIMEDOUT as transient', () => {
      const result = classifyError('web.fetch', 1, '', 'Error: connect ETIMEDOUT 1.2.3.4:443');
      expect(result.classification).toBe('transient');
    });

    it('classifies 503 Service Unavailable as transient', () => {
      const result = classifyError('web.fetch', null, '503 Service Unavailable', null);
      expect(result.classification).toBe('transient');
    });

    it('classifies 429 Too Many Requests as transient', () => {
      const result = classifyError('api.call', null, '429 Too Many Requests', null);
      expect(result.classification).toBe('transient');
    });

    it('classifies rate limit error as transient', () => {
      const result = classifyError('api.call', null, '', 'Rate limit exceeded. Try again in 30s');
      expect(result.classification).toBe('transient');
    });

    it('classifies 502 Bad Gateway as transient', () => {
      const result = classifyError('web.fetch', null, '502 Bad Gateway', null);
      expect(result.classification).toBe('transient');
    });

    it('classifies exit code 124 (timeout) as transient', () => {
      const result = classifyError('shell.exec', 124, '', null);
      expect(result.classification).toBe('transient');
    });

    // ── Fatal errors ──
    it('classifies 401 Unauthorized as fatal', () => {
      const result = classifyError('api.call', null, '401 Unauthorized', null);
      expect(result.classification).toBe('fatal');
    });

    it('classifies 403 Forbidden as fatal', () => {
      const result = classifyError('api.call', null, '403 Forbidden', null);
      expect(result.classification).toBe('fatal');
    });

    it('classifies invalid API key as fatal', () => {
      const result = classifyError('api.call', null, '', 'Invalid API key provided');
      expect(result.classification).toBe('fatal');
    });

    it('classifies permission denied as fatal', () => {
      const result = classifyError('file.read', null, '', 'Permission denied');
      expect(result.classification).toBe('fatal');
    });

    it('classifies exit code 137 (OOM) as fatal', () => {
      const result = classifyError('process.run', 137, '', null);
      expect(result.classification).toBe('fatal');
    });

    it('classifies kill switch as fatal', () => {
      const result = classifyError('ha.write', null, '', 'Kill switch active');
      expect(result.classification).toBe('fatal');
    });

    // ── Strategy errors ──
    it('classifies 404 Not Found as strategy', () => {
      const result = classifyError('web.fetch', null, '404 Not Found', null);
      expect(result.classification).toBe('strategy');
    });

    it('classifies file not found as strategy', () => {
      const result = classifyError('file.read', 1, '', 'Error: ENOENT: no such file or directory');
      expect(result.classification).toBe('strategy');
    });

    it('classifies command not found as strategy', () => {
      const result = classifyError('shell.exec', 127, 'bash: foobar: command not found', null);
      expect(result.classification).toBe('strategy');
    });

    it('classifies 400 Bad Request as strategy', () => {
      const result = classifyError('api.call', null, '400 Bad Request: invalid parameter', null);
      expect(result.classification).toBe('strategy');
    });

    it('classifies empty output as strategy', () => {
      const result = classifyError('search.web', null, '', null);
      expect(result.classification).toBe('strategy');
      expect(result.errorDetail).toBe('Tool returned no output');
    });

    it('classifies exit code 2 (misuse) as strategy', () => {
      const result = classifyError('shell.exec', 2, '', 'invalid option');
      expect(result.classification).toBe('strategy');
    });

    it('classifies syntax error as strategy', () => {
      const result = classifyError('code.run', 1, '', 'SyntaxError: Unexpected token');
      expect(result.classification).toBe('strategy');
    });

    // ── Stack trace detection ──
    it('detects JavaScript stack traces', () => {
      const stack = 'TypeError: Cannot read property "foo" of undefined\n    at Object.<anonymous> (/app/index.js:10:5)';
      const result = classifyError('code.run', 1, stack, null);
      expect(result.hasStackTrace).toBe(true);
    });

    it('detects Python stack traces', () => {
      const stack = 'Traceback (most recent call last):\n  File "script.py", line 42, in <module>';
      const result = classifyError('code.run', 1, stack, null);
      expect(result.hasStackTrace).toBe(true);
    });

    // ── Error detail extraction ──
    it('extracts error detail from output', () => {
      const result = classifyError('web.fetch', null, 'Error: 404 Not Found\nPage does not exist', null);
      expect(result.errorDetail).toContain('does not exist');
    });
  });

  describe('classifyToolResult', () => {
    it('returns null for success status', () => {
      expect(classifyToolResult('tool', 'success', {}, null)).toBeNull();
    });

    it('returns null for completed status', () => {
      expect(classifyToolResult('tool', 'completed', {}, null)).toBeNull();
    });

    it('returns null for running status', () => {
      expect(classifyToolResult('tool', 'running', undefined, null)).toBeNull();
    });

    it('classifies denied as fatal', () => {
      const result = classifyToolResult('tool', 'denied', undefined, 'Denied by policy');
      expect(result?.classification).toBe('fatal');
    });

    it('classifies timeout as transient', () => {
      const result = classifyToolResult('tool', 'timeout', undefined, 'Execution timed out');
      expect(result?.classification).toBe('transient');
    });

    it('classifies error with exit code in outputs', () => {
      const result = classifyToolResult('shell.exec', 'error', { exit_code: 127 }, 'command not found');
      expect(result?.classification).toBe('strategy');
    });

    it('classifies error with network failure', () => {
      const result = classifyToolResult('web.fetch', 'error', {}, 'Error: ECONNREFUSED 127.0.0.1:8080');
      expect(result?.classification).toBe('transient');
    });
  });
});
