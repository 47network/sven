import * as fs from 'fs';
import * as path from 'path';

/**
 * Unit tests for the Pipeline services: Image Processing (6.12),
 * Audio Scribe (6.14), Device Actions (6.15), and related UI
 * components (2.5 Brain Canvas, 6.9 Settings).
 */

const MIGRATION_SQL = fs.readFileSync(
  path.resolve(__dirname, '../db/migrations/20260409100000_pipeline_scribe_actions.sql'),
  'utf-8',
);

const ROUTE_SOURCE = fs.readFileSync(
  path.resolve(__dirname, '../routes/admin/pipeline.ts'),
  'utf-8',
);

const ADMIN_INDEX = fs.readFileSync(
  path.resolve(__dirname, '../routes/admin/index.ts'),
  'utf-8',
);

// ── Migration Structure ────────────────────────────────────────

describe('Pipeline tables migration (6.12, 6.14, 6.15)', () => {
  it('creates image_escalation_policies table (6.12)', () => {
    expect(MIGRATION_SQL).toContain('CREATE TABLE IF NOT EXISTS image_escalation_policies');
    expect(MIGRATION_SQL).toContain('organization_id');
    expect(MIGRATION_SQL).toContain('auto_escalate');
    expect(MIGRATION_SQL).toContain('confidence_threshold');
    expect(MIGRATION_SQL).toContain('max_local_processing_ms');
    expect(MIGRATION_SQL).toContain('allowed_categories');
    expect(MIGRATION_SQL).toContain('prefer_local');
    expect(MIGRATION_SQL).toContain('ocr_enabled');
    expect(MIGRATION_SQL).toContain('handwriting_enabled');
  });

  it('creates image_processing_jobs table (6.12)', () => {
    expect(MIGRATION_SQL).toContain('CREATE TABLE IF NOT EXISTS image_processing_jobs');
    expect(MIGRATION_SQL).toContain('image_ref');
    expect(MIGRATION_SQL).toContain("category IN ('photo','screenshot','document','handwriting','chart','diagram','other')");
    expect(MIGRATION_SQL).toContain("target IN ('local','server','fallback_server')");
    expect(MIGRATION_SQL).toContain("status IN ('queued','processing','completed','failed','escalated')");
    expect(MIGRATION_SQL).toContain('local_confidence');
    expect(MIGRATION_SQL).toContain('escalation_reason');
    expect(MIGRATION_SQL).toContain('result_data');
    expect(MIGRATION_SQL).toContain('processing_ms');
    expect(MIGRATION_SQL).toContain('model_used');
  });

  it('creates audio_scribe_configs table (6.14)', () => {
    expect(MIGRATION_SQL).toContain('CREATE TABLE IF NOT EXISTS audio_scribe_configs');
    expect(MIGRATION_SQL).toContain('prefer_local');
    expect(MIGRATION_SQL).toContain('max_local_duration_seconds');
    expect(MIGRATION_SQL).toContain('auto_detect_language');
    expect(MIGRATION_SQL).toContain('default_language');
    expect(MIGRATION_SQL).toContain('noise_reduction');
    expect(MIGRATION_SQL).toContain('punctuation_enabled');
    expect(MIGRATION_SQL).toContain('speaker_diarization');
    expect(MIGRATION_SQL).toContain('real_time_mode');
  });

  it('creates audio_scribe_sessions table (6.14)', () => {
    expect(MIGRATION_SQL).toContain('CREATE TABLE IF NOT EXISTS audio_scribe_sessions');
    expect(MIGRATION_SQL).toContain("source IN ('microphone','voice_note','meeting','lecture','uploaded_file')");
    expect(MIGRATION_SQL).toContain("target IN ('local','server')");
    expect(MIGRATION_SQL).toContain("status IN ('pending','recording','processing','completed','failed')");
    expect(MIGRATION_SQL).toContain('duration_seconds');
    expect(MIGRATION_SQL).toContain('transcript');
    expect(MIGRATION_SQL).toContain('language_detected');
    expect(MIGRATION_SQL).toContain('confidence');
    expect(MIGRATION_SQL).toContain('word_count');
  });

  it('creates device_actions table (6.15)', () => {
    expect(MIGRATION_SQL).toContain('CREATE TABLE IF NOT EXISTS device_actions');
    expect(MIGRATION_SQL).toContain("category IN ('navigation','automation','device_control','app_interaction','system','custom')");
    expect(MIGRATION_SQL).toContain("platform IN ('android','ios','desktop_macos','desktop_windows','desktop_linux','any')");
    expect(MIGRATION_SQL).toContain('function_schema');
    expect(MIGRATION_SQL).toContain('requires_confirmation');
    expect(MIGRATION_SQL).toContain('UNIQUE (organization_id, name)');
  });

  it('creates device_action_executions table with FK (6.15)', () => {
    expect(MIGRATION_SQL).toContain('CREATE TABLE IF NOT EXISTS device_action_executions');
    expect(MIGRATION_SQL).toContain('action_id');
    expect(MIGRATION_SQL).toContain('device_id');
    expect(MIGRATION_SQL).toContain("status IN ('registered','pending','executing','completed','failed','cancelled')");
    expect(MIGRATION_SQL).toContain('input_params');
    expect(MIGRATION_SQL).toContain('execution_ms');
    expect(MIGRATION_SQL).toContain('REFERENCES device_actions(id) ON DELETE CASCADE');
  });

  it('creates device_action_policies table (6.15)', () => {
    expect(MIGRATION_SQL).toContain('CREATE TABLE IF NOT EXISTS device_action_policies');
    expect(MIGRATION_SQL).toContain('allow_device_control');
    expect(MIGRATION_SQL).toContain('allow_app_navigation');
    expect(MIGRATION_SQL).toContain('allow_system_actions');
    expect(MIGRATION_SQL).toContain('require_confirmation_all');
    expect(MIGRATION_SQL).toContain('max_actions_per_minute');
    expect(MIGRATION_SQL).toContain('blocked_actions');
  });

  it('wraps all DDL in a transaction', () => {
    expect(MIGRATION_SQL).toMatch(/^BEGIN;/m);
    expect(MIGRATION_SQL).toMatch(/^COMMIT;/m);
  });

  it('has ON DELETE CASCADE for FK references', () => {
    expect(MIGRATION_SQL).toContain('ON DELETE CASCADE');
  });

  it('creates indexes for all major query patterns', () => {
    expect(MIGRATION_SQL).toContain('idx_image_jobs_org');
    expect(MIGRATION_SQL).toContain('idx_image_jobs_status');
    expect(MIGRATION_SQL).toContain('idx_scribe_sessions_org');
    expect(MIGRATION_SQL).toContain('idx_scribe_sessions_status');
    expect(MIGRATION_SQL).toContain('idx_device_actions_org');
    expect(MIGRATION_SQL).toContain('idx_device_executions_org');
    expect(MIGRATION_SQL).toContain('idx_device_executions_device');
  });

  it('uses ASCII-only quotes (no smart quotes)', () => {
    expect(MIGRATION_SQL).not.toMatch(/[\u2018\u2019\u201C\u201D]/);
  });
});

