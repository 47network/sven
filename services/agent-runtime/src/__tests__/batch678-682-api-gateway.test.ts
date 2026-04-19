import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 678-682: API Gateway', () => {
  const verticals = [
    {
      name: 'rate_limiter_v2', migration: '20260623150000_agent_rate_limiter_v2.sql',
      typeFile: 'agent-rate-limiter-v2.ts', skillDir: 'rate-limiter-v2',
      interfaces: ['RateLimiterV2Config', 'RateBucket', 'LimiterEvent'],
      bk: 'rate_limiter_v2', eks: ['rlv2.limit_exceeded', 'rlv2.bucket_refilled', 'rlv2.client_throttled', 'rlv2.quota_adjusted'],
      subjects: ['sven.rlv2.limit_exceeded', 'sven.rlv2.bucket_refilled', 'sven.rlv2.client_throttled', 'sven.rlv2.quota_adjusted'],
      cases: ['rlv2_limit', 'rlv2_refill', 'rlv2_throttle', 'rlv2_quota', 'rlv2_report', 'rlv2_monitor'],
    },
    {
      name: 'api_versioner', migration: '20260623160000_agent_api_versioner.sql',
      typeFile: 'agent-api-versioner.ts', skillDir: 'api-versioner',
      interfaces: ['ApiVersionerConfig', 'VersionMapping', 'VersionerEvent'],
      bk: 'api_versioner', eks: ['apvr.version_registered', 'apvr.deprecation_scheduled', 'apvr.migration_guided', 'apvr.sunset_enforced'],
      subjects: ['sven.apvr.version_registered', 'sven.apvr.deprecation_scheduled', 'sven.apvr.migration_guided', 'sven.apvr.sunset_enforced'],
      cases: ['apvr_register', 'apvr_deprecate', 'apvr_migrate', 'apvr_sunset', 'apvr_report', 'apvr_monitor'],
    },
    {
      name: 'request_transformer', migration: '20260623170000_agent_request_transformer.sql',
      typeFile: 'agent-request-transformer.ts', skillDir: 'request-transformer',
      interfaces: ['RequestTransformerConfig', 'TransformRule', 'TransformerEvent'],
      bk: 'request_transformer', eks: ['rqtr.body_transformed', 'rqtr.header_injected', 'rqtr.path_rewritten', 'rqtr.param_mapped'],
      subjects: ['sven.rqtr.body_transformed', 'sven.rqtr.header_injected', 'sven.rqtr.path_rewritten', 'sven.rqtr.param_mapped'],
      cases: ['rqtr_body', 'rqtr_header', 'rqtr_path', 'rqtr_param', 'rqtr_report', 'rqtr_monitor'],
    },
    {
      name: 'cors_manager', migration: '20260623180000_agent_cors_manager.sql',
      typeFile: 'agent-cors-manager.ts', skillDir: 'cors-manager',
      interfaces: ['CorsManagerConfig', 'CorsPolicy', 'ManagerEvent'],
      bk: 'cors_manager', eks: ['crsm.policy_applied', 'crsm.origin_allowed', 'crsm.preflight_cached', 'crsm.violation_blocked'],
      subjects: ['sven.crsm.policy_applied', 'sven.crsm.origin_allowed', 'sven.crsm.preflight_cached', 'sven.crsm.violation_blocked'],
      cases: ['crsm_policy', 'crsm_origin', 'crsm_preflight', 'crsm_violation', 'crsm_report', 'crsm_monitor'],
    },
    {
      name: 'ip_filter', migration: '20260623190000_agent_ip_filter.sql',
      typeFile: 'agent-ip-filter.ts', skillDir: 'ip-filter',
      interfaces: ['IpFilterConfig', 'FilterRule', 'FilterEvent'],
      bk: 'ip_filter', eks: ['ipfl.ip_blocked', 'ipfl.range_whitelisted', 'ipfl.geo_restricted', 'ipfl.anomaly_flagged'],
      subjects: ['sven.ipfl.ip_blocked', 'sven.ipfl.range_whitelisted', 'sven.ipfl.geo_restricted', 'sven.ipfl.anomaly_flagged'],
      cases: ['ipfl_block', 'ipfl_whitelist', 'ipfl_geo', 'ipfl_anomaly', 'ipfl_report', 'ipfl_monitor'],
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
