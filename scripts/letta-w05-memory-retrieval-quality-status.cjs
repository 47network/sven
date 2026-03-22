#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const strict = process.argv.includes('--strict');
const outDir = path.join(root, 'docs', 'release', 'status');

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

function run() {
  const memoryStore = read('services/gateway-api/src/services/MemoryStore.ts');
  const memoryRoute = read('services/gateway-api/src/routes/admin/memory.ts');
  const matrixSource = read('docs/parity/wave6-letta-workflow-matrix-2026-03-16.md');
  const contractSource = read(
    'services/gateway-api/src/__tests__/letta-parity-w05-memory-retrieval-quality-contract.test.ts',
  );

  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });

  add(
    'letta_w05_temporal_decay_algorithm_present',
    memoryStore.includes('export function applyTemporalDecay(') &&
      memoryStore.includes("curve: 'linear' | 'exponential' | 'step'") &&
      memoryStore.includes("if (curve === 'linear')") &&
      memoryStore.includes("if (curve === 'step')") &&
      memoryStore.includes('return score * Math.pow(decayFactor, daysSinceCreation);'),
    'temporal decay scoring supports linear/step/exponential curves with bounded factor application',
  );

  add(
    'letta_w05_mmr_reranking_present',
    memoryStore.includes('export function applyMMR(candidates: Array<any>, lambda: number, topK: number): any[]') &&
      memoryStore.includes('const mmrScore = lambda * candidate.score - (1 - lambda) * maxSimToSelected;') &&
      memoryStore.includes('results = applyMMR(results, mmrLambda, topK);'),
    'MMR reranking is implemented and applied for retrieval diversification',
  );

  add(
    'letta_w05_bounded_quality_tuning_present',
    memoryStore.includes('const decayFactor = Math.max(0.5, Math.min(1.0, Number(input.decay_factor || 0.98)));') &&
      memoryStore.includes('const decayStepDays = Math.max(1, Math.floor(Number(input.decay_step_days || 7)));') &&
      memoryStore.includes('const mmrLambda = Math.max(0, Math.min(1.0, Number(input.mmr_lambda || 0.7)));') &&
      memoryStore.includes('const fetchK = useMmr ? Math.min(topK * 3, 100) : topK;'),
    'retrieval quality knobs are bounded to fail-safe ranges before ranking execution',
  );

  add(
    'letta_w05_admin_route_quality_setting_wiring_present',
    memoryRoute.includes('app.post(\'/memories/search\', async (request, reply) => {') &&
      memoryRoute.includes("parseBool(await loadSetting(pool, orgId, 'memory.temporalDecay.enabled'), true)") &&
      memoryRoute.includes("parseNumber(await loadSetting(pool, orgId, 'memory.temporalDecay.factor'), 0.98)") &&
      memoryRoute.includes("parseDecayCurve(await loadSetting(pool, orgId, 'memory.temporalDecay.curve'))") &&
      memoryRoute.includes("parseBool(await loadSetting(pool, orgId, 'memory.mmr.enabled'), true)") &&
      memoryRoute.includes("parseNumber(await loadSetting(pool, orgId, 'memory.mmr.lambda'), 0.7)"),
    'admin memory search route wires org/global quality settings into retrieval execution',
  );

  add(
    'letta_w05_matrix_and_contract_binding_present',
    matrixSource.includes('| LT-W05 | Memory retrieval quality controls (overlap, decay, relevance tuning) | implemented |') &&
      matrixSource.includes('letta_parity_w05_memory_retrieval_quality_contract') &&
      matrixSource.includes('letta-w05-memory-retrieval-quality-latest') &&
      contractSource.includes('Letta W05 memory retrieval quality parity contract') &&
      contractSource.includes("'letta_w05_temporal_decay_algorithm_present'"),
    'Wave 6 matrix and contract test bind LT-W05 to strict retrieval-quality artifact lane',
  );

  const passed = checks.filter((check) => check.pass).length;
  const failed = checks.length - passed;
  const status = failed === 0 ? 'pass' : 'fail';
  const generatedAt = new Date().toISOString();

  const report = {
    generated_at: generatedAt,
    status,
    passed,
    failed,
    checks,
  };

  fs.mkdirSync(outDir, { recursive: true });
  const outJson = path.join(outDir, 'letta-w05-memory-retrieval-quality-latest.json');
  const outMd = path.join(outDir, 'letta-w05-memory-retrieval-quality-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# Letta W05 Memory Retrieval Quality Status',
      '',
      `Generated: ${generatedAt}`,
      `Status: ${status}`,
      `Passed: ${passed}`,
      `Failed: ${failed}`,
      '',
      '## Checks',
      ...checks.map((check) => `- [${check.pass ? 'x' : ' '}] ${check.id}: ${check.detail}`),
      '',
    ].join('\n'),
    'utf8',
  );

  console.log(JSON.stringify(report, null, 2));
  if (strict && status !== 'pass') process.exit(2);
}

run();
