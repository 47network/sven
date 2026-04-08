/**
 * Unit tests for Batch 6 Gemma 4 integration (6.1–6.17)
 * Tests: migration structure, service exports, route registration, core logic
 */

import * as fs from 'fs';
import * as path from 'path';

/* ------------------------------------------------------------------ */
/*  Migration structure tests                                          */
/* ------------------------------------------------------------------ */
describe('Gemma 4 tables migration', () => {
  const migrationPath = path.resolve(
    __dirname,
    '../db/migrations/20260408200000_gemma4_integration.sql',
  );
  let sql: string;

  beforeAll(() => {
    sql = fs.readFileSync(migrationPath, 'utf-8');
  });

  it('creates gemma4_model_profiles table (6.1)', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS gemma4_model_profiles');
    expect(sql).toMatch(/model_key\s+TEXT NOT NULL/);
    expect(sql).toMatch(/model_name\s+TEXT NOT NULL/);
    expect(sql).toContain("('on_device', 'ollama', 'litellm', 'custom')");
    expect(sql).toContain("('flutter_mobile', 'tauri_desktop', 'server', 'web', 'cli')");
    expect(sql).toContain('UNIQUE (organization_id, model_key)');
    expect(sql).toContain('supports_audio');
    expect(sql).toContain('supports_vision');
    expect(sql).toContain('supports_function_calling');
  });

  it('creates gemma4_routing_policies table (6.4)', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS gemma4_routing_policies');
    expect(sql).toMatch(/organization_id\s+TEXT NOT NULL UNIQUE/);
    expect(sql).toContain("('simple', 'moderate', 'complex')");
    expect(sql).toMatch(/prefer_local\s+BOOLEAN NOT NULL DEFAULT TRUE/);
    expect(sql).toMatch(/cloud_fallback_enabled\s+BOOLEAN NOT NULL DEFAULT TRUE/);
    expect(sql).toContain('max_local_token_count');
    expect(sql).toContain('max_cloud_token_count');
  });

  it('creates gemma4_routing_decisions table (6.4)', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS gemma4_routing_decisions');
    expect(sql).toContain("target IN ('local', 'cloud', 'fallback_local')");
    expect(sql).toContain("complexity IN ('simple', 'moderate', 'complex', 'unknown')");
    expect(sql).toContain('latency_estimate_ms');
    expect(sql).toContain('prompt_length');
    expect(sql).toContain('idx_gemma4_routing_org');
    expect(sql).toContain('idx_gemma4_routing_target');
  });

  it('creates gemma4_device_sync_manifests table (6.5)', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS gemma4_device_sync_manifests');
    expect(sql).toContain('UNIQUE (organization_id, user_id, device_id)');
    expect(sql).toContain("('registered', 'syncing', 'synced', 'error')");
    expect(sql).toContain('sync_cursor');
    expect(sql).toContain('memories_on_device');
    expect(sql).toContain('pending_uploads');
    expect(sql).toContain('pending_downloads');
  });

  it('creates gemma4_sync_batches table with FK (6.5)', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS gemma4_sync_batches');
    expect(sql).toContain('REFERENCES gemma4_device_sync_manifests(id) ON DELETE CASCADE');
    expect(sql).toContain("direction IN ('upload', 'download')");
    expect(sql).toContain("('pending', 'in_progress', 'completed', 'failed')");
    expect(sql).toContain('byte_size');
  });

  it('creates gemma4_community_bridge_config table (6.6)', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS gemma4_community_bridge_config');
    expect(sql).toContain('UNIQUE (organization_id, user_id)');
    expect(sql).toContain('auto_file_bugs');
    expect(sql).toContain('auto_share_insights');
    expect(sql).toContain('auto_request_features');
    expect(sql).toContain('min_confidence_to_share');
  });

  it('creates gemma4_community_bridge_events table (6.6)', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS gemma4_community_bridge_events');
    expect(sql).toContain("('file_bug', 'request_feature', 'share_insight', 'ask_question', 'vote')");
    expect(sql).toContain('consent_verified');
    expect(sql).toContain('consent_level');
    expect(sql).toContain("('submitted', 'processing', 'completed', 'rejected', 'failed')");
    expect(sql).toContain('idx_gemma4_bridge_user');
    expect(sql).toContain('idx_gemma4_bridge_action');
  });

  it('creates gemma4_module_catalog table (6.7)', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS gemma4_module_catalog');
    expect(sql).toContain("('model', 'voice', 'vision', 'tool', 'language', 'plugin')");
    expect(sql).toContain('module_key');
    expect(sql).toContain('checksum_sha256');
    expect(sql).toContain('min_ram_mb');
    expect(sql).toContain('min_storage_mb');
    expect(sql).toContain('requires_gpu');
    expect(sql).toContain('idx_gemma4_modules_category');
  });

  it('creates gemma4_device_module_installs table (6.7+6.8)', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS gemma4_device_module_installs');
    expect(sql).toContain('REFERENCES gemma4_module_catalog(id) ON DELETE CASCADE');
    expect(sql).toContain('UNIQUE (organization_id, user_id, device_id, module_id)');
    expect(sql).toContain("('downloading', 'installed', 'updating', 'failed', 'uninstalled')");
    expect(sql).toContain('download_progress');
    expect(sql).toContain('disk_usage_bytes');
    expect(sql).toContain('idx_gemma4_installs_device');
  });

  it('creates gemma4_privacy_policies table (6.11+6.13)', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS gemma4_privacy_policies');
    expect(sql).toContain('UNIQUE (organization_id, user_id)');
    expect(sql).toMatch(/local_inference_only\s+BOOLEAN NOT NULL DEFAULT TRUE/);
    expect(sql).toMatch(/block_telemetry\s+BOOLEAN NOT NULL DEFAULT TRUE/);
    expect(sql).toMatch(/block_crash_reports\s+BOOLEAN NOT NULL DEFAULT TRUE/);
    expect(sql).toMatch(/block_usage_analytics\s+BOOLEAN NOT NULL DEFAULT TRUE/);
    expect(sql).toMatch(/offline_mode_forced\s+BOOLEAN NOT NULL DEFAULT FALSE/);
    expect(sql).toContain('data_retention_days');
  });

  it('creates gemma4_privacy_audit_log table (6.11)', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS gemma4_privacy_audit_log');
    expect(sql).toContain('event_type');
    expect(sql).toContain('blocked');
    expect(sql).toContain('idx_gemma4_privacy_audit');
  });

  it('creates gemma4_capability_maps table (6.10+6.17)', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS gemma4_capability_maps');
    expect(sql).toContain('REFERENCES gemma4_model_profiles(id) ON DELETE CASCADE');
    expect(sql).toContain('UNIQUE (organization_id, model_profile_id, capability)');
    expect(sql).toContain("'function_calling'");
    expect(sql).toContain("'audio_input'");
    expect(sql).toContain("'audio_output'");
    expect(sql).toContain("'vision'");
    expect(sql).toContain("'structured_json'");
    expect(sql).toContain("'agentic_workflows'");
    expect(sql).toContain("'device_control'");
    expect(sql).toContain('idx_gemma4_caps_model');
  });

  it('creates gemma4_custom_model_slots table (6.10)', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS gemma4_custom_model_slots');
    expect(sql).toContain("('gguf', 'safetensors', 'onnx', 'tflite', 'mediapipe')");
    expect(sql).toContain('model_path');
    expect(sql).toContain('model_size_bytes');
    expect(sql).toContain('capabilities');
    expect(sql).toContain('idx_gemma4_custom_user');
  });

  it('wraps all DDL in a transaction', () => {
    expect(sql.trim()).toMatch(/^(?:--[^\n]*\n)*\s*BEGIN;/);
    expect(sql.trim()).toMatch(/COMMIT;\s*$/);
  });

  it('has ON DELETE CASCADE for FK references', () => {
    const fkRefs = sql.match(/ON DELETE CASCADE/g) ?? [];
    expect(fkRefs.length).toBeGreaterThanOrEqual(3);
  });

  it('uses ASCII-only quotes (no smart quotes)', () => {
    const smartQuotes = sql.match(/[\u2018\u2019\u201C\u201D]/g);
    expect(smartQuotes).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/*  Service export tests                                               */
/* ------------------------------------------------------------------ */
describe('Gemma 4 service exports', () => {
  it('exports ModelSelectionService (6.1)', () => {
    const mod = require('../services/ModelSelectionService');
    expect(mod.ModelSelectionService).toBeDefined();
    expect(typeof mod.ModelSelectionService).toBe('function');
  });

  it('exports SmartRoutingService (6.4)', () => {
    const mod = require('../services/SmartRoutingService');
    expect(mod.SmartRoutingService).toBeDefined();
    expect(typeof mod.SmartRoutingService).toBe('function');
  });

  it('exports OnDeviceMemoryService (6.5)', () => {
    const mod = require('../services/OnDeviceMemoryService');
    expect(mod.OnDeviceMemoryService).toBeDefined();
    expect(typeof mod.OnDeviceMemoryService).toBe('function');
  });

  it('exports CommunityBridgeService (6.6)', () => {
    const mod = require('../services/CommunityBridgeService');
    expect(mod.CommunityBridgeService).toBeDefined();
    expect(typeof mod.CommunityBridgeService).toBe('function');
  });

  it('exports ModuleSystemService (6.7+6.8)', () => {
    const mod = require('../services/ModuleSystemService');
    expect(mod.ModuleSystemService).toBeDefined();
    expect(typeof mod.ModuleSystemService).toBe('function');
  });

  it('exports PrivacyIsolationService (6.11+6.13)', () => {
    const mod = require('../services/PrivacyIsolationService');
    expect(mod.PrivacyIsolationService).toBeDefined();
    expect(typeof mod.PrivacyIsolationService).toBe('function');
  });

  it('exports GemmaCapabilitiesService (6.10+6.17)', () => {
    const mod = require('../services/GemmaCapabilitiesService');
    expect(mod.GemmaCapabilitiesService).toBeDefined();
    expect(typeof mod.GemmaCapabilitiesService).toBe('function');
  });
});

/* ------------------------------------------------------------------ */
/*  Route registration test                                            */
/* ------------------------------------------------------------------ */
describe('Gemma 4 route registration', () => {
  const routePath = path.resolve(__dirname, '../routes/admin/gemma4.ts');
  let routeSrc: string;

  beforeAll(() => {
    routeSrc = fs.readFileSync(routePath, 'utf-8');
  });

  it('exports registerGemma4Routes', () => {
    expect(routeSrc).toContain('export async function registerGemma4Routes');
  });

  it('registers Model Selection endpoints (6.1)', () => {
    expect(routeSrc).toContain("'/gemma4/models/seed'");
    expect(routeSrc).toContain("'/gemma4/models/defaults'");
    expect(routeSrc).toContain("'/gemma4/models'");
    expect(routeSrc).toContain("'/gemma4/models/select/:platform'");
  });

  it('registers Smart Routing endpoints (6.4)', () => {
    expect(routeSrc).toContain("'/gemma4/routing/policy'");
    expect(routeSrc).toContain("'/gemma4/routing/route'");
    expect(routeSrc).toContain("'/gemma4/routing/stats'");
  });

  it('registers On-Device Memory Sync endpoints (6.5)', () => {
    expect(routeSrc).toContain("'/gemma4/memory/devices'");
    expect(routeSrc).toContain("'/gemma4/memory/devices/:deviceId/manifest'");
    expect(routeSrc).toContain("'/gemma4/memory/devices/:deviceId/delta'");
    expect(routeSrc).toContain("'/gemma4/memory/devices/:deviceId/upload'");
    expect(routeSrc).toContain("'/gemma4/memory/devices/:deviceId/ack'");
    expect(routeSrc).toContain("'/gemma4/memory/sync-history'");
    expect(routeSrc).toContain("'/gemma4/memory/sync-stats'");
  });

  it('registers Community Bridge endpoints (6.6)', () => {
    expect(routeSrc).toContain("'/gemma4/bridge/config'");
    expect(routeSrc).toContain("'/gemma4/bridge/actions'");
    expect(routeSrc).toContain("'/gemma4/bridge/events'");
    expect(routeSrc).toContain("'/gemma4/bridge/stats'");
  });

  it('registers Module System endpoints (6.7+6.8)', () => {
    expect(routeSrc).toContain("'/gemma4/modules'");
    expect(routeSrc).toContain("'/gemma4/modules/recommend'");
    expect(routeSrc).toContain("'/gemma4/modules/:moduleId/install'");
    expect(routeSrc).toContain("'/gemma4/modules/:moduleId/progress'");
    expect(routeSrc).toContain("'/gemma4/modules/installed'");
    expect(routeSrc).toContain("'/gemma4/modules/stats'");
  });

  it('registers Privacy Isolation endpoints (6.11+6.13)', () => {
    expect(routeSrc).toContain("'/gemma4/privacy/policy'");
    expect(routeSrc).toContain("'/gemma4/privacy/check-outbound'");
    expect(routeSrc).toContain("'/gemma4/privacy/verify'");
    expect(routeSrc).toContain("'/gemma4/privacy/blocked-domains'");
    expect(routeSrc).toContain("'/gemma4/privacy/audit-stats'");
  });

  it('registers Capabilities endpoints (6.10+6.17)', () => {
    expect(routeSrc).toContain("'/gemma4/capabilities/seed'");
    expect(routeSrc).toContain("'/gemma4/capabilities'");
    expect(routeSrc).toContain("'/gemma4/capabilities/:capabilityId/toggle'");
    expect(routeSrc).toContain("'/gemma4/capabilities/:capabilityId/config'");
    expect(routeSrc).toContain("'/gemma4/capabilities/native'");
    expect(routeSrc).toContain("'/gemma4/capabilities/formats'");
    expect(routeSrc).toContain("'/gemma4/models/custom'");
  });

  it('imports all 7 Gemma 4 services', () => {
    expect(routeSrc).toContain('ModelSelectionService');
    expect(routeSrc).toContain('SmartRoutingService');
    expect(routeSrc).toContain('OnDeviceMemoryService');
    expect(routeSrc).toContain('CommunityBridgeService');
    expect(routeSrc).toContain('ModuleSystemService');
    expect(routeSrc).toContain('PrivacyIsolationService');
    expect(routeSrc).toContain('GemmaCapabilitiesService');
  });
});

/* ------------------------------------------------------------------ */
/*  Admin index registration test                                      */
/* ------------------------------------------------------------------ */
describe('Gemma 4 admin index registration', () => {
  const indexPath = path.resolve(__dirname, '../routes/admin/index.ts');
  let indexSrc: string;

  beforeAll(() => {
    indexSrc = fs.readFileSync(indexPath, 'utf-8');
  });

  it('imports registerGemma4Routes', () => {
    expect(indexSrc).toContain("import { registerGemma4Routes } from './gemma4.js'");
  });

  it('registers gemma4 routes via mountAdminRoutes', () => {
    expect(indexSrc).toContain('registerGemma4Routes(scopedApp)');
  });
});

/* ------------------------------------------------------------------ */
/*  Domain logic tests                                                 */
/* ------------------------------------------------------------------ */
describe('ModelSelectionService defaults', () => {
  it('provides defaults for all 5 platform types', () => {
    const mod = require('../services/ModelSelectionService');
    const defaults = mod.ModelSelectionService.getDefaults();
    expect(defaults).toHaveProperty('flutter_mobile');
    expect(defaults).toHaveProperty('tauri_desktop');
    expect(defaults).toHaveProperty('server');
    expect(defaults).toHaveProperty('web');
    expect(defaults).toHaveProperty('cli');
  });

  it('uses Gemma 2B for flutter mobile (resource constrained)', () => {
    const mod = require('../services/ModelSelectionService');
    const defaults = mod.ModelSelectionService.getDefaults();
    expect(defaults.flutter_mobile.parameter_count).toMatch(/2B/i);
  });

  it('uses 27B MoE for server (maximum capability)', () => {
    const mod = require('../services/ModelSelectionService');
    const defaults = mod.ModelSelectionService.getDefaults();
    expect(defaults.server.parameter_count).toMatch(/27B/i);
  });
});

describe('SmartRoutingService complexity estimation', () => {
  it('classifies short prompts as simple', () => {
    const mod = require('../services/SmartRoutingService');
    const svc = new mod.SmartRoutingService({} as any);
    const result = svc.estimateComplexity('hello world');
    expect(result).toBe('simple');
  });

  it('escalates prompts with complex keywords', () => {
    const mod = require('../services/SmartRoutingService');
    const svc = new mod.SmartRoutingService({} as any);
    const result = svc.estimateComplexity('analyze the codebase and refactor the architecture');
    expect(result).toBe('complex');
  });
});

describe('GemmaCapabilitiesService static methods', () => {
  it('lists 12 native capabilities', () => {
    const mod = require('../services/GemmaCapabilitiesService');
    const caps = mod.GemmaCapabilitiesService.getNativeCapabilities();
    expect(caps.length).toBe(12);
    expect(caps).toContain('function_calling');
    expect(caps).toContain('vision');
    expect(caps).toContain('device_control');
  });

  it('lists supported model formats', () => {
    const mod = require('../services/GemmaCapabilitiesService');
    const formats = mod.GemmaCapabilitiesService.getSupportedFormats();
    expect(formats).toContain('gguf');
    expect(formats).toContain('safetensors');
    expect(formats).toContain('onnx');
    expect(formats).toContain('tflite');
    expect(formats).toContain('mediapipe');
  });
});

describe('PrivacyIsolationService blocked domains', () => {
  it('blocks known Google telemetry domains', () => {
    const mod = require('../services/PrivacyIsolationService');
    const svc = new mod.PrivacyIsolationService({} as any);
    const domains = svc.getBlockedDomains();
    expect(domains.length).toBeGreaterThanOrEqual(5);
    expect(domains).toContain('play.googleapis.com');
  });
});
