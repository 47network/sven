// lib/app/providers.dart
// ignore_for_file: lines_longer_than_80_chars
//
// Riverpod provider definitions for the Sven companion app.
//
// Architecture overview
// ─────────────────────
// The app started with get_it for pure-service singletons (AuthService, etc.)
// and hand-crafted ChangeNotifier instances owned by _SvenUserAppState.
// Sprint 40 introduces flutter_riverpod as the reactive layer:
//
//   • Services already in get_it  → Provider<T> that bridges via sl<T>()
//   • ChangeNotifier-based state  → ChangeNotifierProvider<T> that must be
//     overridden inside the inner ProviderScope in _SvenUserAppState.build()
//
// This lets any ConsumerWidget anywhere in the tree do:
//
//   final memory = ref.watch(memoryServiceProvider);
//   final state  = ref.watch(appStateProvider);
//
// instead of receiving services through 4-levels of constructor drilling.
//
// Migration strategy (see ADR 008):
//   Stage 1 (Sprint 40) — infrastructure only; MemoryPage converted as demo.
//   Stage 2+ — remaining pages migrated incrementally; get_it retired last.
//
// ─────────────────────────────────────────────────────────────────────────────

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../features/auth/auth_service.dart';
import '../features/brain/brain_service.dart';
import '../features/chat/messages_repository.dart';
import '../features/chat/prompt_templates_service.dart';
import '../features/chat/sync_service.dart';
import '../features/chat/voice_service.dart';
import '../features/devices/device_service.dart';
import '../features/home/feature_tooltip_service.dart';
import '../features/inference/on_device_inference_service.dart';
import '../features/memory/memory_service.dart';
import '../features/onboarding/tutorial_service.dart';
import '../features/projects/project_service.dart';
import '../features/security/app_lock_service.dart';
import '../features/ai/image_processing_service.dart';
import '../features/ai/audio_scribe_service.dart';
import '../features/ai/device_action_service.dart';
import '../features/ai/ai_policy_service.dart';
import '../features/ai/brain_admin_service.dart';
import '../features/ai/community_agents_service.dart';
import '../features/ai/calibration_service.dart';
import '../features/ai/federation_service.dart';
import 'app_state.dart';
import 'authenticated_client.dart';
import 'feature_flag_service.dart';
import 'service_locator.dart';

// ── get_it bridge providers ────────────────────────────────────────────────
//
// These pull the already-registered singleton out of get_it so that widgets
// migrated to Riverpod can consume them via ref.read / ref.watch.
// The services themselves are not ChangeNotifiers, so a plain Provider is
// sufficient — no reactive rebuild needed.

/// The singleton [AuthService] registered in [setupServiceLocator].
final authServiceProvider = Provider<AuthService>(
  (ref) => sl<AuthService>(),
  name: 'authServiceProvider',
);

/// The singleton [MessagesRepository] registered in [setupServiceLocator].
final messagesRepositoryProvider = Provider<MessagesRepository>(
  (ref) => sl<MessagesRepository>(),
  name: 'messagesRepositoryProvider',
);

/// The app-wide [FeatureFlagService] singleton.
final featureFlagServiceProvider = Provider<FeatureFlagService>(
  (ref) => FeatureFlagService.instance,
  name: 'featureFlagServiceProvider',
);

// ── Instance-owned ChangeNotifier providers ────────────────────────────────
//
// These services are created inside _SvenUserAppState.initState() and their
// lifecycle is tied to the root widget subtree.  They MUST be overridden in
// the inner ProviderScope returned by _SvenUserAppState.build(); the default
// factory throws to surface missing-override mistakes early.

/// The top-level [AppState] that drives theme, auth, onboarding, etc.
///
/// Overridden in [_SvenUserAppState] with the live `_state` instance.
final appStateProvider = ChangeNotifierProvider<AppState>(
  (ref) => throw StateError(
    'appStateProvider must be overridden by the root ProviderScope.',
  ),
  name: 'appStateProvider',
);

/// The user's [MemoryService] (facts + custom instructions).
///
/// Overridden in [_SvenUserAppState] with the live `_memoryService` instance.
final memoryServiceProvider = ChangeNotifierProvider<MemoryService>(
  (ref) => throw StateError(
    'memoryServiceProvider must be overridden by the root ProviderScope.',
  ),
  name: 'memoryServiceProvider',
);

/// The biometric / PIN [AppLockService].
///
/// Overridden in [_SvenUserAppState] with the live `_lockService` instance.
final appLockServiceProvider = ChangeNotifierProvider<AppLockService>(
  (ref) => throw StateError(
    'appLockServiceProvider must be overridden by the root ProviderScope.',
  ),
  name: 'appLockServiceProvider',
);

/// The [ProjectService] (workspace projects).
///
/// Overridden in [_SvenUserAppState] with the live `_projectService` instance.
final projectServiceProvider = ChangeNotifierProvider<ProjectService>(
  (ref) => throw StateError(
    'projectServiceProvider must be overridden by the root ProviderScope.',
  ),
  name: 'projectServiceProvider',
);

/// The [TutorialService] (feature-discovery tooltips / guided tour).
///
/// Overridden in [_SvenUserAppState] with the live `_tutorialService` instance.
final tutorialServiceProvider = ChangeNotifierProvider<TutorialService>(
  (ref) => throw StateError(
    'tutorialServiceProvider must be overridden by the root ProviderScope.',
  ),
  name: 'tutorialServiceProvider',
);

