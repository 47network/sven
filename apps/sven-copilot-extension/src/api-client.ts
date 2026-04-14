/**
 * Sven API Client — connects to the Sven gateway API
 * for fetching live trading status, soul content, and chatting with Sven's brain.
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
      activeSymbol: string | null;
      balance: number;
      dailyPnl: number;
      loopRunning: boolean;
      loopIterations: number;
      autoTradeEnabled: boolean;
      tradesExecuted: number;
    };
  }> {
    return this.request('/v1/ext/sven/context');
  }

  /** Legacy: get trading status (admin session required) */
  async getTradingStatus(): Promise<any> {
    return this.request('/v1/trading/status');
  }

  /** Legacy: get active soul */
  async getActiveSoul(): Promise<{ slug: string; version: string; content: string }> {
    return this.request('/v1/admin/souls/installed');
  }
}
