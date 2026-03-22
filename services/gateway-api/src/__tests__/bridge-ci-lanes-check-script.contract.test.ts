import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from '@jest/globals';

const ROOT_PACKAGE_JSON = path.resolve(__dirname, '../../../../package.json');
const BRIDGE_CI_CHECK_SCRIPT = path.resolve(__dirname, '../../../../scripts/ops/release/bridge-ci-lanes-check.cjs');

describe('bridge ci lanes checker contract', () => {
  it('exposes npm scripts for bridge ci lanes go/no-go checking', async () => {
    const source = await fs.readFile(ROOT_PACKAGE_JSON, 'utf8');
    const pkg = JSON.parse(source);
    const scripts = (pkg && typeof pkg === 'object' && pkg.scripts && typeof pkg.scripts === 'object') ? pkg.scripts : {};

    expect(scripts['ops:release:bridge-ci-lanes:check']).toBe('node scripts/ops/release/bridge-ci-lanes-check.cjs');
    expect(scripts['ops:release:bridge-ci-lanes:check:strict']).toBe('node scripts/ops/release/bridge-ci-lanes-check.cjs --strict');
    expect(scripts['ops:release:bridge-ci-lanes:check:local']).toBe('node scripts/ops/release/bridge-ci-lanes-check.cjs --local-only');
    expect(scripts['ops:release:bridge-ci-lanes:check:local:strict']).toBe('node scripts/ops/release/bridge-ci-lanes-check.cjs --local-only --strict');
    expect(scripts['ops:release:bridge-ci-lanes:remote']).toBe('node scripts/ops/release/bridge-ci-lanes-remote-check.cjs');
    expect(scripts['ops:release:bridge-ci-lanes:remote:strict']).toBe('node scripts/ops/release/bridge-ci-lanes-remote-check.cjs --strict');
    expect(scripts['ops:release:bridge-vm-ci-lanes']).toBe('node scripts/ops/release/bridge-vm-ci-lanes.cjs');
    expect(scripts['ops:release:bridge-vm-ci-lanes:strict']).toBe('node scripts/ops/release/bridge-vm-ci-lanes.cjs --strict');
    expect(scripts['ops:release:bridge-vm-ci-lanes:strict:skip-remote']).toBe('node scripts/ops/release/bridge-vm-ci-lanes.cjs --strict --skip-remote');
    expect(scripts['ops:release:bridge-vm-ci-lanes:pr-comment']).toBe('node scripts/ops/release/bridge-vm-ci-lanes-pr-comment.cjs');
    expect(scripts['ops:release:bridge-vm-ci-lanes:pr-comment:dry']).toBe('node scripts/ops/release/bridge-vm-ci-lanes-pr-comment.cjs --dry-run');
    expect(scripts['ops:release:bridge-vm-ci-lanes:run-and-comment']).toBe('node scripts/ops/release/bridge-vm-ci-lanes-run-and-comment.cjs --strict --skip-remote');
    expect(scripts['ops:release:bridge-vm-ci-lanes:run-and-comment:dry']).toBe('node scripts/ops/release/bridge-vm-ci-lanes-run-and-comment.cjs --strict --skip-remote --dry-run');
  });

  it('checks required bridge workflow and signoff IDs', async () => {
    const source = await fs.readFile(BRIDGE_CI_CHECK_SCRIPT, 'utf8');

    expect(source).toContain('latest_run_success:bridge-runtime-tests');
    expect(source).toContain('latest_run_success:gateway-bridge-contract-tests');
    expect(source).toContain('ci_required_checks_bridge_runtime_latest_run_success');
    expect(source).toContain('ci_required_checks_gateway_bridge_contract_latest_run_success');
    expect(source).toContain('bridge_ci_lanes_remote_evidence_required');
    expect(source).toContain('--local-only');
    expect(source).toContain('ci-required-checks-local-only.json');
    expect(source).toContain('final-signoff-local-latest.json');
  });

  it('includes remote checker for direct github workflow evidence', async () => {
    const source = await fs.readFile(
      path.resolve(__dirname, '../../../../scripts/ops/release/bridge-ci-lanes-remote-check.cjs'),
      'utf8',
    );

    expect(source).toContain('bridge-runtime-tests');
    expect(source).toContain('gateway-bridge-contract-tests');
    expect(source).toContain('gh');
    expect(source).toContain('bridge-ci-lanes-remote-latest.json');
    expect(source).toContain('BRIDGE_CI_LANES_GH_REPO');
    expect(source).toContain('--repo');
  });

  it('includes vm authoritative checker for local release gates', async () => {
    const source = await fs.readFile(
      path.resolve(__dirname, '../../../../scripts/ops/release/bridge-vm-ci-lanes.cjs'),
      'utf8',
    );

    expect(source).toContain('release:ci:required:check:local');
    expect(source).toContain('release:final:signoff:check:local');
    expect(source).toContain('ops:release:bridge-ci-lanes:check:local:strict');
    expect(source).toContain('bridge-vm-ci-lanes-latest.json');
    expect(source).toContain('--skip-remote');
  });

  it('includes vm lane pr comment publisher', async () => {
    const source = await fs.readFile(
      path.resolve(__dirname, '../../../../scripts/ops/release/bridge-vm-ci-lanes-pr-comment.cjs'),
      'utf8',
    );

    expect(source).toContain('bridge-vm-ci-lanes-latest.json');
    expect(source).toContain('bridge-ci-lanes-remote-latest.json');
    expect(source).toContain('gh');
    expect(source).toContain('pr comment');
  });

  it('includes vm lane run-and-comment wrapper', async () => {
    const source = await fs.readFile(
      path.resolve(__dirname, '../../../../scripts/ops/release/bridge-vm-ci-lanes-run-and-comment.cjs'),
      'utf8',
    );

    expect(source).toContain('ops:release:bridge-vm-ci-lanes');
    expect(source).toContain('ops:release:bridge-vm-ci-lanes:pr-comment');
    expect(source).toContain('--skip-remote');
    expect(source).toContain('--dry-run');
  });
});