/// The [VoiceService] (STT + TTS pipeline).
///
/// VoiceService is not a ChangeNotifier, but it is lifecycle-owned by the
/// root widget, so it is exposed as a plain Provider override.
final voiceServiceProvider = Provider<VoiceService>(
  (ref) => throw StateError(
    'voiceServiceProvider must be overridden by the root ProviderScope.',
  ),
  name: 'voiceServiceProvider',
);

// ── Sprint 41 — lifecycle-owned plain-service providers ───────────────────
//
// These are also owned by _SvenUserAppState but are plain objects (not
// ChangeNotifiers), so they use Provider<T> with overrideWithValue().

/// The [AuthenticatedClient] HTTP client (carries the JWT + retry logic).
///
/// Overridden in [_SvenUserAppState] with the live `_authClient` instance.
final authenticatedClientProvider = Provider<AuthenticatedClient>(
  (ref) => throw StateError(
    'authenticatedClientProvider must be overridden by the root ProviderScope.',
  ),
  name: 'authenticatedClientProvider',
);

/// The [PromptTemplatesService] (chat starter / system-prompt templates).
///
/// Overridden in [_SvenUserAppState] with the live `_promptTemplatesService`.
final promptTemplatesServiceProvider = Provider<PromptTemplatesService>(
  (ref) => throw StateError(
    'promptTemplatesServiceProvider must be overridden by the root ProviderScope.',
  ),
  name: 'promptTemplatesServiceProvider',
);

/// The [DeviceService] (paired-device registry).
///
/// Overridden in [_SvenUserAppState] with the live `_deviceService`.
final deviceServiceProvider = Provider<DeviceService>(
  (ref) => throw StateError(
    'deviceServiceProvider must be overridden by the root ProviderScope.',
  ),
  name: 'deviceServiceProvider',
);

/// The [FeatureTooltipService] (first-run tooltips / feature discovery).
///
/// Overridden in [_SvenUserAppState] with the live `_tooltipService`.
final featureTooltipServiceProvider = Provider<FeatureTooltipService>(
  (ref) => throw StateError(
    'featureTooltipServiceProvider must be overridden by the root ProviderScope.',
  ),
  name: 'featureTooltipServiceProvider',
);

/// The app-wide [SyncService] that manages the persistent offline queue.
///
/// Overridden in [_SvenUserAppState] with the live `_syncService` instance.
final syncServiceProvider = ChangeNotifierProvider<SyncService>(
  (ref) => throw UnimplementedError(
    'syncServiceProvider must be overridden in the inner ProviderScope',
  ),
  name: 'syncServiceProvider',
);

// ── Sprint 71 — brain & inference providers ─────────────────────────────

/// The [BrainService] (knowledge graph visualization).
///
/// Overridden in [_SvenUserAppState] with the live `_brainService` instance.
final brainServiceProvider = ChangeNotifierProvider<BrainService>(
  (ref) => throw StateError(
    'brainServiceProvider must be overridden by the root ProviderScope.',
  ),
  name: 'brainServiceProvider',
);

/// The [OnDeviceInferenceService] (local Gemma 4 inference).
///
/// Overridden in [_SvenUserAppState] with the live `_inferenceService` instance.
final inferenceServiceProvider = ChangeNotifierProvider<OnDeviceInferenceService>(
  (ref) => throw StateError(
    'inferenceServiceProvider must be overridden by the root ProviderScope.',
  ),
  name: 'inferenceServiceProvider',
);

// ── Sprint 72 — AI pipeline providers ─────────────────────────────────

/// The [ImageProcessingService] (on-device image analysis).
final imageProcessingServiceProvider = Provider<ImageProcessingService>(
  (ref) => sl<ImageProcessingService>(),
  name: 'imageProcessingServiceProvider',
);

/// The [AudioScribeService] (on-device speech-to-text).
final audioScribeServiceProvider = Provider<AudioScribeService>(
  (ref) => sl<AudioScribeService>(),
  name: 'audioScribeServiceProvider',
);

/// The [DeviceActionService] (AI-powered device automations).
final deviceActionServiceProvider = Provider<DeviceActionService>(
  (ref) => sl<DeviceActionService>(),
  name: 'deviceActionServiceProvider',
);

/// The [AiPolicyService] (smart routing + privacy controls + module system).
final aiPolicyServiceProvider = Provider<AiPolicyService>(
  (ref) => sl<AiPolicyService>(),
  name: 'aiPolicyServiceProvider',
);

// ── Sprint 73 — Batch 2-5 providers ──────────────────────────────────────

/// The [BrainAdminService] (quantum fading, emotional intel, reasoning, GDPR).
final brainAdminServiceProvider = Provider<BrainAdminService>(
  (ref) => sl<BrainAdminService>(),
  name: 'brainAdminServiceProvider',
);

/// The [CommunityAgentsService] (personas, moderation, changelog, corrections).
final communityAgentsServiceProvider = Provider<CommunityAgentsService>(
  (ref) => sl<CommunityAgentsService>(),
  name: 'communityAgentsServiceProvider',
);

/// The [CalibrationService] (confidence, feedback, corrections, snapshots).
final calibrationServiceProvider = Provider<CalibrationService>(
  (ref) => sl<CalibrationService>(),
  name: 'calibrationServiceProvider',
);

/// The [FederationService] (identity, peers, homeserver, consent, sovereignty).
final federationServiceProvider = Provider<FederationService>(
  (ref) => sl<FederationService>(),
  name: 'federationServiceProvider',
);

