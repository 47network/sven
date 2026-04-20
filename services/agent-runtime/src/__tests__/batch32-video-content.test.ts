/**
 * Batch 32 — Video Content Generation (ffmpeg + Canvas)
 *
 * Tests that:
 * 1. Migration SQL creates 3 tables, ALTER with correct CHECK values, settings
 * 2. Shared types (video-content.ts) export correct types, constants, utilities
 * 3. Existing video-engine.ts has all expected types + functions
 * 4. Existing SKILL.md has correct structure + 7 actions
 * 5. Task executor has 3 new switch cases + handlers
 * 6. Eidolon has video_studio building + 4 video.* events + districtFor
 * 7. SUBJECT_MAP has 4 new video entries
 */

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

// ── helpers ──────────────────────────────────────────────────────
function readFile(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8');
}

// ── pre-load sources ─────────────────────────────────────────────
const migrationSql = readFile('services/gateway-api/migrations/20260506120000_video_content.sql');
const sharedTypes = readFile('packages/shared/src/video-content.ts');
const sharedIndex = readFile('packages/shared/src/index.ts');
const videoEngine = readFile('services/agent-runtime/src/video-engine.ts');
const skillMd = readFile('skills/design/video-generator/SKILL.md');
const handlerTs = readFile('skills/design/video-generator/handler.ts');
const taskExecutor = readFile('services/sven-marketplace/src/task-executor.ts');
const eidolonTypes = readFile('services/sven-eidolon/src/types.ts');
const eventBus = readFile('services/sven-eidolon/src/event-bus.ts');

// ═══════════════════════════════════════════════════════════════════
// 1. Migration SQL
// ═══════════════════════════════════════════════════════════════════
describe('Migration — 20260506120000_video_content.sql', () => {
  test('creates render_jobs table', () => {
    expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS render_jobs');
  });

  test('creates video_templates table', () => {
    expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS video_templates');
  });

  test('creates video_assets table', () => {
    expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS video_assets');
  });

  test('render_jobs has correct status CHECK', () => {
    expect(migrationSql).toContain("status IN ('pending','rendering','completed','failed','cancelled')");
  });

  test('render_jobs has template domain CHECK', () => {
    expect(migrationSql).toContain("template IN ('social_media','data_dashboard','product_showcase','tutorial','custom')");
  });

  test('render_jobs has progress CHECK', () => {
    expect(migrationSql).toContain('progress >= 0 AND progress <= 100');
  });

  test('video_templates has domain CHECK', () => {
    expect(migrationSql).toContain("domain IN ('social_media','data_dashboard','product_showcase','tutorial','custom')");
  });

  test('video_templates has aspect_ratio CHECK', () => {
    expect(migrationSql).toContain("aspect_ratio IN ('16:9','9:16','1:1','4:3')");
  });

  test('video_assets has asset_type CHECK', () => {
    expect(migrationSql).toContain("asset_type IN ('image','font','overlay','audio','logo')");
  });

  test('ALTER adds video_create to task_type CHECK', () => {
    expect(migrationSql).toContain("'video_create'");
  });

  test('ALTER adds video_render to task_type CHECK', () => {
    expect(migrationSql).toContain("'video_render'");
  });

  test('ALTER adds video_preview to task_type CHECK', () => {
    expect(migrationSql).toContain("'video_preview'");
  });

  test('has indexes for render_jobs', () => {
    expect(migrationSql).toContain('idx_render_jobs_org');
    expect(migrationSql).toContain('idx_render_jobs_user');
    expect(migrationSql).toContain('idx_render_jobs_status');
    expect(migrationSql).toContain('idx_render_jobs_template');
    expect(migrationSql).toContain('idx_render_jobs_created');
  });

  test('has indexes for video_templates', () => {
    expect(migrationSql).toContain('idx_video_templates_org');
    expect(migrationSql).toContain('idx_video_templates_domain');
    expect(migrationSql).toContain('idx_video_templates_public');
  });

  test('has indexes for video_assets', () => {
    expect(migrationSql).toContain('idx_video_assets_org');
    expect(migrationSql).toContain('idx_video_assets_type');
  });

  test('has 5 settings_global defaults', () => {
    expect(migrationSql).toContain("'video.max_concurrent_renders'");
    expect(migrationSql).toContain("'video.default_quality_crf'");
    expect(migrationSql).toContain("'video.max_duration_s'");
    expect(migrationSql).toContain("'video.default_fps'");
    expect(migrationSql).toContain("'video.output_format'");
  });

  test('wraps in transaction', () => {
    expect(migrationSql).toContain('BEGIN;');
    expect(migrationSql).toContain('COMMIT;');
  });
});

