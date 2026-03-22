# Competitor Executable Smoke

Generated: 2026-03-21T00:35:21.717Z
Status: fail

## Summary
- total commands: 2
- passed: 1
- failed: 1

## Commands
- [x] shared_build: npm run --workspace packages/shared build
- [ ] gateway_parity_contracts: npm run --workspace services/gateway-api test -- --runTestsByPath src/__tests__/parity-integration-runtime-truthfulness-2026-03-12.contract.test.ts src/__tests__/parity-integration-skills-truthfulness-2026-03-12.contract.test.ts src/__tests__/langgraph-wave8-parity-e2e-ci-binding.contract.test.ts src/__tests__/parity-all-waves-closeout-contract.test.ts src/__tests__/parity-checklist-verify-wave-closeout.contract.test.ts

## Failure Excerpts
- gateway_parity_contracts (exit=1)
  - 
  -       16 |
  -       17 |   it('keeps parity-e2e workflow binding to unified all-waves closeout artifact upload', async () => {
  -     > 18 |     const workflow = await fs.readFile(PARITY_WORKFLOW, 'utf8');
  -          |                      ^
  -       19 |
  -       20 |     expect(workflow.includes('npm run -s release:parity:all-waves:closeout')).toBe(true);
  -       21 |     expect(workflow.includes('docs/release/status/parity-all-waves-closeout-latest.json')).toBe(true);
  - 
  -       at Object.<anonymous> (src/__tests__/parity-all-waves-closeout-contract.test.ts:18:22)
  - 
  - PASS src/__tests__/parity-integration-skills-truthfulness-2026-03-12.contract.test.ts (13.245 s)
  - FAIL src/__tests__/langgraph-wave8-parity-e2e-ci-binding.contract.test.ts (13.439 s)
  -   ● LangGraph Wave 8 parity-e2e CI binding contract › executes Wave 8 status lanes and closeout as a parity-e2e hard gate
  - 
  -     ENOENT: no such file or directory, open '/media/hantz/47Network_Main/47Network/47Network_Future/TheSven/thesven_v0.1.0/.github/workflows/parity-e2e.yml'
  - 
  -        7 | describe('LangGraph Wave 8 parity-e2e CI binding contract', () => {
  -        8 |   it('executes Wave 8 status lanes and closeout as a parity-e2e hard gate', async () => {
  -     >  9 |     const workflow = await fs.readFile(PARITY_WORKFLOW, 'utf8');
  -          |                      ^
  -       10 |
  -       11 |     expect(workflow.includes('- name: LangGraph Wave 8 parity gates')).toBe(true);
  -       12 |     expect(workflow.includes('id: langgraph_wave8')).toBe(true);
  - 
  -       at Object.<anonymous> (src/__tests__/langgraph-wave8-parity-e2e-ci-binding.contract.test.ts:9:22)
  - 
  -   ● LangGraph Wave 8 parity-e2e CI binding contract › binds wave8 outcome into parity summary pass criteria and check set
  - 
  -     ENOENT: no such file or directory, open '/media/hantz/47Network_Main/47Network/47Network_Future/TheSven/thesven_v0.1.0/.github/workflows/parity-e2e.yml'
  - 
  -       18 |
  -       19 |   it('binds wave8 outcome into parity summary pass criteria and check set', async () => {
  -     > 20 |     const workflow = await fs.readFile(PARITY_WORKFLOW, 'utf8');
  -          |                      ^
  -       21 |
  -       22 |     expect(/steps\.langgraph_wave8\.outcome/.test(workflow)).toBe(true);
  -       23 |     expect(/steps\.parity_contracts\.outcome/.test(workflow)).toBe(true);
  - 
  -       at Object.<anonymous> (src/__tests__/langgraph-wave8-parity-e2e-ci-binding.contract.test.ts:20:22)
  - 
  -   ● LangGraph Wave 8 parity-e2e CI binding contract › uploads Wave 8 lane + rollup + closeout artifacts in parity-e2e provenance bundle
  - 
  -     ENOENT: no such file or directory, open '/media/hantz/47Network_Main/47Network/47Network_Future/TheSven/thesven_v0.1.0/.github/workflows/parity-e2e.yml'
  - 
  -       31 |
  -       32 |   it('uploads Wave 8 lane + rollup + closeout artifacts in parity-e2e provenance bundle', async () => {
  -     > 33 |     const workflow = await fs.readFile(PARITY_WORKFLOW, 'utf8');
  -          |                      ^
  -       34 |
  -       35 |     expect(workflow.includes('docs/release/status/langgraph-w01-stateful-graph-orchestration-latest.json')).toBe(true);
  -       36 |     expect(workflow.includes('docs/release/status/langgraph-w10-graph-packaging-latest.json')).toBe(true);
  - 
  -       at Object.<anonymous> (src/__tests__/langgraph-wave8-parity-e2e-ci-binding.contract.test.ts:33:22)
  - 
  - Test Suites: 2 failed, 3 passed, 5 total
  - Tests:       4 failed, 5 passed, 9 total
  - Snapshots:   0 total
  - Time:        14.757 s
  - Ran all test suites within paths "src/__tests__/parity-integration-runtime-truthfulness-2026-03-12.contract.test.ts", "src/__tests__/parity-integration-skills-truthfulness-2026-03-12.contract.test.ts", "src/__tests__/langgraph-wave8-parity-e2e-ci-binding.contract.test.ts", "src/__tests__/parity-all-waves-closeout-contract.test.ts", "src/__tests__/parity-checklist-verify-wave-closeout.contract.test.ts".

