import pg from 'pg';
import { createLogger } from '@sven/shared';
import type { InboundMessageEvent } from '@sven/shared';
import { parseSettingValue } from './settings-utils.js';
import { isCommandMessage } from './chat-commands.js';

const logger = createLogger('trigger-gate');

export interface TriggerGateDecision {
  allow: boolean;
  reason:
    | 'allowed'
    | 'chat_not_found'
    | 'hq_admin_only'
    | 'group_muted'
    | 'group_trigger_not_matched'
    | 'unsupported_chat_type';
  userMessage?: string;
}

export function normalizeAutoRespondChatsAllowlist(raw: unknown): string[] {
  const parsed = parseSettingValue(raw);
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((value) => String(value || '').trim())
    .filter(Boolean);
}

/**
 * Trigger gate determines whether the runtime should respond to a message.
 *
 * Group chat: mention bot OR /sven prefix OR allowlisted room
 * DM: always responds (unless disabled)
 * HQ: always responds (admin-only)
 */
export class TriggerGate {
  constructor(private pool: pg.Pool) {}

  async evaluate(event: InboundMessageEvent): Promise<TriggerGateDecision> {
    // Get chat info
    const chatRes = await this.pool.query(
      `SELECT type FROM chats WHERE id = $1`,
      [event.chat_id],
    );

    if (chatRes.rows.length === 0) {
      logger.warn('Chat not found', { chat_id: event.chat_id });
      return { allow: false, reason: 'chat_not_found' };
    }

    const chatType = chatRes.rows[0].type;

    // HQ chat: admin-only
    if (chatType === 'hq') {
      const roleRes = await this.pool.query(
        `SELECT u.role FROM identities i
         JOIN users u ON i.user_id = u.id
         WHERE i.id = $1`,
        [event.sender_identity_id],
      );
      const role = roleRes.rows[0]?.role;
      if (role !== 'admin') {
        logger.warn('Non-admin attempted HQ access', {
          chat_id: event.chat_id,
          identity_id: event.sender_identity_id,
        });
        return {
          allow: false,
          reason: 'hq_admin_only',
          userMessage: 'This HQ thread is admin-only. Use a direct message or a permitted group chat for normal runtime requests.',
        };
      }
      return { allow: true, reason: 'allowed' };
    }

    // DM: always respond
    if (chatType === 'dm') {
      return { allow: true, reason: 'allowed' };
    }

    // Group chat: check triggers
    if (chatType === 'group') {
      const text = event.text || '';

      // Mute gate: skip all responses while muted.
      const muteKey = `chat.mute_until.${event.chat_id}`;
      const muteRes = await this.pool.query(
        `SELECT value FROM settings_global WHERE key = $1`,
        [muteKey],
      );
      if (muteRes.rows.length > 0) {
        const muteUntil = parseSettingValue<string>(muteRes.rows[0].value) || '';
        if (muteUntil && new Date(muteUntil).getTime() > Date.now()) {
          return { allow: false, reason: 'group_muted' };
        }
      }

      const activationKey = `chat.activation.${event.chat_id}`;
      const activationRes = await this.pool.query(
        `SELECT value FROM settings_global WHERE key = $1`,
        [activationKey],
      );
      const activationMode = activationRes.rows.length > 0
        ? String(parseSettingValue(activationRes.rows[0].value) || 'mention').toLowerCase()
        : 'mention';

      if (activationMode === 'always') {
        return { allow: true, reason: 'allowed' };
      }

      // Commands are explicit triggers across channels.
      if (await isCommandMessage(this.pool, text)) {
        return { allow: true, reason: 'allowed' };
      }

      // Check mention
      if (text.includes('@sven') || text.includes('@Sven')) {
        return { allow: true, reason: 'allowed' };
      }

      // Check /sven prefix
      if (text.startsWith('/sven ') || text === '/sven') {
        return { allow: true, reason: 'allowed' };
      }

      // Check if room is allowlisted
      const settingsRes = await this.pool.query(
        `SELECT value FROM settings_global WHERE key = 'allowlist.auto_respond_chats'`,
      );
      if (settingsRes.rows.length > 0) {
        const allowedChats = normalizeAutoRespondChatsAllowlist(settingsRes.rows[0].value);
        if (allowedChats.includes(event.chat_id)) {
          return { allow: true, reason: 'allowed' };
        }
      }

      return { allow: false, reason: 'group_trigger_not_matched' };
    }

    return { allow: false, reason: 'unsupported_chat_type' };
  }
}