// ── Service Exports ────────────────────────────────────────────

describe('Pipeline service exports', () => {
  it('exports ImageProcessingService (6.12)', () => {
    const mod = require('../services/ImageProcessingService');
    expect(mod.ImageProcessingService).toBeDefined();
    expect(typeof mod.ImageProcessingService).toBe('function');
    expect(typeof mod.ImageProcessingService.getCategories).toBe('function');
    expect(typeof mod.ImageProcessingService.getEscalationKeywords).toBe('function');
  });

  it('exports AudioScribeService (6.14)', () => {
    const mod = require('../services/AudioScribeService');
    expect(mod.AudioScribeService).toBeDefined();
    expect(typeof mod.AudioScribeService).toBe('function');
    expect(typeof mod.AudioScribeService.getHighAccuracyLanguages).toBe('function');
    expect(typeof mod.AudioScribeService.getMaxLocalDuration).toBe('function');
  });

  it('exports DeviceActionService (6.15)', () => {
    const mod = require('../services/DeviceActionService');
    expect(mod.DeviceActionService).toBeDefined();
    expect(typeof mod.DeviceActionService).toBe('function');
    expect(typeof mod.DeviceActionService.getBuiltinActions).toBe('function');
  });
});

// ── Route Registration ─────────────────────────────────────────

