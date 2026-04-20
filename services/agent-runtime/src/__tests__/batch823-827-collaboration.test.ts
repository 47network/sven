import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 823-827: Document Collaboration', () => {
  const verticals = [
    {
      name: 'document_versioning_engine', migration: '20260624600000_agent_document_versioning_engine.sql',
      typeFile: 'agent-document-versioning-engine.ts', skillDir: 'document-versioning-engine',
      interfaces: ['DocumentVersioningEngineConfig', 'DocumentVersion', 'EngineEvent'],
      bk: 'document_versioning_engine', eks: ['dvge.commit_received', 'dvge.diff_computed', 'dvge.version_persisted', 'dvge.history_pruned'],
      subjects: ['sven.dvge.commit_received', 'sven.dvge.diff_computed', 'sven.dvge.version_persisted', 'sven.dvge.history_pruned'],
      cases: ['dvge_receive', 'dvge_compute', 'dvge_persist', 'dvge_prune', 'dvge_report', 'dvge_monitor'],
    },
    {
      name: 'collaborative_editor_sync', migration: '20260624610000_agent_collaborative_editor_sync.sql',
      typeFile: 'agent-collaborative-editor-sync.ts', skillDir: 'collaborative-editor-sync',
      interfaces: ['CollaborativeEditorSyncConfig', 'CollabSession', 'SyncEvent'],
      bk: 'collaborative_editor_sync', eks: ['cesy.operation_received', 'cesy.crdt_merged', 'cesy.peers_broadcasted', 'cesy.snapshot_committed'],
      subjects: ['sven.cesy.operation_received', 'sven.cesy.crdt_merged', 'sven.cesy.peers_broadcasted', 'sven.cesy.snapshot_committed'],
      cases: ['cesy_receive', 'cesy_merge', 'cesy_broadcast', 'cesy_commit', 'cesy_report', 'cesy_monitor'],
    },
    {
      name: 'change_proposal_router', migration: '20260624620000_agent_change_proposal_router.sql',
      typeFile: 'agent-change-proposal-router.ts', skillDir: 'change-proposal-router',
      interfaces: ['ChangeProposalRouterConfig', 'ChangeProposal', 'RouterEvent'],
      bk: 'change_proposal_router', eks: ['cprr.proposal_submitted', 'cprr.reviewers_selected', 'cprr.notifications_dispatched', 'cprr.outcome_recorded'],
      subjects: ['sven.cprr.proposal_submitted', 'sven.cprr.reviewers_selected', 'sven.cprr.notifications_dispatched', 'sven.cprr.outcome_recorded'],
      cases: ['cprr_submit', 'cprr_select', 'cprr_dispatch', 'cprr_record', 'cprr_report', 'cprr_monitor'],
    },
    {
      name: 'approval_workflow_engine', migration: '20260624630000_agent_approval_workflow_engine.sql',
      typeFile: 'agent-approval-workflow-engine.ts', skillDir: 'approval-workflow-engine',
      interfaces: ['ApprovalWorkflowEngineConfig', 'ApprovalCase', 'EngineEvent'],
      bk: 'approval_workflow_engine', eks: ['awfe.case_created', 'awfe.step_advanced', 'awfe.approver_notified', 'awfe.case_finalized'],
      subjects: ['sven.awfe.case_created', 'sven.awfe.step_advanced', 'sven.awfe.approver_notified', 'sven.awfe.case_finalized'],
      cases: ['awfe_create', 'awfe_advance', 'awfe_notify', 'awfe_finalize', 'awfe_report', 'awfe_monitor'],
    },
    {
      name: 'signature_collector', migration: '20260624640000_agent_signature_collector.sql',
      typeFile: 'agent-signature-collector.ts', skillDir: 'signature-collector',
      interfaces: ['SignatureCollectorConfig', 'SignatureRequest', 'CollectorEvent'],
      bk: 'signature_collector', eks: ['sigc.request_initiated', 'sigc.signer_invited', 'sigc.signature_captured', 'sigc.envelope_sealed'],
      subjects: ['sven.sigc.request_initiated', 'sven.sigc.signer_invited', 'sven.sigc.signature_captured', 'sven.sigc.envelope_sealed'],
      cases: ['sigc_initiate', 'sigc_invite', 'sigc_capture', 'sigc_seal', 'sigc_report', 'sigc_monitor'],
    },
  ];

  verticals.forEach((v) => {
    describe(v.name, () => {
      test('migration file exists', () => {
        expect(fs.existsSync(path.join(ROOT, 'services/gateway-api/migrations', v.migration))).toBe(true);
      });
      test('migration has correct table', () => {
        const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations', v.migration), 'utf-8');
        expect(sql).toContain(`agent_${v.name}_configs`);
      });
      test('type file exists', () => {
        expect(fs.existsSync(path.join(ROOT, 'packages/shared/src', v.typeFile))).toBe(true);
      });
      test('shared barrel exports type', () => {
        const idx = fs.readFileSync(path.join(ROOT, 'packages/shared/src/index.ts'), 'utf-8');
        expect(idx).toContain(`./${v.typeFile.replace('.ts', '')}`);
      });
      test('SKILL.md exists with Actions', () => {
        const skill = fs.readFileSync(path.join(ROOT, 'skills/autonomous-economy', v.skillDir, 'SKILL.md'), 'utf-8');
        expect(skill).toContain('## Actions');
        expect(skill).toContain(v.skillDir);
      });
      test('Eidolon BK includes vertical', () => {
        const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
        expect(types).toContain(`'${v.bk}'`);
      });
      test('Eidolon EKs all present', () => {
        const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
        v.eks.forEach((ek) => expect(types).toContain(`'${ek}'`));
      });
      test('event-bus SUBJECT_MAP entries present', () => {
        const eb = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
        v.subjects.forEach((s) => expect(eb).toContain(`'${s}'`));
      });
      test('task-executor switch cases present', () => {
        const te = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
        v.cases.forEach((c) => expect(te).toContain(`case '${c}'`));
      });
      test('.gitattributes filters set', () => {
        const ga = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf-8');
        expect(ga).toContain(v.migration);
        expect(ga).toContain(v.typeFile);
        expect(ga).toContain(v.skillDir);
      });
      test('districtFor includes vertical', () => {
        const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
        expect(types).toContain(`case '${v.bk}':`);
      });
    });
  });
});
