import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 883-887: Content Management', () => {
  const verticals = [
    {
      name: 'cms_content_modeler', migration: '20260625200000_agent_cms_content_modeler.sql',
      typeFile: 'agent-cms-content-modeler.ts', skillDir: 'cms-content-modeler',
      interfaces: ['CmsContentModelerConfig', 'ContentModel', 'ModelerEvent'],
      bk: 'cms_content_modeler', eks: ['ccmd.schema_received', 'ccmd.fields_validated', 'ccmd.model_persisted', 'ccmd.version_tagged'],
      subjects: ['sven.ccmd.schema_received', 'sven.ccmd.fields_validated', 'sven.ccmd.model_persisted', 'sven.ccmd.version_tagged'],
      cases: ['ccmd_receive', 'ccmd_validate', 'ccmd_persist', 'ccmd_tag', 'ccmd_report', 'ccmd_monitor'],
    },
    {
      name: 'cms_content_publisher', migration: '20260625210000_agent_cms_content_publisher.sql',
      typeFile: 'agent-cms-content-publisher.ts', skillDir: 'cms-content-publisher',
      interfaces: ['CmsContentPublisherConfig', 'PublishRequest', 'PublisherEvent'],
      bk: 'cms_content_publisher', eks: ['ccpb.request_received', 'ccpb.draft_validated', 'ccpb.content_published', 'ccpb.cache_warmed'],
      subjects: ['sven.ccpb.request_received', 'sven.ccpb.draft_validated', 'sven.ccpb.content_published', 'sven.ccpb.cache_warmed'],
      cases: ['ccpb_receive', 'ccpb_validate', 'ccpb_publish', 'ccpb_warm', 'ccpb_report', 'ccpb_monitor'],
    },
    {
      name: 'cms_asset_uploader', migration: '20260625220000_agent_cms_asset_uploader.sql',
      typeFile: 'agent-cms-asset-uploader.ts', skillDir: 'cms-asset-uploader',
      interfaces: ['CmsAssetUploaderConfig', 'AssetUpload', 'UploaderEvent'],
      bk: 'cms_asset_uploader', eks: ['caup.upload_received', 'caup.scan_completed', 'caup.asset_stored', 'caup.metadata_indexed'],
      subjects: ['sven.caup.upload_received', 'sven.caup.scan_completed', 'sven.caup.asset_stored', 'sven.caup.metadata_indexed'],
      cases: ['caup_receive', 'caup_scan', 'caup_store', 'caup_index', 'caup_report', 'caup_monitor'],
    },
    {
      name: 'cms_revision_tracker', migration: '20260625230000_agent_cms_revision_tracker.sql',
      typeFile: 'agent-cms-revision-tracker.ts', skillDir: 'cms-revision-tracker',
      interfaces: ['CmsRevisionTrackerConfig', 'RevisionEntry', 'TrackerEvent'],
      bk: 'cms_revision_tracker', eks: ['crvt.change_observed', 'crvt.diff_computed', 'crvt.revision_persisted', 'crvt.history_pruned'],
      subjects: ['sven.crvt.change_observed', 'sven.crvt.diff_computed', 'sven.crvt.revision_persisted', 'sven.crvt.history_pruned'],
      cases: ['crvt_observe', 'crvt_compute', 'crvt_persist', 'crvt_prune', 'crvt_report', 'crvt_monitor'],
    },
    {
      name: 'cms_workflow_router', migration: '20260625240000_agent_cms_workflow_router.sql',
      typeFile: 'agent-cms-workflow-router.ts', skillDir: 'cms-workflow-router',
      interfaces: ['CmsWorkflowRouterConfig', 'WorkflowState', 'RouterEvent'],
      bk: 'cms_workflow_router', eks: ['cwfr.transition_requested', 'cwfr.policy_evaluated', 'cwfr.state_advanced', 'cwfr.notification_dispatched'],
      subjects: ['sven.cwfr.transition_requested', 'sven.cwfr.policy_evaluated', 'sven.cwfr.state_advanced', 'sven.cwfr.notification_dispatched'],
      cases: ['cwfr_request', 'cwfr_evaluate', 'cwfr_advance', 'cwfr_notify', 'cwfr_report', 'cwfr_monitor'],
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