describe('Pipeline route registration', () => {
  it('registers Image Processing endpoints (6.12)', () => {
    expect(ROUTE_SOURCE).toContain("'/pipeline/image/policy'");
    expect(ROUTE_SOURCE).toContain("'/pipeline/image/submit'");
    expect(ROUTE_SOURCE).toContain("'/pipeline/image/:jobId/complete'");
    expect(ROUTE_SOURCE).toContain("'/pipeline/image/:jobId/escalate'");
    expect(ROUTE_SOURCE).toContain("'/pipeline/image/jobs'");
    expect(ROUTE_SOURCE).toContain("'/pipeline/image/stats'");
    expect(ROUTE_SOURCE).toContain("'/pipeline/image/categories'");
  });

  it('registers Audio Scribe endpoints (6.14)', () => {
    expect(ROUTE_SOURCE).toContain("'/pipeline/scribe/config'");
    expect(ROUTE_SOURCE).toContain("'/pipeline/scribe/start'");
    expect(ROUTE_SOURCE).toContain("'/pipeline/scribe/:sessionId/complete'");
    expect(ROUTE_SOURCE).toContain("'/pipeline/scribe/:sessionId/fail'");
    expect(ROUTE_SOURCE).toContain("'/pipeline/scribe/sessions'");
    expect(ROUTE_SOURCE).toContain("'/pipeline/scribe/stats'");
    expect(ROUTE_SOURCE).toContain("'/pipeline/scribe/languages'");
  });

  it('registers Device Action endpoints (6.15)', () => {
    expect(ROUTE_SOURCE).toContain("'/pipeline/actions/seed'");
    expect(ROUTE_SOURCE).toContain("'/pipeline/actions/register'");
    expect(ROUTE_SOURCE).toContain("'/pipeline/actions'");
    expect(ROUTE_SOURCE).toContain("'/pipeline/actions/:actionId/toggle'");
    expect(ROUTE_SOURCE).toContain("'/pipeline/actions/:actionId'");
    expect(ROUTE_SOURCE).toContain("'/pipeline/actions/:actionId/execute'");
    expect(ROUTE_SOURCE).toContain("'/pipeline/actions/executions/:executionId/complete'");
    expect(ROUTE_SOURCE).toContain("'/pipeline/actions/executions/:executionId/fail'");
    expect(ROUTE_SOURCE).toContain("'/pipeline/actions/executions'");
    expect(ROUTE_SOURCE).toContain("'/pipeline/actions/policy'");
    expect(ROUTE_SOURCE).toContain("'/pipeline/actions/stats'");
    expect(ROUTE_SOURCE).toContain("'/pipeline/actions/builtins'");
  });

  it('is registered in admin route index', () => {
    expect(ADMIN_INDEX).toContain("import { registerPipelineRoutes } from './pipeline.js'");
    expect(ADMIN_INDEX).toContain('registerPipelineRoutes');
  });

  it('enforces org auth on all endpoints', () => {
    const orgChecks = (ROUTE_SOURCE.match(/ORG_REQUIRED/g) || []).length;
    // All endpoints except static lists (categories, languages, builtins) should check org
    expect(orgChecks).toBeGreaterThanOrEqual(20);
  });
});

// ── ImageProcessingService Logic ───────────────────────────────

