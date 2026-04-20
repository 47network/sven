/**
 * Batch 34 — MicroGPT Fine-Tuning Pipeline
 *
 * Validates migration, shared types, task executor handlers,
 * Eidolon building/event kinds, SUBJECT_MAP, and skill files.
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

function read(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf-8');
}

// ── Migration ──────────────────────────────────────────────────
describe('Batch 34 — Migration (micro_training)', () => {
  const sql = read('services/gateway-api/migrations/20260508120000_micro_training.sql');

  it('creates training_jobs table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS training_jobs');
  });

  it('has status CHECK with 8 values', () => {
    expect(sql).toContain("status IN ('pending','preparing','training','evaluating','exporting','completed','failed','cancelled')");
  });

  it('has adapter_type CHECK', () => {
    expect(sql).toContain("adapter_type IN ('lora','qlora','full')");
  });

  it('has recipe CHECK with 5 domains', () => {
    expect(sql).toContain("recipe IN ('writing_style','codebase_conventions','domain_vocabulary','task_specific','custom')");
  });

  it('creates training_datasets table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS training_datasets');
  });

  it('has data_format CHECK with 4 values', () => {
    expect(sql).toContain("data_format IN ('conversation','instruction','completion','preference')");
  });

  it('creates training_recipes table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS training_recipes');
  });

  it('ALTERs marketplace_tasks to add training types', () => {
    expect(sql).toContain('training_create');
    expect(sql).toContain('training_monitor');
    expect(sql).toContain('training_export');
  });

  it('creates indexes', () => {
    expect(sql).toContain('idx_training_jobs_org');
    expect(sql).toContain('idx_training_jobs_status');
    expect(sql).toContain('idx_training_datasets_org');
  });

  it('inserts settings_global defaults', () => {
    expect(sql).toContain('training.max_concurrent_jobs');
    expect(sql).toContain('training.default_adapter');
  });
});

// ── Shared types ───────────────────────────────────────────────
describe('Batch 34 — Shared types (micro-training)', () => {
  const src = read('packages/shared/src/micro-training.ts');

  it('exports TrainingJobStatus with 8 values', () => {
    expect(src).toContain("export type TrainingJobStatus =");
    for (const v of ['pending', 'preparing', 'training', 'evaluating', 'exporting', 'completed', 'failed', 'cancelled']) {
      expect(src).toContain(`'${v}'`);
    }
  });

  it('exports TRAINING_JOB_STATUSES array', () => {
    expect(src).toContain('export const TRAINING_JOB_STATUSES: TrainingJobStatus[]');
  });

  it('exports AdapterType with 3 values', () => {
    expect(src).toContain("export type AdapterType = 'lora' | 'qlora' | 'full'");
  });

  it('exports RecipeDomain with 5 values', () => {
    expect(src).toContain("export type RecipeDomain =");
    for (const v of ['writing_style', 'codebase_conventions', 'domain_vocabulary', 'task_specific', 'custom']) {
      expect(src).toContain(`'${v}'`);
    }
  });

  it('exports TrainingDataFormat with 4 values', () => {
    expect(src).toContain("export type TrainingDataFormat =");
    for (const v of ['conversation', 'instruction', 'completion', 'preference']) {
      expect(src).toContain(`'${v}'`);
    }
  });

  it('exports LossFunction with 3 values', () => {
    expect(src).toContain("export type LossFunction = 'mse' | 'hinge' | 'bce'");
  });

  it('exports TrainingJobRecord interface', () => {
    expect(src).toContain('export interface TrainingJobRecord');
    expect(src).toContain('status: TrainingJobStatus');
    expect(src).toContain('baseModel: string');
    expect(src).toContain('adapterType: AdapterType');
    expect(src).toContain('metrics: TrainingMetric[]');
    expect(src).toContain('evaluation: TrainingEvaluation | null');
  });

  it('exports TrainingMetric interface', () => {
    expect(src).toContain('export interface TrainingMetric');
    expect(src).toContain('trainLoss: number');
    expect(src).toContain('evalLoss: number | null');
  });

  it('exports TrainingEvaluation interface', () => {
    expect(src).toContain('export interface TrainingEvaluation');
    expect(src).toContain('improvement: number');
    expect(src).toContain('perplexity: number');
  });

  it('exports TrainingDatasetRecord interface', () => {
    expect(src).toContain('export interface TrainingDatasetRecord');
    expect(src).toContain('dataFormat: TrainingDataFormat');
    expect(src).toContain('sampleCount: number');
  });

  it('exports TrainingRecipeRecord interface', () => {
    expect(src).toContain('export interface TrainingRecipeRecord');
    expect(src).toContain('domain: RecipeDomain');
  });

  it('exports MicrogradSessionRecord interface', () => {
    expect(src).toContain('export interface MicrogradSessionRecord');
    expect(src).toContain('walkthroughProgress: number');
  });

  it('exports DEFAULT_TRAINING_CONFIG with LoRA defaults', () => {
    expect(src).toContain('export const DEFAULT_TRAINING_CONFIG');
    expect(src).toContain('loraRank: 16');
    expect(src).toContain('loraAlpha: 32');
  });

  it('exports TRAINING_STATUS_ORDER', () => {
    expect(src).toContain('export const TRAINING_STATUS_ORDER');
  });

  it('exports MicrotisTerminalStatus function', () => {
    expect(src).toContain('export function MicrotisTerminalStatus');
  });

  it('exports computeProgress function', () => {
    expect(src).toContain('export function computeProgress');
  });

  it('exports canAdvanceTrainingStatus function', () => {
    expect(src).toContain('export function canAdvanceTrainingStatus');
  });

  it('exports estimateTrainingMinutes function', () => {
    expect(src).toContain('export function estimateTrainingMinutes');
  });

  it('exports isSignificantImprovement function', () => {
    expect(src).toContain('export function isSignificantImprovement');
  });
});

// ── Index re-export ────────────────────────────────────────────
describe('Batch 34 — Index re-export', () => {
  const idx = read('packages/shared/src/index.ts');

  it('re-exports micro-training module', () => {
    expect(idx).toContain("export * from './micro-training.js'");
  });
});

// ── Task executor ──────────────────────────────────────────────
describe('Batch 34 — Task executor handlers', () => {
  const src = read('services/sven-marketplace/src/task-executor.ts');

  it('routes training_create case', () => {
    expect(src).toContain("case 'training_create':");
    expect(src).toContain('this.handleTrainingCreate(input)');
  });

  it('routes training_monitor case', () => {
    expect(src).toContain("case 'training_monitor':");
    expect(src).toContain('this.handleTrainingMonitor(input)');
  });

  it('routes training_export case', () => {
    expect(src).toContain("case 'training_export':");
    expect(src).toContain('this.handleTrainingExport(input)');
  });

  it('handleTrainingCreate returns structured job output', () => {
    expect(src).toContain('private async handleTrainingCreate');
    expect(src).toContain("const baseModel = (input.baseModel as string) ?? 'Qwen2.5-4B'");
    expect(src).toContain("const adapterType = (input.adapterType as string) ?? 'lora'");
    expect(src).toContain("const recipe = (input.recipe as string) ?? 'task_specific'");
    expect(src).toContain('loraRank: 16');
    expect(src).toContain('loraAlpha: 32');
  });

  it('handleTrainingMonitor returns progress and loss', () => {
    expect(src).toContain('private async handleTrainingMonitor');
    expect(src).toContain('trainLoss:');
    expect(src).toContain('evalLoss:');
    expect(src).toContain('estimatedRemainingS:');
  });

  it('handleTrainingExport returns litellm registration', () => {
    expect(src).toContain('private async handleTrainingExport');
    expect(src).toContain('litellmModelName: modelName');
    expect(src).toContain('adapterPath');
    expect(src).toContain('routeAlias:');
  });

  it('has 43 total switch cases', () => {
    const caseCount = (src.match(/case '/g) || []).length;
    expect(caseCount).toBe(43);
  });
});

// ── Eidolon types ──────────────────────────────────────────────
describe('Batch 34 — Eidolon types', () => {
  const src = read('services/sven-eidolon/src/types.ts');

  it('includes training_lab building kind', () => {
    expect(src).toContain("| 'training_lab'");
  });

  it('has 19 building kinds (19 pipes)', () => {
    const buildingBlock = src.split('export type EidolonBuildingKind')[1]?.split(';')[0] ?? '';
    const pipeCount = (buildingBlock.match(/\|/g) || []).length;
    expect(pipeCount).toBe(19);
  });

  it('includes 4 training.* event kinds', () => {
    expect(src).toContain("| 'training.job_created'");
    expect(src).toContain("| 'training.epoch_completed'");
    expect(src).toContain("| 'training.job_finished'");
    expect(src).toContain("| 'training.export_registered'");
  });

  it('has 88 event kind pipes + heartbeat', () => {
    const eventBlock = src.split('export type EidolonEventKind')[1]?.split(';')[0] ?? '';
    const pipeCount = (eventBlock.match(/\|/g) || []).length;
    expect(pipeCount).toBe(88); // 88 pipes total (87 event kinds + heartbeat)
  });

  it('districtFor maps training_lab to infrastructure', () => {
    expect(src).toContain("case 'training_lab':");
    expect(src).toContain("return 'infrastructure'");
  });

  it('has 19 districtFor cases', () => {
    const districtBlock = src.split('function districtFor')[1] ?? '';
    const caseCount = (districtBlock.match(/case '/g) || []).length;
    expect(caseCount).toBe(19);
  });
});

// ── Event bus ──────────────────────────────────────────────────
describe('Batch 34 — Event bus SUBJECT_MAP', () => {
  const src = read('services/sven-eidolon/src/event-bus.ts');

  it('maps sven.training.job_created', () => {
    expect(src).toContain("'sven.training.job_created': 'training.job_created'");
  });

  it('maps sven.training.epoch_completed', () => {
    expect(src).toContain("'sven.training.epoch_completed': 'training.epoch_completed'");
  });

  it('maps sven.training.job_finished', () => {
    expect(src).toContain("'sven.training.job_finished': 'training.job_finished'");
  });

  it('maps sven.training.export_registered', () => {
    expect(src).toContain("'sven.training.export_registered': 'training.export_registered'");
  });
});

// ── Skill files ────────────────────────────────────────────────
describe('Batch 34 — model-trainer skill', () => {
  const md = read('skills/ai-agency/model-trainer/SKILL.md');
  const handler = read('skills/ai-agency/model-trainer/handler.ts');

  it('has SKILL.md with name model-trainer', () => {
    expect(md).toContain('name: model-trainer');
  });

  it('SKILL.md references LoRA/QLoRA', () => {
    expect(md).toContain('LoRA');
    expect(md).toContain('QLoRA');
  });

  it('SKILL.md defines create_job action', () => {
    expect(md).toContain('create_job');
  });

  it('handler.ts exists and exports handler logic', () => {
    expect(handler).toContain('create_job');
    expect(handler.length).toBeGreaterThan(100);
  });
});

describe('Batch 34 — micrograd skill', () => {
  const md = read('skills/ai-agency/micrograd/SKILL.md');
  const handler = read('skills/ai-agency/micrograd/handler.ts');

  it('has SKILL.md with name micrograd', () => {
    expect(md).toContain('name: micrograd');
  });

  it('SKILL.md references autograd/backpropagation', () => {
    expect(md).toContain('autograd');
    expect(md).toContain('backpropagation');
  });

  it('SKILL.md defines create_session action', () => {
    expect(md).toContain('create_session');
  });

  it('handler.ts has session management', () => {
    expect(handler).toContain('create_session');
    expect(handler).toContain('destroy_session');
  });

  it('handler.ts implements MLP training', () => {
    expect(handler).toContain('train_model');
  });
});
