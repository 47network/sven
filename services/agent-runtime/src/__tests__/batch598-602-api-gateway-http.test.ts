import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 598-602: API Gateway & HTTP', () => {
  const verticals = [
    {
      name: 'cors_enforcer', migration: '20260622350000_agent_cors_enforcer.sql',
      typeFile: 'agent-cors-enforcer.ts', skillDir: 'cors-enforcer',
      interfaces: ['CorsEnforcerConfig', 'CorsPolicy', 'OriginCheck'],
      bk: 'cors_enforcer', eks: ['crse.policy_applied', 'crse.origin_blocked', 'crse.wildcard_warned', 'crse.preflight_handled'],
      subjects: ['sven.crse.policy_applied', 'sven.crse.origin_blocked', 'sven.crse.wildcard_warned', 'sven.crse.preflight_handled'],
      cases: ['crse_apply', 'crse_block', 'crse_warn', 'crse_preflight', 'crse_report', 'crse_monitor'],
    },
    {
      name: 'header_injector', migration: '20260622360000_agent_header_injector.sql',
      typeFile: 'agent-header-injector.ts', skillDir: 'header-injector',
      interfaces: ['HeaderInjectorConfig', 'HeaderRule', 'InjectionEvent'],
      bk: 'header_injector', eks: ['hdij.header_injected', 'hdij.rule_matched', 'hdij.security_added', 'hdij.cache_header_set'],
      subjects: ['sven.hdij.header_injected', 'sven.hdij.rule_matched', 'sven.hdij.security_added', 'sven.hdij.cache_header_set'],
      cases: ['hdij_inject', 'hdij_match', 'hdij_security', 'hdij_cache', 'hdij_report', 'hdij_monitor'],
    },
    {
      name: 'rate_shaper', migration: '20260622370000_agent_rate_shaper.sql',
      typeFile: 'agent-rate-shaper.ts', skillDir: 'rate-shaper',
      interfaces: ['RateShaperConfig', 'ShapingRule', 'TrafficProfile'],
      bk: 'rate_shaper', eks: ['rtsh.traffic_shaped', 'rtsh.burst_allowed', 'rtsh.throttle_applied', 'rtsh.quota_reset'],
      subjects: ['sven.rtsh.traffic_shaped', 'sven.rtsh.burst_allowed', 'sven.rtsh.throttle_applied', 'sven.rtsh.quota_reset'],
      cases: ['rtsh_shape', 'rtsh_burst', 'rtsh_throttle', 'rtsh_reset', 'rtsh_report', 'rtsh_monitor'],
    },
    {
      name: 'payload_sanitizer', migration: '20260622380000_agent_payload_sanitizer.sql',
      typeFile: 'agent-payload-sanitizer.ts', skillDir: 'payload-sanitizer',
      interfaces: ['PayloadSanitizerConfig', 'SanitizeResult', 'ThreatDetection'],
      bk: 'payload_sanitizer', eks: ['plsn.payload_sanitized', 'plsn.threat_detected', 'plsn.xss_blocked', 'plsn.injection_prevented'],
      subjects: ['sven.plsn.payload_sanitized', 'sven.plsn.threat_detected', 'sven.plsn.xss_blocked', 'sven.plsn.injection_prevented'],
      cases: ['plsn_sanitize', 'plsn_detect', 'plsn_block', 'plsn_prevent', 'plsn_report', 'plsn_monitor'],
    },
    {
      name: 'response_cacher', migration: '20260622390000_agent_response_cacher.sql',
      typeFile: 'agent-response-cacher.ts', skillDir: 'response-cacher',
      interfaces: ['ResponseCacherConfig', 'CacheEntry', 'EvictionEvent'],
      bk: 'response_cacher', eks: ['rsch.response_cached', 'rsch.cache_hit', 'rsch.cache_evicted', 'rsch.ttl_expired'],
      subjects: ['sven.rsch.response_cached', 'sven.rsch.cache_hit', 'sven.rsch.cache_evicted', 'sven.rsch.ttl_expired'],
      cases: ['rsch_cache', 'rsch_hit', 'rsch_evict', 'rsch_expire', 'rsch_report', 'rsch_monitor'],
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
