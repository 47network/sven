// Batch 57 — Agent Communication & Messaging shared types

/* ------------------------------------------------------------------ */
/*  Type unions                                                        */
/* ------------------------------------------------------------------ */

export type ChannelType = 'public' | 'private' | 'direct' | 'broadcast' | 'system';

export type MemberRole = 'owner' | 'admin' | 'member' | 'guest' | 'bot';

export type AgentcMessageType = 'text' | 'code' | 'file' | 'image' | 'system' | 'action' | 'embed';

export type PresenceStatus = 'online' | 'away' | 'busy' | 'offline' | 'dnd';

export type MessageSortBy = 'newest' | 'oldest' | 'most_reactions' | 'most_replies' | 'pinned';

export type ChannelPermission = 'read' | 'write' | 'manage' | 'invite' | 'archive';

export type MessagingAction = 'channel_create' | 'channel_join' | 'message_send' | 'message_react' | 'presence_update' | 'thread_reply' | 'broadcast_send';

/* ------------------------------------------------------------------ */
/*  Interfaces                                                         */
/* ------------------------------------------------------------------ */

export interface AgentChannel {
  id: string;
  name: string;
  channelType: ChannelType;
  topic: string | null;
  createdBy: string;
  isArchived: boolean;
  maxMembers: number;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface ChannelMember {
  id: string;
  channelId: string;
  agentId: string;
  role: MemberRole;
  joinedAt: string;
  mutedUntil: string | null;
}

export interface AgentcAgentMessage {
  id: string;
  channelId: string;
  senderId: string;
  threadId: string | null;
  content: string;
  msgType: AgentcMessageType;
  replyTo: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface MessageReaction {
  id: string;
  messageId: string;
  agentId: string;
  emoji: string;
  createdAt: string;
}

export interface AgentPresence {
  agentId: string;
  status: PresenceStatus;
  statusText: string | null;
  lastSeenAt: string;
  currentChannel: string | null;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

export const CHANNEL_TYPES: readonly ChannelType[] = ['public', 'private', 'direct', 'broadcast', 'system'] as const;

export const MEMBER_ROLES: readonly MemberRole[] = ['owner', 'admin', 'member', 'guest', 'bot'] as const;

export const MESSAGE_TYPES: readonly AgentcMessageType[] = ['text', 'code', 'file', 'image', 'system', 'action', 'embed'] as const;

export const PRESENCE_STATUSES: readonly PresenceStatus[] = ['online', 'away', 'busy', 'offline', 'dnd'] as const;

export const MESSAGE_SORT_OPTIONS: readonly MessageSortBy[] = ['newest', 'oldest', 'most_reactions', 'most_replies', 'pinned'] as const;

export const CHANNEL_PERMISSIONS: readonly ChannelPermission[] = ['read', 'write', 'manage', 'invite', 'archive'] as const;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

export function isChannelJoinable(type: ChannelType, isArchived: boolean): boolean {
  return !isArchived && (type === 'public' || type === 'broadcast');
}

export function canManageChannel(role: MemberRole): boolean {
  return role === 'owner' || role === 'admin';
}

export function isPresenceActive(status: PresenceStatus): boolean {
  return status === 'online' || status === 'busy';
}

export function formatMention(agentId: string): string {
  return `@${agentId}`;
}
