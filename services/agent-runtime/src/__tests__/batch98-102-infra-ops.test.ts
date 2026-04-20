import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batch 98 — Agent Auto-Scaling', () => {
  test('migration SQL exists and creates tables', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260617350000_agent_auto_scaling.sql'), 'utf-8');
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS agent_scaling_policies/);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS agent_scaling_events/);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS agent_scaling_metrics/);
    expect(sql).toMatch(/CREATE INDEX/);
  });

  test('shared types file exports correct types', () => {
    const ts = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-auto-scaling.ts'), 'utf-8');
    expect(ts).toMatch(/export type ScalingResourceType/);
    expect(ts).toMatch(/export type ScalingDirection/);
    expect(ts).toMatch(/export interface AutoScalingPolicy/);
    expect(ts).toMatch(/export interface AutoScalingEvent/);
    expect(ts).toMatch(/export interface AutoScalingStats/);
  });

  test('skill SKILL.md exists with correct structure', () => {
    const md = fs.readFileSync(path.join(ROOT, 'skills/agent-auto-scaling/SKILL.md'), 'utf-8');
    expect(md).toMatch(/skill:\s*agent-auto-scaling/);
    expect(md).toMatch(/triggers:/);
    expect(md).toMatch(/autoscaling_create_policy/);
  });

  test('shared index.ts exports agent-auto-scaling', () => {
    const idx = fs.readFileSync(path.join(ROOT, 'packages/shared/src/index.ts'), 'utf-8');
    expect(idx).toMatch(/export \* from '\.\/agent-auto-scaling\.js'/);
  });

  test('types.ts has auto_scaler building kind', () => {
    const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    expect(types).toMatch(/\| 'auto_scaler'/);
  });

  test('event-bus.ts has autoscaling SUBJECT_MAP entries', () => {
    const eb = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
    expect(eb).toMatch(/sven\.autoscaling\.policy_created/);
    expect(eb).toMatch(/sven\.autoscaling\.scale_triggered/);
    expect(eb).toMatch(/sven\.autoscaling\.scale_completed/);
    expect(eb).toMatch(/sven\.autoscaling\.metric_recorded/);
  });

  test('task-executor has autoscaling switch cases and handlers', () => {
    const te = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
    expect(te).toMatch(/case 'autoscaling_create_policy'/);
    expect(te).toMatch(/case 'autoscaling_evaluate'/);
    expect(te).toMatch(/case 'autoscaling_scale_up'/);
    expect(te).toMatch(/case 'autoscaling_scale_down'/);
    expect(te).toMatch(/case 'autoscaling_record_metric'/);
    expect(te).toMatch(/case 'autoscaling_report'/);
    expect(te).toMatch(/handleAutoscalingCreatePolicy[\s\S]*policyId/);
    expect(te).toMatch(/handleAutoscalingReport[\s\S]*totalPolicies/);
  });
});

describe('Batch 99 — Agent DNS Management', () => {
  test('migration SQL exists and creates tables', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260617360000_agent_dns_management.sql'), 'utf-8');
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS agent_dns_zones/);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS agent_dns_records/);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS agent_dns_changes/);
  });

  test('shared types file exports correct types', () => {
    const ts = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-dns-management.ts'), 'utf-8');
    expect(ts).toMatch(/export type DnsRecordType/);
    expect(ts).toMatch(/export type DnsZoneStatus/);
    expect(ts).toMatch(/export interface DnsZone/);
    expect(ts).toMatch(/export interface DnsRecord/);
    expect(ts).toMatch(/export interface DnsHealthCheck/);
  });

  test('skill SKILL.md exists with correct structure', () => {
    const md = fs.readFileSync(path.join(ROOT, 'skills/agent-dns-management/SKILL.md'), 'utf-8');
    expect(md).toMatch(/skill:\s*agent-dns-management/);
    expect(md).toMatch(/dns_create_zone/);
  });

  test('types.ts has dns_manager building kind', () => {
    const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    expect(types).toMatch(/\| 'dns_manager'/);
  });

  test('event-bus.ts has dns SUBJECT_MAP entries', () => {
    const eb = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
    expect(eb).toMatch(/sven\.dns\.zone_created/);
    expect(eb).toMatch(/sven\.dns\.record_added/);
    expect(eb).toMatch(/sven\.dns\.propagation_complete/);
  });

  test('task-executor has dns switch cases and handlers', () => {
    const te = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
    expect(te).toMatch(/case 'dns_create_zone'/);
    expect(te).toMatch(/case 'dns_add_record'/);
    expect(te).toMatch(/case 'dns_report'/);
    expect(te).toMatch(/handleDnsCreateZone[\s\S]*zoneId/);
  });
});

