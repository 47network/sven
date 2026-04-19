import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 643-647: Notification & Alerting', () => {
  const verticals = [
    {
      name: 'escalation_manager', migration: '20260622800000_agent_escalation_manager.sql',
      typeFile: 'agent-escalation-manager.ts', skillDir: 'escalation-manager',
      interfaces: ['EscalationManagerConfig', 'EscalationPolicy', 'ManagerEvent'],
      bk: 'escalation_manager', eks: ['escm.escalation_triggered', 'escm.policy_matched', 'escm.owner_notified', 'escm.resolution_timed_out'],
      subjects: ['sven.escm.escalation_triggered', 'sven.escm.policy_matched', 'sven.escm.owner_notified', 'sven.escm.resolution_timed_out'],
      cases: ['escm_trigger', 'escm_match', 'escm_notify', 'escm_timeout', 'escm_report', 'escm_monitor'],
    },
    {
      name: 'digest_builder', migration: '20260622810000_agent_digest_builder.sql',
      typeFile: 'agent-digest-builder.ts', skillDir: 'digest-builder',
      interfaces: ['DigestBuilderConfig', 'DigestContent', 'BuilderEvent'],
      bk: 'digest_builder', eks: ['dgbl.digest_compiled', 'dgbl.schedule_triggered', 'dgbl.recipient_resolved', 'dgbl.delivery_confirmed'],
      subjects: ['sven.dgbl.digest_compiled', 'sven.dgbl.schedule_triggered', 'sven.dgbl.recipient_resolved', 'sven.dgbl.delivery_confirmed'],
      cases: ['dgbl_compile', 'dgbl_schedule', 'dgbl_resolve', 'dgbl_deliver', 'dgbl_report', 'dgbl_monitor'],
    },
    {
      name: 'channel_router', migration: '20260622820000_agent_channel_router.sql',
      typeFile: 'agent-channel-router.ts', skillDir: 'channel-router',
      interfaces: ['ChannelRouterConfig', 'RoutingDecision', 'RouterEvent'],
      bk: 'channel_router', eks: ['chrt.message_routed', 'chrt.channel_selected', 'chrt.fallback_triggered', 'chrt.preference_updated'],
      subjects: ['sven.chrt.message_routed', 'sven.chrt.channel_selected', 'sven.chrt.fallback_triggered', 'sven.chrt.preference_updated'],
      cases: ['chrt_route', 'chrt_select', 'chrt_fallback', 'chrt_preference', 'chrt_report', 'chrt_monitor'],
    },
    {
      name: 'silence_enforcer', migration: '20260622830000_agent_silence_enforcer.sql',
      typeFile: 'agent-silence-enforcer.ts', skillDir: 'silence-enforcer',
      interfaces: ['SilenceEnforcerConfig', 'SilenceWindow', 'EnforcerEvent'],
      bk: 'silence_enforcer', eks: ['sien.silence_activated', 'sien.silence_expired', 'sien.alert_suppressed', 'sien.override_granted'],
      subjects: ['sven.sien.silence_activated', 'sven.sien.silence_expired', 'sven.sien.alert_suppressed', 'sven.sien.override_granted'],
      cases: ['sien_activate', 'sien_expire', 'sien_suppress', 'sien_override', 'sien_report', 'sien_monitor'],
    },
    {
      name: 'threshold_tuner', migration: '20260622840000_agent_threshold_tuner.sql',
      typeFile: 'agent-threshold-tuner.ts', skillDir: 'threshold-tuner',
      interfaces: ['ThresholdTunerConfig', 'TuningResult', 'TunerEvent'],
      bk: 'threshold_tuner', eks: ['thtu.threshold_adjusted', 'thtu.anomaly_detected', 'thtu.baseline_recalculated', 'thtu.sensitivity_changed'],
      subjects: ['sven.thtu.threshold_adjusted', 'sven.thtu.anomaly_detected', 'sven.thtu.baseline_recalculated', 'sven.thtu.sensitivity_changed'],
      cases: ['thtu_adjust', 'thtu_detect', 'thtu_baseline', 'thtu_sensitivity', 'thtu_report', 'thtu_monitor'],
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
