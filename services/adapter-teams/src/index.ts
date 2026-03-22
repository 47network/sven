/**
 * Sven – Microsoft Teams Channel Adapter
 *
 * Uses Bot Framework SDK v4 with HTTP endpoint.
 * Ingests messages → forwards to Sven gateway.
 * Polls outbox and delivers replies with Adaptive Card actions.
 */

import {
  CloudAdapter,
  ConfigurationBotFrameworkAuthentication,
  TurnContext,
  ActivityTypes,
  CardFactory,
  MessageFactory,
  type Activity,
} from 'botbuilder';
import http from 'node:http';
import {
  BaseAdapter,
  type AdapterConfig,
  type OutboxItem,
  type ApprovalButton,
  type CanvasBlock,
  runAdapter,
  createLogger,
} from '@sven/shared';

const logger = createLogger('adapter-teams');
const TEAMS_MAX_BODY_BYTES = Number(process.env.TEAMS_MAX_BODY_BYTES || 512 * 1024);

// ──── Teams Adapter ──────────────────────────────────────────────────────────

interface TeamsConfig extends AdapterConfig {
  microsoftAppId: string;
  microsoftAppPassword: string;
  teamsPort: number;
}

class TeamsAdapter extends BaseAdapter {
  private botAdapter!: CloudAdapter;
  private server!: http.Server;
  private microsoftAppId: string;
  private microsoftAppPassword: string;
  private teamsPort: number;
  /** Store conversation references for proactive messaging (outbox delivery) */
  private conversationRefs = new Map<string, Partial<any>>();

  constructor(config: TeamsConfig) {
    super({ ...config, channel: 'teams' });
    this.microsoftAppId = config.microsoftAppId || process.env.TEAMS_APP_ID || process.env.MICROSOFT_APP_ID || '';
    this.microsoftAppPassword = config.microsoftAppPassword || process.env.TEAMS_APP_PASSWORD || process.env.MICROSOFT_APP_PASSWORD || '';
    this.teamsPort = config.teamsPort || parseInt(process.env.TEAMS_PORT || '3978', 10);
  }

