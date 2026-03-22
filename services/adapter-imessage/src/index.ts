/**
 * Sven – iMessage Channel Adapter (BlueBubbles)
 *
 * Bridges iMessage via BlueBubbles Server REST API.
 * Polls for new messages → forwards to Sven gateway.
 * Polls outbox and delivers replies.
 * Approvals via text command (iMessage has no interactive buttons).
 */

import {
  BaseAdapter,
  type AdapterConfig,
  type OutboxItem,
  type ApprovalButton,
  runAdapter,
  createLogger,
} from '@sven/shared';

const logger = createLogger('adapter-imessage');

// ──── iMessage Adapter ───────────────────────────────────────────────────────

interface IMessageConfig extends AdapterConfig {
  blueBubblesUrl: string;
  blueBubblesPassword: string;
  imessagePollMs: number;
}

class IMessageAdapter extends BaseAdapter {
  private bbUrl: string;
  private bbPassword: string;
  private pollMs: number;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private lastTimestamp = Date.now(); // Track last seen message timestamp

  constructor(config: IMessageConfig) {
    super({ ...config, channel: 'imessage' });
    this.bbUrl = (config.blueBubblesUrl || process.env.BLUEBUBBLES_URL || 'http://bluebubbles:1234').replace(/\/$/, '');
    this.bbPassword = config.blueBubblesPassword || process.env.BLUEBUBBLES_PASSWORD || '';
    this.pollMs = config.imessagePollMs || parseInt(process.env.IMESSAGE_POLL_INTERVAL || process.env.IMESSAGE_POLL_MS || '3000', 10);
  }

  protected async connect(): Promise<void> {
    if (!this.bbPassword) throw new Error('BLUEBUBBLES_PASSWORD is required');

    // Verify BlueBubbles is reachable
    try {
      const res = await fetch(`${this.bbUrl}/api/v1/server/info?password=${this.bbPassword}`);
      if (res.ok) {
        const info = await res.json() as any;
        logger.info('Connected to BlueBubbles server', {
          os_version: info.data?.os_version,
          server_version: info.data?.server_version,
        });
      }
    } catch (err: any) {
      logger.warn('BlueBubbles not reachable, will retry', { error: err.message });
    }

    // Poll for new messages
    this.pollTimer = setInterval(() => this.pollMessages(), this.pollMs);
    logger.info('iMessage adapter started');
  }

  private async pollMessages(): Promise<void> {
    try {
      const res = await fetch(
        `${this.bbUrl}/api/v1/message?password=${this.bbPassword}&after=${this.lastTimestamp}&sort=asc&limit=50`,
      );
      if (!res.ok) return;

      const body = await res.json() as any;
      const messages = body.data || [];

      for (const msg of messages) {
        // Skip outgoing messages (from us)
        if (msg.is_from_me) continue;

        await this.processMessage(msg);

        // Update last seen timestamp
        if (msg.date_created > this.lastTimestamp) {
          this.lastTimestamp = msg.date_created;
        }
      }
    } catch (err: any) {
      if (!err.message?.includes('ECONNREFUSED')) {
        logger.warn('iMessage poll error', { error: err.message });
      }
    }
  }

