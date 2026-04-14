/**
 * Sven API Client — connects to the Sven gateway API
 * for fetching live trading status, soul content, and chatting with Sven's brain.
 */

interface SvenConfig {
  gatewayUrl: string;
  apiKey: string;
}

export class SvenApiClient {
  private getConfig: () => SvenConfig;

  constructor(getConfig: () => SvenConfig) {
    this.getConfig = getConfig;
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const config = this.getConfig();
    const url = `${config.gatewayUrl.replace(/\/$/, '')}${path}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Sven-Api-Key': config.apiKey,
    };

    const res = await fetch(url, {
      ...options,
      headers: { ...headers, ...options?.headers as Record<string, string> },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Sven API ${res.status}: ${body || res.statusText}`);
    }

    const json = await res.json() as { success: boolean; data?: T; error?: { message: string } };
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
