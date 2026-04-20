import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 838-842: Email Services', () => {
  const verticals = [
    {
      name: 'email_template_renderer', migration: '20260624750000_agent_email_template_renderer.sql',
      typeFile: 'agent-email-template-renderer.ts', skillDir: 'email-template-renderer',
      interfaces: ['EmailTemplateRendererConfig', 'RenderRequest', 'RendererEvent'],
      bk: 'email_template_renderer', eks: ['emtr.template_loaded', 'emtr.context_validated', 'emtr.body_rendered', 'emtr.output_returned'],
      subjects: ['sven.emtr.template_loaded', 'sven.emtr.context_validated', 'sven.emtr.body_rendered', 'sven.emtr.output_returned'],
      cases: ['emtr_load', 'emtr_validate', 'emtr_render', 'emtr_return', 'emtr_report', 'emtr_monitor'],
    },
    {
      name: 'email_bounce_handler', migration: '20260624760000_agent_email_bounce_handler.sql',
      typeFile: 'agent-email-bounce-handler.ts', skillDir: 'email-bounce-handler',
      interfaces: ['EmailBounceHandlerConfig', 'BounceEvent', 'HandlerEvent'],
      bk: 'email_bounce_handler', eks: ['embh.bounce_received', 'embh.classification_applied', 'embh.suppression_updated', 'embh.notification_sent'],
      subjects: ['sven.embh.bounce_received', 'sven.embh.classification_applied', 'sven.embh.suppression_updated', 'sven.embh.notification_sent'],
      cases: ['embh_receive', 'embh_classify', 'embh_update', 'embh_notify', 'embh_report', 'embh_monitor'],
    },
    {
      name: 'email_unsubscribe_manager', migration: '20260624770000_agent_email_unsubscribe_manager.sql',
      typeFile: 'agent-email-unsubscribe-manager.ts', skillDir: 'email-unsubscribe-manager',
      interfaces: ['EmailUnsubscribeManagerConfig', 'UnsubscribeRequest', 'ManagerEvent'],
      bk: 'email_unsubscribe_manager', eks: ['emum.request_received', 'emum.identity_verified', 'emum.preferences_updated', 'emum.confirmation_sent'],
      subjects: ['sven.emum.request_received', 'sven.emum.identity_verified', 'sven.emum.preferences_updated', 'sven.emum.confirmation_sent'],
      cases: ['emum_receive', 'emum_verify', 'emum_update', 'emum_confirm', 'emum_report', 'emum_monitor'],
    },
    {
      name: 'email_deliverability_monitor', migration: '20260624780000_agent_email_deliverability_monitor.sql',
      typeFile: 'agent-email-deliverability-monitor.ts', skillDir: 'email-deliverability-monitor',
      interfaces: ['EmailDeliverabilityMonitorConfig', 'DeliverabilitySnapshot', 'MonitorEvent'],
      bk: 'email_deliverability_monitor', eks: ['emdm.metrics_collected', 'emdm.reputation_scored', 'emdm.alerts_evaluated', 'emdm.report_persisted'],
      subjects: ['sven.emdm.metrics_collected', 'sven.emdm.reputation_scored', 'sven.emdm.alerts_evaluated', 'sven.emdm.report_persisted'],
      cases: ['emdm_collect', 'emdm_score', 'emdm_evaluate', 'emdm_persist', 'emdm_report', 'emdm_monitor'],
    },
    {
      name: 'email_open_tracker', migration: '20260624790000_agent_email_open_tracker.sql',
      typeFile: 'agent-email-open-tracker.ts', skillDir: 'email-open-tracker',
      interfaces: ['EmailOpenTrackerConfig', 'OpenEvent', 'TrackerEvent'],
      bk: 'email_open_tracker', eks: ['emot.pixel_requested', 'emot.consent_checked', 'emot.event_recorded', 'emot.aggregation_emitted'],
      subjects: ['sven.emot.pixel_requested', 'sven.emot.consent_checked', 'sven.emot.event_recorded', 'sven.emot.aggregation_emitted'],
      cases: ['emot_request', 'emot_check', 'emot_record', 'emot_emit', 'emot_report', 'emot_monitor'],
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
