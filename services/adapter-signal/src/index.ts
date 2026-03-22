/**
 * Sven – Signal Channel Adapter
 *
 * Bridges Signal via signal-cli REST API (https://github.com/bbernhard/signal-cli-rest-api).
 * Polls for new messages → forwards to Sven gateway.
 * Polls outbox and delivers replies via signal-cli REST.
 * Approvals via text command (Signal has no interactive buttons).
 */

import {
  BaseAdapter,
  type AdapterConfig,
  type OutboxItem,
  type ApprovalButton,
  runAdapter,
  createLogger,
} from '@sven/shared';

const logger = createLogger('adapter-signal');

// ──── Signal Adapter ─────────────────────────────────────────────────────────

interface SignalConfig extends AdapterConfig {
  signalCliUrl: string;
  signalPhoneNumber: string;
  signalPollMs: number;
}

class SignalAdapter extends BaseAdapter {
  private signalCliUrl: string;
  private phoneNumber: string;
  private pollMs: number;
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config: SignalConfig) {
    super({ ...config, channel: 'signal' });
    this.signalCliUrl = (config.signalCliUrl || process.env.SIGNAL_CLI_URL || 'http://signal-cli:8080').replace(/\/$/, '');
    this.phoneNumber = config.signalPhoneNumber || process.env.SIGNAL_NUMBER || process.env.SIGNAL_PHONE_NUMBER || '';
    this.pollMs = config.signalPollMs || parseInt(process.env.SIGNAL_POLL_INTERVAL || process.env.SIGNAL_POLL_MS || '2000', 10);
  }

  protected async connect(): Promise<void> {
    if (!this.phoneNumber) throw new Error('SIGNAL_NUMBER is required');

    // Verify signal-cli is reachable
    try {
      const res = await fetch(`${this.signalCliUrl}/v1/about`);
      if (res.ok) {
        const info = await res.json() as any;
        logger.info('Connected to signal-cli REST API', {
          version: info.versions?.['signal-cli'],
        });
      }
    } catch (err: any) {
      logger.warn('signal-cli REST API not reachable, will retry', { error: err.message });
    }

    // Poll for new messages
    this.pollTimer = setInterval(() => this.pollMessages(), this.pollMs);
    logger.info('Signal adapter started', { phone: this.phoneNumber });
  }

  private async pollMessages(): Promise<void> {
    try {
      const encoded = encodeURIComponent(this.phoneNumber);
      const res = await fetch(`${this.signalCliUrl}/v1/receive/${encoded}`);
      if (!res.ok) return;

      const messages: any[] = await res.json() as any[];
      for (const msg of messages) {
        await this.processSignalMessage(msg);
      }
    } catch (err: any) {
      if (!err.message?.includes('ECONNREFUSED')) {
        logger.warn('Signal poll error', { error: err.message });
      }
    }
  }

  private async processSignalMessage(msg: any): Promise<void> {
    const envelope = msg.envelope;
    if (!envelope) return;

    const source = envelope.sourceNumber || envelope.source;
    if (!source) return;

    const dataMessage = envelope.dataMessage;
    if (!dataMessage) return;

    const text = dataMessage.message || '';
    const timestamp = dataMessage.timestamp?.toString() || Date.now().toString();

    // Group or DM
    const groupInfo = dataMessage.groupInfo;
    const isGroup = !!groupInfo;
    const channelChatId = isGroup
      ? groupInfo.groupId
      : source;

    // Handle attachments
    const attachments = dataMessage.attachments || [];
    const audioAttachment = attachments.find(
      (a: any) => a.contentType?.startsWith('audio/'),
    );
    const fileAttachment = attachments.find(
      (a: any) => !a.contentType?.startsWith('audio/'),
    );

    // Check for approval text command: "approve <id>" or "deny <id>"
    const approvalMatch = text.match(/^(approve|deny)\s+(\S+)/i);
    if (approvalMatch) {
      const [, action, approvalId] = approvalMatch;
      await this.gateway.sendMessage('signal', {
        channel_message_id: timestamp,
        chat_id: '',
        sender_identity_id: '',
        text: `${action.toLowerCase()} ${approvalId}`,
        metadata: {
          is_approval_vote: true,
          approval_id: approvalId,
          vote: action.toLowerCase(),
          voter_phone: source,
        },
      });
      return;
    }

    await this.handleInbound({
      channelUserId: source,
      channelChatId,
      channelMessageId: timestamp,
      displayName: envelope.sourceName || source,
      chatName: isGroup ? (groupInfo.groupName || 'Signal Group') : `DM`,
      chatType: isGroup ? 'group' : 'dm',
      text: text || undefined,
      fileUrl: fileAttachment ? `${this.signalCliUrl}/v1/attachments/${fileAttachment.id}` : undefined,
      fileName: fileAttachment?.filename,
      fileMime: fileAttachment?.contentType,
      audioUrl: audioAttachment ? `${this.signalCliUrl}/v1/attachments/${audioAttachment.id}` : undefined,
    });
  }

  protected async disconnect(): Promise<void> {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  // ──── signal-cli REST API call ────────────────────────────────

  private async signalSend(recipient: string, body: any): Promise<void> {
    const encoded = encodeURIComponent(this.phoneNumber);
    const res = await fetch(`${this.signalCliUrl}/v2/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        number: this.phoneNumber,
        recipients: [recipient],
        ...body,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`signal-cli send error ${res.status}: ${text}`);
    }
  }

  // ──── Outbound: Text ──────────────────────────────────────────

  protected async sendText(
    channelChatId: string,
    text: string,
    _item: OutboxItem,
  ): Promise<void> {
    await this.signalSend(channelChatId, { message: text });
  }

  // ──── Outbound: File ──────────────────────────────────────────

  protected async sendFile(
    channelChatId: string,
    fileUrl: string,
    caption?: string,
    _item?: OutboxItem,
  ): Promise<void> {
    // signal-cli accepts base64 attachments; for URLs, send as text
    const text = caption ? `${caption}\n📎 ${fileUrl}` : `📎 ${fileUrl}`;
    await this.signalSend(channelChatId, { message: text });
  }

  // ──── Outbound: Audio ─────────────────────────────────────────

  protected async sendAudio(
    channelChatId: string,
    audioUrl: string,
    caption?: string,
    _item?: OutboxItem,
  ): Promise<void> {
    const text = caption ? `🎵 ${caption}\n${audioUrl}` : `🎵 ${audioUrl}`;
    await this.signalSend(channelChatId, { message: text });
  }

  // ──── Outbound: Approval Buttons (text command fallback) ──────

  protected override async sendApprovalButtons(
    channelChatId: string,
    buttons: ApprovalButton[],
    _item: OutboxItem,
  ): Promise<void> {
    const lines = buttons.map(
      (b) => `→ Reply "${b.action} ${b.approval_id.slice(0, 8)}" to ${b.label.toLowerCase()}`,
    );
    const text = `🗳 Approval Required\n${lines.join('\n')}`;
    await this.signalSend(channelChatId, { message: text });
  }
}

// ──── Main ───────────────────────────────────────────────────────────────────

runAdapter(SignalAdapter as any, {
  signalCliUrl: process.env.SIGNAL_CLI_URL || 'http://signal-cli:8080',
  signalPhoneNumber: process.env.SIGNAL_NUMBER || process.env.SIGNAL_PHONE_NUMBER || '',
  signalPollMs: parseInt(process.env.SIGNAL_POLL_INTERVAL || process.env.SIGNAL_POLL_MS || '2000', 10),
});