  protected async connect(): Promise<void> {
    const botFrameworkAuth = new ConfigurationBotFrameworkAuthentication({
      MicrosoftAppId: this.microsoftAppId,
      MicrosoftAppPassword: this.microsoftAppPassword,
      MicrosoftAppType: 'MultiTenant',
    });

    this.botAdapter = new CloudAdapter(botFrameworkAuth);

    // Error handler
    this.botAdapter.onTurnError = async (context: TurnContext, error: Error) => {
      logger.error('Teams bot turn error', { error: error.message });
      await context.sendActivity('Sorry, an error occurred.');
    };

    // HTTP server for Bot Framework messages endpoint
    this.server = http.createServer(async (req, res) => {
      if (req.method === 'POST' && req.url === '/api/messages') {
        const maxBodyBytes = normalizeMaxBodyBytes(TEAMS_MAX_BODY_BYTES);
        const contentLength = Number(req.headers['content-length'] || 0);
        if (Number.isFinite(contentLength) && contentLength > maxBodyBytes) {
          logger.warn('Teams request rejected: content-length over limit', {
            content_length: contentLength,
            max_body_bytes: maxBodyBytes,
          });
          writeJson(res, 413, {
            success: false,
            error: { code: 'PAYLOAD_TOO_LARGE', message: 'Teams activity body exceeds limit' },
          });
          req.resume();
          return;
        }

        let bytesReceived = 0;
        const chunks: Buffer[] = [];
        let bodyTooLarge = false;

        req.on('data', (chunk: Buffer) => {
          if (bodyTooLarge) return;
          bytesReceived += chunk.length;
          if (bytesReceived > maxBodyBytes) {
            bodyTooLarge = true;
            logger.warn('Teams request rejected: body exceeds max bytes', {
              bytes_received: bytesReceived,
              max_body_bytes: maxBodyBytes,
            });
            writeJson(res, 413, {
              success: false,
              error: { code: 'PAYLOAD_TOO_LARGE', message: 'Teams activity body exceeds limit' },
            });
            req.destroy();
            return;
          }
          chunks.push(chunk);
        });

        req.on('end', async () => {
          if (bodyTooLarge) return;
          try {
            const body = Buffer.concat(chunks).toString('utf8');
            const activity: Activity = JSON.parse(body);

            await this.botAdapter.process(
              { body: activity, headers: req.headers } as any,
              { status: (code: number) => ({ send: (b: any) => { res.writeHead(code); res.end(JSON.stringify(b)); } }), end: () => { res.writeHead(200); res.end(); } } as any,
              async (context: TurnContext) => {
                await this.handleTurn(context);
              },
            );
          } catch (err: any) {
            logger.error('Failed to process Teams activity', { error: err.message });
            res.writeHead(500);
            res.end();
          }
        });

        req.on('error', (err: Error) => {
          logger.warn('Teams request stream error', { error: err.message });
        });
      } else if (req.method === 'GET' && req.url === '/healthz') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', adapter: 'teams' }));
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    await new Promise<void>((resolve) => {
      this.server.listen(this.teamsPort, () => {
        logger.info('Teams adapter listening', { port: this.teamsPort });
        resolve();
      });
    });
  }

  private async handleTurn(context: TurnContext): Promise<void> {
    // Save conversation reference for proactive messaging
    const ref = TurnContext.getConversationReference(context.activity);
    const channelChatId = context.activity.conversation?.id || '';
    if (channelChatId) {
      this.conversationRefs.set(channelChatId, ref);
    }

    if (context.activity.type === ActivityTypes.Message) {
      const text = context.activity.text || '';
      const from = context.activity.from;

      // Handle file attachments
      const attachments = context.activity.attachments || [];
      const fileAttachment = attachments.find(
        (a) => a.contentType && !a.contentType.startsWith('application/vnd.microsoft.card'),
      );

      await this.handleInbound({
        channelUserId: from.id,
        channelChatId,
        channelMessageId: context.activity.id || Date.now().toString(),
        displayName: from.name,
        chatName: context.activity.conversation?.name || 'Teams Chat',
        chatType: context.activity.conversation?.isGroup ? 'group' : 'dm',
        text: text || undefined,
        fileUrl: fileAttachment?.contentUrl,
        fileName: fileAttachment?.name,
        fileMime: fileAttachment?.contentType,
        metadata: {
          tenant_id: (context.activity as any).channelData?.tenant?.id,
          team_id: (context.activity as any).channelData?.team?.id,
        },
      });
    } else if (context.activity.type === ActivityTypes.Invoke) {
      // Handle Adaptive Card action
      const value = context.activity.value as any;
      if (value?.action && value?.approval_id) {
        try {
          await this.gateway.sendMessage('teams', {
            channel_message_id: context.activity.id || Date.now().toString(),
            chat_id: '',
            sender_identity_id: '',
            text: `${value.action} ${value.approval_id}`,
            metadata: {
              is_approval_vote: true,
              approval_id: value.approval_id,
              vote: value.action,
              voter_teams_id: context.activity.from.id,
            },
          });

          await context.sendActivity('✅ Vote recorded');
        } catch (err: any) {
          logger.error('failed to record approval vote', {
            error: String(err?.message || err),
            approval_id: value.approval_id,
            vote: value.action,
            voter_teams_id: context.activity.from.id,
          });
          await context.sendActivity('❌ Failed to record vote. Please try again.');
        }
      }
    }
  }

  protected async disconnect(): Promise<void> {
    await new Promise<void>((resolve) => this.server.close(() => resolve()));
  }

  // ──── Outbound: Text ──────────────────────────────────────────

  protected async sendText(
    channelChatId: string,
    text: string,
    _item: OutboxItem,
  ): Promise<void> {
    const ref = this.conversationRefs.get(channelChatId);
    if (!ref) {
      logger.warn('No conversation reference for Teams chat', { channelChatId });
      return;
    }

    await this.botAdapter.continueConversationAsync(
      this.microsoftAppId,
      ref as any,
      async (context: TurnContext) => {
        await context.sendActivity(MessageFactory.text(text));
      },
    );
  }

  // ──── Outbound: Blocks → Adaptive Card ────────────────────────

  protected override async sendBlocks(
    channelChatId: string,
    blocks: CanvasBlock[],
    fallbackText?: string,
    item?: OutboxItem,
  ): Promise<void> {
    const ref = this.conversationRefs.get(channelChatId);
    if (!ref) {
      // Fallback to text
      await this.sendText(channelChatId, fallbackText || this.blocksToText(blocks), item!);
      return;
    }

    const cardBody = blocks.map((b) => canvasBlockToAdaptiveElement(b)).flat();

    const card = CardFactory.adaptiveCard({
      $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
      type: 'AdaptiveCard',
      version: '1.5',
      body: cardBody,
    });

    await this.botAdapter.continueConversationAsync(
      this.microsoftAppId,
      ref as any,
      async (context: TurnContext) => {
        await context.sendActivity({ attachments: [card] });
      },
    );
  }

  // ──── Outbound: File ──────────────────────────────────────────

  protected async sendFile(
    channelChatId: string,
    fileUrl: string,
    caption?: string,
    item?: OutboxItem,
  ): Promise<void> {
    const text = caption ? `${caption}\n📎 ${fileUrl}` : `📎 ${fileUrl}`;
    await this.sendText(channelChatId, text, item!);
  }

  // ──── Outbound: Audio ─────────────────────────────────────────

  protected async sendAudio(
    channelChatId: string,
    audioUrl: string,
    caption?: string,
    item?: OutboxItem,
  ): Promise<void> {
    const text = caption ? `🎵 ${caption}\n${audioUrl}` : `🎵 ${audioUrl}`;
    await this.sendText(channelChatId, text, item!);
  }

  // ──── Outbound: Approval Buttons (Adaptive Card Actions) ──────

  protected override async sendApprovalButtons(
    channelChatId: string,
    buttons: ApprovalButton[],
    _item: OutboxItem,
  ): Promise<void> {
    const ref = this.conversationRefs.get(channelChatId);
    if (!ref) return;

    const actions = buttons.map((btn) => ({
      type: 'Action.Submit',
      title: btn.label,
      data: { action: btn.action, approval_id: btn.approval_id },
      style: btn.action === 'approve' ? 'positive' : 'destructive',
    }));

    const card = CardFactory.adaptiveCard({
      $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
      type: 'AdaptiveCard',
      version: '1.5',
      body: [
        { type: 'TextBlock', text: '🗳 Approval Required', weight: 'Bolder', size: 'Medium' },
      ],
      actions,
    });

    await this.botAdapter.continueConversationAsync(
      this.microsoftAppId,
      ref as any,
      async (context: TurnContext) => {
        await context.sendActivity({ attachments: [card] });
      },
    );
  }
}

function normalizeMaxBodyBytes(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 512 * 1024;
  return Math.min(Math.max(Math.floor(raw), 16 * 1024), 10 * 1024 * 1024);
}

function writeJson(res: http.ServerResponse, statusCode: number, payload: unknown): void {
  if (res.writableEnded) return;
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

// ──── Helpers ────────────────────────────────────────────────────────────────

function canvasBlockToAdaptiveElement(block: CanvasBlock): any[] {
  switch (block.type) {
    case 'markdown': {
      const text = typeof block.content === 'string' ? block.content : JSON.stringify(block.content);
      return [{ type: 'TextBlock', text, wrap: true }];
    }
    case 'code': {
      const c = block.content as { language?: string; code?: string };
      return [
        { type: 'TextBlock', text: c.language || 'Code', weight: 'Bolder' },
        { type: 'TextBlock', text: c.code || '', fontType: 'Monospace', wrap: true },
      ];
    }
    case 'tool_card': {
      const tc = block.content as { tool_name?: string; status?: string };
      return [{
        type: 'ColumnSet',
        columns: [
          { type: 'Column', width: 'auto', items: [{ type: 'TextBlock', text: `🔧 ${tc.tool_name}` }] },
          { type: 'Column', width: 'auto', items: [{ type: 'TextBlock', text: tc.status || '', color: tc.status === 'success' ? 'Good' : 'Attention' }] },
        ],
      }];
    }
    default: {
      const text = typeof block.content === 'string' ? block.content : JSON.stringify(block.content);
      return [{ type: 'TextBlock', text, wrap: true }];
    }
  }
}

// ──── Main ───────────────────────────────────────────────────────────────────

runAdapter(TeamsAdapter as any, {
  microsoftAppId: process.env.TEAMS_APP_ID || process.env.MICROSOFT_APP_ID || '',
  microsoftAppPassword: process.env.TEAMS_APP_PASSWORD || process.env.MICROSOFT_APP_PASSWORD || '',
  teamsPort: parseInt(process.env.TEAMS_PORT || '3978', 10),
});
