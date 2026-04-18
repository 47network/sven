import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

function read(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf-8');
}

/* ------------------------------------------------------------------ */
/*  1. Migration SQL                                                  */
/* ------------------------------------------------------------------ */
describe('Batch 52 — Migration SQL', () => {
  const sql = read('services/gateway-api/migrations/20260525120000_agent_notifications.sql');

  it('creates agent_notifications table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_notifications');
  });
  it('creates notification_preferences table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS notification_preferences');
  });
  it('creates notification_channels table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS notification_channels');
  });
  it('creates notification_templates table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS notification_templates');
  });
  it('creates escalation_rules table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS escalation_rules');
  });
  it('has 5 CREATE TABLE statements', () => {
    const m = sql.match(/CREATE TABLE IF NOT EXISTS/g);
    expect(m).not.toBeNull();
    expect(m!.length).toBe(5);
  });
  it('has >= 16 indexes', () => {
    const m = sql.match(/CREATE INDEX IF NOT EXISTS/g);
    expect(m).not.toBeNull();
    expect(m!.length).toBeGreaterThanOrEqual(16);
  });
  it('has JSONB columns', () => {
    expect(sql).toContain('JSONB');
  });
  it('has TIMESTAMPTZ columns', () => {
    expect(sql).toContain('TIMESTAMPTZ');
  });
  it('has UNIQUE constraint on preferences', () => {
    expect(sql).toContain('UNIQUE(agent_id, notification_type, channel)');
  });
});

