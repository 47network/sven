/**
 * Sven – Matrix Channel Adapter
 *
 * Matrix CS API long-poll sync adapter:
 * - Inbound: /sync timeline parsing for text + media
 * - Outbound: room message send + media upload
 * - Invite handling: auto-join optional
 * - Contract: uses BaseAdapter (resolve identity/chat, outbox, delivery acks)
 */

import { randomUUID } from 'node:crypto';

// Polyfill IndexedDB for Node.js before matrix-js-sdk loads crypto.
// matrix-sdk-crypto-wasm stores OlmMachine state in IndexedDB; fake-indexeddb
// provides an in-memory implementation that satisfies the interface. The
// crypto-persistence module dumps/restores this state to disk for persistence.
import 'fake-indexeddb/auto';

import { createClient, MatrixEvent, type MatrixClient } from 'matrix-js-sdk';
import {
  BaseAdapter,
  type AdapterConfig,
  type ApprovalButton,
  type OutboxItem,
  runAdapter,
  createLogger,
} from '@sven/shared';
import { dumpIndexedDB, restoreIndexedDB } from './crypto-persistence.js';

const logger = createLogger('adapter-matrix');

const MAX_UPLOAD_SIZE = 100 * 1024 * 1024; // 100 MB
const MAX_MESSAGE_BODY = 512 * 1024; // 512 KB
const APPROVAL_REACTION_PATTERN = /^(approve|deny)[:\s]+(.+)$/i;

interface MatrixConfig extends AdapterConfig {
  matrixHomeserverUrl: string;
  matrixAccessToken: string;
  matrixUserId: string;
  matrixDeviceId?: string;
  matrixBotName?: string;
  matrixAutoJoin?: boolean;
  matrixTriggerPrefix?: string;
  matrixSyncMs?: number;
  matrixE2eeEnabled?: boolean;
  matrixReactionApprovalPrefix?: string;
}

type SyncResponse = {
  next_batch?: string;
  rooms?: {
    join?: Record<string, { timeline?: { events?: any[] } }>;
    invite?: Record<string, unknown>;
  };
};

class MatrixAdapter extends BaseAdapter {
  private homeserverUrl: string;
  private accessToken: string;
  private userId: string;
  private deviceId: string;
  private botName: string;
  private autoJoin: boolean;
  private triggerPrefix: string;
  private allowedRooms: Set<string>;
  private syncMs: number;
  private e2eeEnabled: boolean;
  private reactionApprovalPrefix: string;
  private matrixClient: MatrixClient | null = null;
  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private syncSince: string | null = null;
  private syncInFlight = false;
  private directRooms = new Set<string>();
  /** Epoch ms when connect() started — events older than this are initial-sync backfill. */
  private connectEpochMs = 0;
  /** Sliding-window dedup set: recently processed Matrix event_ids (max 2000). */
  private processedEventIds = new Set<string>();

