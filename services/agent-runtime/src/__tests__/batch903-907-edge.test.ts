import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 903-907: Edge Compute & Security', () => {
  const verticals = [
    {
      name: 'edge_rule_compiler', migration: '20260625400000_agent_edge_rule_compiler.sql',
      typeFile: 'agent-edge-rule-compiler.ts', skillDir: 'edge-rule-compiler',
      interfaces: ['EdgeRuleCompilerConfig', 'RuleSource', 'CompilerEvent'],
      bk: 'edge_rule_compiler', eks: ['ercp.source_received', 'ercp.rules_parsed', 'ercp.bundle_compiled', 'ercp.bundle_published'],
      subjects: ['sven.ercp.source_received', 'sven.ercp.rules_parsed', 'sven.ercp.bundle_compiled', 'sven.ercp.bundle_published'],
      cases: ['ercp_receive', 'ercp_parse', 'ercp_compile', 'ercp_publish', 'ercp_report', 'ercp_monitor'],
    },
    {
      name: 'edge_geo_router', migration: '20260625410000_agent_edge_geo_router.sql',
      typeFile: 'agent-edge-geo-router.ts', skillDir: 'edge-geo-router',
      interfaces: ['EdgeGeoRouterConfig', 'GeoRequest', 'RouterEvent'],
      bk: 'edge_geo_router', eks: ['egrt.request_received', 'egrt.geo_resolved', 'egrt.policy_applied', 'egrt.route_returned'],
      subjects: ['sven.egrt.request_received', 'sven.egrt.geo_resolved', 'sven.egrt.policy_applied', 'sven.egrt.route_returned'],
      cases: ['egrt_receive', 'egrt_resolve', 'egrt_apply', 'egrt_return', 'egrt_report', 'egrt_monitor'],
    },
    {
      name: 'edge_bot_filter', migration: '20260625420000_agent_edge_bot_filter.sql',
      typeFile: 'agent-edge-bot-filter.ts', skillDir: 'edge-bot-filter',
      interfaces: ['EdgeBotFilterConfig', 'BotEvaluation', 'FilterEvent'],
      bk: 'edge_bot_filter', eks: ['ebot.request_received', 'ebot.signals_evaluated', 'ebot.verdict_issued', 'ebot.action_applied'],
      subjects: ['sven.ebot.request_received', 'sven.ebot.signals_evaluated', 'sven.ebot.verdict_issued', 'sven.ebot.action_applied'],
      cases: ['ebot_receive', 'ebot_evaluate', 'ebot_issue', 'ebot_apply', 'ebot_report', 'ebot_monitor'],
    },
    {
      name: 'edge_rate_shaper', migration: '20260625430000_agent_edge_rate_shaper.sql',
      typeFile: 'agent-edge-rate-shaper.ts', skillDir: 'edge-rate-shaper',
      interfaces: ['EdgeRateShaperConfig', 'RateBucket', 'ShaperEvent'],
      bk: 'edge_rate_shaper', eks: ['erts.request_received', 'erts.bucket_evaluated', 'erts.action_decided', 'erts.headers_emitted'],
      subjects: ['sven.erts.request_received', 'sven.erts.bucket_evaluated', 'sven.erts.action_decided', 'sven.erts.headers_emitted'],
      cases: ['erts_receive', 'erts_evaluate', 'erts_decide', 'erts_emit', 'erts_report', 'erts_monitor'],
    },
    {
      name: 'edge_security_responder', migration: '20260625440000_agent_edge_security_responder.sql',
      typeFile: 'agent-edge-security-responder.ts', skillDir: 'edge-security-responder',
      interfaces: ['EdgeSecurityResponderConfig', 'SecurityIncident', 'ResponderEvent'],
      bk: 'edge_security_responder', eks: ['esrp.signal_received', 'esrp.incident_classified', 'esrp.response_dispatched', 'esrp.outcome_recorded'],
      subjects: ['sven.esrp.signal_received', 'sven.esrp.incident_classified', 'sven.esrp.response_dispatched', 'sven.esrp.outcome_recorded'],
      cases: ['esrp_receive', 'esrp_classify', 'esrp_dispatch', 'esrp_record', 'esrp_report', 'esrp_monitor'],
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
