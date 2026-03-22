/**
 * Sven – Slack Channel Adapter
 *
 * Uses @slack/bolt for Socket Mode (no public endpoint needed).
 * Ingests messages → forwards to Sven gateway.
 * Polls outbox and delivers replies with Block Kit approval buttons.
 */

import { App, LogLevel as SlackLogLevel } from '@slack/bolt';
import { WebClient } from '@slack/web-api';
import {
  BaseAdapter,
  type AdapterConfig,
  type OutboxItem,
  type ApprovalButton,
  type CanvasBlock,
  runAdapter,
  createLogger,
} from '@sven/shared';

const logger = createLogger('adapter-slack');

// ──── Slack Adapter ──────────────────────────────────────────────────────────

interface SlackConfig extends AdapterConfig {
  slackBotToken: string;
  slackAppToken: string;
  slackSigningSecret: string;
}

class SlackAdapter extends BaseAdapter {
  private app!: App;
  private web!: WebClient;
  private botUserId = '';
  private slackBotToken: string;
  private slackAppToken: string;
  private slackSigningSecret: string;

  constructor(config: SlackConfig) {
    super({ ...config, channel: 'slack' });
    this.slackBotToken = config.slackBotToken || process.env.SLACK_BOT_TOKEN || '';
    this.slackAppToken = config.slackAppToken || process.env.SLACK_APP_TOKEN || '';
    this.slackSigningSecret = config.slackSigningSecret || process.env.SLACK_SIGNING_SECRET || '';
  }

  protected async connect(): Promise<void> {
    if (!this.slackBotToken) throw new Error('SLACK_BOT_TOKEN is required');
    if (!this.slackAppToken) throw new Error('SLACK_APP_TOKEN is required');

    this.app = new App({
      token: this.slackBotToken,
      appToken: this.slackAppToken,
      signingSecret: this.slackSigningSecret || undefined,
      socketMode: true,
      logLevel: SlackLogLevel.WARN,
    });

    this.web = new WebClient(this.slackBotToken);

    // Get bot user ID
    const authRes = await this.web.auth.test();
    this.botUserId = authRes.user_id || '';

    // ── Message handler ──
    this.app.message(async ({ message, say }) => {
      const msg = message as any;
      // Skip bot messages, edits, deletes
      if (msg.subtype) return;
      if (msg.bot_id) return;

      const text = msg.text || '';
      const isDM = msg.channel_type === 'im';
      const isMention = text.includes(`<@${this.botUserId}>`);
      const hasPrefix = text.startsWith('/sven');

      if (!isDM && !isMention && !hasPrefix) return;

      // Clean text
      const cleanText = text
        .replace(new RegExp(`<@${this.botUserId}>`, 'g'), '')
        .replace(/^\/sven\s*/i, '')
        .trim();

      // Handle file shares
      const files = msg.files || [];
      const audioFile = files.find((f: any) =>
        f.mimetype?.startsWith('audio/'),
      );
      const otherFile = files.find(
        (f: any) => !f.mimetype?.startsWith('audio/'),
      );

      // Get user info for display name
      let displayName: string | undefined;
      try {
        const userInfo = await this.web.users.info({ user: msg.user });
        displayName =
          userInfo.user?.real_name || userInfo.user?.name || undefined;
      } catch {
        // best-effort identity enrichment
      }

      // Get channel info for chat name
      let chatName: string | undefined;
      try {
        if (!isDM) {
          const convInfo = await this.web.conversations.info({
            channel: msg.channel,
          });
          chatName = (convInfo.channel as any)?.name;
        }
      } catch {
        // best-effort channel enrichment
      }

      await this.handleInbound({
        channelUserId: msg.user,
        channelChatId: msg.channel,
        channelMessageId: msg.ts,
        displayName,
        chatName: chatName || (isDM ? `DM` : 'Slack Channel'),
        chatType: isDM ? 'dm' : 'group',
        text: cleanText || undefined,
        fileUrl: otherFile?.url_private_download,
        fileName: otherFile?.name,
        fileMime: otherFile?.mimetype,
        audioUrl: audioFile?.url_private_download,
        metadata: {
          thread_ts: msg.thread_ts,
          team: msg.team,
        },
      });
    });

    // ── Block Kit button handler (approvals) ──
    this.app.action(/^(approve|deny):/, async ({ action, ack, respond }) => {
      await ack();
      const btnAction = action as any;
      const [vote, approvalId] = btnAction.action_id.split(':');

      try {
        await this.gateway.sendMessage('slack', {
          channel_message_id: btnAction.action_ts || Date.now().toString(),
          chat_id: '',
          sender_identity_id: '',
          text: `${vote} ${approvalId}`,
          metadata: {
            is_approval_vote: true,
            approval_id: approvalId,
            vote,
            voter_slack_id: (btnAction as any).user?.id,
          },
        });

        await respond({
          text: `✅ Vote recorded: *${vote}* for approval \`${approvalId.slice(0, 8)}…\``,
          replace_original: false,
          response_type: 'ephemeral',
        });
      } catch (err: any) {
        logger.error('failed to record approval vote', {
          error: String(err?.message || err),
          approval_id: approvalId,
          vote,
          voter_slack_id: (btnAction as any).user?.id,
        });
        await respond({
          text: '❌ Failed to record vote. Please try again.',
          replace_original: false,
          response_type: 'ephemeral',
        });
      }
    });

    await this.app.start();
    logger.info('Slack bot connected via Socket Mode', { bot_user_id: this.botUserId });
  }

