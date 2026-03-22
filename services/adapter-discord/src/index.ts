/**
 * Sven – Discord Channel Adapter
 *
 * Connects to Discord via discord.js (gateway WebSocket).
 * Ingests messages, files, and audio → forwards to Sven gateway.
 * Polls outbox and delivers replies with optional approval buttons.
 */

import {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type Message,
  type Interaction,
  type TextChannel,
  type DMChannel,
  type NewsChannel,
  type ThreadChannel,
  AttachmentBuilder,
} from 'discord.js';
import {
  BaseAdapter,
  type AdapterConfig,
  type OutboxItem,
  type ApprovalButton,
  runAdapter,
  createLogger,
} from '@sven/shared';

const logger = createLogger('adapter-discord');

// ──── Discord Adapter ────────────────────────────────────────────────────────

interface DiscordConfig extends AdapterConfig {
  discordToken: string;
  triggerPrefixes: string[];
}

class DiscordAdapter extends BaseAdapter {
  private client: Client;
  private discordToken: string;
  private triggerPrefixes: string[];

  constructor(config: DiscordConfig) {
    super({ ...config, channel: 'discord' });
    this.discordToken = config.discordToken || process.env.DISCORD_TOKEN || '';
    this.triggerPrefixes = config.triggerPrefixes || ['/sven', '@sven'];

    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildVoiceStates,
      ],
      partials: [Partials.Channel, Partials.Message],
    });
  }

  protected async connect(): Promise<void> {
    if (!this.discordToken) {
      throw new Error('DISCORD_TOKEN is required');
    }

    // ── Message handler ──
    this.client.on(Events.MessageCreate, async (msg: Message) => {
      // Ignore bot messages
      if (msg.author.bot) return;

      // DM always triggers; guild messages need mention or prefix
      const isDM = !msg.guild;
      const isMention = msg.mentions.users.has(this.client.user?.id || '');
      const hasPrefix = this.triggerPrefixes.some((p) =>
        msg.content.toLowerCase().startsWith(p.toLowerCase()),
      );

      if (!isDM && !isMention && !hasPrefix) return;

      // Clean text (remove mention prefix)
      let text = msg.content;
      if (isMention) {
        text = text.replace(/<@!?\d+>/g, '').trim();
      }
      for (const prefix of this.triggerPrefixes) {
        if (text.toLowerCase().startsWith(prefix.toLowerCase())) {
          text = text.slice(prefix.length).trim();
          break;
        }
      }

      // Handle attachments
      const attachments = [...msg.attachments.values()];
      const audioAttachment = attachments.find((a) =>
        a.contentType?.startsWith('audio/'),
      );
      const fileAttachment = attachments.find(
        (a) => !a.contentType?.startsWith('audio/'),
      );

      await this.handleInbound({
        channelUserId: msg.author.id,
        channelChatId: msg.channel.id,
        channelMessageId: msg.id,
        displayName: msg.author.displayName || msg.author.username,
        chatName: isDM
          ? `DM with ${msg.author.username}`
          : (msg.channel as TextChannel).name || 'Discord Chat',
        chatType: isDM ? 'dm' : 'group',
        text: text || undefined,
        fileUrl: fileAttachment?.url,
        fileName: fileAttachment?.name || undefined,
        fileMime: fileAttachment?.contentType || undefined,
        audioUrl: audioAttachment?.url,
        metadata: {
          guild_id: msg.guild?.id,
          guild_name: msg.guild?.name,
          thread_id: msg.channel.isThread() ? msg.channel.id : undefined,
        },
      });
    });

    // ── Button interaction handler (approval votes) ──
    this.client.on(Events.InteractionCreate, async (interaction: Interaction) => {
      if (!interaction.isButton()) return;

      const [action, approvalId] = interaction.customId.split(':');
      if (!action || !approvalId) return;
      if (action !== 'approve' && action !== 'deny') return;

      try {
        // Forward the vote to the gateway
        await this.gateway.sendMessage('discord', {
          channel_message_id: interaction.id,
          chat_id: '', // Will be resolved by the gateway from the approval
          sender_identity_id: '', // Will be resolved
          text: `${action} ${approvalId}`,
          metadata: {
            is_approval_vote: true,
            approval_id: approvalId,
            vote: action,
            voter_discord_id: interaction.user.id,
          },
        });

        await interaction.reply({
          content: `✅ Vote recorded: **${action}** for approval \`${approvalId.slice(0, 8)}…\``,
          ephemeral: true,
        });
      } catch (err: any) {
        logger.error('failed to record approval vote', {
          error: String(err?.message || err),
          approval_id: approvalId,
          vote: action,
          voter_discord_id: interaction.user.id,
        });
        await interaction.reply({
          content: '❌ Failed to record vote. Please try again.',
          ephemeral: true,
        });
      }
    });

    this.client.on(Events.ClientReady, () => {
      logger.info('Discord bot connected', {
        username: this.client.user?.username,
        guilds: this.client.guilds.cache.size,
      });
    });

    await this.client.login(this.discordToken);
  }

  protected async disconnect(): Promise<void> {
    this.client.destroy();
  }

  // ──── Outbound: Text ──────────────────────────────────────────

  protected async sendText(
    channelChatId: string,
    text: string,
    _item: OutboxItem,
  ): Promise<void> {
    const channel = await this.client.channels.fetch(channelChatId);
    if (!channel || !('send' in channel)) {
      throw new Error(`Cannot send to channel ${channelChatId}`);
    }

    // Discord has a 2000-char limit; split if needed
    const chunks = splitText(text, 2000);
    for (const chunk of chunks) {
      await (channel as TextChannel).send(chunk);
    }
  }

  // ──── Outbound: Blocks (rich embeds) ──────────────────────────

  protected override async sendBlocks(
    channelChatId: string,
    blocks: import('@sven/shared').CanvasBlock[],
    fallbackText?: string,
    item?: OutboxItem,
  ): Promise<void> {
    // For Discord, convert blocks to text (Discord embeds are limited)
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
    const channel = await this.client.channels.fetch(channelChatId);
    if (!channel || !('send' in channel)) {
      throw new Error(`Cannot send file to channel ${channelChatId}`);
    }

    await (channel as TextChannel).send({
      content: caption || undefined,
      files: [fileUrl],
    });
  }

  // ──── Outbound: Audio ─────────────────────────────────────────

  protected async sendAudio(
    channelChatId: string,
    audioUrl: string,
    caption?: string,
    _item?: OutboxItem,
  ): Promise<void> {
    // Discord treats audio as file attachments
    await this.sendFile(channelChatId, audioUrl, caption || '🎵 Voice message');
  }

  // ──── Outbound: Approval Buttons ──────────────────────────────

  protected override async sendApprovalButtons(
    channelChatId: string,
    buttons: ApprovalButton[],
    item: OutboxItem,
  ): Promise<void> {
    const channel = await this.client.channels.fetch(channelChatId);
    if (!channel || !('send' in channel)) return;

    const row = new ActionRowBuilder<ButtonBuilder>();
    for (const btn of buttons) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`${btn.action}:${btn.approval_id}`)
          .setLabel(btn.label)
          .setStyle(
            btn.action === 'approve'
              ? ButtonStyle.Success
              : ButtonStyle.Danger,
          ),
      );
    }

    await (channel as TextChannel).send({ components: [row] });
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
    // Try to split at a newline
    let splitAt = remaining.lastIndexOf('\n', maxLen);
    if (splitAt < maxLen / 2) splitAt = maxLen;
    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt);
  }
  return chunks;
}

// ──── Main ───────────────────────────────────────────────────────────────────

runAdapter(DiscordAdapter as any, {
  discordToken: process.env.DISCORD_TOKEN || '',
  triggerPrefixes: (process.env.DISCORD_TRIGGER_PREFIXES || '/sven,@sven').split(','),
});
