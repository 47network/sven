import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 728-732: Reliability Engineering', () => {
  const verticals = [
    {
      name: 'chaos_injector', migration: '20260623650000_agent_chaos_injector.sql',
      typeFile: 'agent-chaos-injector.ts', skillDir: 'chaos-injector',
      interfaces: ['ChaosInjectorConfig', 'ChaosExperiment', 'InjectorEvent'],
      bk: 'chaos_injector', eks: ['chin.experiment_scheduled', 'chin.fault_injected', 'chin.steady_state_verified', 'chin.experiment_aborted'],
      subjects: ['sven.chin.experiment_scheduled', 'sven.chin.fault_injected', 'sven.chin.steady_state_verified', 'sven.chin.experiment_aborted'],
      cases: ['chin_schedule', 'chin_inject', 'chin_verify', 'chin_abort', 'chin_report', 'chin_monitor'],
    },
    {
      name: 'fault_simulator', migration: '20260623660000_agent_fault_simulator.sql',
      typeFile: 'agent-fault-simulator.ts', skillDir: 'fault-simulator',
      interfaces: ['FaultSimulatorConfig', 'FaultScenario', 'SimulatorEvent'],
      bk: 'fault_simulator', eks: ['ftsm.scenario_loaded', 'ftsm.fault_simulated', 'ftsm.recovery_observed', 'ftsm.results_recorded'],
      subjects: ['sven.ftsm.scenario_loaded', 'sven.ftsm.fault_simulated', 'sven.ftsm.recovery_observed', 'sven.ftsm.results_recorded'],
      cases: ['ftsm_load', 'ftsm_simulate', 'ftsm_observe', 'ftsm_record', 'ftsm_report', 'ftsm_monitor'],
    },
    {
      name: 'resilience_tester', migration: '20260623670000_agent_resilience_tester.sql',
      typeFile: 'agent-resilience-tester.ts', skillDir: 'resilience-tester',
      interfaces: ['ResilienceTesterConfig', 'ResilienceTest', 'TesterEvent'],
      bk: 'resilience_tester', eks: ['rstr.test_planned', 'rstr.workload_applied', 'rstr.recovery_measured', 'rstr.score_assigned'],
      subjects: ['sven.rstr.test_planned', 'sven.rstr.workload_applied', 'sven.rstr.recovery_measured', 'sven.rstr.score_assigned'],
      cases: ['rstr_plan', 'rstr_apply', 'rstr_measure', 'rstr_assign', 'rstr_report', 'rstr_monitor'],
    },
    {
      name: 'dependency_mapper', migration: '20260623680000_agent_dependency_mapper.sql',
      typeFile: 'agent-dependency-mapper.ts', skillDir: 'dependency-mapper',
      interfaces: ['DependencyMapperConfig', 'DependencyGraph', 'MapperEvent'],
      bk: 'dependency_mapper', eks: ['dpmp.graph_built', 'dpmp.node_added', 'dpmp.edge_inferred', 'dpmp.cycle_detected'],
      subjects: ['sven.dpmp.graph_built', 'sven.dpmp.node_added', 'sven.dpmp.edge_inferred', 'sven.dpmp.cycle_detected'],
      cases: ['dpmp_build', 'dpmp_add', 'dpmp_infer', 'dpmp_detect', 'dpmp_report', 'dpmp_monitor'],
    },
    {
      name: 'blast_radius_calculator', migration: '20260623690000_agent_blast_radius_calculator.sql',
      typeFile: 'agent-blast-radius-calculator.ts', skillDir: 'blast-radius-calculator',
      interfaces: ['BlastRadiusCalculatorConfig', 'BlastRadius', 'CalculatorEvent'],
      bk: 'blast_radius_calculator', eks: ['brca.radius_computed', 'brca.impact_assessed', 'brca.containment_recommended', 'brca.simulation_completed'],
      subjects: ['sven.brca.radius_computed', 'sven.brca.impact_assessed', 'sven.brca.containment_recommended', 'sven.brca.simulation_completed'],
      cases: ['brca_compute', 'brca_assess', 'brca_recommend', 'brca_complete', 'brca_report', 'brca_monitor'],
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
