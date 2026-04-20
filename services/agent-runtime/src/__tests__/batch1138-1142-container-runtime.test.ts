import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Container Runtime management verticals', () => {
  const verticals = [
    {
      name: 'container_runtime_monitor', migration: '20260627750000_agent_container_runtime_monitor.sql',
      typeFile: 'agent-container-runtime-monitor.ts', skillDir: 'container-runtime-monitor',
      interfaces: ['RuntimeMonitorConfig', 'RuntimeMetrics', 'RuntimeHealthReport'],
      bk: 'container_runtime_monitor', eks: ['crm.monitoring_started', 'crm.anomaly_detected', 'crm.export_emitted'],
      subjects: ['sven.crm.monitoring_started', 'sven.crm.anomaly_detected', 'sven.crm.export_emitted'],
      cases: ['crm_reporter'],
    },
    {
      name: 'container_runtime_enforcer', migration: '20260627760000_agent_container_runtime_enforcer.sql',
      typeFile: 'agent-container-runtime-enforcer.ts', skillDir: 'container-runtime-enforcer',
      interfaces: ['RuntimePolicyConfig', 'EnforcementResult', 'RuntimeViolation'],
      bk: 'container_runtime_enforcer', eks: ['cre.policy_applied', 'cre.violation_blocked', 'cre.export_emitted'],
      subjects: ['sven.cre.policy_applied', 'sven.cre.violation_blocked', 'sven.cre.export_emitted'],
      cases: ['cre_reporter'],
    },
    {
      name: 'container_runtime_profiler', migration: '20260627770000_agent_container_runtime_profiler.sql',
      typeFile: 'agent-container-runtime-profiler.ts', skillDir: 'container-runtime-profiler',
      interfaces: ['ProfilerConfig', 'ProfileResult', 'SyscallProfile'],
      bk: 'container_runtime_profiler', eks: ['crp.profiling_started', 'crp.profile_generated', 'crp.export_emitted'],
      subjects: ['sven.crp.profiling_started', 'sven.crp.profile_generated', 'sven.crp.export_emitted'],
      cases: ['crp_reporter'],
    },
    {
      name: 'container_cgroup_optimizer', migration: '20260627780000_agent_container_cgroup_optimizer.sql',
      typeFile: 'agent-container-cgroup-optimizer.ts', skillDir: 'container-cgroup-optimizer',
      interfaces: ['CgroupConfig', 'CgroupOptResult', 'ResourceRecommendation'],
      bk: 'container_cgroup_optimizer', eks: ['cco.analysis_started', 'cco.limits_adjusted', 'cco.export_emitted'],
      subjects: ['sven.cco.analysis_started', 'sven.cco.limits_adjusted', 'sven.cco.export_emitted'],
      cases: ['cco_reporter'],
    },
    {
      name: 'container_runtime_auditor', migration: '20260627790000_agent_container_runtime_auditor.sql',
      typeFile: 'agent-container-runtime-auditor.ts', skillDir: 'container-runtime-auditor',
      interfaces: ['RuntimeAuditConfig', 'RuntimeAuditResult', 'RuntimeComplianceReport'],
      bk: 'container_runtime_auditor', eks: ['crta.audit_started', 'crta.findings_reported', 'crta.export_emitted'],
      subjects: ['sven.crta.audit_started', 'sven.crta.findings_reported', 'sven.crta.export_emitted'],
      cases: ['crta_reporter'],
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
