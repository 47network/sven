/**
 * Sven – Telegram Channel Adapter
 *
 * Uses Telegraf for long-polling (no webhook needed behind VPN).
 * Ingests messages, files, voice notes → forwards to Sven gateway.
 * Polls outbox and delivers replies with inline keyboard approval buttons.
 */

import { Telegraf, Markup } from 'telegraf';
import type { Update, Message } from 'telegraf/types';
import {
  BaseAdapter,
  type AdapterConfig,
  type OutboxItem,
  type ApprovalButton,
  type CanvasBlock,
  runAdapter,
  createLogger,
} from '@sven/shared';

const logger = createLogger('adapter-telegram');

// ──── Telegram Adapter ───────────────────────────────────────────────────────

interface TelegramConfig extends AdapterConfig {
  telegramToken: string;
}

class TelegramAdapter extends BaseAdapter {
  private bot!: Telegraf;
  private telegramToken: string;

  constructor(config: TelegramConfig) {
    super({ ...config, channel: 'telegram' });
    this.telegramToken = config.telegramToken || process.env.TELEGRAM_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '';
  }

  protected async connect(): Promise<void> {
    if (!this.telegramToken) throw new Error('TELEGRAM_TOKEN is required');

    this.bot = new Telegraf(this.telegramToken);

    // ── Text messages ──
    this.bot.on('text', async (ctx) => {
      const msg = ctx.message;
      const isDM = ctx.chat.type === 'private';
      const text = msg.text || '';

      // Group chat: only respond to mentions or /sven prefix
      if (!isDM) {
        const botUsername = ctx.botInfo?.username || '';
        const isMention = text.includes(`@${botUsername}`);
        const hasPrefix = text.startsWith('/sven');
        if (!isMention && !hasPrefix) return;
      }

      const cleanText = text
        .replace(/@\w+/g, '')
        .replace(/^\/sven\s*/i, '')
        .trim();

      const from = msg.from;
      const displayName = [from.first_name, from.last_name].filter(Boolean).join(' ') || from.username;

      await this.handleInbound({
        channelUserId: String(from.id),
        channelChatId: String(ctx.chat.id),
        channelMessageId: String(msg.message_id),
        displayName,
        chatName: isDM
          ? `DM with ${displayName}`
          : ('title' in ctx.chat ? ctx.chat.title : 'Telegram Group'),
        chatType: isDM ? 'dm' : 'group',
        text: cleanText || undefined,
      });
    });

    // ── Document/photo messages ──
    this.bot.on('document', async (ctx) => {
      const msg = ctx.message;
      const doc = msg.document;
      const fileLink = await ctx.telegram.getFileLink(doc.file_id);

      await this.handleInbound({
        channelUserId: String(msg.from.id),
        channelChatId: String(ctx.chat.id),
        channelMessageId: String(msg.message_id),
        displayName: msg.from.first_name,
        chatType: ctx.chat.type === 'private' ? 'dm' : 'group',
        text: (msg as any).caption,
        fileUrl: fileLink.href,
        fileName: doc.file_name,
        fileMime: doc.mime_type,
      });
    });

    this.bot.on('photo', async (ctx) => {
      const msg = ctx.message;
      const photo = msg.photo[msg.photo.length - 1]; // highest resolution
      const fileLink = await ctx.telegram.getFileLink(photo.file_id);

      await this.handleInbound({
        channelUserId: String(msg.from.id),
        channelChatId: String(ctx.chat.id),
        channelMessageId: String(msg.message_id),
        displayName: msg.from.first_name,
        chatType: ctx.chat.type === 'private' ? 'dm' : 'group',
        text: (msg as any).caption,
        fileUrl: fileLink.href,
        fileName: `photo_${photo.file_unique_id}.jpg`,
        fileMime: 'image/jpeg',
      });
    });

    // ── Voice notes ──
    this.bot.on('voice', async (ctx) => {
      const msg = ctx.message;
      const voice = msg.voice;
      const fileLink = await ctx.telegram.getFileLink(voice.file_id);

      await this.handleInbound({
        channelUserId: String(msg.from.id),
        channelChatId: String(ctx.chat.id),
        channelMessageId: String(msg.message_id),
        displayName: msg.from.first_name,
        chatType: ctx.chat.type === 'private' ? 'dm' : 'group',
        audioUrl: fileLink.href,
        metadata: { duration: voice.duration },
      });
    });

    // ── Inline keyboard callback (approval votes) ──
    this.bot.on('callback_query', async (ctx) => {
      const data = (ctx.callbackQuery as any).data || '';
      const [action, approvalId] = data.split(':');
      if (!action || !approvalId) return;
      if (action !== 'approve' && action !== 'deny') return;

      try {
        await this.gateway.sendMessage('telegram', {
          channel_message_id: String(ctx.callbackQuery.id),
          chat_id: '',
          sender_identity_id: '',
          text: `${action} ${approvalId}`,
          metadata: {
            is_approval_vote: true,
            approval_id: approvalId,
            vote: action,
            voter_telegram_id: ctx.callbackQuery.from.id,
          },
        });

        await ctx.answerCbQuery(`✅ Vote: ${action}`);
      } catch (err: any) {
        logger.error('failed to record approval vote', {
          error: String(err?.message || err),
          approval_id: approvalId,
          vote: action,
          voter_telegram_id: ctx.callbackQuery.from.id,
        });
        await ctx.answerCbQuery('❌ Failed to record vote. Please try again.');
      }
    });

    // Launch with long polling
    await this.bot.launch({ dropPendingUpdates: true });
    logger.info('Telegram bot started (long polling)', {
      username: this.bot.botInfo?.username,
    });
  }

