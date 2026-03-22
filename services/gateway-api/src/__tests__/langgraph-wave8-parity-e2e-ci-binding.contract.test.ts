import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(process.cwd(), '..', '..');
const PARITY_WORKFLOW = path.join(ROOT, '.github', 'workflows', 'parity-e2e.yml');

describe('LangGraph Wave 8 parity-e2e CI binding contract', () => {
  it('executes Wave 8 status lanes and closeout as a parity-e2e hard gate', async () => {
    const workflow = await fs.readFile(PARITY_WORKFLOW, 'utf8');

    expect(workflow.includes('- name: LangGraph Wave 8 parity gates')).toBe(true);
    expect(workflow.includes('id: langgraph_wave8')).toBe(true);
    expect(workflow.includes('npm run -s release:langgraph:w01:status')).toBe(true);
    expect(workflow.includes('npm run -s release:langgraph:w10:status')).toBe(true);
    expect(workflow.includes('npm run -s release:langgraph:wave8:rollup')).toBe(true);
    expect(workflow.includes('npm run -s release:langgraph:wave8:closeout')).toBe(true);
  });

  it('binds wave8 outcome into parity summary pass criteria and check set', async () => {
    const workflow = await fs.readFile(PARITY_WORKFLOW, 'utf8');

    expect(/steps\.langgraph_wave8\.outcome/.test(workflow)).toBe(true);
    expect(/steps\.parity_contracts\.outcome/.test(workflow)).toBe(true);
    expect(/const\s+langgraphOutcome\s*=/.test(workflow)).toBe(true);
    expect(/const\s+parityContractsOutcome\s*=/.test(workflow)).toBe(true);
    expect(/id:\s*'langgraph_wave8'/.test(workflow)).toBe(true);
    expect(/id:\s*'parity_contracts'/.test(workflow)).toBe(true);
    expect(/outcome:\s*langgraphOutcome/.test(workflow)).toBe(true);
    expect(/outcome:\s*parityContractsOutcome/.test(workflow)).toBe(true);
  });

  it('uploads Wave 8 lane + rollup + closeout artifacts in parity-e2e provenance bundle', async () => {
    const workflow = await fs.readFile(PARITY_WORKFLOW, 'utf8');

    expect(workflow.includes('docs/release/status/langgraph-w01-stateful-graph-orchestration-latest.json')).toBe(true);
    expect(workflow.includes('docs/release/status/langgraph-w10-graph-packaging-latest.json')).toBe(true);
    expect(workflow.includes('docs/release/status/langgraph-wave8-rollup-latest.json')).toBe(true);
    expect(workflow.includes('docs/release/status/langgraph-wave8-rollup-latest.md')).toBe(true);
    expect(workflow.includes('docs/release/status/langgraph-wave8-closeout-latest.json')).toBe(true);
    expect(workflow.includes('docs/release/status/langgraph-wave8-closeout-latest.md')).toBe(true);
    expect(workflow.includes('docs/release/status/competitor-executable-smoke-latest.json')).toBe(true);
    expect(workflow.includes('docs/release/status/competitor-executable-smoke-latest.md')).toBe(true);
  });
});
