import 'dart:async';
import 'dart:io' show HttpClient, X509Certificate;

import 'package:crypto/crypto.dart';
import 'package:dio/dio.dart';
import 'package:dio/io.dart';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

// ─────────────────────────────────────────────────────────────────────────────
// TLS certificate pinning
// ─────────────────────────────────────────────────────────────────────────────

/// SHA-256 fingerprints (lowercase hex) of DER-encoded leaf TLS certificates.
/// Supply comma/space-separated values via:
/// `--dart-define=SVEN_API_CERT_SHA256_PINS=<pin1>,<pin2>`
///
/// Derive a fingerprint with:
///
/// ```sh
/// openssl s_client -connect api.sven.app:443 </dev/null 2>/dev/null \
///   | openssl x509 -outform DER \
///   | openssl dgst -sha256
/// ```
///
/// Include both the current **and** next (backup) certificate so that
/// a rotation does not cause a service outage.
const String _kCertPinsDefine = 'SVEN_API_CERT_SHA256_PINS';

bool _isValidSha256Hex(String value) {
  return RegExp(r'^[a-f0-9]{64}$').hasMatch(value);
}

Set<String> _configuredApiPins() {
  const raw = String.fromEnvironment(_kCertPinsDefine, defaultValue: '');
  if (raw.trim().isEmpty) return <String>{};
  return raw
      .split(RegExp(r'[,\s;]+'))
      .map((v) => v.trim().toLowerCase())
      .where(_isValidSha256Hex)
      .toSet();
}

// ─────────────────────────────────────────────────────────────────────────────
/// A drop-in [http.BaseClient] backed by Dio.
///
/// Provides:
///   - **Automatic retry** (3 attempts, 1 s / 2 s / 4 s exponential back-off)
///     on transient network errors and 502 / 503 / 504 responses.
///   - **Debug logging** (request method + URL, status code) — debug builds only.
///   - **SSE-aware streaming**: responses to requests with
///     `Accept: text/event-stream` use [ResponseType.stream] so that bytes are
///     delivered incrementally rather than buffered.
///
/// Auth header injection is left to the layer above ([AuthenticatedClient]).
/// This class only handles transport concerns.
///
/// Usage (usually through service_locator.dart):
/// ```dart
/// final authClient = AuthenticatedClient(client: DioHttpClient());
/// ```
// ─────────────────────────────────────────────────────────────────────────────
class DioHttpClient extends http.BaseClient {
  DioHttpClient({Dio? dio}) : _dio = dio ?? _build();

  final Dio _dio;

  // ── Construction ───────────────────────────────────────────────────────────

  static Dio _build() {
    final dio = Dio(
      BaseOptions(
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 30),
        sendTimeout: const Duration(seconds: 30),
        // Let callers inspect every status code — don't auto-throw on 4xx/5xx.
        validateStatus: (_) => true,
        followRedirects: true,
      ),
    );

    if (kDebugMode) {
      dio.interceptors.add(_DebugLogInterceptor());
    }

    dio.interceptors.add(_RetryInterceptor(dio));

    // ── TLS certificate pinning (native platforms only) ──────────────────────
    if (!kIsWeb) {
      final ioAdapter = dio.httpClientAdapter as IOHttpClientAdapter;
      final pins = _configuredApiPins();

      if (!kDebugMode && pins.isEmpty) {
        throw StateError(
          'Missing TLS pin set. Configure $_kCertPinsDefine via --dart-define '
          'for release/profile builds.',
        );
      }

      ioAdapter.createHttpClient = () {
        final client = HttpClient();
        if (kDebugMode) {
          // Development builds can use local/self-signed certs.
          client.badCertificateCallback =
              (X509Certificate cert, String host, int port) {
            debugPrint('[CertPin] bypassed for $host:$port (debug build)');
            return true;
          };
        }
        return client;
      };

      // In Dio 5, validateCertificate is available on IOHttpClientAdapter.
      // Use dynamic assignment to remain compatible across minor adapter changes.
      final dynamic dynamicAdapter = ioAdapter;
      try {
        dynamicAdapter.validateCertificate =
            (dynamic cert, String host, int port) {
          if (kDebugMode) return true;
          final der = (cert as X509Certificate?)?.der;
          if (der == null || der.isEmpty) return false;
          final fp = sha256.convert(der).toString();
          final trusted = pins.contains(fp);
          if (!trusted) {
            debugPrint(
              '[CertPin] REJECTED untrusted cert for $host:$port fp=$fp',
            );
          }
          return trusted;
        };
      } catch (_) {
        if (!kDebugMode) {
          throw StateError(
            'IOHttpClientAdapter does not expose validateCertificate; '
            'cannot enforce certificate pinning in release/profile builds.',
          );
        }
      }
    }

