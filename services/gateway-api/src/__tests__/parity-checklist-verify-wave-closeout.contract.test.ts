import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(process.cwd(), '..', '..');
const VERIFY_SCRIPT = path.join(ROOT, 'scripts', 'release-parity-checklist-verify.cjs');

describe('Parity checklist verify wave closeout contract', () => {
  it('requires wave8 closeout in parity wave closeout status artifacts', async () => {
    const script = await fs.readFile(VERIFY_SCRIPT, 'utf8');

    expect(script.includes('const parityWaveCloseoutStatusArtifacts = [')).toBe(true);
    expect(script.includes('docs/release/status/langgraph-wave8-closeout-latest.json')).toBe(true);
    expect(script.includes('docs/release/status/parity-all-waves-closeout-latest.json')).toBe(true);
  });

  it('enforces lifecycle release gates through checklist verification', async () => {
    const script = await fs.readFile(VERIFY_SCRIPT, 'utf8');

    expect(script.includes("const lifecycleGateKeys = ['soak_72h', 'week4_rc_complete', 'post_release_verified'];")).toBe(true);
    expect(script.includes("id: 'parity_release_lifecycle_gates_pass'")).toBe(true);
  });
});

