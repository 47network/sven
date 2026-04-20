import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 518-522: Notification & Messaging', () => {
  const verticals = [
    {
      name: 'push_dispatcher', migration: '20260621550000_agent_push_dispatcher.sql',
      typeFile: 'agent-push-dispatcher.ts', skillDir: 'push-dispatcher',
      interfaces: ['PushDispatcherConfig', 'PushPayload', 'DeliveryReceipt'],
      bk: 'push_dispatcher', eks: ['psdp.push_sent', 'psdp.batch_dispatched', 'psdp.token_refreshed', 'psdp.delivery_confirmed'],
      subjects: ['sven.psdp.push_sent', 'sven.psdp.batch_dispatched', 'sven.psdp.token_refreshed', 'sven.psdp.delivery_confirmed'],
      cases: ['psdp_send', 'psdp_batch', 'psdp_refresh', 'psdp_monitor', 'psdp_report', 'psdp_configure'],
    },
    {
      name: 'email_renderer', migration: '20260621560000_agent_email_renderer.sql',
      typeFile: 'agent-email-renderer.ts', skillDir: 'email-renderer',
      interfaces: ['EmailRendererConfig', 'EmailTemplate', 'RenderResult'],
      bk: 'email_renderer', eks: ['emrd.email_rendered', 'emrd.template_compiled', 'emrd.layout_cached', 'emrd.preview_generated'],
      subjects: ['sven.emrd.email_rendered', 'sven.emrd.template_compiled', 'sven.emrd.layout_cached', 'sven.emrd.preview_generated'],
      cases: ['emrd_render', 'emrd_compile', 'emrd_cache', 'emrd_preview', 'emrd_report', 'emrd_monitor'],
    },
    {
      name: 'sms_gateway', migration: '20260621570000_agent_sms_gateway.sql',
      typeFile: 'agent-sms-gateway.ts', skillDir: 'sms-gateway',
      interfaces: ['SmsGatewayConfig', 'SmsMessage', 'GatewayResponse'],
      bk: 'sms_gateway', eks: ['smgw.sms_sent', 'smgw.provider_switched', 'smgw.rate_checked', 'smgw.delivery_verified'],
      subjects: ['sven.smgw.sms_sent', 'sven.smgw.provider_switched', 'sven.smgw.rate_checked', 'sven.smgw.delivery_verified'],
      cases: ['smgw_send', 'smgw_switch', 'smgw_check', 'smgw_verify', 'smgw_report', 'smgw_monitor'],
    },
    {
      name: 'channel_selector', migration: '20260621580000_agent_channel_selector.sql',
      typeFile: 'agent-channel-selector.ts', skillDir: 'channel-selector',
      interfaces: ['ChannelSelectorConfig', 'ChannelRule', 'SelectionResult'],
      bk: 'channel_selector', eks: ['chsl.channel_selected', 'chsl.rule_evaluated', 'chsl.preference_applied', 'chsl.fallback_used'],
      subjects: ['sven.chsl.channel_selected', 'sven.chsl.rule_evaluated', 'sven.chsl.preference_applied', 'sven.chsl.fallback_used'],
      cases: ['chsl_select', 'chsl_evaluate', 'chsl_apply', 'chsl_fallback', 'chsl_report', 'chsl_monitor'],
    },
    {
      name: 'delivery_tracker', migration: '20260621590000_agent_delivery_tracker.sql',
      typeFile: 'agent-delivery-tracker.ts', skillDir: 'delivery-tracker',
      interfaces: ['DeliveryTrackerConfig', 'DeliveryEvent', 'TrackingReport'],
      bk: 'delivery_tracker', eks: ['dltr.delivery_tracked', 'dltr.bounce_detected', 'dltr.open_recorded', 'dltr.status_updated'],
      subjects: ['sven.dltr.delivery_tracked', 'sven.dltr.bounce_detected', 'sven.dltr.open_recorded', 'sven.dltr.status_updated'],
      cases: ['dltr_track', 'dltr_bounce', 'dltr_record', 'dltr_update', 'dltr_report', 'dltr_monitor'],
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
      test('type file exports interfaces', () => {
        const content = fs.readFileSync(path.join(ROOT, 'packages/shared/src', v.typeFile), 'utf-8');
        v.interfaces.forEach((iface) => { expect(content).toContain(`export interface ${iface}`); });
      });
      test('barrel export exists', () => {
        const idx = fs.readFileSync(path.join(ROOT, 'packages/shared/src/index.ts'), 'utf-8');
        expect(idx).toContain(`from './${v.typeFile.replace('.ts', '')}'`);
      });
      test('SKILL.md exists', () => {
        expect(fs.existsSync(path.join(ROOT, 'skills/autonomous-economy', v.skillDir, 'SKILL.md'))).toBe(true);
      });
      test('SKILL.md has actions', () => {
        const content = fs.readFileSync(path.join(ROOT, 'skills/autonomous-economy', v.skillDir, 'SKILL.md'), 'utf-8');
        expect(content).toContain('## Actions');
      });
      test('BK registered', () => {
        const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
        expect(types).toContain(`'${v.bk}'`);
      });
      test('EK values registered', () => {
        const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
        v.eks.forEach((ek) => { expect(types).toContain(`'${ek}'`); });
      });
      test('districtFor case exists', () => {
        const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
        expect(types).toContain(`case '${v.bk}':`);
      });
      test('SUBJECT_MAP entries exist', () => {
        const eb = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
        v.subjects.forEach((subj) => { expect(eb).toContain(`'${subj}'`); });
      });
      test('task executor cases exist', () => {
        const te = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
        v.cases.forEach((cs) => { expect(te).toContain(`case '${cs}'`); });
      });
    });
  });
});