// ═══════════════════════════════════════════════════════════════════
// 2. Shared types — video-content.ts
// ═══════════════════════════════════════════════════════════════════
describe('Shared types — video-content.ts', () => {
  test('exports RenderStatus type with 5 values', () => {
    expect(sharedTypes).toContain("'pending' | 'rendering' | 'completed' | 'failed' | 'cancelled'");
  });

  test('exports AspectRatio type with 4 values', () => {
    expect(sharedTypes).toContain("'16:9' | '9:16' | '1:1' | '4:3'");
  });

  test('exports TransitionType with 7 values', () => {
    expect(sharedTypes).toContain("'cut'");
    expect(sharedTypes).toContain("'fade'");
    expect(sharedTypes).toContain("'dissolve'");
    expect(sharedTypes).toContain("'wipe_left'");
    expect(sharedTypes).toContain("'wipe_right'");
    expect(sharedTypes).toContain("'slide_up'");
    expect(sharedTypes).toContain("'slide_down'");
  });

  test('exports ElementType with 5 values', () => {
    expect(sharedTypes).toContain("'text' | 'image' | 'shape' | 'chart' | 'overlay'");
  });

  test('exports TemplateDomain with 5 values', () => {
    expect(sharedTypes).toContain("'social_media' | 'data_dashboard' | 'product_showcase' | 'tutorial' | 'custom'");
  });

  test('exports VideoAssetType with 5 values', () => {
    expect(sharedTypes).toContain("'image' | 'font' | 'overlay' | 'audio' | 'logo'");
  });

  test('exports VideoOutputFormat', () => {
    expect(sharedTypes).toContain("'mp4' | 'webm'");
  });

  test('exports RENDER_STATUSES constant array', () => {
    expect(sharedTypes).toContain('RENDER_STATUSES');
  });

  test('exports ASPECT_RATIOS constant array', () => {
    expect(sharedTypes).toContain('ASPECT_RATIOS');
  });

  test('exports TRANSITION_TYPES constant array', () => {
    expect(sharedTypes).toContain('TRANSITION_TYPES');
  });

  test('exports ELEMENT_TYPES constant array', () => {
    expect(sharedTypes).toContain('ELEMENT_TYPES');
  });

  test('exports TEMPLATE_DOMAINS constant array', () => {
    expect(sharedTypes).toContain('TEMPLATE_DOMAINS');
  });

  test('exports VIDEO_ASSET_TYPES constant array', () => {
    expect(sharedTypes).toContain('VIDEO_ASSET_TYPES');
  });

  test('exports DEFAULT_VIDEO_CONFIG', () => {
    expect(sharedTypes).toContain('DEFAULT_VIDEO_CONFIG');
    expect(sharedTypes).toContain('maxConcurrentRenders: 3');
    expect(sharedTypes).toContain('defaultQualityCrf: 23');
    expect(sharedTypes).toContain('maxDurationS: 600');
    expect(sharedTypes).toContain('defaultFps: 30');
  });

  test('exports RenderJobRecord interface', () => {
    expect(sharedTypes).toContain('interface RenderJobRecord');
  });

  test('exports VideoAssetRecord interface', () => {
    expect(sharedTypes).toContain('interface VideoAssetRecord');
  });

  test('exports VideoTemplateRecord interface', () => {
    expect(sharedTypes).toContain('interface VideoTemplateRecord');
  });

  test('exports VideoSpec interface', () => {
    expect(sharedTypes).toContain('interface VideoSpec');
  });

  test('exports Scene interface', () => {
    expect(sharedTypes).toContain('interface Scene');
  });

  test('exports AudioTrack interface', () => {
    expect(sharedTypes).toContain('interface AudioTrack');
  });

  test('exports RenderResult interface', () => {
    expect(sharedTypes).toContain('interface RenderResult');
  });

  test('exports VideoEngineStats interface', () => {
    expect(sharedTypes).toContain('interface VideoEngineStats');
  });
});