  constructor(config: MatrixConfig) {
    super({ ...config, channel: 'matrix' });
    this.homeserverUrl = (config.matrixHomeserverUrl || process.env.MATRIX_HOMESERVER_URL || '').replace(/\/+$/, '');
    this.accessToken = config.matrixAccessToken || process.env.MATRIX_ACCESS_TOKEN || '';
    this.userId = config.matrixUserId || process.env.MATRIX_USER_ID || '';
    this.deviceId = config.matrixDeviceId || process.env.MATRIX_DEVICE_ID || '';
    this.botName = config.matrixBotName || process.env.MATRIX_BOT_NAME || 'sven';
    this.autoJoin = config.matrixAutoJoin ?? ((process.env.MATRIX_AUTO_JOIN || 'true') !== 'false');
    this.triggerPrefix = config.matrixTriggerPrefix || process.env.MATRIX_TRIGGER_PREFIX || '/sven';
    this.allowedRooms = new Set(
      String(process.env.MATRIX_ALLOWED_ROOM_IDS || '')
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean),
    );
    this.syncMs = Number(config.matrixSyncMs || process.env.MATRIX_SYNC_MS || 1500);
    this.e2eeEnabled = config.matrixE2eeEnabled ?? ((process.env.MATRIX_E2EE_ENABLED || 'false') === 'true');
    this.reactionApprovalPrefix = config.matrixReactionApprovalPrefix || process.env.MATRIX_REACTION_APPROVAL_PREFIX || 'approval:';
  }

  protected async connect(): Promise<void> {
    if (!this.homeserverUrl) throw new Error('MATRIX_HOMESERVER_URL is required');
    if (!this.accessToken) throw new Error('MATRIX_ACCESS_TOKEN is required');
    if (!this.userId) throw new Error('MATRIX_USER_ID is required');

    this.connectEpochMs = Date.now();

    this.matrixClient = createClient({
      baseUrl: this.homeserverUrl,
      accessToken: this.accessToken,
      userId: this.userId,
      ...(this.deviceId ? { deviceId: this.deviceId } : {}),
    });
    await this.matrixClient.whoami();
    if (this.e2eeEnabled && typeof (this.matrixClient as any).initRustCrypto === 'function') {
      try {
        await restoreIndexedDB();
        await (this.matrixClient as any).initRustCrypto({});
        logger.info('Matrix E2EE support initialized (persistent crypto store)');
      } catch (err) {
        logger.warn('Matrix E2EE initialization failed', { error: String(err) });
      }
    }
    await this.refreshDirectRooms();

    if (this.e2eeEnabled && this.matrixClient) {
      // SDK sync handles the Olm/Megolm key-exchange protocol (device-key
      // upload, one-time-key claims, to-device messages, room-key sharing).
      this.matrixClient.on('Room.timeline' as any, (event: MatrixEvent, room: any, toStartOfTimeline: boolean) => {
        if (toStartOfTimeline) return;
        if (!room?.roomId) return;
        if (this.allowedRooms.size > 0 && !this.allowedRooms.has(room.roomId)) return;
        void this.handleTimelineEvent(room.roomId, event.getEffectiveEvent());
      });

      if (this.autoJoin) {
        this.matrixClient.on('RoomMember.membership' as any, (_event: MatrixEvent, member: any) => {
          if (member.membership === 'invite' && member.userId === this.userId) {
            if (this.allowedRooms.size > 0 && !this.allowedRooms.has(member.roomId)) return;
            void this.joinRoom(member.roomId);
          }
        });
      }

      await (this.matrixClient as any).startClient({ initialSyncLimit: 50, disablePresence: true });
      logger.info('Matrix SDK sync started (E2EE mode)');
    } else {
      await this.syncOnce();
      this.syncTimer = setInterval(() => {
        void this.syncOnce();
      }, this.syncMs);
    }

    logger.info('Matrix adapter connected', {
      homeserver: this.homeserverUrl,
      user_id: this.userId,
      auto_join: this.autoJoin,
      e2ee: this.e2eeEnabled,
    });
  }

  protected async disconnect(): Promise<void> {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
    if (this.matrixClient) {
      (this.matrixClient as any).stopClient();
    }
    // Dump AFTER stopping sync so outgoing request queue is flushed.
    if (this.e2eeEnabled) {
      await dumpIndexedDB();
    }
  }

  protected async sendText(channelChatId: string, text: string, item: OutboxItem): Promise<void> {
    await this.sendRoomMessage(
      channelChatId,
      { msgtype: 'm.text', body: text },
      this.getRelationFromOutbox(item),
    );
  }

  protected async sendFile(channelChatId: string, fileUrl: string, caption?: string, item?: OutboxItem): Promise<void> {
    const uploaded = await this.uploadFromUrl(fileUrl);
    if (!uploaded) {
      await this.sendText(channelChatId, [caption, fileUrl].filter(Boolean).join('\n'), item as OutboxItem);
      return;
    }
    await this.sendRoomMessage(channelChatId, {
      msgtype: 'm.file',
      body: caption || 'file',
      filename: caption || 'file',
      url: uploaded.content_uri,
      info: uploaded.info,
    }, this.getRelationFromOutbox(item));
  }

  protected async sendAudio(channelChatId: string, audioUrl: string, caption?: string, item?: OutboxItem): Promise<void> {
    const uploaded = await this.uploadFromUrl(audioUrl);
    if (!uploaded) {
      await this.sendText(
        channelChatId,
        [caption || 'Audio', audioUrl].filter(Boolean).join('\n'),
        item as OutboxItem,
      );
      return;
    }
    await this.sendRoomMessage(channelChatId, {
      msgtype: 'm.audio',
      body: caption || 'audio',
      filename: caption || 'audio',
      url: uploaded.content_uri,
      info: uploaded.info,
    }, this.getRelationFromOutbox(item));
  }

  protected override async sendApprovalButtons(
    channelChatId: string,
    buttons: ApprovalButton[],
    item: OutboxItem,
  ): Promise<void> {
    const lines = buttons.map((b) => `- ${b.label}: \`${b.action} ${b.approval_id}\``);
    await this.sendText(channelChatId, `Approval required\n${lines.join('\n')}`, item);
    if (item.text) {
      await this.sendText(channelChatId, item.text, item);
    }
  }

  private async syncOnce(): Promise<void> {
    if (this.syncInFlight) return;
    this.syncInFlight = true;
    try {
      const query = new URLSearchParams({
        timeout: '1000',
        filter: JSON.stringify({
          room: { timeline: { limit: 50 } },
          account_data: { types: ['m.direct'] },
        }),
      });
      if (this.syncSince) query.set('since', this.syncSince);

      const sync = await this.matrixRequest<SyncResponse>(
        'GET',
        `/_matrix/client/v3/sync?${query.toString()}`,
      );
      this.syncSince = sync.next_batch || this.syncSince;

      if (sync.rooms?.invite && this.autoJoin) {
        for (const roomId of Object.keys(sync.rooms.invite)) {
          if (this.allowedRooms.size > 0 && !this.allowedRooms.has(roomId)) {
            continue;
          }
          await this.joinRoom(roomId);
        }
      }

      if (sync.rooms?.join) {
        for (const [roomId, data] of Object.entries(sync.rooms.join)) {
          if (this.allowedRooms.size > 0 && !this.allowedRooms.has(roomId)) {
            await this.leaveRoom(roomId, 'Room not allowlisted for bot');
            continue;
          }
          const events = data.timeline?.events || [];
          for (const event of events) {
            await this.handleTimelineEvent(roomId, event);
          }
        }
      }
    } catch (err: any) {
      this.logger.warn('Matrix sync failed', { error: String(err?.message || err) });
    } finally {
      this.syncInFlight = false;
    }
  }

  private async handleTimelineEvent(roomId: string, event: any): Promise<void> {
    if (event?.sender === this.userId) return;

    // Skip events from before the adapter connected (initial-sync backfill).
    const originTs = Number(event?.origin_server_ts || 0);
    if (originTs > 0 && originTs < this.connectEpochMs) return;

    // Dedup: skip events we already processed (SDK may fire Room.timeline
    // twice for encrypted events — once encrypted, once after decryption).
    const matrixEventId = String(event?.event_id || '');
    if (matrixEventId && this.processedEventIds.has(matrixEventId)) return;
    // Track immediately to prevent concurrent async entries for the same event.
    if (matrixEventId) {
      this.processedEventIds.add(matrixEventId);
      if (this.processedEventIds.size > 2000) {
        const first = this.processedEventIds.values().next().value;
        if (first !== undefined) this.processedEventIds.delete(first);
      }
    }

    if (event?.type === 'm.reaction') {
      await this.handleReactionEvent(event);
      return;
    }

    if (event?.type === 'm.room.encrypted') {
      const decrypted = await this.tryDecryptEncryptedEvent(roomId, event);
      if (!decrypted) return;
      // Continue processing with decrypted payload (no recursion — event_id
      // is already tracked from the encrypted envelope above).
      event = decrypted;
    }

    if (event?.type !== 'm.room.message') return;
    if (event?.sender === this.userId) return;

    const content = event?.content || {};
    const msgType = String(content?.msgtype || '');
    const rawBody = String(content?.body || '');
    const body = rawBody.length > MAX_MESSAGE_BODY ? rawBody.slice(0, MAX_MESSAGE_BODY) : rawBody;
    const senderId = String(event?.sender || '');
    const eventId = String(event?.event_id || randomUUID());
    if (!senderId) return;

    const dm = this.directRooms.has(roomId);
    const isMention = body.toLowerCase().includes(this.botName.toLowerCase()) || body.includes(this.userId);
    const hasPrefix = body.trim().toLowerCase().startsWith(this.triggerPrefix.toLowerCase());
    if (!dm && !isMention && !hasPrefix) return;

    let text = body;
    if (hasPrefix) {
      text = body.slice(this.triggerPrefix.length).trim();
    } else if (isMention) {
      text = body.replace(this.userId, '').replace(new RegExp(this.botName, 'ig'), '').trim();
    }

    const relatesTo = content?.['m.relates_to'];
    const metadata: Record<string, unknown> = {};
    // Signal to agent-runtime that the adapter already confirmed the trigger
    // (mention or prefix was matched and stripped from the text).
    if (!dm && (isMention || hasPrefix)) {
      metadata.trigger_matched = true;
    }
    if (relatesTo?.event_id) metadata.reply_to_event_id = String(relatesTo.event_id);
    if (relatesTo?.rel_type === 'm.thread' && relatesTo?.event_id) {
      metadata.thread_root_event_id = String(relatesTo.event_id);
    }

    const mxcUrl = String(content?.url || '');
    const mediaUrl = mxcUrl.startsWith('mxc://') ? this.mxcToHttp(mxcUrl) : '';
    const chatType = dm ? 'dm' : 'group';

    if (msgType === 'm.audio' && mediaUrl) {
      await this.handleInbound({
        channelUserId: senderId,
        channelChatId: roomId,
        channelMessageId: eventId,
        displayName: senderId,
        chatName: roomId,
        chatType,
        audioUrl: mediaUrl,
        metadata,
      });
      return;
    }

    if ((msgType === 'm.file' || msgType === 'm.image') && mediaUrl) {
      await this.handleInbound({
        channelUserId: senderId,
        channelChatId: roomId,
        channelMessageId: eventId,
        displayName: senderId,
        chatName: roomId,
        chatType,
        text: text || undefined,
        fileUrl: mediaUrl,
        fileName: String(content?.filename || content?.body || 'file'),
        fileMime: String(content?.info?.mimetype || ''),
        metadata,
      });
      return;
    }

    await this.handleInbound({
      channelUserId: senderId,
      channelChatId: roomId,
      channelMessageId: eventId,
      displayName: senderId,
      chatName: roomId,
      chatType,
      text: text || undefined,
      metadata,
    });
  }

  private async tryDecryptEncryptedEvent(roomId: string, event: any): Promise<any | null> {
    if (!this.e2eeEnabled || !this.matrixClient) return null;
    try {
      const wrapped = new MatrixEvent({ ...event, room_id: roomId });
      await this.matrixClient.decryptEventIfNeeded(wrapped);
      const clear = wrapped.getClearContent();
      if (!clear) return null;
      return {
        ...event,
        type: wrapped.getType(),
        room_id: roomId,
        content: clear,
      };
    } catch (err) {
      logger.warn('Failed to decrypt Matrix event', { error: String(err) });
      return null;
    }
  }

  private async handleReactionEvent(event: any): Promise<void> {
    const senderId = String(event?.sender || '');
    const eventId = String(event?.event_id || randomUUID());
    const relatesTo = event?.content?.['m.relates_to'] || {};
    const key = String(relatesTo?.key || '').trim();
    if (!senderId || !key) return;

    let action = '';
    let approvalId = '';
    const prefixed = APPROVAL_REACTION_PATTERN.exec(key);
    if (prefixed) {
      action = prefixed[1].toLowerCase();
      approvalId = prefixed[2].trim();
    } else if (key.toLowerCase().startsWith(this.reactionApprovalPrefix.toLowerCase())) {
      const rest = key.slice(this.reactionApprovalPrefix.length).trim();
      const parts = rest.split(/\s+/);
      if (parts.length >= 2) {
        action = parts[0].toLowerCase();
        approvalId = parts.slice(1).join(' ').trim();
      }
    }

    if (!approvalId || (action !== 'approve' && action !== 'deny')) return;

    await this.gateway.sendMessage('matrix', {
      channel_message_id: eventId,
      chat_id: '',
      sender_identity_id: '',
      text: `${action} ${approvalId}`,
      metadata: {
        is_approval_vote: true,
        approval_id: approvalId,
        vote: action,
        voter_matrix_id: senderId,
      },
    });
  }

  private async refreshDirectRooms(): Promise<void> {
    try {
      const res = await this.matrixRequest<Record<string, string[]>>(
        'GET',
        `/_matrix/client/v3/user/${encodeURIComponent(this.userId)}/account_data/m.direct`,
      );
      const next = new Set<string>();
      for (const roomIds of Object.values(res || {})) {
        for (const roomId of roomIds || []) next.add(String(roomId));
      }
      this.directRooms = next;
    } catch {
      // Optional account data; continue without it.
    }
  }

  private async joinRoom(roomId: string): Promise<void> {
    try {
      if (this.matrixClient) {
        await this.matrixClient.joinRoom(roomId);
      } else {
        await this.matrixRequest('POST', `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/join`, {});
      }
      this.logger.info('Joined Matrix room', { room_id: roomId });
    } catch (err: any) {
      this.logger.warn('Failed to join Matrix room', { room_id: roomId, error: String(err?.message || err) });
    }
  }

  private async leaveRoom(roomId: string, reason?: string): Promise<void> {
    try {
      if (this.matrixClient) {
        await this.matrixClient.leave(roomId);
      } else {
        await this.matrixRequest(
          'POST',
          `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/leave`,
          reason ? { reason } : {},
        );
      }
      this.logger.info('Left Matrix room', { room_id: roomId, reason });
    } catch (err: any) {
      this.logger.warn('Failed to leave Matrix room', { room_id: roomId, error: String(err?.message || err) });
    }
  }

  private async sendRoomMessage(
    roomId: string,
    content: Record<string, unknown>,
    relation?: Record<string, unknown>,
  ): Promise<void> {
    const txnId = randomUUID();
    const payload = relation ? { ...content, 'm.relates_to': relation } : content;
    if (this.matrixClient) {
      await (this.matrixClient as any).sendEvent(roomId, 'm.room.message', payload, txnId);
      return;
    }
    await this.matrixRequest(
      'PUT',
      `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/m.room.message/${encodeURIComponent(txnId)}`,
      payload,
    );
  }

  private async matrixRequest<T = any>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.homeserverUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let parsed: any = {};
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      parsed = { raw: text };
    }
    if (!res.ok) {
      throw new Error(`Matrix ${method} ${path} failed (${res.status}): ${JSON.stringify(parsed)}`);
    }
    return parsed as T;
  }

  private mxcToHttp(mxc: string): string {
    const rest = mxc.slice('mxc://'.length);
    return `${this.homeserverUrl}/_matrix/media/v3/download/${rest}`;
  }

  private async uploadFromUrl(url: string): Promise<{ content_uri: string; info?: Record<string, unknown> } | null> {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
      const h = parsed.hostname.toLowerCase();
      if (h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '0.0.0.0' || h === '169.254.169.254' || h === 'metadata.google.internal') {
        logger.warn('Upload URL rejected: blocked host', { url: parsed.hostname });
        return null;
      }
      const v4 = h.split('.');
      if (v4.length === 4 && v4.every((p: string) => /^\d+$/.test(p))) {
        const [a, b] = v4.map(Number);
        if (a === 10 || a === 127 || a === 0 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254)) {
          logger.warn('Upload URL rejected: private IP', { url: parsed.hostname });
          return null;
        }
      }
      const res = await fetch(url);
      if (!res.ok) return null;
      const declaredSize = Number(res.headers.get('content-length') || 0);
      if (declaredSize > MAX_UPLOAD_SIZE) {
        logger.warn('File download rejected: Content-Length exceeds limit', { url, size: declaredSize });
        return null;
      }
      const buf = await res.arrayBuffer();
      if (buf.byteLength > MAX_UPLOAD_SIZE) {
        logger.warn('File download rejected: actual size exceeds limit', { url, size: buf.byteLength });
        return null;
      }
      const contentType = res.headers.get('content-type') || 'application/octet-stream';
      const fileName = String(url.split('/').pop() || 'upload.bin');
      let contentUri = '';
      if (this.matrixClient) {
        const uploaded = await this.matrixClient.uploadContent(Buffer.from(buf), {
          name: fileName,
          type: contentType,
        });
        if (typeof uploaded === 'string') contentUri = uploaded;
        else contentUri = String((uploaded as any)?.content_uri || '');
      } else {
        const upload = await fetch(`${this.homeserverUrl}/_matrix/media/v3/upload`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': contentType,
          },
          body: Buffer.from(buf),
        });
        if (!upload.ok) return null;
        const json = await upload.json() as { content_uri?: string };
        contentUri = String(json.content_uri || '');
      }
      if (!contentUri) return null;
      return {
        content_uri: contentUri,
        info: { mimetype: contentType, size: buf.byteLength },
      };
    } catch {
      return null;
    }
  }

  private getRelationFromOutbox(item?: OutboxItem): Record<string, unknown> | undefined {
    const metadataRaw = (item as any)?.metadata;
    if (!metadataRaw || typeof metadataRaw !== 'object') return undefined;
    const metadata = metadataRaw as Record<string, unknown>;
    const threadRoot = typeof metadata.thread_root_event_id === 'string' ? metadata.thread_root_event_id : '';
    const replyTo = typeof metadata.reply_to_event_id === 'string' ? metadata.reply_to_event_id : '';
    if (threadRoot) {
      return {
        rel_type: 'm.thread',
        event_id: threadRoot,
      };
    }
    if (replyTo) {
      return {
        'm.in_reply_to': {
          event_id: replyTo,
        },
      };
    }
    return undefined;
  }
}

runAdapter(MatrixAdapter as any, {
  matrixHomeserverUrl: process.env.MATRIX_HOMESERVER_URL || '',
  matrixAccessToken: process.env.MATRIX_ACCESS_TOKEN || '',
  matrixUserId: process.env.MATRIX_USER_ID || '',
  matrixBotName: process.env.MATRIX_BOT_NAME || 'sven',
  matrixAutoJoin: (process.env.MATRIX_AUTO_JOIN || 'true') !== 'false',
  matrixTriggerPrefix: process.env.MATRIX_TRIGGER_PREFIX || '/sven',
  matrixSyncMs: Number(process.env.MATRIX_SYNC_MS || 1500),
  matrixE2eeEnabled: (process.env.MATRIX_E2EE_ENABLED || 'false') === 'true',
  matrixReactionApprovalPrefix: process.env.MATRIX_REACTION_APPROVAL_PREFIX || 'approval:',
});
