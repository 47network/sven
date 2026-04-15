/**
 * Sven API Client — connects to the Sven gateway API
 * for fetching soul content and chatting with Sven's brain.
 * Uses Node.js http/https modules (always available in VS Code extension host).
 */

import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';

interface SvenConfig {
  gatewayUrl: string;
  apiKey: string;
}

export class SvenApiClient {
  private getConfig: () => SvenConfig;

  constructor(getConfig: () => SvenConfig) {
    this.getConfig = getConfig;
  }

  private httpRequest(url: string, method: string, headers: Record<string, string>, body?: string): Promise<{ status: number; body: string }> {
    return new Promise((resolve, reject) => {
      const parsed = new URL(url);
      const isHttps = parsed.protocol === 'https:';
      const mod = isHttps ? https : http;

      const req = mod.request({
        hostname: parsed.hostname,
        port: parsed.port || (isHttps ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method,
        headers,
        timeout: 90_000,
      }, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf-8') });
        });
      });

      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });

      if (body) {
        req.write(body);
      }
      req.end();
    });
  }

  private async request<T>(path: string, options?: { method?: string; body?: string }): Promise<T> {
    const config = this.getConfig();
    const url = `${config.gatewayUrl.replace(/\/$/, '')}${path}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Sven-Api-Key': config.apiKey,
    };

    const res = await this.httpRequest(url, options?.method || 'GET', headers, options?.body);

    if (res.status < 200 || res.status >= 300) {
      throw new Error(`Sven API ${res.status}: ${res.body || 'Unknown error'}`);
    }

    const json = JSON.parse(res.body) as { success: boolean; data?: T; error?: { message: string } };
    if (!json.success) {
      throw new Error(json.error?.message || 'Unknown API error');
    }
    return json.data as T;
  }

  /** Chat with Sven's actual brain on GPU */
  async chat(prompt: string, history?: Array<{ role: string; content: string }>): Promise<{ response: string; model: string; node: string }> {
    return this.request('/v1/ext/sven/chat', {
      method: 'POST',
      body: JSON.stringify({ prompt, history }),
    });
  }

  /** Get Sven's soul + live status in one call */
  async getContext(): Promise<{
    soul: string;
    status: {
      state: string;
      loopRunning: boolean;
      loopIterations: number;
    };
  }> {
    return this.request('/v1/ext/sven/context');
  }

  /** Stream chat with Sven's brain — returns tokens via callback */
  chatStream(
    prompt: string,
    onToken: (token: string) => void,
    onDone: (meta: { model: string; node: string }) => void,
    onError: (err: Error) => void,
    history?: Array<{ role: string; content: string }>,
  ): { abort: () => void } {
    const config = this.getConfig();
    const url = `${config.gatewayUrl.replace(/\/$/, '')}/v1/ext/sven/chat/stream`;
    const parsed = new URL(url);
    const isHttps = parsed.protocol === 'https:';
    const mod = isHttps ? https : http;
    let aborted = false;
    let model = '';
    let node = '';

    const payload = JSON.stringify({ prompt, history });

    const req = mod.request({
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sven-Api-Key': config.apiKey,
        'Accept': 'text/event-stream',
      },
      timeout: 120_000,
    }, (res) => {
      if (res.statusCode !== 200) {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf-8');
          onError(new Error(`Sven stream ${res.statusCode}: ${body}`));
        });
        return;
      }

      let buffer = '';
      res.on('data', (chunk: Buffer) => {
        if (aborted) { return; }
        buffer += chunk.toString('utf-8');
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) { continue; }
          const json = line.slice(6).trim();
          if (!json) { continue; }
          try {
            const parsed = JSON.parse(json) as { type: string; content?: string; model?: string; node?: string; message?: string };
            if (parsed.type === 'meta') {
              model = parsed.model || '';
              node = parsed.node || '';
            } else if (parsed.type === 'token' && parsed.content) {
              onToken(parsed.content);
            } else if (parsed.type === 'done') {
              onDone({ model, node });
            } else if (parsed.type === 'error') {
              onError(new Error(parsed.message || 'Stream error'));
            }
          } catch { /* skip malformed SSE frames */ }
        }
      });

      res.on('end', () => {
        if (!aborted) { onDone({ model, node }); }
      });

      res.on('error', (err: Error) => {
        if (!aborted) { onError(err); }
      });
    });

    req.on('error', (err: Error) => {
      if (!aborted) { onError(err); }
    });
    req.on('timeout', () => {
      req.destroy();
      if (!aborted) { onError(new Error('Stream timed out')); }
    });

    req.write(payload);
    req.end();

    return {
      abort: () => {
        aborted = true;
        req.destroy();
      },
    };
  }

  /** Legacy: get active soul */
  async getActiveSoul(): Promise<{ slug: string; version: string; content: string }> {
    return this.request('/v1/admin/souls/installed');
  }

  async analyzeForImprovement(focus?: string, codeSnippet?: string): Promise<{
    analysis: string;
    model: string;
    node: string;
    metrics: {
      loopIterations: number;
      learningIterations: number;
      learnedPatterns: number;
    };
  }> {
    return this.request('/v1/ext/sven/improve', {
      method: 'POST',
      body: JSON.stringify({ focus, codeSnippet }),
    });
  }
}