  protected async disconnect(): Promise<void> {
    await this.app.stop();
  }

  // ──── Outbound: Text ──────────────────────────────────────────

  protected async sendText(
    channelChatId: string,
    text: string,
    _item: OutboxItem,
  ): Promise<void> {
    await this.web.chat.postMessage({
      channel: channelChatId,
      text,
      unfurl_links: false,
    });
  }

  // ──── Outbound: Blocks (Block Kit) ────────────────────────────

  protected override async sendBlocks(
    channelChatId: string,
    blocks: CanvasBlock[],
    fallbackText?: string,
    item?: OutboxItem,
  ): Promise<void> {
    // Convert canvas blocks to Slack Block Kit
    const slackBlocks = blocks.map((b) => canvasBlockToSlackBlock(b)).flat();

    await this.web.chat.postMessage({
      channel: channelChatId,
      text: fallbackText || this.blocksToText(blocks),
      blocks: slackBlocks,
      unfurl_links: false,
    });
  }

  // ──── Outbound: File ──────────────────────────────────────────

  protected async sendFile(
    channelChatId: string,
    fileUrl: string,
    caption?: string,
    _item?: OutboxItem,
  ): Promise<void> {
    // Slack can't upload from URL directly; send as a link
    const text = caption ? `${caption}\n${fileUrl}` : fileUrl;
    await this.web.chat.postMessage({
      channel: channelChatId,
      text,
    });
  }

  // ──── Outbound: Audio ─────────────────────────────────────────

  protected async sendAudio(
    channelChatId: string,
    audioUrl: string,
    caption?: string,
    _item?: OutboxItem,
  ): Promise<void> {
    const text = caption
      ? `🎵 ${caption}\n${audioUrl}`
      : `🎵 Voice message: ${audioUrl}`;
    await this.web.chat.postMessage({
      channel: channelChatId,
      text,
    });
  }

  // ──── Outbound: Approval Buttons (Block Kit) ──────────────────

  protected override async sendApprovalButtons(
    channelChatId: string,
    buttons: ApprovalButton[],
    _item: OutboxItem,
  ): Promise<void> {
    const elements = buttons.map((btn) => ({
      type: 'button' as const,
      text: { type: 'plain_text' as const, text: btn.label },
      action_id: `${btn.action}:${btn.approval_id}`,
      style: btn.action === 'approve' ? ('primary' as const) : ('danger' as const),
    }));

    await this.web.chat.postMessage({
      channel: channelChatId,
      text: 'Approval required',
      blocks: [
        {
          type: 'actions',
          elements,
        },
      ],
    });
  }
}

// ──── Helpers ────────────────────────────────────────────────────────────────

function canvasBlockToSlackBlock(block: CanvasBlock): any[] {
  switch (block.type) {
    case 'markdown': {
      const text = typeof block.content === 'string'
        ? block.content
        : JSON.stringify(block.content);
      return [{ type: 'section', text: { type: 'mrkdwn', text } }];
    }
    case 'code': {
      const c = block.content as { language?: string; code?: string };
      return [{
        type: 'section',
        text: { type: 'mrkdwn', text: `\`\`\`\n${c.code || ''}\n\`\`\`` },
      }];
    }
    case 'table': {
      const t = block.content as { headers?: string[]; rows?: string[][] };
      if (!t.headers || !t.rows) return [];
      const header = t.headers.join(' | ');
      const rows = t.rows.map((r) => r.join(' | ')).join('\n');
      return [{
        type: 'section',
        text: { type: 'mrkdwn', text: `*${header}*\n${rows}` },
      }];
    }
    case 'tool_card': {
      const tc = block.content as { tool_name?: string; status?: string };
      return [{
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `🔧 *${tc.tool_name}* → \`${tc.status}\``,
        },
      }];
    }
    default: {
      const text = typeof block.content === 'string'
        ? block.content
        : JSON.stringify(block.content);
      return [{ type: 'section', text: { type: 'mrkdwn', text } }];
    }
  }
}

// ──── Main ───────────────────────────────────────────────────────────────────

runAdapter(SlackAdapter as any, {
  slackBotToken: process.env.SLACK_BOT_TOKEN || '',
  slackAppToken: process.env.SLACK_APP_TOKEN || '',
  slackSigningSecret: process.env.SLACK_SIGNING_SECRET || '',
});