describe('ImageProcessingService routing logic', () => {
  let ImageProcessingService: any;
  beforeAll(() => {
    ImageProcessingService = require('../services/ImageProcessingService').ImageProcessingService;
  });

  it('provides 7 image categories', () => {
    const categories = ImageProcessingService.getCategories();
    expect(categories).toContain('photo');
    expect(categories).toContain('screenshot');
    expect(categories).toContain('document');
    expect(categories).toContain('handwriting');
    expect(categories).toContain('chart');
    expect(categories).toContain('diagram');
    expect(categories).toContain('other');
    expect(categories.length).toBe(7);
  });

  it('provides escalation keywords for complex content', () => {
    const keywords = ImageProcessingService.getEscalationKeywords();
    expect(keywords.length).toBeGreaterThan(5);
    expect(keywords).toContain('medical');
    expect(keywords).toContain('blueprint');
    expect(keywords).toContain('financial statement');
  });

  it('routes simple photos to local when prefer_local is true', () => {
    const svc = new ImageProcessingService(null as any);
    const policy = {
      prefer_local: true,
      auto_escalate: true,
      allowed_categories: ['photo', 'screenshot', 'document', 'handwriting', 'chart', 'diagram'],
    };
    const target = svc.routeImage('photo', 'a nice sunset picture', policy);
    expect(target).toBe('local');
  });

  it('routes medical images to server when auto_escalate is true', () => {
    const svc = new ImageProcessingService(null as any);
    const policy = {
      prefer_local: true,
      auto_escalate: true,
      allowed_categories: ['photo', 'screenshot', 'document', 'handwriting', 'chart', 'diagram'],
    };
    const target = svc.routeImage('photo', 'medical xray of left knee', policy);
    expect(target).toBe('server');
  });

  it('routes everything to server when prefer_local is false', () => {
    const svc = new ImageProcessingService(null as any);
    const policy = { prefer_local: false, auto_escalate: true, allowed_categories: ['photo'] };
    const target = svc.routeImage('photo', 'anything', policy);
    expect(target).toBe('server');
  });

  it('routes disallowed categories to server', () => {
    const svc = new ImageProcessingService(null as any);
    const policy = { prefer_local: true, auto_escalate: true, allowed_categories: ['photo'] };
    const target = svc.routeImage('document', 'some doc', policy);
    expect(target).toBe('server');
  });
});

// ── AudioScribeService Logic ───────────────────────────────────

describe('AudioScribeService routing logic', () => {
  let AudioScribeService: any;
  beforeAll(() => {
    AudioScribeService = require('../services/AudioScribeService').AudioScribeService;
  });

  it('returns 30 as max local duration', () => {
    expect(AudioScribeService.getMaxLocalDuration()).toBe(30);
  });

  it('lists 13 high-accuracy languages', () => {
    const langs = AudioScribeService.getHighAccuracyLanguages();
    expect(langs.length).toBe(13);
    expect(langs).toContain('en');
    expect(langs).toContain('es');
    expect(langs).toContain('zh');
    expect(langs).toContain('ja');
  });

  it('routes short audio to local when prefer_local is true', () => {
    const svc = new AudioScribeService(null as any);
    const config = { prefer_local: true, max_local_duration_seconds: 30, speaker_diarization: false };
    const target = svc.routeAudio(15, config);
    expect(target).toBe('local');
  });

  it('routes long audio to server', () => {
    const svc = new AudioScribeService(null as any);
    const config = { prefer_local: true, max_local_duration_seconds: 30, speaker_diarization: false };
    const target = svc.routeAudio(120, config);
    expect(target).toBe('server');
  });

  it('routes to server when speaker diarization is enabled', () => {
    const svc = new AudioScribeService(null as any);
    const config = { prefer_local: true, max_local_duration_seconds: 30, speaker_diarization: true };
    const target = svc.routeAudio(10, config);
    expect(target).toBe('server');
  });

  it('routes to server when prefer_local is false', () => {
    const svc = new AudioScribeService(null as any);
    const config = { prefer_local: false, max_local_duration_seconds: 30, speaker_diarization: false };
    const target = svc.routeAudio(5, config);
    expect(target).toBe('server');
  });
});

