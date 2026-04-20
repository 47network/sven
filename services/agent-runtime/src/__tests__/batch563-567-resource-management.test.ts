import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 563-567: Resource Management & Capacity', () => {
  const verticals = [
    {
      name: 'resource_allocator', migration: '20260622000000_agent_resource_allocator.sql',
      typeFile: 'agent-resource-allocator.ts', skillDir: 'resource-allocator',
      interfaces: ['ResourceAllocatorConfig', 'AllocationRequest', 'AllocationResult'],
      bk: 'resource_allocator', eks: ['rsal.allocation_requested', 'rsal.resource_assigned', 'rsal.allocation_released', 'rsal.contention_detected'],
      subjects: ['sven.rsal.allocation_requested', 'sven.rsal.resource_assigned', 'sven.rsal.allocation_released', 'sven.rsal.contention_detected'],
      cases: ['rsal_request', 'rsal_assign', 'rsal_release', 'rsal_contend', 'rsal_report', 'rsal_monitor'],
    },
    {
      name: 'demand_forecaster', migration: '20260622010000_agent_demand_forecaster.sql',
      typeFile: 'agent-demand-forecaster.ts', skillDir: 'demand-forecaster',
      interfaces: ['DemandForecasterConfig', 'ForecastResult', 'DemandSignal'],
      bk: 'demand_forecaster', eks: ['dmfc.forecast_generated', 'dmfc.spike_predicted', 'dmfc.model_retrained', 'dmfc.accuracy_computed'],
      subjects: ['sven.dmfc.forecast_generated', 'sven.dmfc.spike_predicted', 'sven.dmfc.model_retrained', 'sven.dmfc.accuracy_computed'],
      cases: ['dmfc_forecast', 'dmfc_spike', 'dmfc_retrain', 'dmfc_accuracy', 'dmfc_report', 'dmfc_monitor'],
    },
    {
      name: 'burst_handler', migration: '20260622020000_agent_burst_handler.sql',
      typeFile: 'agent-burst-handler.ts', skillDir: 'burst-handler',
      interfaces: ['BurstHandlerConfig', 'BurstEvent', 'ThrottlePolicy'],
      bk: 'burst_handler', eks: ['brsh.burst_detected', 'brsh.throttle_applied', 'brsh.burst_subsided', 'brsh.overflow_rejected'],
      subjects: ['sven.brsh.burst_detected', 'sven.brsh.throttle_applied', 'sven.brsh.burst_subsided', 'sven.brsh.overflow_rejected'],
      cases: ['brsh_detect', 'brsh_throttle', 'brsh_subside', 'brsh_reject', 'brsh_report', 'brsh_monitor'],
    },
    {
      name: 'reservation_clerk', migration: '20260622030000_agent_reservation_clerk.sql',
      typeFile: 'agent-reservation-clerk.ts', skillDir: 'reservation-clerk',
      interfaces: ['ReservationClerkConfig', 'Reservation', 'AvailabilitySlot'],
      bk: 'reservation_clerk', eks: ['rsvk.reservation_created', 'rsvk.reservation_confirmed', 'rsvk.reservation_cancelled', 'rsvk.slot_released'],
      subjects: ['sven.rsvk.reservation_created', 'sven.rsvk.reservation_confirmed', 'sven.rsvk.reservation_cancelled', 'sven.rsvk.slot_released'],
      cases: ['rsvk_create', 'rsvk_confirm', 'rsvk_cancel', 'rsvk_release', 'rsvk_report', 'rsvk_monitor'],
    },
    {
      name: 'utilization_tracker', migration: '20260622040000_agent_utilization_tracker.sql',
      typeFile: 'agent-utilization-tracker.ts', skillDir: 'utilization-tracker',
      interfaces: ['UtilizationTrackerConfig', 'UtilizationSnapshot', 'UsageTrend'],
      bk: 'utilization_tracker', eks: ['utlz.snapshot_recorded', 'utlz.threshold_exceeded', 'utlz.trend_computed', 'utlz.report_generated'],
      subjects: ['sven.utlz.snapshot_recorded', 'sven.utlz.threshold_exceeded', 'sven.utlz.trend_computed', 'sven.utlz.report_generated'],
      cases: ['utlz_snapshot', 'utlz_threshold', 'utlz_trend', 'utlz_generate', 'utlz_report', 'utlz_monitor'],
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
