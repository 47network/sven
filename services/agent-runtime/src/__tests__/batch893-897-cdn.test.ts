import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 893-897: CDN Operations', () => {
  const verticals = [
    {
      name: 'cdn_cache_invalidator', migration: '20260625300000_agent_cdn_cache_invalidator.sql',
      typeFile: 'agent-cdn-cache-invalidator.ts', skillDir: 'cdn-cache-invalidator',
      interfaces: ['CdnCacheInvalidatorConfig', 'InvalidationRequest', 'InvalidatorEvent'],
      bk: 'cdn_cache_invalidator', eks: ['ccin.request_received', 'ccin.scope_resolved', 'ccin.purge_dispatched', 'ccin.completion_recorded'],
      subjects: ['sven.ccin.request_received', 'sven.ccin.scope_resolved', 'sven.ccin.purge_dispatched', 'sven.ccin.completion_recorded'],
      cases: ['ccin_receive', 'ccin_resolve', 'ccin_dispatch', 'ccin_record', 'ccin_report', 'ccin_monitor'],
    },
    {
      name: 'cdn_origin_shield', migration: '20260625310000_agent_cdn_origin_shield.sql',
      typeFile: 'agent-cdn-origin-shield.ts', skillDir: 'cdn-origin-shield',
      interfaces: ['CdnOriginShieldConfig', 'ShieldRequest', 'ShieldEvent'],
      bk: 'cdn_origin_shield', eks: ['cosh.request_received', 'cosh.coalesced', 'cosh.origin_called', 'cosh.response_returned'],
      subjects: ['sven.cosh.request_received', 'sven.cosh.coalesced', 'sven.cosh.origin_called', 'sven.cosh.response_returned'],
      cases: ['cosh_receive', 'cosh_coalesce', 'cosh_call', 'cosh_return', 'cosh_report', 'cosh_monitor'],
    },
    {
      name: 'cdn_purge_dispatcher', migration: '20260625320000_agent_cdn_purge_dispatcher.sql',
      typeFile: 'agent-cdn-purge-dispatcher.ts', skillDir: 'cdn-purge-dispatcher',
      interfaces: ['CdnPurgeDispatcherConfig', 'PurgeBatch', 'DispatcherEvent'],
      bk: 'cdn_purge_dispatcher', eks: ['cpdp.batch_received', 'cpdp.targets_resolved', 'cpdp.purges_dispatched', 'cpdp.results_aggregated'],
      subjects: ['sven.cpdp.batch_received', 'sven.cpdp.targets_resolved', 'sven.cpdp.purges_dispatched', 'sven.cpdp.results_aggregated'],
      cases: ['cpdp_receive', 'cpdp_resolve', 'cpdp_dispatch', 'cpdp_aggregate', 'cpdp_report', 'cpdp_monitor'],
    },
    {
      name: 'cdn_token_minter', migration: '20260625330000_agent_cdn_token_minter.sql',
      typeFile: 'agent-cdn-token-minter.ts', skillDir: 'cdn-token-minter',
      interfaces: ['CdnTokenMinterConfig', 'TokenRequest', 'MinterEvent'],
      bk: 'cdn_token_minter', eks: ['ctkm.request_received', 'ctkm.policy_evaluated', 'ctkm.token_minted', 'ctkm.audit_recorded'],
      subjects: ['sven.ctkm.request_received', 'sven.ctkm.policy_evaluated', 'sven.ctkm.token_minted', 'sven.ctkm.audit_recorded'],
      cases: ['ctkm_receive', 'ctkm_evaluate', 'ctkm_mint', 'ctkm_audit', 'ctkm_report', 'ctkm_monitor'],
    },
    {
      name: 'cdn_log_aggregator', migration: '20260625340000_agent_cdn_log_aggregator.sql',
      typeFile: 'agent-cdn-log-aggregator.ts', skillDir: 'cdn-log-aggregator',
      interfaces: ['CdnLogAggregatorConfig', 'LogShipment', 'AggregatorEvent'],
      bk: 'cdn_log_aggregator', eks: ['clga.shipment_received', 'clga.records_parsed', 'clga.metrics_aggregated', 'clga.summary_persisted'],
      subjects: ['sven.clga.shipment_received', 'sven.clga.records_parsed', 'sven.clga.metrics_aggregated', 'sven.clga.summary_persisted'],
      cases: ['clga_receive', 'clga_parse', 'clga_aggregate', 'clga_persist', 'clga_report', 'clga_monitor'],
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
