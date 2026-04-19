import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 803-807: Messaging Channels', () => {
  const verticals = [
    {
      name: 'email_template_engine', migration: '20260624400000_agent_email_template_engine.sql',
      typeFile: 'agent-email-template-engine.ts', skillDir: 'email-template-engine',
      interfaces: ['EmailTemplateEngineConfig', 'EmailTemplate', 'EngineEvent'],
      bk: 'email_template_engine', eks: ['etmp.template_loaded', 'etmp.context_merged', 'etmp.email_rendered', 'etmp.delivery_queued'],
      subjects: ['sven.etmp.template_loaded', 'sven.etmp.context_merged', 'sven.etmp.email_rendered', 'sven.etmp.delivery_queued'],
      cases: ['etmp_load', 'etmp_merge', 'etmp_render', 'etmp_queue', 'etmp_report', 'etmp_monitor'],
    },
    {
      name: 'sms_dispatcher', migration: '20260624410000_agent_sms_dispatcher.sql',
      typeFile: 'agent-sms-dispatcher.ts', skillDir: 'sms-dispatcher',
      interfaces: ['SmsDispatcherConfig', 'SmsMessage', 'DispatcherEvent'],
      bk: 'sms_dispatcher', eks: ['smsd.message_validated', 'smsd.carrier_routed', 'smsd.sms_sent', 'smsd.receipt_recorded'],
      subjects: ['sven.smsd.message_validated', 'sven.smsd.carrier_routed', 'sven.smsd.sms_sent', 'sven.smsd.receipt_recorded'],
      cases: ['smsd_validate', 'smsd_route', 'smsd_send', 'smsd_record', 'smsd_report', 'smsd_monitor'],
    },
    {
      name: 'mobile_push_router', migration: '20260624420000_agent_mobile_push_router.sql',
      typeFile: 'agent-mobile-push-router.ts', skillDir: 'mobile-push-router',
      interfaces: ['MobilePushRouterConfig', 'PushNotification', 'RouterEvent'],
      bk: 'mobile_push_router', eks: ['mppr.notification_received', 'mppr.platform_routed', 'mppr.push_dispatched', 'mppr.receipt_processed'],
      subjects: ['sven.mppr.notification_received', 'sven.mppr.platform_routed', 'sven.mppr.push_dispatched', 'sven.mppr.receipt_processed'],
      cases: ['mppr_receive', 'mppr_route', 'mppr_dispatch', 'mppr_process', 'mppr_report', 'mppr_monitor'],
    },
    {
      name: 'voice_call_dialer', migration: '20260624430000_agent_voice_call_dialer.sql',
      typeFile: 'agent-voice-call-dialer.ts', skillDir: 'voice-call-dialer',
      interfaces: ['VoiceCallDialerConfig', 'VoiceCall', 'DialerEvent'],
      bk: 'voice_call_dialer', eks: ['vcdl.call_initiated', 'vcdl.script_executed', 'vcdl.response_captured', 'vcdl.call_completed'],
      subjects: ['sven.vcdl.call_initiated', 'sven.vcdl.script_executed', 'sven.vcdl.response_captured', 'sven.vcdl.call_completed'],
      cases: ['vcdl_initiate', 'vcdl_execute', 'vcdl_capture', 'vcdl_complete', 'vcdl_report', 'vcdl_monitor'],
    },
    {
      name: 'fax_gateway', migration: '20260624440000_agent_fax_gateway.sql',
      typeFile: 'agent-fax-gateway.ts', skillDir: 'fax-gateway',
      interfaces: ['FaxGatewayConfig', 'FaxJob', 'GatewayEvent'],
      bk: 'fax_gateway', eks: ['faxg.fax_queued', 'faxg.transmission_started', 'faxg.pages_sent', 'faxg.delivery_confirmed'],
      subjects: ['sven.faxg.fax_queued', 'sven.faxg.transmission_started', 'sven.faxg.pages_sent', 'sven.faxg.delivery_confirmed'],
      cases: ['faxg_queue', 'faxg_start', 'faxg_send', 'faxg_confirm', 'faxg_report', 'faxg_monitor'],
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