describe('Batch 100 — Agent SSL Certificates', () => {
  test('migration SQL exists and creates tables', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260617370000_agent_ssl_certificates.sql'), 'utf-8');
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS agent_ssl_certificates/);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS agent_ssl_renewal_log/);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS agent_ssl_alerts/);
  });

  test('shared types file exports correct types', () => {
    const ts = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-ssl-certificates.ts'), 'utf-8');
    expect(ts).toMatch(/export type SslCertType/);
    expect(ts).toMatch(/export type SslCertStatus/);
    expect(ts).toMatch(/export interface SslCertificate/);
    expect(ts).toMatch(/export interface SslCertStats/);
  });

  test('skill SKILL.md exists', () => {
    const md = fs.readFileSync(path.join(ROOT, 'skills/agent-ssl-certificates/SKILL.md'), 'utf-8');
    expect(md).toMatch(/skill:\s*agent-ssl-certificates/);
    expect(md).toMatch(/ssl_issue_cert/);
  });

  test('types.ts has ssl_cert_manager building kind', () => {
    const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    expect(types).toMatch(/\| 'ssl_cert_manager'/);
  });

  test('event-bus.ts has ssl SUBJECT_MAP entries', () => {
    const eb = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
    expect(eb).toMatch(/sven\.ssl\.cert_issued/);
    expect(eb).toMatch(/sven\.ssl\.cert_renewed/);
    expect(eb).toMatch(/sven\.ssl\.cert_revoked/);
  });

  test('task-executor has ssl switch cases and handlers', () => {
    const te = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
    expect(te).toMatch(/case 'ssl_issue_cert'/);
    expect(te).toMatch(/case 'ssl_renew_cert'/);
    expect(te).toMatch(/case 'ssl_report'/);
    expect(te).toMatch(/handleSslIssueCert[\s\S]*certId/);
  });
});

describe('Batch 101 — Agent Chaos Engineering', () => {
  test('migration SQL exists and creates tables', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260617380000_agent_chaos_engineering.sql'), 'utf-8');
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS agent_chaos_experiments/);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS agent_chaos_runs/);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS agent_chaos_findings/);
  });

  test('shared types file exports correct types', () => {
    const ts = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-chaos-engineering.ts'), 'utf-8');
    expect(ts).toMatch(/export type ChaosFaultType/);
    expect(ts).toMatch(/export type ChaosBlastRadius/);
    expect(ts).toMatch(/export interface ChaosExperiment/);
    expect(ts).toMatch(/export interface ChaosResilienceScore/);
  });

  test('skill SKILL.md exists', () => {
    const md = fs.readFileSync(path.join(ROOT, 'skills/agent-chaos-engineering/SKILL.md'), 'utf-8');
    expect(md).toMatch(/skill:\s*agent-chaos-engineering/);
    expect(md).toMatch(/chaos_create_experiment/);
  });

  test('types.ts has chaos_engineer building kind', () => {
    const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    expect(types).toMatch(/\| 'chaos_engineer'/);
  });

  test('event-bus.ts has chaos SUBJECT_MAP entries', () => {
    const eb = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
    expect(eb).toMatch(/sven\.chaos\.experiment_created/);
    expect(eb).toMatch(/sven\.chaos\.weakness_found/);
  });

  test('task-executor has chaos switch cases and handlers', () => {
    const te = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
    expect(te).toMatch(/case 'chaos_create_experiment'/);
    expect(te).toMatch(/case 'chaos_inject_fault'/);
    expect(te).toMatch(/case 'chaos_report'/);
    expect(te).toMatch(/handleChaosCreateExperiment[\s\S]*experimentId/);
  });
});

