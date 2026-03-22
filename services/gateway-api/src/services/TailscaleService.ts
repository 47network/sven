import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import pg from 'pg';
import { createLogger } from '@sven/shared';

const execFileAsync = promisify(execFile);
const logger = createLogger('tailscale-service');

export type TailscaleMode = 'off' | 'serve' | 'funnel';

export function normalizeTailscaleMode(value: unknown): TailscaleMode {
  const str = String(value || '').trim().toLowerCase();
  if (str === 'serve' || str === 'funnel' || str === 'off') return str;
  return 'off';
}

export function buildTailscalePreview(mode: TailscaleMode, gatewayPort: number): string[] {
  const target = `http://127.0.0.1:${gatewayPort}`;
  if (mode === 'off') return [];
  if (mode === 'serve') {
    return [`tailscale serve --bg ${target}`];
  }
  return [
    `tailscale serve --bg ${target}`,
    `tailscale funnel --bg ${target}`,
  ];
}

export type TailscaleWhoisIdentity = {
  login: string;
  name?: string;
};

function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

export function parseTailscaleWhoisIdentity(payload: Record<string, unknown>): TailscaleWhoisIdentity | null {
  const userProfile =
    readRecord(payload.UserProfile) ?? readRecord(payload.userProfile) ?? readRecord(payload.User);
  const login =
    getString(userProfile?.LoginName) ??
    getString(userProfile?.Login) ??
    getString(userProfile?.login) ??
    getString(payload.LoginName) ??
    getString(payload.login);
  if (!login) return null;

  const name =
    getString(userProfile?.DisplayName) ??
    getString(userProfile?.Name) ??
    getString(userProfile?.displayName) ??
    getString(payload.DisplayName) ??
    getString(payload.name);
  return { login, name };
}

export async function readTailscaleWhoisIdentity(ip: string): Promise<TailscaleWhoisIdentity | null> {
  const normalized = String(ip || '').trim();
  if (!normalized) return null;
  const bin = process.env.TAILSCALE_BIN || 'tailscale';
  try {
    const { stdout } = await execFileAsync(
      bin,
      ['whois', '--json', normalized],
      { timeout: Number(process.env.TAILSCALE_CMD_TIMEOUT_MS || 15000), maxBuffer: 200_000 },
    );
    const parsed = JSON.parse(String(stdout || '{}')) as Record<string, unknown>;
    return parseTailscaleWhoisIdentity(parsed);
  } catch (err: any) {
    logger.warn('Tailscale whois failed', { ip: normalized, error: String(err?.message || err) });
    return null;
  }
}

export class TailscaleService {
  constructor(private pool: pg.Pool, private gatewayPort: number) {}

  async getMode(): Promise<TailscaleMode> {
    if (process.env.GATEWAY_TAILSCALE_MODE) {
      return normalizeTailscaleMode(process.env.GATEWAY_TAILSCALE_MODE);
    }
    const res = await this.pool.query(
      `SELECT value FROM settings_global WHERE key = 'gateway.tailscale.mode' LIMIT 1`,
    );
    if (res.rows.length === 0) return 'off';
    return normalizeTailscaleMode(parseSetting(res.rows[0].value));
  }

  async configureOnStart(): Promise<void> {
    const mode = await this.getMode();
    if (mode === 'off') return;

    if (mode === 'funnel') {
      // Funnel is public internet exposure: disable password-less deep-link exchange.
      await this.pool.query(
        `INSERT INTO settings_global (key, value, updated_at, updated_by)
         VALUES ('auth.disable_token_exchange', 'true'::jsonb, NOW(), NULL)
         ON CONFLICT (key) DO UPDATE SET value = 'true'::jsonb, updated_at = NOW()`,
      );
    }

    const target = `http://127.0.0.1:${this.gatewayPort}`;
    await this.runCommand(['serve', '--bg', target]);
    if (mode === 'funnel') {
      await this.runCommand(['funnel', '--bg', target]);
    }

    await this.pool.query(
      `INSERT INTO settings_global (key, value, updated_at, updated_by)
       VALUES ('gateway.tailscale.last_mode', $1::jsonb, NOW(), NULL)
       ON CONFLICT (key) DO UPDATE SET value = $1::jsonb, updated_at = NOW()`,
      [JSON.stringify(mode)],
    );
    logger.info('Tailscale configured', { mode, gateway_port: this.gatewayPort });
  }

  async resetOnShutdown(): Promise<void> {
    const shouldReset = process.env.GATEWAY_TAILSCALE_RESET_ON_SHUTDOWN !== 'false';
    if (!shouldReset) return;

    await this.runCommand(['serve', 'reset']);
    await this.runCommand(['funnel', 'reset']);
  }

  private async runCommand(args: string[]): Promise<void> {
    const bin = process.env.TAILSCALE_BIN || 'tailscale';
    try {
      await execFileAsync(bin, args, { timeout: Number(process.env.TAILSCALE_CMD_TIMEOUT_MS || 15000) });
    } catch (err: any) {
      logger.warn('Tailscale command failed', { bin, args: args.join(' '), error: String(err?.message || err) });
    }
  }
}

function parseSetting(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