// ── DeviceActionService Logic ──────────────────────────────────

describe('DeviceActionService built-in actions', () => {
  let DeviceActionService: any;
  beforeAll(() => {
    DeviceActionService = require('../services/DeviceActionService').DeviceActionService;
  });

  it('provides 8 built-in actions', () => {
    const actions = DeviceActionService.getBuiltinActions();
    expect(actions.length).toBe(8);
  });

  it('includes core device actions', () => {
    const actions = DeviceActionService.getBuiltinActions();
    const names = actions.map((a: any) => a.name);
    expect(names).toContain('open_app');
    expect(names).toContain('set_alarm');
    expect(names).toContain('send_notification');
    expect(names).toContain('toggle_setting');
    expect(names).toContain('take_screenshot');
    expect(names).toContain('navigate_to');
    expect(names).toContain('run_shortcut');
    expect(names).toContain('clipboard_copy');
  });

  it('requires confirmation for destructive actions', () => {
    const actions = DeviceActionService.getBuiltinActions();
    const toggleSetting = actions.find((a: any) => a.name === 'toggle_setting');
    const runShortcut = actions.find((a: any) => a.name === 'run_shortcut');
    expect(toggleSetting.requires_confirmation).toBe(true);
    expect(runShortcut.requires_confirmation).toBe(true);
  });

  it('does not require confirmation for read-only actions', () => {
    const actions = DeviceActionService.getBuiltinActions();
    const screenshot = actions.find((a: any) => a.name === 'take_screenshot');
    const clipboard = actions.find((a: any) => a.name === 'clipboard_copy');
    expect(screenshot.requires_confirmation).toBe(false);
    expect(clipboard.requires_confirmation).toBe(false);
  });

  it('all built-in actions target any platform', () => {
    const actions = DeviceActionService.getBuiltinActions();
    for (const action of actions) {
      expect(action.platform).toBe('any');
    }
  });

  it('all built-in actions have function schemas', () => {
    const actions = DeviceActionService.getBuiltinActions();
    for (const action of actions) {
      expect(action.function_schema).toBeDefined();
      expect(action.function_schema.type).toBe('object');
      expect(action.function_schema.properties).toBeDefined();
    }
  });
});

// ── Canvas Brain Block ─────────────────────────────────────────