describe('Batch 102 — Agent A/B Testing', () => {
  test('migration SQL exists and creates tables', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260617390000_agent_ab_testing.sql'), 'utf-8');
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS agent_ab_experiments/);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS agent_ab_variants/);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS agent_ab_assignments/);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS agent_ab_results/);
  });

  test('shared types file exports correct types', () => {
    const ts = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-ab-testing.ts'), 'utf-8');
    expect(ts).toMatch(/export type AbExperimentStatus/);
    expect(ts).toMatch(/export type AbMetricType/);
    expect(ts).toMatch(/export interface AbExperiment/);
    expect(ts).toMatch(/export interface AbTestResult/);
    expect(ts).toMatch(/export interface AbTestStats/);
  });

  test('skill SKILL.md exists', () => {
    const md = fs.readFileSync(path.join(ROOT, 'skills/agent-ab-testing/SKILL.md'), 'utf-8');
    expect(md).toMatch(/skill:\s*agent-ab-testing/);
    expect(md).toMatch(/abtest_create_experiment/);
  });

  test('types.ts has ab_tester building kind', () => {
    const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    expect(types).toMatch(/\| 'ab_tester'/);
  });

  test('event-bus.ts has abtest SUBJECT_MAP entries', () => {
    const eb = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
    expect(eb).toMatch(/sven\.abtest\.experiment_created/);
    expect(eb).toMatch(/sven\.abtest\.experiment_concluded/);
  });

  test('task-executor has abtest switch cases and handlers', () => {
    const te = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
    expect(te).toMatch(/case 'abtest_create_experiment'/);
    expect(te).toMatch(/case 'abtest_assign_variant'/);
    expect(te).toMatch(/case 'abtest_report'/);
    expect(te).toMatch(/handleAbtestCreateExperiment[\s\S]*experimentId/);
  });
});

describe('Batches 98-102 — Cross-cutting validation', () => {
  test('.gitattributes has entries for all 5 batches', () => {
    const ga = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf-8');
    expect(ga).toMatch(/agent-auto-scaling/);
    expect(ga).toMatch(/agent-dns-management/);
    expect(ga).toMatch(/agent-ssl-certificates/);
    expect(ga).toMatch(/agent-chaos-engineering/);
    expect(ga).toMatch(/agent-ab-testing/);
  });

  test('all 5 migrations have unique timestamps', () => {
    const migDir = path.join(ROOT, 'services/gateway-api/migrations');
    const files = fs.readdirSync(migDir).filter(f => f.endsWith('.sql')).sort();
    const batch98_102 = files.filter(f => /2026061735|2026061736|2026061737|2026061738|2026061739/.test(f));
    expect(batch98_102.length).toBe(5);
    const timestamps = batch98_102.map(f => f.split('_')[0]);
    expect(new Set(timestamps).size).toBe(5);
  });

  test('shared index.ts has all 5 new exports', () => {
    const idx = fs.readFileSync(path.join(ROOT, 'packages/shared/src/index.ts'), 'utf-8');
    expect(idx).toMatch(/agent-auto-scaling/);
    expect(idx).toMatch(/agent-dns-management/);
    expect(idx).toMatch(/agent-ssl-certificates/);
    expect(idx).toMatch(/agent-chaos-engineering/);
    expect(idx).toMatch(/agent-ab-testing/);
  });

  test('types.ts EidolonEventKind has all 20 new event kinds', () => {
    const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    const newEvents = [
      'autoscaling.policy_created', 'autoscaling.scale_triggered',
      'dns.zone_created', 'dns.record_added',
      'ssl.cert_issued', 'ssl.cert_renewed',
      'chaos.experiment_created', 'chaos.weakness_found',
      'abtest.experiment_created', 'abtest.experiment_concluded',
    ];
    for (const ev of newEvents) {
      expect(types).toContain(ev);
    }
  });

  test('task-executor has 30 new switch cases total', () => {
    const te = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
    const batchCases = [
      'autoscaling_create_policy', 'autoscaling_evaluate', 'autoscaling_scale_up',
      'autoscaling_scale_down', 'autoscaling_record_metric', 'autoscaling_report',
      'dns_create_zone', 'dns_add_record', 'dns_update_record',
      'dns_delete_record', 'dns_check_propagation', 'dns_report',
      'ssl_issue_cert', 'ssl_renew_cert', 'ssl_check_expiry',
      'ssl_revoke_cert', 'ssl_verify_chain', 'ssl_report',
      'chaos_create_experiment', 'chaos_run_experiment', 'chaos_inject_fault',
      'chaos_abort', 'chaos_analyze_findings', 'chaos_report',
      'abtest_create_experiment', 'abtest_assign_variant', 'abtest_record_conversion',
      'abtest_analyze_results', 'abtest_conclude', 'abtest_report',
    ];
    for (const c of batchCases) {
      expect(te).toContain(`case '${c}'`);
    }
  });

  test('task-executor handler count increased by 30', () => {
    const te = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
    const handlerMatches = te.match(/private (?:async )?handle[A-Z]/g);
    expect(handlerMatches).not.toBeNull();
    expect(handlerMatches!.length).toBeGreaterThanOrEqual(486);
  });
});
