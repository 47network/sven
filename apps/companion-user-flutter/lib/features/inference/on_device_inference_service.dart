import 'dart:convert';
import 'dart:io';

import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../app/api_base_service.dart';
import '../../app/authenticated_client.dart';
import '../../app/scoped_preferences.dart';

// ═══════════════════════════════════════════════════════════════════════════
// OnDeviceInferenceService — manages local Gemma 4 inference on Flutter
//
// Integrates with Google AI Edge SDK / LiteRT-LM for on-device inference.
// Handles model lifecycle (download → load → infer → unload), routing
// decisions (local vs cloud), and module management.
//
// Privacy: On-device inference NEVER sends prompts/responses to Google or
// any third party. The model runs in full isolation.
// ═══════════════════════════════════════════════════════════════════════════

class OnDeviceInferenceService extends ChangeNotifier {
  OnDeviceInferenceService({AuthenticatedClient? client}) : _client = client {
    _loadPreferences();
    _probeDeviceCapabilities();
  }

  final AuthenticatedClient? _client;

  static const _kModelsInstalled = 'sven.inference.models_installed';
  static const _kPreferLocal = 'sven.inference.prefer_local';
  static const _kMaxLocalTokens = 'sven.inference.max_local_tokens';
  static const _kActiveModelId = 'sven.inference.active_model';

  InferenceState _state = InferenceState.idle;
  ModelProfile? _activeModel;
  List<ModelProfile> _installedModels = [];
  List<InferenceModule> _availableModules = [];
  bool _preferLocal = true;
  int _maxLocalTokens = 2048;
  bool _disposed = false;
  String? _error;

  // Device capability tracking
  DeviceCapability? _deviceCapability;

  // Performance tracking
  double _lastInferenceMs = 0;
  final double _avgTokensPerSecond = 0;
  int _totalInferences = 0;
  double _downloadProgress = 0;

  // ── Public getters ─────────────────────────────────────────────────────

  InferenceState get state => _state;
  ModelProfile? get activeModel => _activeModel;
  List<ModelProfile> get installedModels => List.unmodifiable(_installedModels);
  List<InferenceModule> get availableModules =>
      List.unmodifiable(_availableModules);
  bool get preferLocal => _preferLocal;
  int get maxLocalTokens => _maxLocalTokens;
  String? get error => _error;
  double get lastInferenceMs => _lastInferenceMs;
  double get avgTokensPerSecond => _avgTokensPerSecond;
  int get totalInferences => _totalInferences;
  double get downloadProgress => _downloadProgress;
  bool get isModelLoaded => _state == InferenceState.ready;
  DeviceCapability? get deviceCapability => _deviceCapability;

  /// Whether the device supports on-device inference.
  bool get isSupported =>
      Platform.isAndroid || Platform.isIOS || Platform.isMacOS;

  /// Recommended model variant for this device based on actual RAM.
  ModelVariant get recommendedVariant {
    final ramMb = _deviceCapability?.totalRamMb ?? 0;
    if (ramMb >= 12288) return ModelVariant.dense31b;
    if (ramMb >= 8192) return ModelVariant.moe26b;
    if (ramMb >= 6144) return ModelVariant.e4b;
    return ModelVariant.e2b;
  }

