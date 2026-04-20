import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

function read(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf-8');
}

// ─── Migration SQL ─────────────────────────────────────────────────────────
describe('Batch 40 — Migration', () => {
  const sql = read('services/gateway-api/migrations/20260513120000_agent_collaboration.sql');

  it('creates agent_collaborations table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_collaborations');
  });

  it('creates agent_teams table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_teams');
  });

  it('creates agent_team_members table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_team_members');
  });

  it('creates agent_social_interactions table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_social_interactions');
  });

  it('has collaboration_type CHECK constraint', () => {
    expect(sql).toContain("'joint_project'");
    expect(sql).toContain("'mentorship'");
    expect(sql).toContain("'peer_review'");
    expect(sql).toContain("'skill_exchange'");
    expect(sql).toContain("'co_creation'");
    expect(sql).toContain("'delegation'");
  });

  it('has team_type CHECK constraint', () => {
    expect(sql).toContain("'project'");
    expect(sql).toContain("'guild'");
    expect(sql).toContain("'squad'");
    expect(sql).toContain("'research_group'");
    expect(sql).toContain("'creative_studio'");
  });

  it('has interaction_type CHECK constraint', () => {
    expect(sql).toContain("'endorsement'");
    expect(sql).toContain("'mentoring_session'");
    expect(sql).toContain("'knowledge_transfer'");
    expect(sql).toContain("'debate'");
  });

  it('creates 9 indexes', () => {
    const indexCount = (sql.match(/CREATE INDEX/g) || []).length;
    expect(indexCount).toBe(9);
  });

  it('has foreign key on agent_team_members', () => {
    expect(sql).toContain('REFERENCES agent_teams(id)');
  });

  it('has trust_score column', () => {
    expect(sql).toContain('trust_score');
  });

  it('has sentiment CHECK constraint', () => {
    expect(sql).toContain("'positive'");
    expect(sql).toContain("'neutral'");
    expect(sql).toContain("'negative'");
    expect(sql).toContain("'mixed'");
  });
});

// ─── Shared Types ──────────────────────────────────────────────────────────
describe('Batch 40 — Shared Types', () => {
  const src = read('packages/shared/src/agent-collaboration.ts');

  it('exports CollaborationType', () => {
    expect(src).toContain('export type CollaborationType');
  });

  it('exports CollaborationStatus', () => {
    expect(src).toContain('export type CollaborationStatus');
  });

  it('exports TeamType', () => {
    expect(src).toContain('export type TeamType');
  });

  it('exports TeamStatus', () => {
    expect(src).toContain('export type TeamStatus');
  });

  it('exports TeamMemberRole', () => {
    expect(src).toContain('export type TeamMemberRole');
  });

  it('exports SocialInteractionType', () => {
    expect(src).toContain('export type SocialInteractionType');
  });

  it('exports Sentiment', () => {
    expect(src).toContain('export type Sentiment');
  });

  it('CollaborationType has 8 values', () => {
    expect(src).toContain("'joint_project'");
    expect(src).toContain("'mentorship'");
    expect(src).toContain("'peer_review'");
    expect(src).toContain("'knowledge_share'");
    expect(src).toContain("'skill_exchange'");
    expect(src).toContain("'resource_pooling'");
    expect(src).toContain("'co_creation'");
    expect(src).toContain("'delegation'");
  });

  it('TeamType has 8 values', () => {
    expect(src).toContain("'project'");
    expect(src).toContain("'guild'");
    expect(src).toContain("'squad'");
    expect(src).toContain("'council'");
    expect(src).toContain("'research_group'");
    expect(src).toContain("'service_crew'");
    expect(src).toContain("'trading_desk'");
    expect(src).toContain("'creative_studio'");
  });

  it('SocialInteractionType has 12 values', () => {
    expect(src).toContain("'endorsement'");
    expect(src).toContain("'recommendation'");
    expect(src).toContain("'challenge'");
    expect(src).toContain("'greeting'");
    expect(src).toContain("'trade_proposal'");
    expect(src).toContain("'feedback'");
    expect(src).toContain("'mentoring_session'");
    expect(src).toContain("'dispute'");
    expect(src).toContain("'gift'");
    expect(src).toContain("'alliance_offer'");
    expect(src).toContain("'knowledge_transfer'");
    expect(src).toContain("'debate'");
  });
});

