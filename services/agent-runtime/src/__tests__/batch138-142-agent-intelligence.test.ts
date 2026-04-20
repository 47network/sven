import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batch 138-142 — Agent Intelligence Infrastructure', () => {
  /* ───── Batch 138: Token Minting ───── */
  describe('Batch 138 — Token Minting migration', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260617750000_agent_token_minting.sql'), 'utf-8');
    it('creates token_definitions table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS token_definitions'));
    it('creates mint_operations table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS mint_operations'));
    it('creates token_balances table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS token_balances'));
    it('has token_type CHECK constraint', () => expect(sql).toMatch(/CHECK\s*\(\s*token_type\s+IN/));
    it('has amount > 0 constraint', () => expect(sql).toContain('amount > 0'));
    it('has UNIQUE(token_id, holder)', () => expect(sql).toContain('UNIQUE(token_id, holder)'));
    it('creates idx_token_defs_agent', () => expect(sql).toContain('idx_token_defs_agent'));
    it('creates idx_mint_ops_token', () => expect(sql).toContain('idx_mint_ops_token'));
    it('creates idx_token_bal_holder', () => expect(sql).toContain('idx_token_bal_holder'));
  });

  describe('Batch 138 — Token Minting types', () => {
    let mod: Record<string, unknown>;
    beforeAll(async () => { mod = await import('../../../../packages/shared/src/agent-token-minting'); });
    it('exports TokenType enum', () => expect(mod.TokenType).toBeDefined());
    it('TokenType has Utility', () => expect((mod.TokenType as any).Utility).toBe('utility'));
    it('TokenType has Governance', () => expect((mod.TokenType as any).Governance).toBe('governance'));
    it('exports MintReason enum', () => expect(mod.MintReason).toBeDefined());
    it('MintReason has Airdrop', () => expect((mod.MintReason as any).Airdrop).toBe('airdrop'));
    it('exports MintStatus enum', () => expect(mod.MintStatus).toBeDefined());
    it('MintStatus has Confirmed', () => expect((mod.MintStatus as any).Confirmed).toBe('confirmed'));
  });

  describe('Batch 138 — Token Minting SKILL.md', () => {
    const skill = fs.readFileSync(path.join(ROOT, 'skills/agent-token-minting/SKILL.md'), 'utf-8');
    it('has name field', () => expect(skill).toContain('name: agent-token-minting'));
    it('has tokenmint_define_token action', () => expect(skill).toContain('tokenmint_define_token'));
    it('has tokenmint_mint action', () => expect(skill).toContain('tokenmint_mint'));
    it('has treasury archetype', () => expect(skill).toContain('archetype: treasury'));
  });

  /* ───── Batch 139: Sandbox Isolation ───── */
  describe('Batch 139 — Sandbox Isolation migration', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260617760000_agent_sandbox_isolation.sql'), 'utf-8');
    it('creates sandbox_environments table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS sandbox_environments'));
    it('creates sandbox_executions table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS sandbox_executions'));
    it('creates sandbox_violations table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS sandbox_violations'));
    it('has isolation_level CHECK', () => expect(sql).toMatch(/CHECK\s*\(\s*isolation_level\s+IN/));
    it('has network_policy CHECK', () => expect(sql).toMatch(/CHECK\s*\(\s*network_policy\s+IN/));
    it('has violation_type CHECK', () => expect(sql).toMatch(/CHECK\s*\(\s*violation_type\s+IN/));
    it('creates idx_sandbox_env_agent', () => expect(sql).toContain('idx_sandbox_env_agent'));
    it('creates idx_sandbox_exec_sandbox', () => expect(sql).toContain('idx_sandbox_exec_sandbox'));
    it('creates idx_sandbox_viol_type', () => expect(sql).toContain('idx_sandbox_viol_type'));
  });

  describe('Batch 139 — Sandbox Isolation types', () => {
    let mod: Record<string, unknown>;
    beforeAll(async () => { mod = await import('../../../../packages/shared/src/agent-sandbox-isolation'); });
    it('exports IsolationLevel enum', () => expect(mod.IsolationLevel).toBeDefined());
    it('IsolationLevel has Container', () => expect((mod.IsolationLevel as any).Container).toBe('container'));
    it('IsolationLevel has Wasm', () => expect((mod.IsolationLevel as any).Wasm).toBe('wasm'));
    it('exports SandboxStatus enum', () => expect(mod.SandboxStatus).toBeDefined());
    it('exports NetworkPolicy enum', () => expect(mod.NetworkPolicy).toBeDefined());
    it('exports ViolationType enum', () => expect(mod.ViolationType).toBeDefined());
    it('ViolationType has FsEscape', () => expect((mod.ViolationType as any).FsEscape).toBe('fs_escape'));
  });

  describe('Batch 139 — Sandbox SKILL.md', () => {
    const skill = fs.readFileSync(path.join(ROOT, 'skills/agent-sandbox-isolation/SKILL.md'), 'utf-8');
    it('has name field', () => expect(skill).toContain('name: agent-sandbox-isolation'));
    it('has sandbox_provision action', () => expect(skill).toContain('sandbox_provision'));
    it('has sandbox_execute action', () => expect(skill).toContain('sandbox_execute'));
    it('has infrastructure archetype', () => expect(skill).toContain('archetype: infrastructure'));
  });

  /* ───── Batch 140: Swarm Coordination ───── */
  describe('Batch 140 — Swarm Coordination migration', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260617770000_agent_swarm_coordination.sql'), 'utf-8');
    it('creates swarm_clusters table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS swarm_clusters'));
    it('creates swarm_members table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS swarm_members'));
    it('creates swarm_tasks table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS swarm_tasks'));
    it('has strategy CHECK', () => expect(sql).toMatch(/CHECK\s*\(\s*strategy\s+IN/));
    it('has role CHECK', () => expect(sql).toMatch(/CHECK\s*\(\s*role\s+IN/));
    it('has UNIQUE(cluster_id, agent_id)', () => expect(sql).toContain('UNIQUE(cluster_id, agent_id)'));
    it('creates idx_swarm_clusters_status', () => expect(sql).toContain('idx_swarm_clusters_status'));
    it('creates idx_swarm_members_agent', () => expect(sql).toContain('idx_swarm_members_agent'));
    it('creates idx_swarm_tasks_assigned', () => expect(sql).toContain('idx_swarm_tasks_assigned'));
  });

  describe('Batch 140 — Swarm Coordination types', () => {
    let mod: Record<string, unknown>;
    beforeAll(async () => { mod = await import('../../../../packages/shared/src/agent-swarm-coordination'); });
    it('exports SwarmStrategy enum', () => expect(mod.SwarmStrategy).toBeDefined());
    it('SwarmStrategy has Consensus', () => expect((mod.SwarmStrategy as any).Consensus).toBe('consensus'));
    it('SwarmStrategy has Emergent', () => expect((mod.SwarmStrategy as any).Emergent).toBe('emergent'));
    it('exports SwarmStatus enum', () => expect(mod.SwarmStatus).toBeDefined());
    it('exports SwarmRole enum', () => expect(mod.SwarmRole).toBeDefined());
    it('SwarmRole has Leader', () => expect((mod.SwarmRole as any).Leader).toBe('leader'));
    it('SwarmRole has Specialist', () => expect((mod.SwarmRole as any).Specialist).toBe('specialist'));
  });

  describe('Batch 140 — Swarm SKILL.md', () => {
    const skill = fs.readFileSync(path.join(ROOT, 'skills/agent-swarm-coordination/SKILL.md'), 'utf-8');
    it('has name field', () => expect(skill).toContain('name: agent-swarm-coordination'));
    it('has swarm_create_cluster action', () => expect(skill).toContain('swarm_create_cluster'));
    it('has swarm_elect_leader action', () => expect(skill).toContain('swarm_elect_leader'));
    it('has coordination archetype', () => expect(skill).toContain('archetype: coordination'));
  });

  /* ───── Batch 141: Consensus Protocol ───── */
  describe('Batch 141 — Consensus Protocol migration', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260617780000_agent_consensus_protocol.sql'), 'utf-8');
    it('creates consensus_proposals table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS consensus_proposals'));
    it('creates consensus_votes table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS consensus_votes'));
    it('creates consensus_executions table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS consensus_executions'));
    it('has proposal_type CHECK', () => expect(sql).toMatch(/CHECK\s*\(\s*proposal_type\s+IN/));
    it('has vote CHECK', () => expect(sql).toMatch(/CHECK\s*\(\s*vote\s+IN/));
    it('has UNIQUE(proposal_id, voter_id)', () => expect(sql).toContain('UNIQUE(proposal_id, voter_id)'));
    it('creates idx_consensus_prop_status', () => expect(sql).toContain('idx_consensus_prop_status'));
    it('creates idx_consensus_votes_voter', () => expect(sql).toContain('idx_consensus_votes_voter'));
    it('creates idx_consensus_exec_proposal', () => expect(sql).toContain('idx_consensus_exec_proposal'));
  });

  describe('Batch 141 — Consensus Protocol types', () => {
    let mod: Record<string, unknown>;
    beforeAll(async () => { mod = await import('../../../../packages/shared/src/agent-consensus-protocol'); });
    it('exports ProposalType enum', () => expect(mod.ProposalType).toBeDefined());
    it('ProposalType has Emergency', () => expect((mod.ProposalType as any).Emergency).toBe('emergency'));
    it('ProposalType has Constitutional', () => expect((mod.ProposalType as any).Constitutional).toBe('constitutional'));
    it('exports ProposalStatus enum', () => expect(mod.ProposalStatus).toBeDefined());
    it('ProposalStatus has Executed', () => expect((mod.ProposalStatus as any).Executed).toBe('executed'));
    it('exports VoteChoice enum', () => expect(mod.VoteChoice).toBeDefined());
    it('VoteChoice has Abstain', () => expect((mod.VoteChoice as any).Abstain).toBe('abstain'));
  });

  describe('Batch 141 — Consensus SKILL.md', () => {
    const skill = fs.readFileSync(path.join(ROOT, 'skills/agent-consensus-protocol/SKILL.md'), 'utf-8');
    it('has name field', () => expect(skill).toContain('name: agent-consensus-protocol'));
    it('has consensus_create_proposal action', () => expect(skill).toContain('consensus_create_proposal'));
    it('has consensus_cast_vote action', () => expect(skill).toContain('consensus_cast_vote'));
    it('has governance archetype', () => expect(skill).toContain('archetype: governance'));
  });

  /* ───── Batch 142: Anomaly Detection ───── */
  describe('Batch 142 — Anomaly Detection migration', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260617790000_agent_anomaly_detection.sql'), 'utf-8');
    it('creates anomaly_detectors table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS anomaly_detectors'));
    it('creates detected_anomalies table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS detected_anomalies'));
    it('creates anomaly_baselines table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS anomaly_baselines'));
    it('has algorithm CHECK', () => expect(sql).toMatch(/CHECK\s*\(\s*algorithm\s+IN/));
    it('has severity CHECK', () => expect(sql).toMatch(/CHECK\s*\(\s*severity\s+IN/));
    it('has period CHECK', () => expect(sql).toMatch(/CHECK\s*\(\s*period\s+IN/));
    it('creates idx_anomaly_det_agent', () => expect(sql).toContain('idx_anomaly_det_agent'));
    it('creates idx_detected_anom_severity', () => expect(sql).toContain('idx_detected_anom_severity'));
    it('creates idx_anomaly_base_detector', () => expect(sql).toContain('idx_anomaly_base_detector'));
  });

  describe('Batch 142 — Anomaly Detection types', () => {
    let mod: Record<string, unknown>;
    beforeAll(async () => { mod = await import('../../../../packages/shared/src/agent-anomaly-detection'); });
    it('exports AnomalyAlgorithm enum', () => expect(mod.AnomalyAlgorithm).toBeDefined());
    it('AnomalyAlgorithm has ZScore', () => expect((mod.AnomalyAlgorithm as any).ZScore).toBe('zscore'));
    it('AnomalyAlgorithm has Prophet', () => expect((mod.AnomalyAlgorithm as any).Prophet).toBe('prophet'));
    it('exports AnomalySeverity enum', () => expect(mod.AnomalySeverity).toBeDefined());
    it('AnomalySeverity has Critical', () => expect((mod.AnomalySeverity as any).Critical).toBe('critical'));
    it('exports BaselinePeriod enum', () => expect(mod.BaselinePeriod).toBeDefined());
    it('BaselinePeriod has Monthly', () => expect((mod.BaselinePeriod as any).Monthly).toBe('monthly'));
  });

  describe('Batch 142 — Anomaly SKILL.md', () => {
    const skill = fs.readFileSync(path.join(ROOT, 'skills/agent-anomaly-detection/SKILL.md'), 'utf-8');
    it('has name field', () => expect(skill).toContain('name: agent-anomaly-detection'));
    it('has anomaly_create_detector action', () => expect(skill).toContain('anomaly_create_detector'));
    it('has anomaly_evaluate action', () => expect(skill).toContain('anomaly_evaluate'));
    it('has observability archetype', () => expect(skill).toContain('archetype: observability'));
  });

  /* ───── Barrel exports ───── */
  describe('Barrel exports (index.ts)', () => {
    const idx = fs.readFileSync(path.join(ROOT, 'packages/shared/src/index.ts'), 'utf-8');
    it('exports agent-token-minting', () => expect(idx).toContain("./agent-token-minting.js"));
    it('exports agent-sandbox-isolation', () => expect(idx).toContain("./agent-sandbox-isolation.js"));
    it('exports agent-swarm-coordination', () => expect(idx).toContain("./agent-swarm-coordination.js"));
    it('exports agent-consensus-protocol', () => expect(idx).toContain("./agent-consensus-protocol.js"));
    it('exports agent-anomaly-detection', () => expect(idx).toContain("./agent-anomaly-detection.js"));
  });

  /* ───── Eidolon BK / EK / districtFor ───── */
  describe('Eidolon wiring', () => {
    const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    it('has token_mint BK', () => expect(types).toContain("'token_mint'"));
    it('has sandbox_chamber BK', () => expect(types).toContain("'sandbox_chamber'"));
    it('has swarm_nexus BK', () => expect(types).toContain("'swarm_nexus'"));
    it('has consensus_forum BK', () => expect(types).toContain("'consensus_forum'"));
    it('has anomaly_watchtower BK', () => expect(types).toContain("'anomaly_watchtower'"));
    it('has tokenmint.token_defined EK', () => expect(types).toContain("'tokenmint.token_defined'"));
    it('has sandbox.env_provisioned EK', () => expect(types).toContain("'sandbox.env_provisioned'"));
    it('has swarm.cluster_formed EK', () => expect(types).toContain("'swarm.cluster_formed'"));
    it('has consensus.proposal_created EK', () => expect(types).toContain("'consensus.proposal_created'"));
    it('has anomaly.anomaly_detected EK', () => expect(types).toContain("'anomaly.anomaly_detected'"));
    it('districtFor token_mint → market', () => expect(types).toMatch(/case\s+'token_mint':\s*\n\s*return\s+'market'/));
    it('districtFor sandbox_chamber → civic', () => expect(types).toMatch(/case\s+'sandbox_chamber':\s*\n\s*return\s+'civic'/));
    it('districtFor swarm_nexus → civic', () => expect(types).toMatch(/case\s+'swarm_nexus':\s*\n\s*return\s+'civic'/));
    it('districtFor consensus_forum → civic', () => expect(types).toMatch(/case\s+'consensus_forum':\s*\n\s*return\s+'civic'/));
    it('districtFor anomaly_watchtower → civic', () => expect(types).toMatch(/case\s+'anomaly_watchtower':\s*\n\s*return\s+'civic'/));
  });

  /* ───── SUBJECT_MAP ───── */
  describe('SUBJECT_MAP entries', () => {
    const bus = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
    const subjects = [
      'sven.tokenmint.token_defined', 'sven.tokenmint.tokens_minted', 'sven.tokenmint.tokens_burned', 'sven.tokenmint.balance_updated',
      'sven.sandbox.env_provisioned', 'sven.sandbox.execution_completed', 'sven.sandbox.violation_detected', 'sven.sandbox.env_terminated',
      'sven.swarm.cluster_formed', 'sven.swarm.member_joined', 'sven.swarm.task_distributed', 'sven.swarm.cluster_dissolved',
      'sven.consensus.proposal_created', 'sven.consensus.vote_cast', 'sven.consensus.quorum_reached', 'sven.consensus.proposal_executed',
      'sven.anomaly.detector_created', 'sven.anomaly.anomaly_detected', 'sven.anomaly.anomaly_resolved', 'sven.anomaly.baseline_updated',
    ];
    for (const s of subjects) {
      it(`has ${s}`, () => expect(bus).toContain(`'${s}'`));
    }
  });

  /* ───── Task executor ───── */
  describe('Task executor switch cases', () => {
    const tex = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
    const cases = [
      'tokenmint_define', 'tokenmint_mint', 'tokenmint_burn', 'tokenmint_balance', 'tokenmint_list', 'tokenmint_report',
      'sandbox_provision', 'sandbox_execute', 'sandbox_terminate', 'sandbox_violations', 'sandbox_list', 'sandbox_report',
      'swarm_create', 'swarm_join', 'swarm_assign', 'swarm_elect', 'swarm_list', 'swarm_report',
      'consensus_propose', 'consensus_vote', 'consensus_tally', 'consensus_execute', 'consensus_list', 'consensus_report',
      'anomaly_create_detector', 'anomaly_evaluate', 'anomaly_acknowledge', 'anomaly_update_baseline', 'anomaly_list', 'anomaly_report',
    ];
    for (const c of cases) {
      it(`has case '${c}'`, () => expect(tex).toContain(`case '${c}'`));
    }
  });

  /* ───── .gitattributes ───── */
  describe('.gitattributes entries', () => {
    const ga = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf-8');
    it('has token-minting migration', () => expect(ga).toContain('20260617750000_agent_token_minting.sql'));
    it('has sandbox-isolation types', () => expect(ga).toContain('agent-sandbox-isolation.ts'));
    it('has swarm-coordination skill', () => expect(ga).toContain('skills/agent-swarm-coordination/SKILL.md'));
    it('has consensus-protocol migration', () => expect(ga).toContain('20260617780000_agent_consensus_protocol.sql'));
    it('has anomaly-detection types', () => expect(ga).toContain('agent-anomaly-detection.ts'));
  });
});
