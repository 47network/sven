import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 553-557: Notification & Alerting', () => {
  const verticals = [
    {
      name: 'threshold_monitor', migration: '20260621900000_agent_threshold_monitor.sql',
      typeFile: 'agent-threshold-monitor.ts', skillDir: 'threshold-monitor',
      interfaces: ['ThresholdMonitorConfig', 'ThresholdBreach', 'MonitorRule'],
      bk: 'threshold_monitor', eks: ['thmn.threshold_breached', 'thmn.alert_fired', 'thmn.threshold_cleared', 'thmn.rule_configured'],
      subjects: ['sven.thmn.threshold_breached', 'sven.thmn.alert_fired', 'sven.thmn.threshold_cleared', 'sven.thmn.rule_configured'],
      cases: ['thmn_breach', 'thmn_fire', 'thmn_clear', 'thmn_config', 'thmn_report', 'thmn_monitor'],
    },
    {
      name: 'escalation_router', migration: '20260621910000_agent_escalation_router.sql',
      typeFile: 'agent-escalation-router.ts', skillDir: 'escalation-router',
      interfaces: ['EscalationRouterConfig', 'EscalationPath', 'EscalationEvent'],
      bk: 'escalation_router', eks: ['esrt.escalation_triggered', 'esrt.level_advanced', 'esrt.escalation_resolved', 'esrt.timeout_reached'],
      subjects: ['sven.esrt.escalation_triggered', 'sven.esrt.level_advanced', 'sven.esrt.escalation_resolved', 'sven.esrt.timeout_reached'],
      cases: ['esrt_trigger', 'esrt_advance', 'esrt_resolve', 'esrt_timeout', 'esrt_report', 'esrt_monitor'],
    },
    {
      name: 'notification_templater', migration: '20260621920000_agent_notification_templater.sql',
      typeFile: 'agent-notification-templater.ts', skillDir: 'notification-templater',
      interfaces: ['NotificationTemplaterConfig', 'TemplateInstance', 'TemplateVariable'],
      bk: 'notification_templater', eks: ['ntpl.template_rendered', 'ntpl.delivery_queued', 'ntpl.delivery_confirmed', 'ntpl.template_updated'],
      subjects: ['sven.ntpl.template_rendered', 'sven.ntpl.delivery_queued', 'sven.ntpl.delivery_confirmed', 'sven.ntpl.template_updated'],
      cases: ['ntpl_render', 'ntpl_queue', 'ntpl_confirm', 'ntpl_update', 'ntpl_report', 'ntpl_monitor'],
    },
    {
      name: 'digest_aggregator', migration: '20260621930000_agent_digest_aggregator.sql',
      typeFile: 'agent-digest-aggregator.ts', skillDir: 'digest-aggregator',
      interfaces: ['DigestAggregatorConfig', 'DigestBatch', 'DigestEntry'],
      bk: 'digest_aggregator', eks: ['dgag.digest_compiled', 'dgag.batch_dispatched', 'dgag.preference_changed', 'dgag.schedule_updated'],
      subjects: ['sven.dgag.digest_compiled', 'sven.dgag.batch_dispatched', 'sven.dgag.preference_changed', 'sven.dgag.schedule_updated'],
      cases: ['dgag_compile', 'dgag_dispatch', 'dgag_prefer', 'dgag_schedule', 'dgag_report', 'dgag_monitor'],
    },
    {
      name: 'channel_gateway', migration: '20260621940000_agent_channel_gateway.sql',
      typeFile: 'agent-channel-gateway.ts', skillDir: 'channel-gateway',
      interfaces: ['ChannelGatewayConfig', 'ChannelStatus', 'DeliveryReceipt'],
      bk: 'channel_gateway', eks: ['chgw.message_sent', 'chgw.delivery_failed', 'chgw.channel_degraded', 'chgw.failover_activated'],
      subjects: ['sven.chgw.message_sent', 'sven.chgw.delivery_failed', 'sven.chgw.channel_degraded', 'sven.chgw.failover_activated'],
      cases: ['chgw_send', 'chgw_fail', 'chgw_degrade', 'chgw_failover', 'chgw_report', 'chgw_monitor'],
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