describe('Batch 40 — Shared Interfaces', () => {
  const src = read('packages/shared/src/agent-collaboration.ts');

  it('exports AgentCollaboration interface', () => {
    expect(src).toContain('export interface AgentCollaboration');
  });

  it('exports AgentTeam interface', () => {
    expect(src).toContain('export interface AgentTeam');
  });

  it('exports AgentTeamMember interface', () => {
    expect(src).toContain('export interface AgentTeamMember');
  });

  it('exports AgentSocialInteraction interface', () => {
    expect(src).toContain('export interface AgentSocialInteraction');
  });
});

describe('Batch 40 — Shared Constants', () => {
  const src = read('packages/shared/src/agent-collaboration.ts');

  it('exports COLLABORATION_TYPES array', () => {
    expect(src).toContain('export const COLLABORATION_TYPES');
  });

  it('exports TEAM_TYPES array', () => {
    expect(src).toContain('export const TEAM_TYPES');
  });

  it('exports SOCIAL_INTERACTION_TYPES array', () => {
    expect(src).toContain('export const SOCIAL_INTERACTION_TYPES');
  });

  it('exports COLLABORATION_STATUS_ORDER', () => {
    expect(src).toContain('export const COLLABORATION_STATUS_ORDER');
  });

  it('exports TEAM_STATUS_ORDER', () => {
    expect(src).toContain('export const TEAM_STATUS_ORDER');
  });

  it('exports TEAM_TYPE_LABELS', () => {
    expect(src).toContain('export const TEAM_TYPE_LABELS');
  });
});

describe('Batch 40 — Shared Helpers', () => {
  const src = read('packages/shared/src/agent-collaboration.ts');

  it('exports canAdvanceCollaboration', () => {
    expect(src).toContain('export function canAdvanceCollaboration');
  });

  it('exports canAdvanceTeam', () => {
    expect(src).toContain('export function canAdvanceTeam');
  });

  it('exports isTrustworthy', () => {
    expect(src).toContain('export function isTrustworthy');
  });

  it('exports calculateTeamCapacity', () => {
    expect(src).toContain('export function calculateTeamCapacity');
  });
});

// ─── Shared Index ──────────────────────────────────────────────────────────
describe('Batch 40 — Shared Index', () => {
  const idx = read('packages/shared/src/index.ts');

  it('exports agent-collaboration module', () => {
    expect(idx).toContain("export * from './agent-collaboration.js'");
  });

  it('has 65 lines', () => {
    const lines = idx.split('\n').length;
    expect(lines).toBe(66);
  });
});

