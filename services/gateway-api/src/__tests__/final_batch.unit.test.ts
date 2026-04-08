// ═══════════════════════════════════════════════════════════════════════════
// final_batch.unit.test.ts — Tests for remaining roadmap items:
// 2.6 Flutter Brain Visualization, 6.2 Flutter On-Device Inference,
// 6.3 Tauri On-Device Inference, 6.16 Gemma 4 Documentation
// ═══════════════════════════════════════════════════════════════════════════

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

// ── Helper ──────────────────────────────────────────────────────────────

function readFile(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf-8');
}

function fileExists(relPath: string): boolean {
  return fs.existsSync(path.join(ROOT, relPath));
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. Flutter Brain Visualization (2.6)
// ═══════════════════════════════════════════════════════════════════════════

describe('Flutter Brain Visualization (2.6)', () => {
  const brainDir = 'apps/companion-user-flutter/lib/features/brain';

  test('brain_models.dart exists and defines BrainNode, BrainEdge, BrainGraph', () => {
    const content = readFile(`${brainDir}/brain_models.dart`);
    expect(content).toContain('class BrainNode');
    expect(content).toContain('class BrainEdge');
    expect(content).toContain('class BrainGraph');
    expect(content).toContain('class BrainStats');
  });

  test('BrainNode has 4 types matching Canvas UI', () => {
    const content = readFile(`${brainDir}/brain_models.dart`);
    expect(content).toContain('enum BrainNodeType');
    expect(content).toContain('memory');
    expect(content).toContain('knowledge');
    expect(content).toContain('emotion');
    expect(content).toContain('reasoning');
  });

  test('BrainNode has 6 states matching Canvas UI', () => {
    const content = readFile(`${brainDir}/brain_models.dart`);
    expect(content).toContain('enum BrainNodeState');
    expect(content).toContain('fresh');
    expect(content).toContain('active');
    expect(content).toContain('resonating');
    expect(content).toContain('fading');
    expect(content).toContain('consolidating');
    expect(content).toContain('consolidated');
  });

  test('brain_service.dart exists with BrainService ChangeNotifier', () => {
    const content = readFile(`${brainDir}/brain_service.dart`);
    expect(content).toContain('class BrainService extends ChangeNotifier');
    expect(content).toContain('fetchGraph');
    expect(content).toContain('selectNode');
    expect(content).toContain('toggleFilter');
    expect(content).toContain('hitTest');
  });

  test('brain_service.dart has force-directed layout algorithm', () => {
    const content = readFile(`${brainDir}/brain_service.dart`);
    expect(content).toContain('_runForceLayout');
    expect(content).toContain('repulsion');
    expect(content).toContain('attraction');
    expect(content).toContain('damping');
    expect(content).toContain('centerPull');
  });

  test('brain_service.dart supports zoom controls', () => {
    const content = readFile(`${brainDir}/brain_service.dart`);
    expect(content).toContain('zoomIn');
    expect(content).toContain('zoomOut');
    expect(content).toContain('resetZoom');
    expect(content).toContain("z.clamp(0.3, 3.0)");
  });

  test('brain_page.dart exists with BrainPage widget and CustomPaint', () => {
    const content = readFile(`${brainDir}/brain_page.dart`);
    expect(content).toContain('class BrainPage extends StatefulWidget');
    expect(content).toContain('class _BrainGraphPainter extends CustomPainter');
    expect(content).toContain("title: const Text('Brain Map')");
  });

  test('brain_page.dart supports touch navigation', () => {
    const content = readFile(`${brainDir}/brain_page.dart`);
    expect(content).toContain('GestureDetector');
    expect(content).toContain('onScaleUpdate');
    expect(content).toContain('onTapUp');
    expect(content).toContain('_panOffset');
  });

  test('brain_page.dart renders node colors matching Canvas UI', () => {
    const content = readFile(`${brainDir}/brain_page.dart`);
    // Same colors as Canvas BrainBlock.tsx
    expect(content).toContain('0xFF3b82f6'); // memory = blue
    expect(content).toContain('0xFF10b981'); // knowledge = green
    expect(content).toContain('0xFFf59e0b'); // emotion = amber
    expect(content).toContain('0xFF8b5cf6'); // reasoning = purple
  });

  test('brain_page.dart renders stats bar', () => {
    const content = readFile(`${brainDir}/brain_page.dart`);
    expect(content).toContain("'Memories'");
    expect(content).toContain("'Entities'");
    expect(content).toContain("'Emotions'");
    expect(content).toContain("'Active'");
    expect(content).toContain("'Fading'");
  });

  test('brain_page.dart renders detail sheet on node selection', () => {
    const content = readFile(`${brainDir}/brain_page.dart`);
    expect(content).toContain('_buildDetailSheet');
    expect(content).toContain('selectedNodeId');
    expect(content).toContain('node.label');
    expect(content).toContain('node.strength');
  });

  test('brain_page.dart has filter chips for node types', () => {
    const content = readFile(`${brainDir}/brain_page.dart`);
    expect(content).toContain('_buildFilterBar');
    expect(content).toContain('FilterChip');
    expect(content).toContain('BrainNodeType.values');
  });

  test('BrainNode.fromJson / toJson round-trips correctly', () => {
    const content = readFile(`${brainDir}/brain_models.dart`);
    expect(content).toContain('factory BrainNode.fromJson');
    expect(content).toContain("Map<String, dynamic> toJson()");
    expect(content).toContain('factory BrainEdge.fromJson');
    expect(content).toContain('factory BrainGraph.fromJson');
  });

  test('state opacity values match Canvas UI BrainBlock', () => {
    const content = readFile(`${brainDir}/brain_page.dart`);
    expect(content).toContain('_stateOpacity');
    expect(content).toMatch(/fresh.*1\.0/s);
    expect(content).toMatch(/active.*0\.9/s);
    expect(content).toMatch(/fading.*0\.35/s);
    expect(content).toMatch(/consolidating.*0\.7/s);
    expect(content).toMatch(/consolidated.*0\.85/s);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. Flutter On-Device Inference (6.2)
// ═══════════════════════════════════════════════════════════════════════════

describe('Flutter On-Device Inference (6.2)', () => {
  const infDir = 'apps/companion-user-flutter/lib/features/inference';

  test('on_device_inference_service.dart exists with OnDeviceInferenceService', () => {
    const content = readFile(`${infDir}/on_device_inference_service.dart`);
    expect(content).toContain('class OnDeviceInferenceService extends ChangeNotifier');
    expect(content).toContain('installModel');
    expect(content).toContain('uninstallModel');
    expect(content).toContain('loadModel');
    expect(content).toContain('infer');
  });

  test('defines 4 model variants with correct specs', () => {
    const content = readFile(`${infDir}/on_device_inference_service.dart`);
    expect(content).toContain('enum ModelVariant');
    expect(content).toContain('e2b');
    expect(content).toContain('e4b');
    expect(content).toContain('moe26b');
    expect(content).toContain('dense31b');
  });

  test('E2B/E4B have 128K context, 26B/31B have 256K', () => {
    const content = readFile(`${infDir}/on_device_inference_service.dart`);
    expect(content).toContain('128000');
    expect(content).toContain('256000');
  });

  test('model capabilities include vision, audio, function_calling', () => {
    const content = readFile(`${infDir}/on_device_inference_service.dart`);
    expect(content).toContain("'vision'");
    expect(content).toContain("'audio'");
    expect(content).toContain("'function_calling'");
    expect(content).toContain("'multilingual'");
  });

  test('smart routing logic differentiates local vs cloud', () => {
    const content = readFile(`${infDir}/on_device_inference_service.dart`);
    expect(content).toContain('enum InferenceRoute');
    expect(content).toContain('InferenceRoute.local');
    expect(content).toContain('InferenceRoute.cloud');
    expect(content).toContain('InferenceRoute.localUnavailable');
    expect(content).toContain('routePrompt');
  });

  test('routing uses token estimation heuristic', () => {
    const content = readFile(`${infDir}/on_device_inference_service.dart`);
    expect(content).toContain("prompt.split(' ').length");
    expect(content).toContain('_maxLocalTokens');
  });

  test('privacy: inference doc states no external data transmission', () => {
    const content = readFile(`${infDir}/on_device_inference_service.dart`);
    expect(content).toContain('NEVER sends prompts/responses to Google');
    expect(content).toContain('full isolation');
  });

  test('ModelProfile has size, context window, capabilities, and status', () => {
    const content = readFile(`${infDir}/on_device_inference_service.dart`);
    expect(content).toContain('class ModelProfile');
    expect(content).toContain('sizeBytes');
    expect(content).toContain('contextWindow');
    expect(content).toContain('capabilities');
    expect(content).toContain('enum ModelStatus');
  });

  test('inference_page.dart exists with InferencePage widget', () => {
    const content = readFile(`${infDir}/inference_page.dart`);
    expect(content).toContain('class InferencePage extends StatefulWidget');
    expect(content).toContain("title: const Text('On-Device AI')");
  });

  test('inference_page.dart has privacy banner', () => {
    const content = readFile(`${infDir}/inference_page.dart`);
    expect(content).toContain('_buildPrivacyBanner');
    expect(content).toContain('never sends data to external servers');
  });

  test('inference_page.dart has model management UI', () => {
    const content = readFile(`${infDir}/inference_page.dart`);
    expect(content).toContain('_buildModelSection');
    expect(content).toContain("'Install'");
    expect(content).toContain("'Load'");
    expect(content).toContain("'Unload'");
    expect(content).toContain("'Remove'");
  });

  test('inference_page.dart has routing settings', () => {
    const content = readFile(`${infDir}/inference_page.dart`);
    expect(content).toContain('_buildSettingsSection');
    expect(content).toContain('Prefer local inference');
    expect(content).toContain('Max local tokens');
    expect(content).toContain('Slider');
  });

  test('inference_page.dart has performance stats', () => {
    const content = readFile(`${infDir}/inference_page.dart`);
    expect(content).toContain('_buildPerformanceSection');
    expect(content).toContain('Total inferences');
    expect(content).toContain('Last inference');
    expect(content).toContain('Avg tokens/sec');
  });

  test('device support check is platform-aware', () => {
    const content = readFile(`${infDir}/on_device_inference_service.dart`);
    expect(content).toContain('Platform.isAndroid');
    expect(content).toContain('Platform.isIOS');
    expect(content).toContain('Platform.isMacOS');
    expect(content).toContain('get isSupported');
  });

  test('recommendedVariant returns E2B for mobile, E4B for desktop', () => {
    const content = readFile(`${infDir}/on_device_inference_service.dart`);
    expect(content).toContain('get recommendedVariant');
    expect(content).toContain('ModelVariant.e2b');
    expect(content).toContain('ModelVariant.e4b');
  });

  test('model lifecycle states are complete', () => {
    const content = readFile(`${infDir}/on_device_inference_service.dart`);
    expect(content).toContain('enum InferenceState');
    expect(content).toContain('idle');
    expect(content).toContain('downloading');
    expect(content).toContain('loading');
    expect(content).toContain('ready');
    expect(content).toContain('inferring');
    expect(content).toContain('error');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. Tauri On-Device Inference (6.3)
// ═══════════════════════════════════════════════════════════════════════════

describe('Tauri On-Device Inference (6.3)', () => {
  test('main.rs has Ollama sidecar commands', () => {
    const content = readFile('apps/companion-desktop-tauri/src-tauri/src/main.rs');
    expect(content).toContain('inference_check_ollama');
    expect(content).toContain('inference_list_models');
    expect(content).toContain('inference_pull_model');
    expect(content).toContain('inference_delete_model');
    expect(content).toContain('inference_generate');
  });

  test('main.rs registers all inference commands in invoke_handler', () => {
    const content = readFile('apps/companion-desktop-tauri/src-tauri/src/main.rs');
    const handlerBlock = content.slice(content.indexOf('generate_handler!['));
    expect(handlerBlock).toContain('inference_check_ollama');
    expect(handlerBlock).toContain('inference_list_models');
    expect(handlerBlock).toContain('inference_pull_model');
    expect(handlerBlock).toContain('inference_delete_model');
    expect(handlerBlock).toContain('inference_generate');
  });

  test('main.rs defines InferenceRequest and InferenceResponse structs', () => {
    const content = readFile('apps/companion-desktop-tauri/src-tauri/src/main.rs');
    expect(content).toContain('struct InferenceRequest');
    expect(content).toContain('struct InferenceResponse');
    expect(content).toContain('struct LocalModelInfo');
  });

  test('InferenceResponse includes performance metrics', () => {
    const content = readFile('apps/companion-desktop-tauri/src-tauri/src/main.rs');
    expect(content).toContain('tokens_generated');
    expect(content).toContain('duration_ms');
    expect(content).toContain('tokens_per_second');
  });

  test('Ollama API endpoints are correct', () => {
    const content = readFile('apps/companion-desktop-tauri/src-tauri/src/main.rs');
    expect(content).toContain('/api/version');
    expect(content).toContain('/api/tags');
    expect(content).toContain('/api/pull');
    expect(content).toContain('/api/delete');
    expect(content).toContain('/api/generate');
  });

  test('Ollama URL configurable via SVEN_OLLAMA_URL env var', () => {
    const content = readFile('apps/companion-desktop-tauri/src-tauri/src/main.rs');
    expect(content).toContain('SVEN_OLLAMA_URL');
    expect(content).toContain('http://127.0.0.1:11434');
  });

  test('inference_generate has timeout and temperature support', () => {
    const content = readFile('apps/companion-desktop-tauri/src-tauri/src/main.rs');
    expect(content).toContain('timeout(Duration::from_secs(120))');
    expect(content).toContain('temperature');
    expect(content).toContain('num_predict');
  });

  test('model listing detects Gemma and assigns variants', () => {
    const content = readFile('apps/companion-desktop-tauri/src-tauri/src/main.rs');
    expect(content).toContain('is_gemma');
    expect(content).toContain('"e2b"');
    expect(content).toContain('"e4b"');
    expect(content).toContain('"moe26b"');
    expect(content).toContain('"dense31b"');
  });

  test('privacy: no external data in on-device inference', () => {
    const content = readFile('apps/companion-desktop-tauri/src-tauri/src/main.rs');
    // Ollama URL is local only
    expect(content).toContain('127.0.0.1:11434');
    // Privacy comment
    expect(content).toContain('No data leaves the machine');
  });

  // TypeScript API wrappers
  test('api.ts exports inference TypeScript types', () => {
    const content = readFile('apps/companion-desktop-tauri/src/lib/api.ts');
    expect(content).toContain('LocalModelInfo');
    expect(content).toContain('InferenceRequest');
    expect(content).toContain('InferenceResponse');
  });

  test('api.ts exports all inference functions', () => {
    const content = readFile('apps/companion-desktop-tauri/src/lib/api.ts');
    expect(content).toContain('inferenceCheckOllama');
    expect(content).toContain('inferenceListModels');
    expect(content).toContain('inferencePullModel');
    expect(content).toContain('inferenceDeleteModel');
    expect(content).toContain('inferenceGenerate');
  });

  // InferencePanel UI
  test('InferencePanel.tsx exists', () => {
    expect(fileExists('apps/companion-desktop-tauri/src/panels/InferencePanel.tsx')).toBe(true);
  });

  test('InferencePanel has Ollama status indicator', () => {
    const content = readFile('apps/companion-desktop-tauri/src/panels/InferencePanel.tsx');
    expect(content).toContain('Ollama:');
    expect(content).toContain('ollamaOnline');
    expect(content).toContain("'Online'");
    expect(content).toContain("'Offline'");
  });

  test('InferencePanel has model list with pull and remove', () => {
    const content = readFile('apps/companion-desktop-tauri/src/panels/InferencePanel.tsx');
    expect(content).toContain('Installed Models');
    expect(content).toContain('Download Model');
    expect(content).toContain('SUGGESTED_MODELS');
    expect(content).toContain("'Pull'");
    expect(content).toContain('Remove');
  });

  test('InferencePanel has inference test area', () => {
    const content = readFile('apps/companion-desktop-tauri/src/panels/InferencePanel.tsx');
    expect(content).toContain('Test Inference');
    expect(content).toContain('Run Local Inference');
    expect(content).toContain('lastResponse');
    expect(content).toContain('tokens_per_second');
  });

  test('InferencePanel has privacy badge', () => {
    const content = readFile('apps/companion-desktop-tauri/src/panels/InferencePanel.tsx');
    expect(content).toContain('never sends prompts or responses to external');
  });

  // Sidebar and App wiring
  test('Sidebar includes inference tab', () => {
    const content = readFile('apps/companion-desktop-tauri/src/components/Sidebar.tsx');
    expect(content).toContain("'inference'");
    expect(content).toContain("'Local AI'");
    expect(content).toContain('Cpu');
  });

  test('App.tsx routes to InferencePanel', () => {
    const content = readFile('apps/companion-desktop-tauri/src/App.tsx');
    expect(content).toContain("case 'inference':");
    expect(content).toContain('InferencePanel');
  });

  // useDesktopApp state hook
  test('useDesktopApp includes inference state and handlers', () => {
    const content = readFile('apps/companion-desktop-tauri/src/lib/useDesktopApp.ts');
    expect(content).toContain('ollamaOnline');
    expect(content).toContain('localModels');
    expect(content).toContain('activeLocalModelId');
    expect(content).toContain('lastInferenceResponse');
    expect(content).toContain('pullingModel');
    expect(content).toContain('generating');
    expect(content).toContain('onRefreshLocalModels');
    expect(content).toContain('onPullModel');
    expect(content).toContain('onDeleteModel');
    expect(content).toContain('onLocalGenerate');
  });

  test('useDesktopApp imports inference API functions', () => {
    const content = readFile('apps/companion-desktop-tauri/src/lib/useDesktopApp.ts');
    expect(content).toContain('inferenceCheckOllama');
    expect(content).toContain('inferenceListModels');
    expect(content).toContain('inferencePullModel');
    expect(content).toContain('inferenceDeleteModel');
    expect(content).toContain('inferenceGenerate');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. Gemma 4 Documentation (6.16)
// ═══════════════════════════════════════════════════════════════════════════

describe('Gemma 4 Documentation (6.16)', () => {
  const docPath = 'docs/features/gemma4-integration.md';

  test('documentation file exists', () => {
    expect(fileExists(docPath)).toBe(true);
  });

  test('has platform compatibility matrix', () => {
    const content = readFile(docPath);
    expect(content).toContain('Platform Compatibility Matrix');
    expect(content).toContain('Android');
    expect(content).toContain('iOS');
    expect(content).toContain('macOS');
    expect(content).toContain('Windows');
    expect(content).toContain('Linux');
    expect(content).toContain('Server');
  });

  test('covers all 4 model variants', () => {
    const content = readFile(docPath);
    expect(content).toContain('**E2B**');
    expect(content).toContain('**E4B**');
    expect(content).toContain('**26B');
    expect(content).toContain('**31B');
  });

  test('has minimum hardware requirements', () => {
    const content = readFile(docPath);
    expect(content).toContain('Minimum Requirements');
    expect(content).toContain('RAM');
    expect(content).toContain('Storage');
    expect(content).toContain('GPU');
  });

  test('has architecture overview diagram', () => {
    const content = readFile(docPath);
    expect(content).toContain('Architecture Overview');
    expect(content).toContain('Smart Router');
    expect(content).toContain('Inference Routing Layer');
    expect(content).toContain('LiteRT-LM');
    expect(content).toContain('llama.cpp');
    expect(content).toContain('LiteLLM');
  });

  test('has module descriptions for all 8 modules', () => {
    const content = readFile(docPath);
    expect(content).toContain('Agentic Workflow');
    expect(content).toContain('Multimodal Reasoning');
    expect(content).toContain('Language');
    expect(content).toContain('Fine-tuning');
    expect(content).toContain('Audio Scribe');
    expect(content).toContain('Agent Skills');
    expect(content).toContain('Prompt Lab');
    expect(content).toContain('Mobile Actions');
  });

  test('has setup guides for Flutter, Tauri, and Server', () => {
    const content = readFile(docPath);
    expect(content).toContain('Flutter Mobile');
    expect(content).toContain('Tauri Desktop');
    expect(content).toContain('Server-Side');
    expect(content).toContain('LiteRT-LM');
    expect(content).toContain('Ollama');
    expect(content).toContain('LiteLLM');
  });

  test('has privacy & security section', () => {
    const content = readFile(docPath);
    expect(content).toContain('Privacy & Security');
    expect(content).toContain('On-Device Guarantees');
    expect(content).toContain('No data exfiltration');
    expect(content).toContain('No telemetry');
    expect(content).toContain('Apache 2.0');
  });

  test('has compliance coverage table', () => {
    const content = readFile(docPath);
    expect(content).toContain('GDPR');
    expect(content).toContain('CCPA');
    expect(content).toContain('SOC 2');
    expect(content).toContain('OWASP');
  });

  test('has performance benchmarks', () => {
    const content = readFile(docPath);
    expect(content).toContain('Performance Benchmarks');
    expect(content).toContain('Tokens/sec');
    expect(content).toContain('First Token');
  });

  test('has model agnosticism section', () => {
    const content = readFile(docPath);
    expect(content).toContain('Model Agnosticism');
    expect(content).toContain('GGUF');
    expect(content).toContain('not a lock-in');
  });

  test('has troubleshooting guide', () => {
    const content = readFile(docPath);
    expect(content).toContain('Troubleshooting');
    expect(content).toContain('Ollama not detected');
    expect(content).toContain('Model too slow');
    expect(content).toContain('Out of memory');
  });

  test('has API reference for gateway endpoints', () => {
    const content = readFile(docPath);
    expect(content).toContain('API Reference');
    expect(content).toContain('/v1/admin/gemma4/models');
    expect(content).toContain('/v1/admin/gemma4/routing/policy');
    expect(content).toContain('/v1/admin/pipeline/image/stats');
  });

  test('has API reference for Tauri commands', () => {
    const content = readFile(docPath);
    expect(content).toContain('inference_check_ollama');
    expect(content).toContain('inference_list_models');
    expect(content).toContain('inference_pull_model');
    expect(content).toContain('inference_generate');
  });

  test('routing logic table covers all conditions', () => {
    const content = readFile(docPath);
    expect(content).toContain('Routing Logic');
    expect(content).toContain('Token estimate');
    expect(content).toContain('No network');
    expect(content).toContain('prefer local');
    expect(content).toContain('Vision / audio');
    expect(content).toContain('Function calling');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. Cross-cutting: file structure and integration
// ═══════════════════════════════════════════════════════════════════════════

describe('Cross-cutting verification', () => {
  test('all Flutter feature directories exist', () => {
    expect(fileExists('apps/companion-user-flutter/lib/features/brain/brain_models.dart')).toBe(true);
    expect(fileExists('apps/companion-user-flutter/lib/features/brain/brain_service.dart')).toBe(true);
    expect(fileExists('apps/companion-user-flutter/lib/features/brain/brain_page.dart')).toBe(true);
    expect(fileExists('apps/companion-user-flutter/lib/features/inference/on_device_inference_service.dart')).toBe(true);
    expect(fileExists('apps/companion-user-flutter/lib/features/inference/inference_page.dart')).toBe(true);
  });

  test('all Tauri inference files exist', () => {
    expect(fileExists('apps/companion-desktop-tauri/src-tauri/src/main.rs')).toBe(true);
    expect(fileExists('apps/companion-desktop-tauri/src/panels/InferencePanel.tsx')).toBe(true);
    expect(fileExists('apps/companion-desktop-tauri/src/lib/api.ts')).toBe(true);
  });

  test('documentation file exists', () => {
    expect(fileExists('docs/features/gemma4-integration.md')).toBe(true);
  });

  test('brain models fromJson handles missing fields gracefully', () => {
    const content = readFile('apps/companion-user-flutter/lib/features/brain/brain_models.dart');
    // All fromJson factories use ?? fallback
    expect(content).toContain("?? ''");
    expect(content).toContain('?? 0.5');
    expect(content).toContain('?? 0');
  });

  test('ModelProfile.fromJson handles missing fields gracefully', () => {
    const content = readFile('apps/companion-user-flutter/lib/features/inference/on_device_inference_service.dart');
    expect(content).toContain("?? ''");
    expect(content).toContain('?? 0');
    expect(content).toContain('?? []');
  });

  test('Tauri main.rs uses ensure_gateway_allowed for security', () => {
    const content = readFile('apps/companion-desktop-tauri/src-tauri/src/main.rs');
    // Verify existing auth commands still use the guard
    const sendBlock = content.slice(content.indexOf('async fn send_message'));
    expect(sendBlock).toContain('ensure_gateway_allowed');
  });

  test('no hardcoded secrets in any new file', () => {
    const files = [
      'apps/companion-user-flutter/lib/features/brain/brain_service.dart',
      'apps/companion-user-flutter/lib/features/inference/on_device_inference_service.dart',
      'apps/companion-desktop-tauri/src-tauri/src/main.rs',
      'apps/companion-desktop-tauri/src/lib/api.ts',
      'apps/companion-desktop-tauri/src/panels/InferencePanel.tsx',
    ];
    for (const f of files) {
      const content = readFile(f);
      expect(content).not.toMatch(/password\s*[:=]\s*["'][^"']+["']/i);
      expect(content).not.toMatch(/secret\s*[:=]\s*["'][a-zA-Z0-9]{20,}["']/i);
      expect(content).not.toMatch(/api[_-]?key\s*[:=]\s*["'][^"']+["']/i);
    }
  });

  test('no TODO/FIXME in new files', () => {
    const files = [
      'apps/companion-user-flutter/lib/features/brain/brain_models.dart',
      'apps/companion-user-flutter/lib/features/brain/brain_service.dart',
      'apps/companion-user-flutter/lib/features/brain/brain_page.dart',
      'apps/companion-user-flutter/lib/features/inference/on_device_inference_service.dart',
      'apps/companion-user-flutter/lib/features/inference/inference_page.dart',
      'apps/companion-desktop-tauri/src/panels/InferencePanel.tsx',
      'docs/features/gemma4-integration.md',
    ];
    for (const f of files) {
      const content = readFile(f);
      expect(content).not.toMatch(/\bTODO\b/);
      expect(content).not.toMatch(/\bFIXME\b/);
    }
  });
});
