import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from '@jest/globals';

const ROOT_PACKAGE_JSON = path.resolve(__dirname, '../../../../package.json');
const RUNBOOK = path.resolve(__dirname, '../../../../deploy/multi-vm/RUNBOOK.md');
const RESTART_HEALTH_CHECK = path.resolve(__dirname, '../../../../scripts/multi-vm-restart-health-check.cjs');
const VM_RESTART_DRILL = path.resolve(__dirname, '../../../../scripts/ops/release/vm-restart-drill.cjs');
const VM_RESTART_DRILL_EVIDENCE_CHECK = path.resolve(__dirname, '../../../../scripts/vm-restart-drill-evidence-check.cjs');

describe('vm restart drill contract', () => {
  it('exposes npm scripts for restart health and VM restart drill checks', async () => {
    const source = await fs.readFile(ROOT_PACKAGE_JSON, 'utf8');
    const pkg = JSON.parse(source);
    const scripts = (pkg && typeof pkg === 'object' && pkg.scripts && typeof pkg.scripts === 'object') ? pkg.scripts : {};

    expect(scripts['release:multi-vm:restart:health:check']).toBe('node scripts/multi-vm-restart-health-check.cjs --strict');
    expect(scripts['ops:release:vm-restart-drill']).toBe('node scripts/ops/release/vm-restart-drill.cjs');
    expect(scripts['ops:release:vm-restart-drill:strict']).toBe('node scripts/ops/release/vm-restart-drill.cjs --strict');
    expect(scripts['ops:release:vm-restart-drill:execute']).toBe('node scripts/ops/release/vm-restart-drill.cjs --strict --execute');
    expect(scripts['release:vm-restart:drill:evidence:check']).toBe('node scripts/vm-restart-drill-evidence-check.cjs --strict');
  });

  it('keeps restart health checker pinned to VM5 and VM7 compose coverage', async () => {
    const source = await fs.readFile(RESTART_HEALTH_CHECK, 'utf8');

    expect(source).toContain('deploy/multi-vm/docker-compose.vm5-ai.yml');
    expect(source).toContain('deploy/multi-vm/docker-compose.vm7-adapters.yml');
    expect(source).toContain('vm5_restart_services_have_healthchecks');
    expect(source).toContain('vm7_restart_services_have_healthchecks');
    expect(source).toContain('runbook_documents_waited_restart_sequence');
    expect(source).toContain('multi-vm-restart-health-latest.json');
  });

  it('keeps VM restart drill script pinned to waited docker compose commands and evidence outputs', async () => {
    const source = await fs.readFile(VM_RESTART_DRILL, 'utf8');

    expect(source).toContain('docker-compose.vm5-ai.yml');
    expect(source).toContain('docker-compose.vm7-adapters.yml');
    expect(source).toContain('up -d --wait');
    expect(source).toContain('release:multi-vm:restart:health:check');
    expect(source).toContain('vm-restart-drill-latest.json');
    expect(source).toContain('vm-restart-drill-latest.md');
    expect(source).toContain("const outEvidenceDir = path.join(root, 'docs', 'release', 'evidence');");
  });

  it('keeps VM restart drill evidence checker pinned to latest evidence and freshness validation', async () => {
    const source = await fs.readFile(VM_RESTART_DRILL_EVIDENCE_CHECK, 'utf8');

    expect(source).toContain('docs/release/evidence/vm-restart-drill-latest.json');
    expect(source).toContain('vm_restart_drill_vm5_waited_command_present');
    expect(source).toContain('vm_restart_drill_vm7_waited_command_present');
    expect(source).toContain('vm_restart_drill_repo_contract_present');
    expect(source).toContain('vm-restart-drill-evidence-latest.json');
    expect(source).toContain('168');
  });

  it('documents planned and executable VM restart drill commands in the multi-vm runbook', async () => {
    const source = await fs.readFile(RUNBOOK, 'utf8');

    expect(source).toContain('release:multi-vm:restart:health:check');
    expect(source).toContain('ops:release:vm-restart-drill:strict');
    expect(source).toContain('ops:release:vm-restart-drill:execute');
    expect(source).toContain('release:vm-restart:drill:evidence:check');
    expect(source).toContain('docker-compose.vm5-ai.yml');
    expect(source).toContain('docker-compose.vm7-adapters.yml');
    expect(source).toContain('up -d --wait');
  });
});