describe('Brain Canvas UI component (2.5)', () => {
  const brainBlockSource = fs.readFileSync(
    path.resolve(__dirname, '../../../../apps/canvas-ui/src/components/blocks/BrainBlock.tsx'),
    'utf-8',
  );

  const blockRendererSource = fs.readFileSync(
    path.resolve(__dirname, '../../../../apps/canvas-ui/src/components/blocks/BlockRenderer.tsx'),
    'utf-8',
  );

  const blockIndexSource = fs.readFileSync(
    path.resolve(__dirname, '../../../../apps/canvas-ui/src/components/blocks/index.ts'),
    'utf-8',
  );

  it('exports BrainBlock component', () => {
    expect(brainBlockSource).toContain('export function BrainBlock');
  });

  it('renders force-directed graph with SVG', () => {
    expect(brainBlockSource).toContain('<svg');
    expect(brainBlockSource).toContain('viewBox');
    expect(brainBlockSource).toContain('<circle');
    expect(brainBlockSource).toContain('<line');
  });

  it('supports all 4 node types with distinct colors', () => {
    expect(brainBlockSource).toContain("memory: '#3b82f6'");
    expect(brainBlockSource).toContain("knowledge: '#10b981'");
    expect(brainBlockSource).toContain("emotion: '#f59e0b'");
    expect(brainBlockSource).toContain("reasoning: '#8b5cf6'");
  });

  it('supports all 6 node states', () => {
    expect(brainBlockSource).toContain('fresh');
    expect(brainBlockSource).toContain('active');
    expect(brainBlockSource).toContain('resonating');
    expect(brainBlockSource).toContain('fading');
    expect(brainBlockSource).toContain('consolidating');
    expect(brainBlockSource).toContain('consolidated');
  });

  it('has zoom controls', () => {
    expect(brainBlockSource).toContain('ZoomIn');
    expect(brainBlockSource).toContain('ZoomOut');
    expect(brainBlockSource).toContain('handleZoomIn');
    expect(brainBlockSource).toContain('handleZoomOut');
  });

  it('has type filter buttons', () => {
    expect(brainBlockSource).toContain('filterType');
    expect(brainBlockSource).toContain('setFilterType');
  });

  it('displays stats bar with node counts', () => {
    expect(brainBlockSource).toContain('stats.total_memories');
    expect(brainBlockSource).toContain('stats.kg_entities');
    expect(brainBlockSource).toContain('stats.emotional_samples');
    expect(brainBlockSource).toContain('stats.active_memories');
    expect(brainBlockSource).toContain('stats.fading_memories');
    expect(brainBlockSource).toContain('stats.consolidated');
  });

  it('is registered in BlockRenderer', () => {
    expect(blockRendererSource).toContain("import { BrainBlock } from './BrainBlock'");
    expect(blockRendererSource).toContain("'brain'");
    expect(blockRendererSource).toContain('<BrainBlock');
  });

  it('is exported from blocks index', () => {
    expect(blockIndexSource).toContain("export { BrainBlock } from './BrainBlock'");
  });

  it('has accessible graph label', () => {
    expect(brainBlockSource).toContain('aria-label');
    expect(brainBlockSource).toContain('role="img"');
  });

  it('implements force-directed layout algorithm', () => {
    expect(brainBlockSource).toContain('layoutGraph');
    expect(brainBlockSource).toContain('repulsion');
    expect(brainBlockSource).toContain('attraction');
    expect(brainBlockSource).toContain('damping');
  });
});

// ── Settings Model Management Page (6.9) ───────────────────────

describe('Settings Model Management UI (6.9)', () => {
  const settingsSource = fs.readFileSync(
    path.resolve(__dirname, '../../../../apps/canvas-ui/src/app/settings/models/page.tsx'),
    'utf-8',
  );

  it('exports default page component', () => {
    expect(settingsSource).toContain('export default function SettingsModelsPage');
  });

  it('fetches model profiles from admin API', () => {
    expect(settingsSource).toContain('/gemma4/models');
    expect(settingsSource).toContain('/gemma4/routing/policy');
  });

  it('supports seed defaults action', () => {
    expect(settingsSource).toContain('/gemma4/models/seed');
    expect(settingsSource).toContain('handleSeedDefaults');
  });

  it('supports model deactivation', () => {
    expect(settingsSource).toContain('handleDeactivate');
    expect(settingsSource).toContain("method: 'DELETE'");
  });

  it('displays model capabilities (vision, audio, function calling)', () => {
    expect(settingsSource).toContain('supports_vision');
    expect(settingsSource).toContain('supports_audio');
    expect(settingsSource).toContain('supports_function_calling');
  });

  it('shows pipeline statistics', () => {
    expect(settingsSource).toContain('/pipeline/image/stats');
    expect(settingsSource).toContain('/pipeline/scribe/stats');
    expect(settingsSource).toContain('/pipeline/actions/stats');
  });

  it('displays installed modules', () => {
    expect(settingsSource).toContain('/gemma4/modules/installed');
    expect(settingsSource).toContain('module_name');
    expect(settingsSource).toContain('disk_usage_bytes');
  });

  it('shows routing policy info', () => {
    expect(settingsSource).toContain('local_threshold');
    expect(settingsSource).toContain('offline_mode');
    expect(settingsSource).toContain('max_cloud_tokens_per_day');
  });
});