// ─── SKILL.md ──────────────────────────────────────────────────────────────
describe('Batch 40 — SKILL.md', () => {
  const skill = read('skills/autonomous-economy/agent-collaboration/SKILL.md');

  it('has name: agent-collaboration', () => {
    expect(skill).toContain('name: agent-collaboration');
  });

  it('has 7 actions', () => {
    const actionCount = (skill.match(/^### /gm) || []).length;
    expect(actionCount).toBe(7);
  });

  it('has propose-collaboration action', () => {
    expect(skill).toContain('### propose-collaboration');
  });

  it('has respond-collaboration action', () => {
    expect(skill).toContain('### respond-collaboration');
  });

  it('has create-team action', () => {
    expect(skill).toContain('### create-team');
  });

  it('has join-team action', () => {
    expect(skill).toContain('### join-team');
  });

  it('has social-interact action', () => {
    expect(skill).toContain('### social-interact');
  });

  it('has team-report action', () => {
    expect(skill).toContain('### team-report');
  });

  it('has trust-network action', () => {
    expect(skill).toContain('### trust-network');
  });

  it('references Trust & Reputation System', () => {
    expect(skill).toContain('Trust & Reputation System');
  });

  it('references Team Lifecycle', () => {
    expect(skill).toContain('Team Lifecycle');
  });

  it('references Revenue Model', () => {
    expect(skill).toContain('Revenue Model');
  });
});

// ─── Eidolon Types ─────────────────────────────────────────────────────────
describe('Batch 40 — Eidolon Types', () => {
  const types = read('services/sven-eidolon/src/types.ts');

  it('has collaboration_hub building kind', () => {
    expect(types).toContain("| 'collaboration_hub'");
  });

  it('has 24 building kinds', () => {
    const caseCount = (types.match(/case '/g) || []).length;
    expect(caseCount).toBe(24);
  });

  it('has collaboration.proposed event', () => {
    expect(types).toContain("| 'collaboration.proposed'");
  });

  it('has collaboration.completed event', () => {
    expect(types).toContain("| 'collaboration.completed'");
  });

  it('has team.formed event', () => {
    expect(types).toContain("| 'team.formed'");
  });

  it('has social.interaction event', () => {
    expect(types).toContain("| 'social.interaction'");
  });

  it('districtFor collaboration_hub returns residential', () => {
    expect(types).toContain("case 'collaboration_hub':");
    expect(types).toContain("return 'residential'");
  });
});

// ─── Event Bus ─────────────────────────────────────────────────────────────
describe('Batch 40 — Event Bus', () => {
  const bus = read('services/sven-eidolon/src/event-bus.ts');

  it('maps sven.collaboration.proposed', () => {
    expect(bus).toContain("'sven.collaboration.proposed': 'collaboration.proposed'");
  });

  it('maps sven.collaboration.completed', () => {
    expect(bus).toContain("'sven.collaboration.completed': 'collaboration.completed'");
  });

  it('maps sven.team.formed', () => {
    expect(bus).toContain("'sven.team.formed': 'team.formed'");
  });

  it('maps sven.social.interaction', () => {
    expect(bus).toContain("'sven.social.interaction': 'social.interaction'");
  });

  it('has 107 SUBJECT_MAP entries', () => {
    const count = (bus.match(/'sven\./g) || []).length;
    expect(count).toBe(107);
  });
});

// ─── Task Executor ─────────────────────────────────────────────────────────
describe('Batch 40 — Task Executor', () => {
  const exec = read('services/sven-marketplace/src/task-executor.ts');

  it('has collaboration_propose case', () => {
    expect(exec).toContain("case 'collaboration_propose':");
  });

  it('has collaboration_respond case', () => {
    expect(exec).toContain("case 'collaboration_respond':");
  });

  it('has team_create case', () => {
    expect(exec).toContain("case 'team_create':");
  });

  it('has social_interact case', () => {
    expect(exec).toContain("case 'social_interact':");
  });

  it('has handleCollaborationPropose handler', () => {
    expect(exec).toContain('handleCollaborationPropose');
  });

  it('has handleCollaborationRespond handler', () => {
    expect(exec).toContain('handleCollaborationRespond');
  });

  it('has handleTeamCreate handler', () => {
    expect(exec).toContain('handleTeamCreate');
  });

  it('has handleSocialInteract handler', () => {
    expect(exec).toContain('handleSocialInteract');
  });

  it('has 61 switch cases', () => {
    const count = (exec.match(/case '/g) || []).length;
    expect(count).toBe(61);
  });

  it('has 53 handler methods', () => {
    const count = (exec.match(/private async handle/g) || []).length;
    expect(count).toBe(53);
  });
});

// ─── .gitattributes ────────────────────────────────────────────────────────
describe('Batch 40 — .gitattributes', () => {
  const attr = read('.gitattributes');

  it('marks migration as export-ignore', () => {
    expect(attr).toContain('20260513120000_agent_collaboration.sql export-ignore');
  });

  it('marks shared types as export-ignore', () => {
    expect(attr).toContain('agent-collaboration.ts export-ignore');
  });

  it('marks skill as export-ignore', () => {
    expect(attr).toContain('agent-collaboration/** export-ignore');
  });

  it('marks test as export-ignore', () => {
    expect(attr).toContain('batch40-agent-collaboration.test.ts export-ignore');
  });
});