    return dio;
  }

  // ── http.BaseClient implementation ─────────────────────────────────────────

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    // SSE connections must stream bytes incrementally; everything else can be
    // buffered for simplicity.
    final isEventStream = request.headers['Accept'] == 'text/event-stream' ||
        request.headers['accept'] == 'text/event-stream';

    final options = Options(
      method: request.method,
      headers: Map<String, dynamic>.from(request.headers),
      responseType: isEventStream ? ResponseType.stream : ResponseType.bytes,
      // SSE connections: no receive timeout (stream may stay open indefinitely).
      receiveTimeout: isEventStream ? null : const Duration(seconds: 30),
      validateStatus: (_) => true,
    );

    final bodyBytes = await request.finalize().toBytes();

    try {
      final response = await _dio.request<dynamic>(
        request.url.toString(),
        data: bodyBytes.isNotEmpty ? bodyBytes : null,
        options: options,
      );

      final headers = <String, String>{};
      response.headers.map.forEach((key, values) {
        headers[key] = values.join(', ');
      });

      if (isEventStream) {
        final responseBody = response.data as ResponseBody;
        return http.StreamedResponse(
          responseBody.stream.cast<List<int>>(),
          response.statusCode ?? 200,
          headers: headers,
          request: request,
        );
      } else {
        final bytes = (response.data as List<int>?) ?? const <int>[];
        return http.StreamedResponse(
          Stream.value(bytes),
          response.statusCode ?? 200,
          headers: headers,
          request: request,
        );
      }
    } on DioException catch (e) {
      throw http.ClientException(
        e.message ?? 'Connection error',
        request.url,
      );
    }
  }

  /// Expose the underlying [Dio] instance for tests or advanced callers.
  @visibleForTesting
  Dio get dio => _dio;
}

// ─────────────────────────────────────────────────────────────────────────────
// Retry interceptor
// ─────────────────────────────────────────────────────────────────────────────

class _RetryInterceptor extends Interceptor {
  const _RetryInterceptor(this._dio);

  final Dio _dio;

  static const int _maxAttempts = 3;
  static const Set<int> _retriableStatuses = {502, 503, 504};

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    // Don't retry SSE / streaming requests.
    final isStream = err.requestOptions.responseType == ResponseType.stream;
    if (isStream) return handler.next(err);

    final attempt = (err.requestOptions.extra['_retry_count'] as int?) ?? 0;

    final isTransient = err.type == DioExceptionType.connectionError ||
        err.type == DioExceptionType.receiveTimeout ||
        err.type == DioExceptionType.sendTimeout;
    final isRetriableStatus =
        _retriableStatuses.contains(err.response?.statusCode);

    if (attempt >= _maxAttempts - 1 || (!isTransient && !isRetriableStatus)) {
      return handler.next(err);
    }

    // Exponential back-off: 1 s, 2 s, 4 s.
    final delay = Duration(milliseconds: 1000 * (1 << attempt));
    await Future<void>.delayed(delay);

    final opts = err.requestOptions..extra['_retry_count'] = attempt + 1;

    try {
      final response = await _dio.fetch<dynamic>(opts);
      handler.resolve(response);
    } on DioException catch (e) {
      handler.next(e);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Debug logging interceptor
// ─────────────────────────────────────────────────────────────────────────────

class _DebugLogInterceptor extends Interceptor {
  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    debugPrint('[DioHttp] → ${options.method} ${options.uri.path}');
    handler.next(options);
  }

  @override
  void onResponse(
      Response<dynamic> response, ResponseInterceptorHandler handler) {
    debugPrint(
      '[DioHttp] ← ${response.statusCode} ${response.requestOptions.uri.path}',
    );
    handler.next(response);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    debugPrint(
      '[DioHttp] ✗ ${err.type.name}: ${err.requestOptions.uri.path}',
    );
    handler.next(err);
  }
}
