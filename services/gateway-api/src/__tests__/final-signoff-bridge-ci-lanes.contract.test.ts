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
});