  private async processMessage(msg: any): Promise<void> {
    const handle = msg.handle || {};
    const chatGuid = msg.chats?.[0]?.guid || handle.address || '';
    const isGroup = msg.chats?.[0]?.participants?.length > 2;

    const text = msg.text || '';
    const attachments = msg.attachments || [];

    // Check for approval text command
    const approvalMatch = text.match(/^(approve|deny)\s+(\S+)/i);
    if (approvalMatch) {
      const [, action, approvalId] = approvalMatch;
      await this.gateway.sendMessage('imessage', {
        channel_message_id: msg.guid,
        chat_id: '',
        sender_identity_id: '',
        text: `${action.toLowerCase()} ${approvalId}`,
        metadata: {
          is_approval_vote: true,
          approval_id: approvalId,
          vote: action.toLowerCase(),
          voter_address: handle.address,
        },
      });
      return;
    }

    // Handle attachments
    const audioAttachment = attachments.find(
      (a: any) => a.mime_type?.startsWith('audio/'),
    );
    const fileAttachment = attachments.find(
      (a: any) => !a.mime_type?.startsWith('audio/'),
    );

    const fileUrl = fileAttachment
      ? `${this.bbUrl}/api/v1/attachment/${fileAttachment.guid}/download?password=${this.bbPassword}`
      : undefined;
    const audioUrl = audioAttachment
      ? `${this.bbUrl}/api/v1/attachment/${audioAttachment.guid}/download?password=${this.bbPassword}`
      : undefined;

    await this.handleInbound({
      channelUserId: handle.address || handle.id || 'unknown',
      channelChatId: chatGuid,
      channelMessageId: msg.guid,
      displayName: handle.address, // BlueBubbles doesn't always have contact names
      chatName: isGroup ? (msg.chats?.[0]?.display_name || 'iMessage Group') : 'DM',
      chatType: isGroup ? 'group' : 'dm',
      text: text || undefined,
      fileUrl,
      fileName: fileAttachment?.transfer_name,
      fileMime: fileAttachment?.mime_type,
      audioUrl,
    });
  }

  protected async disconnect(): Promise<void> {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  // ──── BlueBubbles send helper ─────────────────────────────────

  private async bbSend(chatGuid: string, text: string): Promise<void> {
    const res = await fetch(`${this.bbUrl}/api/v1/message/text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        password: this.bbPassword,
        chatGuid,
        message: text,
        method: 'apple-script',
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`BlueBubbles send error ${res.status}: ${body}`);
    }
  }

  // ──── Outbound: Text ──────────────────────────────────────────

  protected async sendText(
    channelChatId: string,
    text: string,
    _item: OutboxItem,
  ): Promise<void> {
    await this.bbSend(channelChatId, text);
  }

  // ──── Outbound: File ──────────────────────────────────────────

  protected async sendFile(
    channelChatId: string,
    fileUrl: string,
    caption?: string,
    _item?: OutboxItem,
  ): Promise<void> {
    // BlueBubbles can send attachments but requires local file
    // For remote URLs, send as text link
    const text = caption ? `${caption}\n📎 ${fileUrl}` : `📎 ${fileUrl}`;
    await this.bbSend(channelChatId, text);
  }

  // ──── Outbound: Audio ─────────────────────────────────────────

  protected async sendAudio(
    channelChatId: string,
    audioUrl: string,
    caption?: string,
    _item?: OutboxItem,
  ): Promise<void> {
    const text = caption ? `🎵 ${caption}\n${audioUrl}` : `🎵 ${audioUrl}`;
    await this.bbSend(channelChatId, text);
  }

  // ──── Outbound: Approval (text command fallback) ──────────────

  protected override async sendApprovalButtons(
    channelChatId: string,
    buttons: ApprovalButton[],
    _item: OutboxItem,
  ): Promise<void> {
    const lines = buttons.map(
      (b) => `→ Reply "${b.action} ${b.approval_id.slice(0, 8)}" to ${b.label.toLowerCase()}`,
    );
    const text = `🗳 Approval Required\n${lines.join('\n')}`;
    await this.bbSend(channelChatId, text);
  }
}

// ──── Main ───────────────────────────────────────────────────────────────────

runAdapter(IMessageAdapter as any, {
  blueBubblesUrl: process.env.BLUEBUBBLES_URL || 'http://bluebubbles:1234',
  blueBubblesPassword: process.env.BLUEBUBBLES_PASSWORD || '',
  imessagePollMs: parseInt(process.env.IMESSAGE_POLL_INTERVAL || process.env.IMESSAGE_POLL_MS || '3000', 10),
});