  protected async disconnect(): Promise<void> {
    this.bot.stop('SIGTERM');
  }

  // ──── Outbound: Text ──────────────────────────────────────────

  protected async sendText(
    channelChatId: string,
    text: string,
    _item: OutboxItem,
  ): Promise<void> {
    // Telegram max message length: 4096
    const chunks = splitText(text, 4096);
    for (const chunk of chunks) {
      await this.bot.telegram.sendMessage(channelChatId, chunk, {
        parse_mode: 'Markdown',
      });
    }
  }

  // ──── Outbound: Blocks ────────────────────────────────────────

  protected override async sendBlocks(
    channelChatId: string,
    blocks: CanvasBlock[],
    fallbackText?: string,
    item?: OutboxItem,
  ): Promise<void> {
    const text = fallbackText || this.blocksToText(blocks);
    await this.sendText(channelChatId, text, item!);
  }

  // ──── Outbound: File ──────────────────────────────────────────

  protected async sendFile(
    channelChatId: string,
    fileUrl: string,
    caption?: string,
    _item?: OutboxItem,
  ): Promise<void> {
    await this.bot.telegram.sendDocument(
      channelChatId,
      { url: fileUrl },
      { caption },
    );
  }

  // ──── Outbound: Audio ─────────────────────────────────────────

  protected async sendAudio(
    channelChatId: string,
    audioUrl: string,
    caption?: string,
    _item?: OutboxItem,
  ): Promise<void> {
    await this.bot.telegram.sendVoice(
      channelChatId,
      { url: audioUrl },
      { caption },
    );
  }

  // ──── Outbound: Approval Buttons (Inline Keyboard) ────────────

  protected override async sendApprovalButtons(
    channelChatId: string,
    buttons: ApprovalButton[],
    _item: OutboxItem,
  ): Promise<void> {
    const keyboard = buttons.map((btn) =>
      Markup.button.callback(btn.label, `${btn.action}:${btn.approval_id}`),
    );

    await this.bot.telegram.sendMessage(
      channelChatId,
      '🗳 *Approval Required*',
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(keyboard),
      },
    );
  }
}

// ──── Helpers ────────────────────────────────────────────────────────────────

function splitText(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }
    let splitAt = remaining.lastIndexOf('\n', maxLen);
    if (splitAt < maxLen / 2) splitAt = maxLen;
    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt);
  }
  return chunks;
}

// ──── Main ───────────────────────────────────────────────────────────────────

runAdapter(TelegramAdapter as any, {
  telegramToken: process.env.TELEGRAM_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '',
});