/* ------------------------------------------------------------------ */
/*  2. Shared types                                                   */
/* ------------------------------------------------------------------ */
describe('Batch 52 — Shared types', () => {
  const src = read('packages/shared/src/agent-notifications.ts');

  it('exports NotificationType (9 values)', () => {
    const m = src.match(/export type NotificationType[\s\S]*?;/);
    expect(m).not.toBeNull();
    const count = (m![0].match(/'/g) || []).length / 2;
    expect(count).toBe(9);
  });
  it('exports NotificationChannel (5 values)', () => {
    const m = src.match(/export type NotificationChannel[\s\S]*?;/);
    expect(m).not.toBeNull();
    const count = (m![0].match(/'/g) || []).length / 2;
    expect(count).toBe(5);
  });
  it('exports NotificationPriority (5 values)', () => {
    const m = src.match(/export type NotificationPriority[\s\S]*?;/);
    expect(m).not.toBeNull();
    const count = (m![0].match(/'/g) || []).length / 2;
    expect(count).toBe(5);
  });
  it('exports NotificationStatus (7 values)', () => {
    const m = src.match(/export type NotificationStatus[\s\S]*?;/);
    expect(m).not.toBeNull();
    const count = (m![0].match(/'/g) || []).length / 2;
    expect(count).toBe(7);
  });
  it('exports NotificationFrequency (5 values)', () => {
    const m = src.match(/export type NotificationFrequency[\s\S]*?;/);
    expect(m).not.toBeNull();
    const count = (m![0].match(/'/g) || []).length / 2;
    expect(count).toBe(5);
  });
  it('exports EscalationCondition (5 values)', () => {
    const m = src.match(/export type EscalationCondition[\s\S]*?;/);
    expect(m).not.toBeNull();
    const count = (m![0].match(/'/g) || []).length / 2;
    expect(count).toBe(5);
  });
  it('exports NotificationAction (7 values)', () => {
    const m = src.match(/export type NotificationAction[\s\S]*?;/);
    expect(m).not.toBeNull();
    const count = (m![0].match(/'/g) || []).length / 2;
    expect(count).toBe(7);
  });
  it('exports AgentNotification interface', () => {
    expect(src).toContain('export interface AgentNotification');
  });
  it('exports NotificationPreference interface', () => {
    expect(src).toContain('export interface NotificationPreference');
  });
  it('exports NotificationTemplate interface', () => {
    expect(src).toContain('export interface NotificationTemplate');
  });
  it('exports EscalationRule interface', () => {
    expect(src).toContain('export interface EscalationRule');
  });
  it('exports NotificationDigest interface', () => {
    expect(src).toContain('export interface NotificationDigest');
  });
  it('exports 6 constant arrays', () => {
    expect(src).toContain('NOTIFICATION_TYPES');
    expect(src).toContain('NOTIFICATION_CHANNELS');
    expect(src).toContain('NOTIFICATION_PRIORITIES');
    expect(src).toContain('NOTIFICATION_STATUSES');
    expect(src).toContain('NOTIFICATION_FREQUENCIES');
    expect(src).toContain('NOTIFICATION_ACTIONS');
  });
  it('exports shouldSendNow helper', () => {
    expect(src).toContain('export function shouldSendNow');
  });
  it('exports isHighPriority helper', () => {
    expect(src).toContain('export function isHighPriority');
  });
  it('exports canEscalate helper', () => {
    expect(src).toContain('export function canEscalate');
  });
  it('exports getUnreadCount helper', () => {
    expect(src).toContain('export function getUnreadCount');
  });
});

/* ------------------------------------------------------------------ */
/*  3. Barrel export                                                  */
/* ------------------------------------------------------------------ */
describe('Batch 52 — Barrel export', () => {
  const idx = read('packages/shared/src/index.ts');

  it('re-exports agent-notifications', () => {
    expect(idx).toContain("./agent-notifications");
  });
  it('has >= 77 lines (wc -l reports 77)', () => {
    expect(idx.split('\n').length).toBeGreaterThanOrEqual(77);
  });
});

/* ------------------------------------------------------------------ */
/*  4. SKILL.md                                                       */
/* ------------------------------------------------------------------ */
describe('Batch 52 — SKILL.md', () => {
  const md = read('skills/autonomous-economy/notifications/SKILL.md');

  it('has correct skill identifier', () => {
    expect(md).toMatch(/skill:\s*notifications/);
  });
  it('has 7 actions', () => {
    const actions = [
      'notification_send', 'notification_read', 'preference_update',
      'template_create', 'escalation_configure', 'digest_generate', 'channel_manage',
    ];
    for (const a of actions) {
      expect(md).toContain(a);
    }
  });
  it('has YAML frontmatter', () => {
    expect(md).toMatch(/^---/);
    expect(md).toContain('version: 1.0.0');
  });
});

/* ------------------------------------------------------------------ */
/*  5. Eidolon building kind                                          */
/* ------------------------------------------------------------------ */
describe('Batch 52 — Eidolon building kind', () => {
  const types = read('services/sven-eidolon/src/types.ts');

  it('adds notification_tower building kind', () => {
    expect(types).toContain("'notification_tower'");
  });
  it('has 35 building kinds total', () => {
    const block = types.match(/export type EidolonBuildingKind[\s\S]*?;/);
    expect(block).not.toBeNull();
    const count = (block![0].match(/\|/g) || []).length;
    expect(count).toBe(35);
  });
});

/* ------------------------------------------------------------------ */
/*  6. Eidolon event kinds                                            */
/* ------------------------------------------------------------------ */
describe('Batch 52 — Eidolon event kinds', () => {
  const types = read('services/sven-eidolon/src/types.ts');

  it('adds 4 notification event kinds', () => {
    expect(types).toContain("'notifications.notification_sent'");
    expect(types).toContain("'notifications.notification_read'");
    expect(types).toContain("'notifications.escalation_triggered'");
    expect(types).toContain("'notifications.digest_generated'");
  });
  it('has 156 event kinds total', () => {
    const block = types.match(/export type EidolonEventKind[\s\S]*?;/);
    expect(block).not.toBeNull();
    const count = (block![0].match(/\|/g) || []).length;
    expect(count).toBe(156);
  });
});

/* ------------------------------------------------------------------ */
/*  7. districtFor                                                    */
/* ------------------------------------------------------------------ */
describe('Batch 52 — districtFor', () => {
  const types = read('services/sven-eidolon/src/types.ts');

  it('maps notification_tower to civic', () => {
    expect(types).toContain("case 'notification_tower':");
    expect(types).toContain("return 'civic'");
  });
  it('has 35 cases total', () => {
    const fn = types.match(/export function districtFor[\s\S]*?^}/m);
    expect(fn).not.toBeNull();
    const count = (fn![0].match(/case '/g) || []).length;
    expect(count).toBe(35);
  });
});

/* ------------------------------------------------------------------ */
/*  8. Event-bus SUBJECT_MAP                                          */
/* ------------------------------------------------------------------ */
describe('Batch 52 — Event-bus SUBJECT_MAP', () => {
  const bus = read('services/sven-eidolon/src/event-bus.ts');

  it('adds 4 notification NATS subjects', () => {
    expect(bus).toContain("'sven.notifications.notification_sent'");
    expect(bus).toContain("'sven.notifications.notification_read'");
    expect(bus).toContain("'sven.notifications.escalation_triggered'");
    expect(bus).toContain("'sven.notifications.digest_generated'");
  });
  it('has 155 SUBJECT_MAP entries total', () => {
    const match = bus.match(/SUBJECT_MAP[^{]*\{([^}]+)\}/s);
    expect(match).not.toBeNull();
    const count = (match![1].match(/^\s+'/gm) || []).length;
    expect(count).toBe(155);
  });
});

/* ------------------------------------------------------------------ */
/*  9. Task-executor switch cases                                     */
/* ------------------------------------------------------------------ */
describe('Batch 52 — Task-executor switch cases', () => {
  const tex = read('services/sven-marketplace/src/task-executor.ts');

  it('adds 7 notification switch cases', () => {
    const cases = [
      'notification_send', 'notification_read', 'notification_preference_update',
      'notification_template_create', 'notification_escalation_configure',
      'notification_digest_generate', 'notification_channel_manage',
    ];
    for (const c of cases) {
      expect(tex).toContain(`case '${c}'`);
    }
  });
  it('has 145 switch cases total', () => {
    const m = tex.match(/case '/g);
    expect(m).not.toBeNull();
    expect(m!.length).toBe(145);
  });
});

/* ------------------------------------------------------------------ */
/*  10. Task-executor handler methods                                 */
/* ------------------------------------------------------------------ */
describe('Batch 52 — Task-executor handlers', () => {
  const tex = read('services/sven-marketplace/src/task-executor.ts');

  it('adds 7 notification handler methods', () => {
    expect(tex).toContain('handleNotificationSend');
    expect(tex).toContain('handleNotificationRead');
    expect(tex).toContain('handleNotificationPreferenceUpdate');
    expect(tex).toContain('handleNotificationTemplateCreate');
    expect(tex).toContain('handleNotificationEscalationConfigure');
    expect(tex).toContain('handleNotificationDigestGenerate');
    expect(tex).toContain('handleNotificationChannelManage');
  });
  it('has 141 handler methods total', () => {
    const m = tex.match(/private (?:async )?handle[A-Z]/g);
    expect(m).not.toBeNull();
    expect(m!.length).toBe(141);
  });
});

/* ------------------------------------------------------------------ */
/*  11. .gitattributes                                                */
/* ------------------------------------------------------------------ */
describe('Batch 52 — .gitattributes', () => {
  const ga = read('.gitattributes');

  it('marks migration as export-ignore', () => {
    expect(ga).toContain('20260525120000_agent_notifications.sql export-ignore');
  });
  it('marks shared types as export-ignore', () => {
    expect(ga).toContain('agent-notifications.ts export-ignore');
  });
  it('marks skill as export-ignore', () => {
    expect(ga).toContain('skills/autonomous-economy/notifications/** export-ignore');
  });
});

/* ------------------------------------------------------------------ */
/*  12. File counts                                                   */
/* ------------------------------------------------------------------ */
describe('Batch 52 — File counts', () => {
  it('has >= 38 migration files', () => {
    const dir = path.join(ROOT, 'services/gateway-api/migrations');
    const files = fs.readdirSync(dir).filter((f: string) => f.endsWith('.sql'));
    expect(files.length).toBeGreaterThanOrEqual(38);
  });
});
