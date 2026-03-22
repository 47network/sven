import pg from 'pg';
import { resolveSecretRef } from '@sven/shared';

type LabelPatch = {
  addLabelIds?: string[];
  removeLabelIds?: string[];
};

export class GmailService {
  constructor(private pool: pg.Pool) {}

  async getMessage(messageId: string, format = 'full', userId = 'me'): Promise<any> {
    const path = `/gmail/v1/users/${encodeURIComponent(userId)}/messages/${encodeURIComponent(messageId)}?format=${encodeURIComponent(format)}`;
    return this.request('GET', path);
  }

  async patchLabels(messageId: string, patch: LabelPatch, userId = 'me'): Promise<any> {
    const path = `/gmail/v1/users/${encodeURIComponent(userId)}/messages/${encodeURIComponent(messageId)}/modify`;
    return this.request('POST', path, {
      addLabelIds: patch.addLabelIds || [],
      removeLabelIds: patch.removeLabelIds || [],
    });
  }

  async archiveMessage(messageId: string, userId = 'me'): Promise<any> {
    return this.patchLabels(messageId, { removeLabelIds: ['INBOX'] }, userId);
  }

  private async request(method: string, path: string, body?: unknown): Promise<any> {
    const accessToken = await this.resolveAccessToken();
    if (!accessToken) throw new Error('Gmail access token is not configured');

    const res = await fetch(`https://www.googleapis.com${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Gmail API error ${res.status}: ${text || res.statusText}`);
    }
    return res.json();
  }

  private async resolveAccessToken(): Promise<string> {
    if (process.env.GMAIL_ACCESS_TOKEN) return String(process.env.GMAIL_ACCESS_TOKEN);
    if (process.env.GMAIL_ACCESS_TOKEN_REF) {
      return String(await resolveSecretRef(process.env.GMAIL_ACCESS_TOKEN_REF));
    }

    const rows = await this.pool.query(
      `SELECT key, value
       FROM settings_global
       WHERE key IN ('gmail.access_token', 'gmail.access_token_ref')`,
    );
    let token: string | null = null;
    let tokenRef: string | null = null;
    for (const row of rows.rows) {
      if (row.key === 'gmail.access_token') token = normalizeSettingString(row.value);
      if (row.key === 'gmail.access_token_ref') tokenRef = normalizeSettingString(row.value);
    }
    if (tokenRef) {
      return String(await resolveSecretRef(tokenRef));
    }
    return String(token || '');
  }
}

function normalizeSettingString(value: unknown): string {
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return String(parsed ?? '');
    } catch {
      return value;
    }
  }
  if (typeof value === 'object' && value !== null) return String(value);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}