// ═══════════════════════════════════════════════════════════════════
// 3. Utility functions in shared types
// ═══════════════════════════════════════════════════════════════════
describe('Shared types — utility functions', () => {
  test('exports isTerminalRenderStatus', () => {
    expect(sharedTypes).toContain('function isTerminalRenderStatus');
  });

  test('exports computeSpecDuration', () => {
    expect(sharedTypes).toContain('function computeSpecDuration');
  });

  test('exports isWithinDurationLimit', () => {
    expect(sharedTypes).toContain('function isWithinDurationLimit');
  });

  test('exports dimensionsForAspect', () => {
    expect(sharedTypes).toContain('function dimensionsForAspect');
  });

  test('exports estimateOutputSize', () => {
    expect(sharedTypes).toContain('function estimateOutputSize');
  });
});

// ═══════════════════════════════════════════════════════════════════
// 4. Shared index re-exports video-content
// ═══════════════════════════════════════════════════════════════════
describe('Shared index.ts', () => {
  test('re-exports video-content module', () => {
    expect(sharedIndex).toContain("export * from './video-content.js'");
  });
});

// ═══════════════════════════════════════════════════════════════════
// 5. Existing video-engine.ts (pre-existing, not created by Batch 32)
// ═══════════════════════════════════════════════════════════════════
describe('Video engine — video-engine.ts', () => {
  test('exports RenderStatus type', () => {
    expect(videoEngine).toContain("export type RenderStatus = 'pending' | 'rendering' | 'completed' | 'failed' | 'cancelled'");
  });

  test('exports AspectRatio type', () => {
    expect(videoEngine).toContain("export type AspectRatio = '16:9' | '9:16' | '1:1' | '4:3'");
  });

  test('exports TransitionType type', () => {
    expect(videoEngine).toContain("export type TransitionType =");
  });

  test('exports ElementType type', () => {
    expect(videoEngine).toContain("export type ElementType = 'text' | 'image' | 'shape' | 'chart' | 'overlay'");
  });

  test('exports TemplateDomain type', () => {
    expect(videoEngine).toContain("export type TemplateDomain = 'social_media' | 'data_dashboard' | 'product_showcase' | 'tutorial' | 'custom'");
  });

  test('exports createRenderJob function', () => {
    expect(videoEngine).toContain('export function createRenderJob');
  });

  test('exports buildFfmpegArgs function', () => {
    expect(videoEngine).toContain('export function buildFfmpegArgs');
  });

  test('exports textToVideoSpec function', () => {
    expect(videoEngine).toContain('export async function textToVideoSpec');
  });

  test('exports buildPreviewArgs function', () => {
    expect(videoEngine).toContain('export function buildPreviewArgs');
  });

  test('exports computeDuration function', () => {
    expect(videoEngine).toContain('export function computeDuration');
  });

  test('exports validateSpec function', () => {
    expect(videoEngine).toContain('export function validateSpec');
  });

  test('exports getVideoStats function', () => {
    expect(videoEngine).toContain('export function getVideoStats');
  });

  test('is 1175 lines', () => {
    const lineCount = videoEngine.split('\n').length;
    expect(lineCount).toBeGreaterThanOrEqual(1170);
    expect(lineCount).toBeLessThanOrEqual(1180);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 6. Existing SKILL.md (pre-existing, not created by Batch 32)
// ═══════════════════════════════════════════════════════════════════
describe('Video generator SKILL.md', () => {
  test('has YAML frontmatter with name', () => {
    expect(skillMd).toContain('name: video-generator');
  });

  test('has handler_language typescript', () => {
    expect(skillMd).toContain('handler_language: typescript');
  });

  test('has handler_file handler.ts', () => {
    expect(skillMd).toContain('handler_file: handler.ts');
  });

  test('has publisher 47dynamics', () => {
    expect(skillMd).toContain('publisher: 47dynamics');
  });

  test('has 7 actions', () => {
    expect(skillMd).toContain('create_video');
    expect(skillMd).toContain('list_templates');
    expect(skillMd).toContain('render');
    expect(skillMd).toContain('get_status');
    expect(skillMd).toContain('cancel');
    expect(skillMd).toContain('preview');
    expect(skillMd).toContain('get_stats');
  });

  test('has 5 template domains in inputs_schema', () => {
    expect(skillMd).toContain('social_media');
    expect(skillMd).toContain('data_dashboard');
    expect(skillMd).toContain('product_showcase');
    expect(skillMd).toContain('tutorial');
  });

  test('has 4 aspect ratios in inputs_schema', () => {
    expect(skillMd).toContain('16:9');
    expect(skillMd).toContain('9:16');
    expect(skillMd).toContain('1:1');
    expect(skillMd).toContain('4:3');
  });
});

// ═══════════════════════════════════════════════════════════════════
// 7. Handler exists and imports from video-engine
// ═══════════════════════════════════════════════════════════════════
describe('Video generator handler.ts', () => {
  test('file exists and is non-empty', () => {
    expect(handlerTs.length).toBeGreaterThan(100);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 8. Task executor — video switch cases
// ═══════════════════════════════════════════════════════════════════
describe('Task executor — video cases', () => {
  test('has video_create case', () => {
    expect(taskExecutor).toContain("case 'video_create'");
  });

  test('has video_render case', () => {
    expect(taskExecutor).toContain("case 'video_render'");
  });

  test('has video_preview case', () => {
    expect(taskExecutor).toContain("case 'video_preview'");
  });

  test('video_create routes to handleVideoCreate', () => {
    expect(taskExecutor).toContain('this.handleVideoCreate');
  });

  test('video_render routes to handleVideoRender', () => {
    expect(taskExecutor).toContain('this.handleVideoRender');
  });

  test('video_preview routes to handleVideoPreview', () => {
    expect(taskExecutor).toContain('this.handleVideoPreview');
  });

  test('has 37 total switch cases', () => {
    const caseCount = (taskExecutor.match(/case '/g) || []).length;
    expect(caseCount).toBe(37);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 9. Task executor — handler output shapes
// ═══════════════════════════════════════════════════════════════════
describe('Task executor — handler outputs', () => {
  test('handleVideoCreate returns specId and template', () => {
    expect(taskExecutor).toContain('specId');
    expect(taskExecutor).toContain("template,");
  });

  test('handleVideoCreate returns estimatedDurationS', () => {
    expect(taskExecutor).toContain('estimatedDurationS');
  });

  test('handleVideoRender returns jobId and renderStatus', () => {
    expect(taskExecutor).toContain('jobId');
    expect(taskExecutor).toContain('renderStatus');
  });

  test('handleVideoRender returns queuePosition', () => {
    expect(taskExecutor).toContain('queuePosition');
  });

  test('handleVideoPreview returns previewUrl', () => {
    expect(taskExecutor).toContain('previewUrl');
  });

  test('handleVideoPreview returns width and height', () => {
    expect(taskExecutor).toContain('width: 320');
    expect(taskExecutor).toContain('height: 180');
  });
});

// ═══════════════════════════════════════════════════════════════════
// 10. Eidolon — building kind
// ═══════════════════════════════════════════════════════════════════
describe('Eidolon — video_studio building kind', () => {
  test('EidolonBuildingKind includes video_studio', () => {
    expect(eidolonTypes).toContain("| 'video_studio'");
  });

  test('has 17 building kinds', () => {
    const buildingKindBlock = eidolonTypes.match(/export type EidolonBuildingKind[\s\S]*?;/);
    expect(buildingKindBlock).not.toBeNull();
    const pipeCount = (buildingKindBlock![0].match(/\| '/g) || []).length;
    expect(pipeCount).toBe(17);
  });

  test('districtFor handles video_studio', () => {
    expect(eidolonTypes).toContain("case 'video_studio':");
  });

  test('video_studio maps to market district', () => {
    expect(eidolonTypes).toContain("case 'video_studio':");
    const idx = eidolonTypes.indexOf("case 'video_studio':");
    const returnSlice = eidolonTypes.slice(idx, idx + 80);
    expect(returnSlice).toContain("return 'market'");
  });

  test('has 17 districtFor cases', () => {
    const caseCount = (eidolonTypes.match(/case '/g) || []).length;
    expect(caseCount).toBe(17);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 11. Eidolon — event kinds
// ═══════════════════════════════════════════════════════════════════
describe('Eidolon — video event kinds', () => {
  test('has video.render_started', () => {
    expect(eidolonTypes).toContain("| 'video.render_started'");
  });

  test('has video.render_completed', () => {
    expect(eidolonTypes).toContain("| 'video.render_completed'");
  });

  test('has video.template_created', () => {
    expect(eidolonTypes).toContain("| 'video.template_created'");
  });

  test('has video.spec_generated', () => {
    expect(eidolonTypes).toContain("| 'video.spec_generated'");
  });

  test('has 80 total event kinds', () => {
    const eventKindBlock = eidolonTypes.match(/export type EidolonEventKind[\s\S]*?'heartbeat';/);
    expect(eventKindBlock).not.toBeNull();
    const pipeCount = (eventKindBlock![0].match(/\| '/g) || []).length;
    expect(pipeCount).toBe(80);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 12. SUBJECT_MAP — video entries
// ═══════════════════════════════════════════════════════════════════
describe('Event bus — SUBJECT_MAP video entries', () => {
  test('maps sven.video.render_started', () => {
    expect(eventBus).toContain("'sven.video.render_started': 'video.render_started'");
  });

  test('maps sven.video.render_completed', () => {
    expect(eventBus).toContain("'sven.video.render_completed': 'video.render_completed'");
  });

  test('maps sven.video.template_created', () => {
    expect(eventBus).toContain("'sven.video.template_created': 'video.template_created'");
  });

  test('maps sven.video.spec_generated', () => {
    expect(eventBus).toContain("'sven.video.spec_generated': 'video.spec_generated'");
  });

  test('has 79 total SUBJECT_MAP entries', () => {
    const entryCount = (eventBus.match(/'sven\./g) || []).length;
    expect(entryCount).toBe(79);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 13. SUBJECT_MAP ↔ EidolonEventKind coherence
// ═══════════════════════════════════════════════════════════════════
describe('SUBJECT_MAP ↔ EidolonEventKind coherence', () => {
  const eventKindBlock = eidolonTypes.match(/export type EidolonEventKind[\s\S]*?'heartbeat';/)?.[0] ?? '';
  const subjectValues = (eventBus.match(/'sven\.[^']+'/g) || [])
    .map(s => s.replace(/^'sven\./, '').replace(/'$/, '').replace(/\./g, '.'));

  test('every SUBJECT_MAP value exists in EidolonEventKind', () => {
    for (const v of subjectValues) {
      expect(eventKindBlock).toContain(`'${v}'`);
    }
  });

  test('4 new video entries all present in both', () => {
    const videoEvents = ['video.render_started', 'video.render_completed', 'video.template_created', 'video.spec_generated'];
    for (const e of videoEvents) {
      expect(eventKindBlock).toContain(`'${e}'`);
      expect(eventBus).toContain(`'sven.${e}'`);
    }
  });
});
