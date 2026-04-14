/**
 * Sven API Client — connects to the Sven gateway API
 * for fetching live trading status, soul content, etc.
 */

interface SvenConfig {
  gatewayUrl: string;
  apiToken: string;
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
    };
    if (config.apiToken) {
      headers['Authorization'] = `Bearer ${config.apiToken}`;
    }

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

  async getTradingStatus(): Promise<any> {
    return this.request('/v1/trading/status');
  }

  async getActiveSoul(): Promise<{ slug: string; version: string; content: string }> {
    return this.request('/v1/admin/souls/installed');
  }

  async getMessages(limit = 20): Promise<any[]> {
    return this.request(`/v1/trading/sven/messages?limit=${limit}`);
  }

  async sendMessage(prompt: string): Promise<any> {
    return this.request('/v1/trading/sven/messages/send', {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    });
  }
}