  /// Check whether a variant is compatible with the current device.
  ModelCompatibility checkCompatibility(ModelVariant variant) {
    final cap = _deviceCapability;
    if (cap == null) return ModelCompatibility.unknown;

    // RAM check: variant needs enough RAM for model + OS overhead
    if (cap.totalRamMb < variant.minRamMb) {
      return ModelCompatibility.insufficientRam;
    }
    // Storage check: need model size + a 500 MB buffer for extraction/temp
    final requiredStorageMb =
        (variant.estimatedSizeBytes / (1024 * 1024)).ceil() + 500;
    if (cap.freeStorageMb < requiredStorageMb) {
      return ModelCompatibility.insufficientStorage;
    }
    return ModelCompatibility.compatible;
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────

  @override
  void dispose() {
    _disposed = true;
    super.dispose();
  }

  /// Bind to scoped preferences for multi-user isolation.
  void bindPreferences(ScopedPreferences prefs) {
    _loadPreferences();
  }

  /// Probe the device for RAM and available storage.
  Future<void> _probeDeviceCapabilities() async {
    if (!isSupported) return; // Only probe on Android/iOS/macOS.
    try {
      final deviceInfo = DeviceInfoPlugin();
      int totalRamMb = 0;
      int freeStorageMb = 0;

      if (Platform.isAndroid) {
        // Fallback to defaults since these were added in device_info_plus 12.4.0
        // and we downgraded to 12.3.0 to fix iOS build on XCode
        totalRamMb = 0;
        freeStorageMb = 0;
      } else if (Platform.isIOS) {
        // Fallback to defaults since these were added in device_info_plus 12.4.0
        // and we downgraded to 12.3.0 to fix iOS build on XCode
        totalRamMb = 0;
        freeStorageMb = 0;
      } else if (Platform.isMacOS) {
        final mac = await deviceInfo.macOsInfo;
        totalRamMb = mac.memorySize ~/ (1024 * 1024); // bytes → MB
        // macOS doesn't expose freeDiskSize; query via df.
        try {
          final result =
              await Process.run('df', ['-m', Directory.systemTemp.path]);
          if (result.exitCode == 0) {
            final lines = (result.stdout as String).trim().split('\n');
            if (lines.length >= 2) {
              final parts = lines[1].split(RegExp(r'\s+'));
              if (parts.length >= 4) {
                freeStorageMb = int.tryParse(parts[3]) ?? 0;
              }
            }
          }
        } catch (_) {
          freeStorageMb = 128000; // Assume generous default on macOS.
        }
      }

      _deviceCapability = DeviceCapability(
        totalRamMb: totalRamMb,
        freeStorageMb: freeStorageMb,
      );
      _notify();
    } catch (e) {
      debugPrint('OnDeviceInferenceService: device probe failed: $e');
    }
  }

  Future<void> _loadPreferences() async {
    final prefs = await SharedPreferences.getInstance();
    _preferLocal = prefs.getBool(_kPreferLocal) ?? true;
    _maxLocalTokens = prefs.getInt(_kMaxLocalTokens) ?? 2048;

    final modelsJson = prefs.getString(_kModelsInstalled);
    if (modelsJson != null) {
      final list = jsonDecode(modelsJson) as List<dynamic>;
      _installedModels =
          list.cast<Map<String, dynamic>>().map(ModelProfile.fromJson).toList();
    }

    final activeId = prefs.getString(_kActiveModelId);
    if (activeId != null) {
      _activeModel = _installedModels.cast<ModelProfile?>().firstWhere(
            (m) => m?.id == activeId,
            orElse: () => null,
          );
    }

    _notify();
  }

  Future<void> _savePreferences() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_kPreferLocal, _preferLocal);
    await prefs.setInt(_kMaxLocalTokens, _maxLocalTokens);
    await prefs.setString(
      _kModelsInstalled,
      jsonEncode(_installedModels.map((m) => m.toJson()).toList()),
    );
    if (_activeModel != null) {
      await prefs.setString(_kActiveModelId, _activeModel!.id);
    }
  }

  // ── Model management ──────────────────────────────────────────────────

  /// Fetch available modules from the gateway.
  Future<void> fetchAvailableModules() async {
    if (_client == null) return;
    try {
      final base = ApiBaseService.currentSync();
      final response = await _client
          .get(Uri.parse('$base/v1/admin/gemma4/modules/installed'));
      if (response.statusCode == 200) {
        final body = jsonDecode(response.body) as Map<String, dynamic>;
        final data = body['data'] as Map<String, dynamic>? ?? body;
        final list = data['modules'] as List<dynamic>? ?? [];
        _availableModules = list
            .cast<Map<String, dynamic>>()
            .map(InferenceModule.fromJson)
            .toList();
        _notify();
      }
    } catch (_) {
      // Modules fetch is best-effort; device works offline.
    }
  }

  /// Download and install a model variant.
  ///
  /// Returns a [ModelInstallResult] indicating success or the reason for
  /// rejection. The model will NOT be downloaded if the device lacks
  /// sufficient RAM or storage.
  Future<ModelInstallResult> installModel(ModelVariant variant) async {
    if (_installedModels.any((m) => m.variant == variant)) {
      return ModelInstallResult.alreadyInstalled;
    }

    // ── Device capability gate ───────────────────────────────────────
    final compat = checkCompatibility(variant);
    if (compat == ModelCompatibility.insufficientRam) {
      _error = 'This model requires ${variant.minRamMb ~/ 1024} GB RAM. '
          'Your device has ${(_deviceCapability?.totalRamMb ?? 0) ~/ 1024} GB.';
      _notify();
      return ModelInstallResult.insufficientRam;
    }
    if (compat == ModelCompatibility.insufficientStorage) {
      final requiredGb = variant.estimatedSizeBytes / 1073741824;
      _error = 'This model needs ${requiredGb.toStringAsFixed(1)} GB '
          'of free storage plus 500 MB overhead. '
          'Available: ${(_deviceCapability?.freeStorageMb ?? 0) ~/ 1024} GB.';
      _notify();
      return ModelInstallResult.insufficientStorage;
    }

    _state = InferenceState.downloading;
    _error = null;
    _downloadProgress = 0;
    _notify();

    try {
      final profile = ModelProfile(
        id: 'gemma4-${variant.name}',
        name: 'Gemma 4 ${variant.displayName}',
        variant: variant,
        sizeBytes: variant.estimatedSizeBytes,
        contextWindow: variant.contextWindow,
        capabilities: variant.capabilities,
        installedAt: DateTime.now().toUtc(),
        status: ModelStatus.downloading,
      );

      _installedModels = [..._installedModels, profile];
      _notify();

      // Simulate download progress — in production this would use
      // Google AI Edge SDK's download manager or fetch from module CDN.
      // Staged progress gives the user visual feedback proportional to
      // model size: ~3s for the smallest, ~8s for the largest.
      const steps = 20;
      final baseDurationMs = (variant.estimatedSizeBytes / 1200000000 * 3000)
          .clamp(2000, 8000)
          .toInt();
      final stepDuration = Duration(milliseconds: baseDurationMs ~/ steps);
      for (var i = 1; i <= steps; i++) {
        if (_disposed) return ModelInstallResult.downloadFailed;
        await Future<void>.delayed(stepDuration);
        _downloadProgress = i / steps;
        _notify();
      }

      final idx = _installedModels.indexWhere((m) => m.id == profile.id);
      if (idx >= 0) {
        _installedModels[idx] = profile.copyWith(status: ModelStatus.ready);
      }

      await _savePreferences();
      _state = InferenceState.idle;
      _downloadProgress = 0;
      _notify();
      return ModelInstallResult.success;
    } catch (e) {
      _state = InferenceState.error;
      _downloadProgress = 0;
      _error = 'Download failed: $e';
      _notify();
      return ModelInstallResult.downloadFailed;
    }
  }

  /// Remove an installed model and free disk space.
  Future<void> uninstallModel(String modelId) async {
    _installedModels = _installedModels.where((m) => m.id != modelId).toList();
    if (_activeModel?.id == modelId) {
      _activeModel = null;
      _state = InferenceState.idle;
    }
    await _savePreferences();
    _notify();
  }

  /// Load a model into memory for inference.
  Future<void> loadModel(String modelId) async {
    final model = _installedModels.cast<ModelProfile?>().firstWhere(
          (m) => m?.id == modelId,
          orElse: () => null,
        );
    if (model == null || model.status != ModelStatus.ready) return;

    _state = InferenceState.loading;
    _error = null;
    _notify();

    try {
      // In production: initialise LiteRT-LM / AI Edge runtime with model path.
      await Future<void>.delayed(const Duration(milliseconds: 200));

      _activeModel = model;
      _state = InferenceState.ready;
      await _savePreferences();
      _notify();
    } catch (e) {
      _state = InferenceState.error;
      _error = 'Failed to load model: $e';
      _notify();
    }
  }

  /// Unload the active model from memory.
  Future<void> unloadModel() async {
    _activeModel = null;
    _state = InferenceState.idle;
    _notify();
  }

  // ── Inference ──────────────────────────────────────────────────────────

  /// Determine whether a prompt should run locally or be sent to the cloud.
  InferenceRoute routePrompt(String prompt, {bool forceLocal = false}) {
    if (forceLocal || !_hasNetworkConnectivity()) {
      if (_activeModel == null) {
        return InferenceRoute.localUnavailable;
      }
      return InferenceRoute.local;
    }

    if (!_preferLocal) return InferenceRoute.cloud;
    if (_activeModel == null) return InferenceRoute.cloud;

    // Simple heuristic: short prompts → local, long/complex → cloud.
    final tokenEstimate = prompt.split(' ').length;
    if (tokenEstimate > _maxLocalTokens) return InferenceRoute.cloud;

    return InferenceRoute.local;
  }

  /// Run inference locally on the device.
  ///
  /// Returns the generated text. Throws on failure.
  Future<String> infer(
    String prompt, {
    int maxTokens = 512,
    double temperature = 0.7,
    List<String>? stopSequences,
  }) async {
    if (_activeModel == null) {
      throw StateError('No model loaded');
    }

    _state = InferenceState.inferring;
    _notify();

    final stopwatch = Stopwatch()..start();
    try {
      // In production: call into LiteRT-LM / AI Edge SDK native interop.
      // For now, this is the integration point where the native platform
      // channel would be invoked:
      //
      //   final result = await _platformChannel.invokeMethod('infer', {
      //     'prompt': prompt,
      //     'max_tokens': maxTokens,
      //     'temperature': temperature,
      //     'stop_sequences': stopSequences ?? [],
      //   });

      await Future<void>.delayed(const Duration(milliseconds: 100));

      stopwatch.stop();
      _lastInferenceMs = stopwatch.elapsedMilliseconds.toDouble();
      _totalInferences++;

      _state = InferenceState.ready;
      _notify();

      // Placeholder — native inference returns the actual generated text.
      return '[on-device inference placeholder]';
    } catch (e) {
      stopwatch.stop();
      _state = InferenceState.error;
      _error = 'Inference failed: $e';
      _notify();
      rethrow;
    }
  }

  // ── Settings ───────────────────────────────────────────────────────────

  Future<void> setPreferLocal(bool value) async {
    _preferLocal = value;
    await _savePreferences();
    _notify();
  }

  Future<void> setMaxLocalTokens(int value) async {
    _maxLocalTokens = value.clamp(128, 128000);
    await _savePreferences();
    _notify();
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  bool _hasNetworkConnectivity() {
    // In production: check via connectivity_plus package.
    return true;
  }

  void _notify() {
    if (!_disposed) notifyListeners();
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Data models
// ═══════════════════════════════════════════════════════════════════════════

enum InferenceState {
  idle,
  downloading,
  loading,
  ready,
  inferring,
  error,
}

enum InferenceRoute {
  local,
  cloud,
  localUnavailable,
}

enum ModelVariant {
  e2b,
  e4b,
  moe26b,
  dense31b;

  String get displayName => switch (this) {
        ModelVariant.e2b => 'E2B (2B)',
        ModelVariant.e4b => 'E4B (4B)',
        ModelVariant.moe26b => '26B MoE',
        ModelVariant.dense31b => '31B Dense',
      };

  int get estimatedSizeBytes => switch (this) {
        ModelVariant.e2b => 1200000000, // ~1.2 GB
        ModelVariant.e4b => 2800000000, // ~2.8 GB
        ModelVariant.moe26b => 15000000000, // ~15 GB
        ModelVariant.dense31b => 18000000000, // ~18 GB
      };

  /// Minimum device RAM (MB) required to run this variant.
  /// Accounts for OS overhead — model needs roughly 60-70% of this for
  /// weights + KV cache; the rest is for OS and app processes.
  int get minRamMb => switch (this) {
        ModelVariant.e2b => 4096, // 4 GB
        ModelVariant.e4b => 6144, // 6 GB
        ModelVariant.moe26b => 8192, // 8 GB
        ModelVariant.dense31b => 12288, // 12 GB
      };

  int get contextWindow => switch (this) {
        ModelVariant.e2b => 128000,
        ModelVariant.e4b => 128000,
        ModelVariant.moe26b => 256000,
        ModelVariant.dense31b => 256000,
      };

  List<String> get capabilities => switch (this) {
        ModelVariant.e2b => [
            'text',
            'vision',
            'audio',
            'function_calling',
            'multilingual'
          ],
        ModelVariant.e4b => [
            'text',
            'vision',
            'audio',
            'function_calling',
            'multilingual'
          ],
        ModelVariant.moe26b => [
            'text',
            'vision',
            'function_calling',
            'multilingual',
            'structured_json'
          ],
        ModelVariant.dense31b => [
            'text',
            'vision',
            'function_calling',
            'multilingual',
            'structured_json',
            'fine_tuning'
          ],
      };

  String get description => switch (this) {
        ModelVariant.e2b =>
          'Lightweight 2-billion parameter model optimized for mobile devices. '
              'Best for quick text responses, basic vision tasks, and voice commands. '
              'Runs efficiently on most modern phones with minimal battery impact.',
        ModelVariant.e4b =>
          'Mid-range 4-billion parameter model with enhanced reasoning. '
              'Stronger at multi-step tasks, image understanding, and multilingual conversations. '
              'Recommended for flagship phones and tablets.',
        ModelVariant.moe26b =>
          'Large 26-billion Mixture-of-Experts model for advanced tasks. '
              'Excellent at complex reasoning, structured JSON output, and detailed analysis. '
              'Requires a high-end device with 8+ GB RAM. Download may take several minutes.',
        ModelVariant.dense31b =>
          'Largest 31-billion dense model with full capabilities including fine-tuning support. '
              'Best-in-class accuracy for all tasks. Supports custom model adaptation. '
              'Requires 12+ GB RAM and significant storage. Recommended for desktop/tablet only.',
      };

  static ModelVariant fromString(String s) => switch (s) {
        'e4b' => ModelVariant.e4b,
        'moe26b' => ModelVariant.moe26b,
        'dense31b' => ModelVariant.dense31b,
        _ => ModelVariant.e2b,
      };
}

enum ModelStatus {
  downloading,
  ready,
  error;

  static ModelStatus fromString(String s) => switch (s) {
        'ready' => ModelStatus.ready,
        'error' => ModelStatus.error,
        _ => ModelStatus.downloading,
      };
}

class ModelProfile {
  const ModelProfile({
    required this.id,
    required this.name,
    required this.variant,
    required this.sizeBytes,
    required this.contextWindow,
    required this.capabilities,
    required this.installedAt,
    required this.status,
  });

  factory ModelProfile.fromJson(Map<String, dynamic> json) => ModelProfile(
        id: json['id'] as String? ?? '',
        name: json['name'] as String? ?? '',
        variant: ModelVariant.fromString(json['variant'] as String? ?? ''),
        sizeBytes: json['size_bytes'] as int? ?? 0,
        contextWindow: json['context_window'] as int? ?? 0,
        capabilities:
            (json['capabilities'] as List<dynamic>?)?.cast<String>().toList() ??
                [],
        installedAt: DateTime.tryParse(json['installed_at'] as String? ?? '') ??
            DateTime.now().toUtc(),
        status: ModelStatus.fromString(json['status'] as String? ?? ''),
      );

  final String id;
  final String name;
  final ModelVariant variant;
  final int sizeBytes;
  final int contextWindow;
  final List<String> capabilities;
  final DateTime installedAt;
  final ModelStatus status;

  ModelProfile copyWith({ModelStatus? status}) => ModelProfile(
        id: id,
        name: name,
        variant: variant,
        sizeBytes: sizeBytes,
        contextWindow: contextWindow,
        capabilities: capabilities,
        installedAt: installedAt,
        status: status ?? this.status,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'variant': variant.name,
        'size_bytes': sizeBytes,
        'context_window': contextWindow,
        'capabilities': capabilities,
        'installed_at': installedAt.toIso8601String(),
        'status': status.name,
      };

  String get sizeLabel {
    final gb = sizeBytes / 1073741824;
    return gb >= 1.0
        ? '${gb.toStringAsFixed(1)} GB'
        : '${(sizeBytes / 1048576).toStringAsFixed(0)} MB';
  }
}

class InferenceModule {
  const InferenceModule({
    required this.id,
    required this.name,
    required this.description,
    required this.sizeBytes,
    this.installed = false,
    this.downloadProgress,
  });

  factory InferenceModule.fromJson(Map<String, dynamic> json) =>
      InferenceModule(
        id: json['id'] as String? ?? '',
        name: json['name'] as String? ?? '',
        description: json['description'] as String? ?? '',
        sizeBytes: json['size_bytes'] as int? ?? 0,
        installed: json['installed'] as bool? ?? false,
        downloadProgress: (json['download_progress'] as num?)?.toDouble(),
      );

  final String id;
  final String name;
  final String description;
  final int sizeBytes;
  final bool installed;
  final double? downloadProgress;
}

// ═══════════════════════════════════════════════════════════════════════════
// Device capability & compatibility models
// ═══════════════════════════════════════════════════════════════════════════

enum ModelCompatibility {
  compatible,
  insufficientRam,
  insufficientStorage,
  unknown,
}

enum ModelInstallResult {
  success,
  alreadyInstalled,
  insufficientRam,
  insufficientStorage,
  downloadFailed,
}

class DeviceCapability {
  const DeviceCapability({
    required this.totalRamMb,
    required this.freeStorageMb,
  });

  final int totalRamMb;
  final int freeStorageMb;

  String get ramLabel {
    final gb = totalRamMb / 1024;
    return '${gb.toStringAsFixed(1)} GB';
  }

  String get storageLabel {
    final gb = freeStorageMb / 1024;
    return '${gb.toStringAsFixed(1)} GB';
  }
}
