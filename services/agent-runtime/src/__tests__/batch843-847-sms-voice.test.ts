import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 843-847: SMS & Voice Services', () => {
  const verticals = [
    {
      name: 'sms_sender', migration: '20260624800000_agent_sms_sender.sql',
      typeFile: 'agent-sms-sender.ts', skillDir: 'sms-sender',
      interfaces: ['SmsSenderConfig', 'SmsRequest', 'SenderEvent'],
      bk: 'sms_sender', eks: ['smss.request_received', 'smss.opt_in_verified', 'smss.carrier_dispatched', 'smss.acknowledgement_recorded'],
      subjects: ['sven.smss.request_received', 'sven.smss.opt_in_verified', 'sven.smss.carrier_dispatched', 'sven.smss.acknowledgement_recorded'],
      cases: ['smss_receive', 'smss_verify', 'smss_dispatch', 'smss_record', 'smss_report', 'smss_monitor'],
    },
    {
      name: 'sms_delivery_tracker', migration: '20260624810000_agent_sms_delivery_tracker.sql',
      typeFile: 'agent-sms-delivery-tracker.ts', skillDir: 'sms-delivery-tracker',
      interfaces: ['SmsDeliveryTrackerConfig', 'DeliveryReport', 'TrackerEvent'],
      bk: 'sms_delivery_tracker', eks: ['smdt.report_received', 'smdt.status_normalized', 'smdt.entry_persisted', 'smdt.callback_invoked'],
      subjects: ['sven.smdt.report_received', 'sven.smdt.status_normalized', 'sven.smdt.entry_persisted', 'sven.smdt.callback_invoked'],
      cases: ['smdt_receive', 'smdt_normalize', 'smdt_persist', 'smdt_invoke', 'smdt_report', 'smdt_monitor'],
    },
    {
      name: 'sms_opt_in_manager', migration: '20260624820000_agent_sms_opt_in_manager.sql',
      typeFile: 'agent-sms-opt-in-manager.ts', skillDir: 'sms-opt-in-manager',
      interfaces: ['SmsOptInManagerConfig', 'OptInRecord', 'ManagerEvent'],
      bk: 'sms_opt_in_manager', eks: ['smom.request_received', 'smom.consent_captured', 'smom.record_persisted', 'smom.confirmation_sent'],
      subjects: ['sven.smom.request_received', 'sven.smom.consent_captured', 'sven.smom.record_persisted', 'sven.smom.confirmation_sent'],
      cases: ['smom_receive', 'smom_capture', 'smom_persist', 'smom_confirm', 'smom_report', 'smom_monitor'],
    },
    {
      name: 'sms_short_code_router', migration: '20260624830000_agent_sms_short_code_router.sql',
      typeFile: 'agent-sms-short-code-router.ts', skillDir: 'sms-short-code-router',
      interfaces: ['SmsShortCodeRouterConfig', 'InboundShortCodeMessage', 'RouterEvent'],
      bk: 'sms_short_code_router', eks: ['sscr.message_received', 'sscr.keyword_matched', 'sscr.handler_invoked', 'sscr.response_dispatched'],
      subjects: ['sven.sscr.message_received', 'sven.sscr.keyword_matched', 'sven.sscr.handler_invoked', 'sven.sscr.response_dispatched'],
      cases: ['sscr_receive', 'sscr_match', 'sscr_invoke', 'sscr_dispatch', 'sscr_report', 'sscr_monitor'],
    },
    {
      name: 'voice_call_initiator', migration: '20260624840000_agent_voice_call_initiator.sql',
      typeFile: 'agent-voice-call-initiator.ts', skillDir: 'voice-call-initiator',
      interfaces: ['VoiceCallInitiatorConfig', 'CallRequest', 'InitiatorEvent'],
      bk: 'voice_call_initiator', eks: ['vcin.request_received', 'vcin.compliance_checked', 'vcin.call_placed', 'vcin.outcome_recorded'],
      subjects: ['sven.vcin.request_received', 'sven.vcin.compliance_checked', 'sven.vcin.call_placed', 'sven.vcin.outcome_recorded'],
      cases: ['vcin_receive', 'vcin_check', 'vcin_place', 'vcin_record', 'vcin_report', 'vcin_monitor'],
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
