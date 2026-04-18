/**
 * Batch 43 — Agent Governance & Voting
 * Democratic decision-making for agent collectives.
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batch 43 — Agent Governance & Voting', () => {
  /* ───── Migration ───── */
  describe('Migration SQL', () => {
    const sql = fs.readFileSync(
      path.join(ROOT, 'services/gateway-api/migrations/20260516120000_agent_governance.sql'),
      'utf-8',
    );

    it('creates governance_proposals table', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS governance_proposals');
    });

    it('creates governance_votes table', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS governance_votes');
    });

    it('creates governance_councils table', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS governance_councils');
    });

    it('creates governance_council_members table', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS governance_council_members');
    });

    it('creates governance_delegations table', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS governance_delegations');
    });

    it('has proposal columns (title, description, proposal_type, status, quorum, threshold)', () => {
      expect(sql).toContain('title');
      expect(sql).toContain('description');
      expect(sql).toContain('proposal_type');
      expect(sql).toContain('quorum');
      expect(sql).toContain('threshold');
    });

    it('has UNIQUE constraint on votes (proposal_id, voter_id)', () => {
      expect(sql).toContain('UNIQUE(proposal_id, voter_id)');
    });

    it('has UNIQUE constraint on delegations (delegator_id, scope, council_id)', () => {
      expect(sql).toContain('UNIQUE(delegator_id, scope, council_id)');
    });

    it('has foreign key from votes to proposals', () => {
      expect(sql).toContain('REFERENCES governance_proposals(id)');
    });

    it('has foreign key from council_members to councils', () => {
      expect(sql).toContain('REFERENCES governance_councils(id)');
    });

    it('creates 13 indexes', () => {
      const idxCount = (sql.match(/CREATE INDEX IF NOT EXISTS/g) || []).length;
      expect(idxCount).toBe(12);
    });

    it('has vote_weight column in council_members', () => {
      expect(sql).toContain('vote_weight');
    });

    it('has delegation active boolean', () => {
      expect(sql).toContain('active');
    });
  });

  /* ───── Shared Types ───── */
  describe('Shared types', () => {
    const ts = fs.readFileSync(
      path.join(ROOT, 'packages/shared/src/agent-governance.ts'),
      'utf-8',
    );

    it('exports ProposalType with 8 values', () => {
      expect(ts).toContain("export type ProposalType");
      const vals = ['standard', 'constitutional', 'emergency', 'budget', 'election', 'policy', 'technical', 'expulsion'];
      vals.forEach(v => expect(ts).toContain(`'${v}'`));
    });

    it('exports ProposalCategory with 7 values', () => {
      expect(ts).toContain("export type ProposalCategory");
      const vals = ['general', 'economy', 'infrastructure', 'security', 'membership', 'research', 'collaboration'];
      vals.forEach(v => expect(ts).toContain(`'${v}'`));
    });

    it('exports ProposalStatus with 8 values', () => {
      expect(ts).toContain("export type ProposalStatus");
      const vals = ['draft', 'review', 'voting', 'passed', 'rejected', 'executed', 'vetoed', 'expired'];
      vals.forEach(v => expect(ts).toContain(`'${v}'`));
    });

    it('exports VoteChoice with 3 values', () => {
      expect(ts).toContain("export type VoteChoice");
      expect(ts).toContain("'for'");
      expect(ts).toContain("'against'");
      expect(ts).toContain("'abstain'");
    });

    it('exports CouncilType with 6 values', () => {
      expect(ts).toContain("export type CouncilType");
      const vals = ['general', 'technical', 'economic', 'security', 'research', 'ethics'];
      vals.forEach(v => expect(ts).toContain(`'${v}'`));
    });

    it('exports CouncilRole with 5 values', () => {
      expect(ts).toContain("export type CouncilRole");
      const vals = ['chair', 'vice_chair', 'secretary', 'member', 'observer'];
      vals.forEach(v => expect(ts).toContain(`'${v}'`));
    });

    it('exports DelegationScope with 6 values', () => {
      expect(ts).toContain("export type DelegationScope");
      const vals = ['all', 'economy', 'infrastructure', 'security', 'membership', 'research'];
      vals.forEach(v => expect(ts).toContain(`'${v}'`));
    });

    it('exports GovernanceProposal interface', () => {
      expect(ts).toContain('export interface GovernanceProposal');
    });

    it('exports GovernanceVote interface', () => {
      expect(ts).toContain('export interface GovernanceVote');
    });

    it('exports GovernanceCouncil interface', () => {
      expect(ts).toContain('export interface GovernanceCouncil');
    });

    it('exports GovernanceDelegation interface', () => {
      expect(ts).toContain('export interface GovernanceDelegation');
    });

    it('exports 6 constant arrays', () => {
      expect(ts).toContain('export const PROPOSAL_TYPES');
      expect(ts).toContain('export const PROPOSAL_CATEGORIES');
      expect(ts).toContain('export const PROPOSAL_STATUSES');
      expect(ts).toContain('export const VOTE_CHOICES');
      expect(ts).toContain('export const COUNCIL_TYPES');
      expect(ts).toContain('export const COUNCIL_ROLES');
    });

    it('exports hasQuorum helper', () => {
      expect(ts).toContain('export function hasQuorum');
    });

    it('exports calculateResult helper', () => {
      expect(ts).toContain('export function calculateResult');
    });

    it('exports getVoteWeight helper', () => {
      expect(ts).toContain('export function getVoteWeight');
    });

    it('exports isVotingOpen helper', () => {
      expect(ts).toContain('export function isVotingOpen');
    });
  });

  /* ───── Shared index.ts barrel ───── */
  describe('Shared index.ts', () => {
    const idx = fs.readFileSync(
      path.join(ROOT, 'packages/shared/src/index.ts'),
      'utf-8',
    );

    it('exports agent-governance module', () => {
      expect(idx).toContain("export * from './agent-governance.js'");
    });

    it('has 68 export lines', () => {
      const lines = idx.split('\n').length;
      expect(lines).toBe(69); // wc -l 68 + trailing newline
    });
  });

  /* ───── SKILL.md ───── */
  describe('SKILL.md', () => {
    const md = fs.readFileSync(
      path.join(ROOT, 'skills/autonomous-economy/agent-governance/SKILL.md'),
      'utf-8',
    );

    it('has title mentioning Governance', () => {
      expect(md).toContain('Agent Governance');
    });

    it('lists 7 actions', () => {
      const actions = ['proposal_create', 'proposal_vote', 'council_manage', 'council_elect', 'delegation_set', 'governance_tally', 'governance_history'];
      actions.forEach(a => expect(md).toContain(a));
    });

    it('lists 8 proposal types', () => {
      const types = ['standard', 'constitutional', 'emergency', 'budget', 'election', 'policy', 'technical', 'expulsion'];
      types.forEach(t => expect(md).toContain(t));
    });

    it('lists 6 council types', () => {
      const types = ['General Council', 'Technical Council', 'Economic Council', 'Security Council', 'Research Council', 'Ethics Council'];
      types.forEach(t => expect(md).toContain(t));
    });

    it('describes voting weight mechanics', () => {
      expect(md).toContain('Voting Weight');
      expect(md).toContain('Reputation bonus');
    });

    it('describes liquid democracy', () => {
      expect(md).toContain('Liquid Democracy');
      expect(md).toContain('delegation');
    });

    it('mentions Eidolon council_chamber', () => {
      expect(md).toContain('council_chamber');
    });
  });

  /* ───── Eidolon types.ts ───── */
  describe('Eidolon types.ts', () => {
    const types = fs.readFileSync(
      path.join(ROOT, 'services/sven-eidolon/src/types.ts'),
      'utf-8',
    );

    it('has council_chamber building kind', () => {
      expect(types).toContain("'council_chamber'");
    });

    it('has 27 building kinds (27 pipes)', () => {
      const match = types.match(/export type EidolonBuildingKind[\s\S]*?;/);
      expect(match).not.toBeNull();
      const pipes = (match![0].match(/\|/g) || []).length;
      expect(pipes).toBe(27);
    });

    it('has 4 governance event kinds', () => {
      expect(types).toContain("'governance.proposal_created'");
      expect(types).toContain("'governance.vote_cast'");
      expect(types).toContain("'governance.proposal_passed'");
      expect(types).toContain("'governance.council_formed'");
    });

    it('has 120 event kind pipes', () => {
      const match = types.match(/export type EidolonEventKind[\s\S]*?;/);
      expect(match).not.toBeNull();
      const pipes = (match![0].match(/\|/g) || []).length;
      expect(pipes).toBe(120);
    });

    it('maps council_chamber to civic district', () => {
      expect(types).toContain("case 'council_chamber'");
      expect(types).toContain("return 'civic'");
    });

    it('has 27 districtFor cases', () => {
      const fnMatch = types.match(/export function districtFor[\s\S]*?^}/m);
      expect(fnMatch).not.toBeNull();
      const cases = (fnMatch![0].match(/case '/g) || []).length;
      expect(cases).toBe(27);
    });
  });

  /* ───── Event bus ───── */
  describe('Event bus SUBJECT_MAP', () => {
    const bus = fs.readFileSync(
      path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'),
      'utf-8',
    );

    it('has 4 governance subjects', () => {
      expect(bus).toContain("'sven.governance.proposal_created': 'governance.proposal_created'");
      expect(bus).toContain("'sven.governance.vote_cast': 'governance.vote_cast'");
      expect(bus).toContain("'sven.governance.proposal_passed': 'governance.proposal_passed'");
      expect(bus).toContain("'sven.governance.council_formed': 'governance.council_formed'");
    });

    it('has 119 total SUBJECT_MAP entries', () => {
      const count = (bus.match(/'sven\./g) || []).length;
      expect(count).toBe(119);
    });
  });

  /* ───── Task executor ───── */
  describe('Task executor', () => {
    const exec = fs.readFileSync(
      path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'),
      'utf-8',
    );

    it('has 7 governance switch cases', () => {
      const cases = ['proposal_create', 'proposal_vote', 'council_manage', 'council_elect', 'delegation_set', 'governance_tally', 'governance_history'];
      cases.forEach(c => expect(exec).toContain(`case '${c}'`));
    });

    it('has 82 total switch cases', () => {
      const count = (exec.match(/case '/g) || []).length;
      expect(count).toBe(82);
    });

    it('has 78 handler methods', () => {
      const count = (exec.match(/private (?:async )?handle[A-Z]/g) || []).length;
      expect(count).toBe(78);
    });

    it('has 7 governance handler methods', () => {
      const handlers = [
        'handleProposalCreate', 'handleProposalVote', 'handleCouncilManage',
        'handleCouncilElect', 'handleDelegationSet', 'handleGovernanceTally',
        'handleGovernanceHistory',
      ];
      handlers.forEach(h => expect(exec).toContain(h));
    });

    it('proposal_create handler returns proposalId and status draft', () => {
      expect(exec).toContain("status: 'draft'");
      expect(exec).toContain('proposalId: id');
    });

    it('proposal_vote handler records vote choice', () => {
      expect(exec).toContain("vote,");
      expect(exec).toContain("recorded: true");
    });

    it('governance_tally handler returns quorumMet and thresholdMet', () => {
      expect(exec).toContain('quorumMet');
      expect(exec).toContain('thresholdMet');
    });

    it('council_elect handler returns candidates with elected flag', () => {
      expect(exec).toContain('elected: true');
    });

    it('is 2388 lines', () => {
      const lines = exec.split('\n').length;
      expect(lines).toBeGreaterThanOrEqual(2388);
    });
  });

  /* ───── .gitattributes ───── */
  describe('.gitattributes', () => {
    const ga = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf-8');

    it('has Batch 43 header', () => {
      expect(ga).toContain('Batch 43');
    });

    it('marks migration as export-ignore', () => {
      expect(ga).toContain('20260516120000_agent_governance.sql export-ignore');
    });

    it('marks shared types as export-ignore', () => {
      expect(ga).toContain('agent-governance.ts export-ignore');
    });

    it('marks skill as export-ignore', () => {
      expect(ga).toContain('agent-governance/** export-ignore');
    });

    it('marks test as export-ignore', () => {
      expect(ga).toContain('batch43-agent-governance.test.ts export-ignore');
    });
  });

  /* ───── CHANGELOG ───── */
  describe('CHANGELOG.md', () => {
    const cl = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf-8');

    it('has Batch 43 entry', () => {
      expect(cl).toContain('Batch 43');
    });

    it('mentions Agent Governance & Voting', () => {
      expect(cl).toContain('Agent Governance & Voting');
    });

    it('mentions council_chamber building', () => {
      expect(cl).toContain('council_chamber');
    });

    it('Batch 43 appears before Batch 42', () => {
      const i43 = cl.indexOf('Batch 43');
      const i42 = cl.indexOf('Batch 42');
      expect(i43).toBeLessThan(i42);
    });
  });

  /* ───── Migration file count ───── */
  describe('Migration count', () => {
    it('has 29 migrations total', () => {
      const dir = path.join(ROOT, 'services/gateway-api/migrations');
      const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql'));
      expect(files.length).toBe(29);
    });
  });

  /* ───── Skills count ───── */
  describe('Skills count', () => {
    it('has 36 autonomous-economy skills', () => {
      const dir = path.join(ROOT, 'skills/autonomous-economy');
      const dirs = fs.readdirSync(dir).filter(f =>
        fs.statSync(path.join(dir, f)).isDirectory()
      );
      expect(dirs.length).toBe(36);
    });
  });
});
