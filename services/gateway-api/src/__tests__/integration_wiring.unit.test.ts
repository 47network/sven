// ═══════════════════════════════════════════════════════════════════════════
// integration_wiring.unit.test.ts — Verifies Flutter DI, providers, router,
// and gateway route registration are correctly wired for all features.
// ═══════════════════════════════════════════════════════════════════════════

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

function readFile(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf-8');
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. Flutter Service Locator (DI registration)
// ═══════════════════════════════════════════════════════════════════════════

describe('Flutter Service Locator (service_locator.dart)', () => {
  const filePath = 'apps/companion-user-flutter/lib/app/service_locator.dart';

  test('imports BrainService', () => {
    const content = readFile(filePath);
    expect(content).toContain("import '../features/brain/brain_service.dart'");
  });

  test('imports OnDeviceInferenceService', () => {
    const content = readFile(filePath);
    expect(content).toContain("import '../features/inference/on_device_inference_service.dart'");
  });

  test('registers BrainService as lazy singleton', () => {
    const content = readFile(filePath);
    expect(content).toContain('sl.isRegistered<BrainService>()');
    expect(content).toContain('sl.registerLazySingleton<BrainService>');
    expect(content).toContain('BrainService(client: sl<AuthenticatedClient>())');
  });

  test('registers OnDeviceInferenceService as lazy singleton', () => {
    const content = readFile(filePath);
    expect(content).toContain('sl.isRegistered<OnDeviceInferenceService>()');
    expect(content).toContain('sl.registerLazySingleton<OnDeviceInferenceService>');
    expect(content).toContain('OnDeviceInferenceService(client: sl<AuthenticatedClient>())');
  });

  test('BrainService registration comes after AuthenticatedClient', () => {
    const content = readFile(filePath);
    const authClientPos = content.indexOf('sl.registerLazySingleton<AuthenticatedClient>');
    const brainPos = content.indexOf('sl.registerLazySingleton<BrainService>');
    expect(authClientPos).toBeGreaterThan(-1);
    expect(brainPos).toBeGreaterThan(authClientPos);
  });

  test('OnDeviceInferenceService registration comes after AuthenticatedClient', () => {
    const content = readFile(filePath);
    const authClientPos = content.indexOf('sl.registerLazySingleton<AuthenticatedClient>');
    const inferencePos = content.indexOf('sl.registerLazySingleton<OnDeviceInferenceService>');
    expect(authClientPos).toBeGreaterThan(-1);
    expect(inferencePos).toBeGreaterThan(authClientPos);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. Flutter Providers (Riverpod bridge)
// ═══════════════════════════════════════════════════════════════════════════

describe('Flutter Providers (providers.dart)', () => {
  const filePath = 'apps/companion-user-flutter/lib/app/providers.dart';

  test('imports BrainService', () => {
    const content = readFile(filePath);
    expect(content).toContain("import '../features/brain/brain_service.dart'");
  });

  test('imports OnDeviceInferenceService', () => {
    const content = readFile(filePath);
    expect(content).toContain("import '../features/inference/on_device_inference_service.dart'");
  });

  test('defines brainServiceProvider as ChangeNotifierProvider', () => {
    const content = readFile(filePath);
    expect(content).toContain('final brainServiceProvider = ChangeNotifierProvider<BrainService>');
  });

  test('brainServiceProvider uses StateError pattern', () => {
    const content = readFile(filePath);
    const brainProviderSection = content.slice(content.indexOf('brainServiceProvider'));
    expect(brainProviderSection).toContain('brainServiceProvider must be overridden');
  });

  test('defines inferenceServiceProvider as ChangeNotifierProvider', () => {
    const content = readFile(filePath);
    expect(content).toContain('final inferenceServiceProvider = ChangeNotifierProvider<OnDeviceInferenceService>');
  });

  test('inferenceServiceProvider uses StateError pattern', () => {
    const content = readFile(filePath);
    const inferenceProviderSection = content.slice(content.indexOf('inferenceServiceProvider'));
    expect(inferenceProviderSection).toContain('inferenceServiceProvider must be overridden');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. Flutter Router (GoRouter route definitions)
// ═══════════════════════════════════════════════════════════════════════════

describe('Flutter Router (router.dart)', () => {
  const filePath = 'apps/companion-user-flutter/lib/app/router.dart';

  test('defines appRouteHomeBrain constant', () => {
    const content = readFile(filePath);
    expect(content).toContain("const appRouteHomeBrain = '/home/brain'");
  });

  test('defines appRouteHomeInference constant', () => {
    const content = readFile(filePath);
    expect(content).toContain("const appRouteHomeInference = '/home/inference'");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. Flutter SvenUserApp (GoRoute entries + ProviderScope overrides)
// ═══════════════════════════════════════════════════════════════════════════

describe('Flutter SvenUserApp (sven_user_app.dart)', () => {
  const filePath = 'apps/companion-user-flutter/lib/app/sven_user_app.dart';

  test('imports BrainPage', () => {
    const content = readFile(filePath);
    expect(content).toContain("import '../features/brain/brain_page.dart'");
  });

  test('imports BrainService', () => {
    const content = readFile(filePath);
    expect(content).toContain("import '../features/brain/brain_service.dart'");
  });

  test('imports InferencePage', () => {
    const content = readFile(filePath);
    expect(content).toContain("import '../features/inference/inference_page.dart'");
  });

  test('imports OnDeviceInferenceService', () => {
    const content = readFile(filePath);
    expect(content).toContain("import '../features/inference/on_device_inference_service.dart'");
  });

  test('declares _brainService field', () => {
    const content = readFile(filePath);
    expect(content).toContain('late final BrainService _brainService');
  });

  test('declares _inferenceService field', () => {
    const content = readFile(filePath);
    expect(content).toContain('late final OnDeviceInferenceService _inferenceService');
  });

  test('creates BrainService with _authClient', () => {
    const content = readFile(filePath);
    expect(content).toContain('_brainService = BrainService(client: _authClient)');
  });

  test('creates OnDeviceInferenceService with _authClient', () => {
    const content = readFile(filePath);
    expect(content).toContain('_inferenceService = OnDeviceInferenceService(client: _authClient)');
  });

  test('has GoRoute for brain page', () => {
    const content = readFile(filePath);
    expect(content).toContain("path: 'brain'");
    expect(content).toContain('BrainPage(brainService: _brainService)');
  });

  test('has GoRoute for inference page', () => {
    const content = readFile(filePath);
    expect(content).toContain("path: 'inference'");
    expect(content).toContain('InferencePage(inferenceService: _inferenceService)');
  });

  test('brainServiceProvider override in ProviderScope', () => {
    const content = readFile(filePath);
    expect(content).toContain('brainServiceProvider.overrideWith((ref) => _brainService)');
  });

  test('inferenceServiceProvider override in ProviderScope', () => {
    const content = readFile(filePath);
    expect(content).toContain('inferenceServiceProvider.overrideWith((ref) => _inferenceService)');
  });

  test('brain route is a child of home route', () => {
    const content = readFile(filePath);
    const homeRouteIdx = content.indexOf("path: appRouteHome");
    const brainRouteIdx = content.indexOf("path: 'brain'");
    expect(homeRouteIdx).toBeGreaterThan(-1);
    expect(brainRouteIdx).toBeGreaterThan(homeRouteIdx);
  });

  test('inference route is a child of home route', () => {
    const content = readFile(filePath);
    const homeRouteIdx = content.indexOf("path: appRouteHome");
    const inferenceRouteIdx = content.indexOf("path: 'inference'");
    expect(homeRouteIdx).toBeGreaterThan(-1);
    expect(inferenceRouteIdx).toBeGreaterThan(homeRouteIdx);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. Gateway API — admin route registration
// ═══════════════════════════════════════════════════════════════════════════

describe('Gateway API admin route registration', () => {
  const indexPath = 'services/gateway-api/src/routes/admin/index.ts';

  test('imports registerBrainRoutes', () => {
    const content = readFile(indexPath);
    expect(content).toContain("import { registerBrainRoutes } from './brain.js'");
  });

  test('imports registerGemma4Routes', () => {
    const content = readFile(indexPath);
    expect(content).toContain("import { registerGemma4Routes } from './gemma4.js'");
  });

  test('imports registerPipelineRoutes', () => {
    const content = readFile(indexPath);
    expect(content).toContain("import { registerPipelineRoutes } from './pipeline.js'");
  });

  test('mounts brain routes', () => {
    const content = readFile(indexPath);
    expect(content).toContain('registerBrainRoutes(scopedApp, pool)');
  });

  test('mounts gemma4 routes', () => {
    const content = readFile(indexPath);
    expect(content).toContain('registerGemma4Routes(scopedApp)');
  });

  test('mounts pipeline routes', () => {
    const content = readFile(indexPath);
    expect(content).toContain('registerPipelineRoutes(scopedApp)');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. Gateway API — route files exist and export correctly
// ═══════════════════════════════════════════════════════════════════════════

describe('Gateway API route files', () => {
  test('brain.ts exists and exports registerBrainRoutes', () => {
    const content = readFile('services/gateway-api/src/routes/admin/brain.ts');
    expect(content).toContain('export async function registerBrainRoutes');
  });

  test('gemma4.ts exists and exports registerGemma4Routes', () => {
    const content = readFile('services/gateway-api/src/routes/admin/gemma4.ts');
    expect(content).toContain('export async function registerGemma4Routes');
  });

  test('pipeline.ts exists and exports registerPipelineRoutes', () => {
    const content = readFile('services/gateway-api/src/routes/admin/pipeline.ts');
    expect(content).toContain('export async function registerPipelineRoutes');
  });

  test('brain.ts has /brain/graph endpoint', () => {
    const content = readFile('services/gateway-api/src/routes/admin/brain.ts');
    expect(content).toContain('/brain/graph');
  });

  test('gemma4.ts has model management endpoints', () => {
    const content = readFile('services/gateway-api/src/routes/admin/gemma4.ts');
    expect(content).toContain('/gemma4/models');
  });

  test('pipeline.ts has image processing endpoints', () => {
    const content = readFile('services/gateway-api/src/routes/admin/pipeline.ts');
    expect(content).toContain('/pipeline/image');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 7. Cross-cutting: no broken references
// ═══════════════════════════════════════════════════════════════════════════

describe('Cross-cutting integration', () => {
  test('service_locator has 9 service registrations', () => {
    const content = readFile('apps/companion-user-flutter/lib/app/service_locator.dart');
    const registrations = content.match(/sl\.registerLazySingleton/g);
    expect(registrations).not.toBeNull();
    // DbEncryption, AppDatabase, MessagesRepository, DioHttpClient, TokenStore,
    // AuthService, AuthenticatedClient, FeatureFlagService, AbTestService,
    // MemoryService, VoiceService, BrainService, OnDeviceInferenceService
    expect(registrations!.length).toBeGreaterThanOrEqual(13);
  });

  test('providers.dart has brain + inference providers after sync provider', () => {
    const content = readFile('apps/companion-user-flutter/lib/app/providers.dart');
    const syncPos = content.indexOf('syncServiceProvider');
    const brainPos = content.indexOf('brainServiceProvider');
    const inferencePos = content.indexOf('inferenceServiceProvider');
    expect(brainPos).toBeGreaterThan(syncPos);
    expect(inferencePos).toBeGreaterThan(brainPos);
  });

  test('sven_user_app.dart creates services before router', () => {
    const content = readFile('apps/companion-user-flutter/lib/app/sven_user_app.dart');
    const brainCreatePos = content.indexOf('_brainService = BrainService');
    const routerCreatePos = content.indexOf('_router = _buildRouter()');
    expect(brainCreatePos).toBeGreaterThan(-1);
    expect(routerCreatePos).toBeGreaterThan(brainCreatePos);
  });

  test('no broken imports in modified files', () => {
    // Verify all import paths resolve to existing files
    const serviceLocator = readFile('apps/companion-user-flutter/lib/app/service_locator.dart');
    const providers = readFile('apps/companion-user-flutter/lib/app/providers.dart');
    const svenUserApp = readFile('apps/companion-user-flutter/lib/app/sven_user_app.dart');

    // All imported feature files should exist
    expect(fs.existsSync(path.join(ROOT, 'apps/companion-user-flutter/lib/features/brain/brain_service.dart'))).toBe(true);
    expect(fs.existsSync(path.join(ROOT, 'apps/companion-user-flutter/lib/features/brain/brain_page.dart'))).toBe(true);
    expect(fs.existsSync(path.join(ROOT, 'apps/companion-user-flutter/lib/features/inference/on_device_inference_service.dart'))).toBe(true);
    expect(fs.existsSync(path.join(ROOT, 'apps/companion-user-flutter/lib/features/inference/inference_page.dart'))).toBe(true);

    // Verify the imports are present
    expect(serviceLocator).toContain('brain_service.dart');
    expect(serviceLocator).toContain('on_device_inference_service.dart');
    expect(providers).toContain('brain_service.dart');
    expect(providers).toContain('on_device_inference_service.dart');
    expect(svenUserApp).toContain('brain_page.dart');
    expect(svenUserApp).toContain('inference_page.dart');
  });
});
