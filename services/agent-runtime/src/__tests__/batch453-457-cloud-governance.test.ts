import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 453-457: Cloud Governance', () => {
  const verticals = [
    {
      name: 'cost_optimizer',
      migration: '20260620900000_agent_cost_optimizer.sql',
      table: 'agent_cost_optimizer_configs',
      typeFile: 'agent-cost-optimizer.ts',
      interfaces: ['CostOptimizerConfig', 'CostRecommendation', 'CostReport'],
      skillDir: 'cost-optimizer',
      bk: 'cost_optimizer',
      ekPrefix: 'copt',
      eks: ['copt.scan_completed', 'copt.recommendation_generated', 'copt.optimization_applied', 'copt.report_generated'],
      subjects: [
        'sven.copt.scan_completed',
        'sven.copt.recommendation_generated',
        'sven.copt.optimization_applied',
        'sven.copt.report_generated',
      ],
      cases: ['copt_scan', 'copt_recommend', 'copt_implement', 'copt_report', 'copt_compare', 'copt_forecast'],
      handlers: ['handleCoptScan', 'handleCoptRecommend', 'handleCoptImplement', 'handleCoptReport', 'handleCoptCompare', 'handleCoptForecast'],
    },
    {
      name: 'resource_tagger',
      migration: '20260620910000_agent_resource_tagger.sql',
      table: 'agent_resource_tagger_configs',
      typeFile: 'agent-resource-tagger.ts',
      interfaces: ['ResourceTaggerConfig', 'TagPolicy', 'TagComplianceReport'],
      skillDir: 'resource-tagger',
      bk: 'resource_tagger',
      ekPrefix: 'rtag',
      eks: ['rtag.audit_completed', 'rtag.tags_applied', 'rtag.policy_created', 'rtag.violation_found'],
      subjects: [
        'sven.rtag.audit_completed',
        'sven.rtag.tags_applied',
        'sven.rtag.policy_created',
        'sven.rtag.violation_found',
      ],
      cases: ['rtag_audit', 'rtag_auto_tag', 'rtag_policy', 'rtag_compliance', 'rtag_untagged', 'rtag_bulk'],
      handlers: ['handleRtagAudit', 'handleRtagAutoTag', 'handleRtagPolicy', 'handleRtagCompliance', 'handleRtagUntagged', 'handleRtagBulk'],
    },
    {
      name: 'quota_manager',
      migration: '20260620920000_agent_quota_manager.sql',
      table: 'agent_quota_manager_configs',
      typeFile: 'agent-quota-manager.ts',
      interfaces: ['QuotaManagerConfig', 'QuotaStatus', 'QuotaAdjustment'],
      skillDir: 'quota-manager',
      bk: 'quota_manager',
      ekPrefix: 'qtmg',
      eks: ['qtmg.check_completed', 'qtmg.threshold_breached', 'qtmg.increase_requested', 'qtmg.quota_exhausted'],
      subjects: [
        'sven.qtmg.check_completed',
        'sven.qtmg.threshold_breached',
        'sven.qtmg.increase_requested',
        'sven.qtmg.quota_exhausted',
      ],
      cases: ['qtmg_check', 'qtmg_alert', 'qtmg_increase', 'qtmg_history', 'qtmg_forecast', 'qtmg_list'],
      handlers: ['handleQtmgCheck', 'handleQtmgAlert', 'handleQtmgIncrease', 'handleQtmgHistory', 'handleQtmgForecast', 'handleQtmgList'],
    },
    {
      name: 'access_reviewer',
      migration: '20260620930000_agent_access_reviewer.sql',
      table: 'agent_access_reviewer_configs',
      typeFile: 'agent-access-reviewer.ts',
      interfaces: ['AccessReviewerConfig', 'AccessReviewFinding', 'AccessReviewReport'],
      skillDir: 'access-reviewer',
      bk: 'access_reviewer',
      ekPrefix: 'acrv',
      eks: ['acrv.review_completed', 'acrv.access_revoked', 'acrv.stale_found', 'acrv.report_generated'],
      subjects: [
        'sven.acrv.review_completed',
        'sven.acrv.access_revoked',
        'sven.acrv.stale_found',
        'sven.acrv.report_generated',
      ],
      cases: ['acrv_review', 'acrv_stale', 'acrv_recommend', 'acrv_revoke', 'acrv_report', 'acrv_schedule'],
      handlers: ['handleAcrvReview', 'handleAcrvStale', 'handleAcrvRecommend', 'handleAcrvRevoke', 'handleAcrvReport', 'handleAcrvSchedule'],
    },
    {
      name: 'failover_tester',
      migration: '20260620940000_agent_failover_tester.sql',
      table: 'agent_failover_tester_configs',
      typeFile: 'agent-failover-tester.ts',
      interfaces: ['FailoverTesterConfig', 'FailoverTestResult', 'ResilienceScore'],
      skillDir: 'failover-tester',
      bk: 'failover_tester',
      ekPrefix: 'fovt',
      eks: ['fovt.test_completed', 'fovt.recovery_measured', 'fovt.score_calculated', 'fovt.test_failed'],
      subjects: [
        'sven.fovt.test_completed',
        'sven.fovt.recovery_measured',
        'sven.fovt.score_calculated',
        'sven.fovt.test_failed',
      ],
      cases: ['fovt_run', 'fovt_schedule', 'fovt_recovery', 'fovt_score', 'fovt_compare', 'fovt_report'],
      handlers: ['handleFovtRun', 'handleFovtSchedule', 'handleFovtRecovery', 'handleFovtScore', 'handleFovtCompare', 'handleFovtReport'],
    },
  ];

  verticals.forEach((v) => {
    describe(v.name, () => {
      test('migration file exists', () => {
        const p = path.join(ROOT, 'services/gateway-api/migrations', v.migration);
        expect(fs.existsSync(p)).toBe(true);
      });
      test('migration creates table', () => {
        const p = path.join(ROOT, 'services/gateway-api/migrations', v.migration);
        const sql = fs.readFileSync(p, 'utf-8');
        expect(sql).toContain(v.table);
        expect(sql).toContain('CREATE TABLE');
        expect(sql).toContain('agent_id UUID NOT NULL');
      });
      test('migration has indexes', () => {
        const p = path.join(ROOT, 'services/gateway-api/migrations', v.migration);
        const sql = fs.readFileSync(p, 'utf-8');
        expect(sql).toContain(`idx_${v.table}_agent`);
        expect(sql).toContain(`idx_${v.table}_enabled`);
      });
      test('type file exists', () => {
        const p = path.join(ROOT, 'packages/shared/src', v.typeFile);
        expect(fs.existsSync(p)).toBe(true);
      });
      test('type file exports interfaces', () => {
        const p = path.join(ROOT, 'packages/shared/src', v.typeFile);
        const content = fs.readFileSync(p, 'utf-8');
        v.interfaces.forEach((iface) => {
          expect(content).toContain(`export interface ${iface}`);
        });
      });
      test('barrel export exists', () => {
        const idx = fs.readFileSync(path.join(ROOT, 'packages/shared/src/index.ts'), 'utf-8');
        const modName = v.typeFile.replace('.ts', '');
        expect(idx).toContain(`export * from './${modName}'`);
      });
      test('SKILL.md exists', () => {
        const p = path.join(ROOT, 'skills/autonomous-economy', v.skillDir, 'SKILL.md');
        expect(fs.existsSync(p)).toBe(true);
      });
      test('SKILL.md has actions', () => {
        const p = path.join(ROOT, 'skills/autonomous-economy', v.skillDir, 'SKILL.md');
        const content = fs.readFileSync(p, 'utf-8');
        expect(content).toContain('## Actions');
      });
      test('BK registered', () => {
        const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
        expect(types).toContain(`'${v.bk}'`);
      });
      test('EKs registered', () => {
        const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
        v.eks.forEach((ek) => {
          expect(types).toContain(`'${ek}'`);
        });
      });
      test('districtFor case', () => {
        const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
        expect(types).toContain(`case '${v.bk}':`);
      });
      test('SUBJECT_MAP entries', () => {
        const eb = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
        v.subjects.forEach((sub) => {
          expect(eb).toContain(`'${sub}'`);
        });
      });
      test('task executor cases', () => {
        const te = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
        v.cases.forEach((c) => {
          expect(te).toContain(`case '${c}'`);
        });
      });
      test('task executor handlers', () => {
        const te = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
        v.handlers.forEach((h) => {
          expect(te).toContain(h);
        });
      });
      test('.gitattributes entries', () => {
        const ga = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf-8');
        expect(ga).toContain(v.migration);
        expect(ga).toContain(v.typeFile);
        expect(ga).toContain(v.skillDir);
      });
    });
  });
});
