import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(process.cwd(), '..', '..');
const SCRIPT = path.join(ROOT, 'scripts', 'parity-all-waves-closeout-status.cjs');
const PARITY_WORKFLOW = path.join(ROOT, '.github', 'workflows', 'parity-e2e.yml');

describe('Parity all-waves closeout contract', () => {
  it('includes wave8 closeout artifact in unified parity closeout script', async () => {
    const script = await fs.readFile(SCRIPT, 'utf8');

    expect(script.includes("id: 'wave8'")).toBe(true);
    expect(script.includes('langgraph-wave8-closeout-latest.json')).toBe(true);
    expect(script.includes('parity-all-waves-closeout-latest.json')).toBe(true);
  });

  it('keeps parity-e2e workflow binding to unified all-waves closeout artifact upload', async () => {
    const workflow = await fs.readFile(PARITY_WORKFLOW, 'utf8');

    expect(workflow.includes('npm run -s release:parity:all-waves:closeout')).toBe(true);
    expect(workflow.includes('docs/release/status/parity-all-waves-closeout-latest.json')).toBe(true);
    expect(workflow.includes('docs/release/status/parity-all-waves-closeout-latest.md')).toBe(true);
  });
});

