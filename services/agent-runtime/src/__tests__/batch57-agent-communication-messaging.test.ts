import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

function readFile(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8');
}

/* ================================================================== */
/*  Batch 57 — Agent Communication & Messaging                        */
/* ================================================================== */

describe('Batch 57 — Agent Communication & Messaging', () => {

  /* ---- Migration ------------------------------------------------- */
  describe('Migration SQL', () => {
    const sql = readFile('services/gateway-api/migrations/20260530120000_agent_communication_messaging.sql');

    it('creates agent_channels table', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_channels');
    });

    it('creates channel_members table', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS channel_members');
    });

    it('creates agent_messages table', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_messages');
    });

    it('creates message_reactions table', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS message_reactions');
    });

    it('creates agent_presence table', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_presence');
    });

    it('has channel_type CHECK constraint', () => {
      expect(sql).toContain("'public','private','direct','broadcast','system'");
    });

    it('has member role CHECK constraint', () => {
      expect(sql).toContain("'owner','admin','member','guest','bot'");
    });

    it('has message type CHECK constraint', () => {
      expect(sql).toContain("'text','code','file','image','system','action','embed'");
    });

    it('has presence status CHECK constraint', () => {
      expect(sql).toContain("'online','away','busy','offline','dnd'");
    });

    it('has at least 17 indexes', () => {
      const idxCount = (sql.match(/CREATE INDEX IF NOT EXISTS/g) || []).length;
      expect(idxCount).toBeGreaterThanOrEqual(17);
    });

    it('has UNIQUE constraint on channel_members', () => {
      expect(sql).toContain('UNIQUE (channel_id, agent_id)');
    });

    it('has UNIQUE constraint on message_reactions', () => {
      expect(sql).toContain('UNIQUE (message_id, agent_id, emoji)');
    });
  });

  /* ---- Shared types ---------------------------------------------- */
  describe('Shared types — ChannelType', () => {
    const src = readFile('packages/shared/src/agent-communication-messaging.ts');

    it('defines ChannelType with 5 values', () => {
      const m = src.match(/export type ChannelType\s*=\s*([^;]+);/);
      expect(m).toBeTruthy();
      const count = (m![1].match(/'/g) || []).length / 2;
      expect(count).toBe(5);
    });

    it('includes public and direct', () => {
      expect(src).toContain("'public'");
      expect(src).toContain("'direct'");
    });
  });

  describe('Shared types — MemberRole', () => {
    const src = readFile('packages/shared/src/agent-communication-messaging.ts');

    it('defines MemberRole with 5 values', () => {
      const m = src.match(/export type MemberRole\s*=\s*([^;]+);/);
      expect(m).toBeTruthy();
      const count = (m![1].match(/'/g) || []).length / 2;
      expect(count).toBe(5);
    });
  });

  describe('Shared types — AgentcMessageType', () => {
    const src = readFile('packages/shared/src/agent-communication-messaging.ts');

    it('defines AgentcMessageType with 7 values', () => {
      const m = src.match(/export type AgentcMessageType\s*=\s*([^;]+);/);
      expect(m).toBeTruthy();
      const count = (m![1].match(/'/g) || []).length / 2;
      expect(count).toBe(7);
    });
  });

  describe('Shared types — PresenceStatus', () => {
    const src = readFile('packages/shared/src/agent-communication-messaging.ts');

    it('defines PresenceStatus with 5 values', () => {
      const m = src.match(/export type PresenceStatus\s*=\s*([^;]+);/);
      expect(m).toBeTruthy();
      const count = (m![1].match(/'/g) || []).length / 2;
      expect(count).toBe(5);
    });
  });

  describe('Shared types — MessageSortBy', () => {
    const src = readFile('packages/shared/src/agent-communication-messaging.ts');

    it('defines MessageSortBy with 5 values', () => {
      const m = src.match(/export type MessageSortBy\s*=\s*([^;]+);/);
      expect(m).toBeTruthy();
      const count = (m![1].match(/'/g) || []).length / 2;
      expect(count).toBe(5);
    });
  });

  describe('Shared types — ChannelPermission', () => {
    const src = readFile('packages/shared/src/agent-communication-messaging.ts');

    it('defines ChannelPermission with 5 values', () => {
      const m = src.match(/export type ChannelPermission\s*=\s*([^;]+);/);
      expect(m).toBeTruthy();
      const count = (m![1].match(/'/g) || []).length / 2;
      expect(count).toBe(5);
    });
  });

  describe('Shared types — MessagingAction', () => {
    const src = readFile('packages/shared/src/agent-communication-messaging.ts');

    it('defines MessagingAction with 7 values', () => {
      const m = src.match(/export type MessagingAction\s*=\s*([^;]+);/);
      expect(m).toBeTruthy();
      const count = (m![1].match(/'/g) || []).length / 2;
      expect(count).toBe(7);
    });
  });

  describe('Shared types — interfaces & constants & helpers', () => {
    const src = readFile('packages/shared/src/agent-communication-messaging.ts');

    it('exports 5 interfaces', () => {
      const count = (src.match(/export interface /g) || []).length;
      expect(count).toBe(5);
    });

    it('exports 6 constants', () => {
      const count = (src.match(/export const /g) || []).length;
      expect(count).toBe(6);
    });

    it('exports 4 helper functions', () => {
      const count = (src.match(/export function /g) || []).length;
      expect(count).toBe(4);
    });

    it('isChannelJoinable returns false for archived', () => {
      const mod = require('../../../../packages/shared/src/agent-communication-messaging');
      expect(mod.isChannelJoinable('public', true)).toBe(false);
      expect(mod.isChannelJoinable('public', false)).toBe(true);
      expect(mod.isChannelJoinable('private', false)).toBe(false);
    });

    it('canManageChannel returns true for owner/admin', () => {
      const mod = require('../../../../packages/shared/src/agent-communication-messaging');
      expect(mod.canManageChannel('owner')).toBe(true);
      expect(mod.canManageChannel('admin')).toBe(true);
      expect(mod.canManageChannel('member')).toBe(false);
    });

    it('isPresenceActive returns true for online/busy', () => {
      const mod = require('../../../../packages/shared/src/agent-communication-messaging');
      expect(mod.isPresenceActive('online')).toBe(true);
      expect(mod.isPresenceActive('busy')).toBe(true);
      expect(mod.isPresenceActive('away')).toBe(false);
    });

    it('formatMention creates @mention', () => {
      const mod = require('../../../../packages/shared/src/agent-communication-messaging');
      expect(mod.formatMention('agent-1')).toBe('@agent-1');
    });
  });

  /* ---- Barrel export --------------------------------------------- */
  describe('Barrel export (index.ts)', () => {
    const src = readFile('packages/shared/src/index.ts');

    it('exports agent-communication-messaging', () => {
      expect(src).toContain("agent-communication-messaging");
    });

    it('has at least 82 lines', () => {
      const lines = src.split('\n').length;
      expect(lines).toBeGreaterThanOrEqual(82);
    });
  });

  /* ---- SKILL.md -------------------------------------------------- */
  describe('SKILL.md', () => {
    const skill = readFile('skills/autonomous-economy/agent-messaging/SKILL.md');

    it('has correct skill identifier', () => {
      expect(skill).toMatch(/skill:\s*agent-messaging/);
    });

    it('has 7 action headings', () => {
      const headings = (skill.match(/^### /gm) || []).length;
      expect(headings).toBe(7);
    });

    it('contains channel_create action', () => {
      expect(skill).toContain('channel_create');
    });

    it('contains presence_update action', () => {
      expect(skill).toContain('presence_update');
    });

    it('contains broadcast_send action', () => {
      expect(skill).toContain('broadcast_send');
    });
  });

  /* ---- Eidolon types --------------------------------------------- */
  describe('Eidolon types', () => {
    const src = readFile('services/sven-eidolon/src/types.ts');

    it('has comm_tower building kind', () => {
      expect(src).toContain("'comm_tower'");
    });

    it('has 40 building kinds', () => {
      const block = src.match(/export type EidolonBuildingKind\s*=([\s\S]*?);/);
      expect(block).toBeTruthy();
      const pipeCount = (block![1].match(/\|/g) || []).length;
      expect(pipeCount).toBe(40);
    });

    it('has 176 event kinds', () => {
      const block = src.match(/export type EidolonEventKind\s*=([\s\S]*?'heartbeat';)/);
      expect(block).toBeTruthy();
      const pipeCount = (block![1].match(/\|/g) || []).length;
      expect(pipeCount).toBe(176);
    });

    it('has messaging event kinds', () => {
      expect(src).toContain("'messaging.channel_created'");
      expect(src).toContain("'messaging.message_sent'");
      expect(src).toContain("'messaging.presence_changed'");
      expect(src).toContain("'messaging.broadcast_sent'");
    });

    it('districtFor maps comm_tower to civic', () => {
      expect(src).toContain("case 'comm_tower':");
      expect(src).toContain("return 'civic'");
    });

    it('has 40 districtFor cases', () => {
      const count = (src.match(/case '/g) || []).length;
      expect(count).toBe(40);
    });
  });

  /* ---- Event bus ------------------------------------------------- */
  describe('Event bus (SUBJECT_MAP)', () => {
    const src = readFile('services/sven-eidolon/src/event-bus.ts');

    it('has 175 SUBJECT_MAP entries', () => {
      const mapMatch = src.match(/SUBJECT_MAP[^{]*\{([^}]+)\}/s);
      expect(mapMatch).toBeTruthy();
      const entryCount = (mapMatch![1].match(/^\s+'/gm) || []).length;
      expect(entryCount).toBe(175);
    });

    it('has messaging NATS subjects', () => {
      expect(src).toContain("'sven.messaging.channel_created'");
      expect(src).toContain("'sven.messaging.message_sent'");
      expect(src).toContain("'sven.messaging.presence_changed'");
      expect(src).toContain("'sven.messaging.broadcast_sent'");
    });
  });

  /* ---- Task executor --------------------------------------------- */
  describe('Task executor — switch cases', () => {
    const src = readFile('services/sven-marketplace/src/task-executor.ts');

    it('has 180 switch cases', () => {
      const count = (src.match(/case '/g) || []).length;
      expect(count).toBe(180);
    });

    it('has messaging switch cases', () => {
      expect(src).toContain("case 'channel_create':");
      expect(src).toContain("case 'channel_join':");
      expect(src).toContain("case 'message_send':");
      expect(src).toContain("case 'message_react':");
      expect(src).toContain("case 'presence_update':");
      expect(src).toContain("case 'thread_reply':");
      expect(src).toContain("case 'broadcast_send':");
    });
  });

  describe('Task executor — handler methods', () => {
    const src = readFile('services/sven-marketplace/src/task-executor.ts');

    it('has 176 handler methods', () => {
      const count = (src.match(/private (?:async )?handle[A-Z]/g) || []).length;
      expect(count).toBe(176);
    });

    it('has handleChannelCreate', () => {
      expect(src).toContain('handleChannelCreate');
    });

    it('has handleChannelJoin', () => {
      expect(src).toContain('handleChannelJoin');
    });

    it('has handleMessageSend', () => {
      expect(src).toContain('handleMessageSend');
    });

    it('has handleMessageReact', () => {
      expect(src).toContain('handleMessageReact');
    });

    it('has handlePresenceUpdate', () => {
      expect(src).toContain('handlePresenceUpdate');
    });

    it('has handleThreadReply', () => {
      expect(src).toContain('handleThreadReply');
    });

    it('has handleBroadcastSend', () => {
      expect(src).toContain('handleBroadcastSend');
    });
  });

  /* ---- .gitattributes -------------------------------------------- */
  describe('.gitattributes', () => {
    const src = readFile('.gitattributes');

    it('marks migration export-ignore', () => {
      expect(src).toContain('20260530120000_agent_communication_messaging.sql export-ignore');
    });

    it('marks shared types export-ignore', () => {
      expect(src).toContain('agent-communication-messaging.ts export-ignore');
    });

    it('marks skill export-ignore', () => {
      expect(src).toContain('agent-messaging/** export-ignore');
    });
  });

  /* ---- CHANGELOG ------------------------------------------------- */
  describe('CHANGELOG', () => {
    const src = readFile('CHANGELOG.md');

    it('has Batch 57 entry', () => {
      expect(src).toContain('Batch 57');
    });

    it('mentions Agent Communication & Messaging', () => {
      expect(src).toContain('Agent Communication & Messaging');
    });
  });

  /* ---- Migrations count ------------------------------------------ */
  describe('Migration file count', () => {
    it('has 43 migration SQL files', () => {
      const migDir = path.join(ROOT, 'services/gateway-api/migrations');
      const files = fs.readdirSync(migDir).filter((f: string) => f.endsWith('.sql'));
      expect(files.length).toBe(43);
    });
  });
});
