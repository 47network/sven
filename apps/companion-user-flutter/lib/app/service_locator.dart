import 'package:get_it/get_it.dart';

import '../features/auth/auth_service.dart';
import '../features/auth/token_store.dart';
import '../features/chat/messages_repository.dart';
import '../features/memory/memory_service.dart';
import '../features/chat/voice_service.dart';
import 'authenticated_client.dart';
import 'database.dart';
import 'db_encryption.dart';
import 'dio_http_client.dart';
import 'feature_flag_service.dart';
import 'ab_test_service.dart';

// ─────────────────────────────────────────────────────────────────────────────
/// Global service locator.
///
/// Call [setupServiceLocator] once during app initialization (in `main()`
/// *before* `runApp`).  Then access services anywhere with:
///
/// ```dart
/// final auth = sl<AuthService>();
/// final mem  = sl<MemoryService>();
/// ```
///
/// All registrations are lazy singletons — objects are only created on first
/// access, not at registration time.
///
/// See [ADR 005](../docs/adr/005-dio-getit-service-locator.md) for rationale.
// ─────────────────────────────────────────────────────────────────────────────

/// The global [GetIt] instance.  Import [sl] instead of [GetIt.instance] directly.
final GetIt sl = GetIt.instance;

Future<void> _verifyDbEncryptionReady() async {
  try {
    // Fail fast at startup if key-material bootstrap is unavailable.
    final enc = await sl<Future<DbEncryption>>();
    const probe = '__sven_db_encryption_probe__';
    final stored = enc.encrypt(probe);
    if (stored == probe || !stored.startsWith('v2:')) {
      throw StateError('DbEncryption probe encrypt result is invalid');
    }
    final roundTrip = enc.decrypt(stored);
    if (roundTrip != probe) {
      throw StateError('DbEncryption probe round-trip failed');
    }
  } catch (error, stackTrace) {
    throw StateError(
      'Critical startup failure: DbEncryption initialization failed. '
      'Refusing to continue without verified local encryption readiness. '
      'Cause: $error\n$stackTrace',
    );
  }
}

/// Register all services.  Safe to call multiple times (idempotent via [GetIt.allowReassignment]).
Future<void> setupServiceLocator() async {
  // ── 0. Local database ─────────────────────────────────────────────────────
  //
  // AppDatabase opens (or creates) sven_app.sqlite3 via drift_flutter.
  // DbEncryption provides AES-256-GCM field-level encryption; the key is
  // generated on first launch and stored in the platform keystore.
  // MessagesRepository is the domain-facing cache layer built on top.
  if (!sl.isRegistered<Future<DbEncryption>>()) {
    sl.registerLazySingleton<Future<DbEncryption>>(
      () => DbEncryption.init(),
    );
  }
  if (!sl.isRegistered<AppDatabase>()) {
    sl.registerLazySingleton<AppDatabase>(() => AppDatabase());
  }
  if (!sl.isRegistered<MessagesRepository>()) {
    sl.registerLazySingleton<MessagesRepository>(
      () => MessagesRepository(
        db: sl<AppDatabase>(),
        encryptionFuture: sl<Future<DbEncryption>>(),
      ),
    );
  }
  await _verifyDbEncryptionReady();

  // ── 1. Transport layer ────────────────────────────────────────────────────
  //
  // DioHttpClient is the Dio-backed drop-in for http.Client.
  // It adds retry + debug logging without touching auth.
  if (!sl.isRegistered<DioHttpClient>()) {
    sl.registerLazySingleton<DioHttpClient>(() => DioHttpClient());
  }

  // ── 2. Token storage ──────────────────────────────────────────────────────
  if (!sl.isRegistered<TokenStore>()) {
    sl.registerLazySingleton<TokenStore>(() => TokenStore());
  }

  // ── 3. Auth service ───────────────────────────────────────────────────────
  //
  // Uses DioHttpClient so login/refresh calls benefit from retry + logging.
  if (!sl.isRegistered<AuthService>()) {
    sl.registerLazySingleton<AuthService>(
      () => AuthService(client: sl<DioHttpClient>()),
    );
  }

  // ── 4. Authenticated HTTP client ──────────────────────────────────────────
  //
  // Wraps DioHttpClient with automatic Bearer-token injection and
  // 401 → SESSION_EXPIRED detection.  (onSessionExpired wired at app level.)
  if (!sl.isRegistered<AuthenticatedClient>()) {
    sl.registerLazySingleton<AuthenticatedClient>(
      () => AuthenticatedClient(
        client: sl<DioHttpClient>(),
        tokenStore: sl<TokenStore>(),
        // onSessionExpired is intentionally left null here; callers that need
        // session-expiry handling should create their own AuthenticatedClient
        // with the callback wired (as SvenUserApp currently does).
      ),
    );
  }

  // ── 5. Feature flags ──────────────────────────────────────────────────────
  //
  // FeatureFlagService has its own singleton pattern; we just expose it here
  // so callers can use sl<FeatureFlagService>() for consistency.
  if (!sl.isRegistered<FeatureFlagService>()) {
    sl.registerLazySingleton<FeatureFlagService>(
      () => FeatureFlagService.instance,
    );
  }

  // ── 5b. A/B testing service ───────────────────────────────────────────────
  //
  // AbTestService drives deterministic variant assignment and QA overrides.
  // Bind it to the signed-in userId after auth (see SvenUserApp._onAuth).
  if (!sl.isRegistered<AbTestService>()) {
    sl.registerLazySingleton<AbTestService>(
      () => AbTestService.instance,
    );
  }

  // ── 6. Memory service ─────────────────────────────────────────────────────
  if (!sl.isRegistered<MemoryService>()) {
    sl.registerLazySingleton<MemoryService>(() => MemoryService());
  }

  // ── 7. Voice service ──────────────────────────────────────────────────────
  if (!sl.isRegistered<VoiceService>()) {
    sl.registerLazySingleton<VoiceService>(() => VoiceService());
  }
}

/// Reset all registrations.  Call in tests to get a clean slate.
///
/// ```dart
/// setUp(() async {
///   resetServiceLocator();
///   await setupServiceLocator();
/// });
/// ```
void resetServiceLocator() => sl.reset();
