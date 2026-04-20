import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 268-272 — Network Diagnostics', () => {
  const verticals = [
    { name: 'packet_sniffer', typefile: 'agent-packet-sniffer', migration: '20260619050000_agent_packet_sniffer.sql', skill: 'packet-sniffer', tables: ['agent_sniffer_configs','agent_sniffer_captures','agent_sniffer_dissections'] },
    { name: 'bandwidth_monitor', typefile: 'agent-bandwidth-monitor', migration: '20260619060000_agent_bandwidth_monitor.sql', skill: 'bandwidth-monitor', tables: ['agent_bw_configs','agent_bw_samples','agent_bw_alerts'] },
    { name: 'latency_probe', typefile: 'agent-latency-probe', migration: '20260619070000_agent_latency_probe.sql', skill: 'latency-probe', tables: ['agent_latency_configs','agent_latency_results','agent_latency_baselines'] },
    { name: 'jitter_analyzer', typefile: 'agent-jitter-analyzer', migration: '20260619080000_agent_jitter_analyzer.sql', skill: 'jitter-analyzer', tables: ['agent_jitter_configs','agent_jitter_samples','agent_jitter_reports'] },
    { name: 'packet_loss_tracker', typefile: 'agent-packet-loss-tracker', migration: '20260619090000_agent_packet_loss_tracker.sql', skill: 'packet-loss-tracker', tables: ['agent_ploss_configs','agent_ploss_results','agent_ploss_trends'] },
  ];

  describe('Migration SQL files', () => {
    verticals.forEach(v => {
      it(`${v.migration} exists and creates tables`, () => {
        const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations', v.migration), 'utf-8');
        v.tables.forEach(t => expect(sql).toContain(`CREATE TABLE IF NOT EXISTS ${t}`));
      });
    });
  });

  describe('Shared TypeScript types', () => {
    verticals.forEach(v => {
      it(`${v.typefile}.ts exists with exports`, () => {
        const ts = fs.readFileSync(path.join(ROOT, 'packages/shared/src', `${v.typefile}.ts`), 'utf-8');
        expect(ts).toContain('export');
      });
    });
  });

  describe('Barrel exports', () => {
    const idx = fs.readFileSync(path.join(ROOT, 'packages/shared/src/index.ts'), 'utf-8');
    verticals.forEach(v => {
      it(`index.ts exports ${v.typefile}`, () => {
        expect(idx).toContain(v.typefile);
      });
    });
  });

  describe('SKILL.md files', () => {
    verticals.forEach(v => {
      it(`${v.skill}/SKILL.md exists with Actions`, () => {
        const md = fs.readFileSync(path.join(ROOT, 'skills/autonomous-economy', v.skill, 'SKILL.md'), 'utf-8');
        expect(md).toContain('## Actions');
        expect(md).toContain('price');
      });
    });
  });

  describe('Eidolon types.ts', () => {
    const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    const bks = ['packet_sniffer','bandwidth_monitor','latency_probe','jitter_analyzer','packet_loss_tracker'];
    bks.forEach(bk => {
      it(`BK contains '${bk}'`, () => { expect(types).toContain(`'${bk}'`); });
    });
    const eks = ['sniff.capture_started','bw.sample_collected','lat.probe_completed','jit.sample_collected','ploss.probe_completed'];
    eks.forEach(ek => {
      it(`EK contains '${ek}'`, () => { expect(types).toContain(`'${ek}'`); });
    });
    it('districtFor handles packet_sniffer', () => { expect(types).toContain("case 'packet_sniffer':"); });
  });

  describe('Event bus SUBJECT_MAP', () => {
    const eb = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
    const subjects = ['sven.sniff.capture_started','sven.bw.sample_collected','sven.lat.probe_completed','sven.jit.sample_collected','sven.ploss.probe_completed'];
    subjects.forEach(s => {
      it(`SUBJECT_MAP has '${s}'`, () => { expect(eb).toContain(`'${s}'`); });
    });
  });

  describe('Task executor', () => {
    const te = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
    const cases = ['sniff_configure','sniff_start_capture','bw_configure','bw_start_monitoring','lat_configure','lat_start_probing','jit_configure','jit_start_analysis','ploss_configure','ploss_start_tracking'];
    cases.forEach(c => {
      it(`routes '${c}'`, () => { expect(te).toContain(`case '${c}'`); });
    });
    const handlers = ['handleSniffConfigure','handleBwConfigure','handleLatConfigure','handleJitConfigure','handlePlossConfigure'];
    handlers.forEach(h => {
      it(`has handler ${h}`, () => { expect(te).toContain(h); });
    });
  });

  describe('.gitattributes', () => {
    const ga = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf-8');
    verticals.forEach(v => {
      it(`filters ${v.typefile}`, () => { expect(ga).toContain(v.typefile); });
    });
  });
});
