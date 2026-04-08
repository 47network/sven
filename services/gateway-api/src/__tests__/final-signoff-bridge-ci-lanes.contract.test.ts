import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from '@jest/globals';

const FINAL_SIGNOFF_CHECK = path.resolve(__dirname, '../../../../scripts/final-signoff-check.cjs');

describe('final signoff bridge ci lanes contract', () => {
  it('requires bridge runtime and gateway bridge contract latest-run checks from ci-required artifacts', async () => {
    const source = await fs.readFile(FINAL_SIGNOFF_CHECK, 'utf8');

    expect(source).toContain("latest_run_success:bridge-runtime-tests");
    expect(source).toContain("latest_run_success:gateway-bridge-contract-tests");
    expect(source).toContain('ci_required_checks_bridge_runtime_latest_run_success');
    expect(source).toContain('ci_required_checks_gateway_bridge_contract_latest_run_success');
  });

  it('uses local ci-required artifacts and local diagnostic scope for final-signoff local mode', async () => {
    const source = await fs.readFile(FINAL_SIGNOFF_CHECK, 'utf8');

    expect(source).toContain("localOnly ? 'ci-required-checks-local-only.json' : 'ci-required-checks-latest.json'");
    expect(source).toContain('skipped in local-only mode');
    expect(source).toContain('local_diagnostic');
    expect(source).toContain('ci_required_checks_execution_authoritative');
    expect(source).toContain('ci_required_checks_not_local_only_evidence');
    expect(source).toContain('ci_required_checks_target_sha_matches_source');
  });
});
