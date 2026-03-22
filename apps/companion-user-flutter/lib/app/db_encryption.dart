// lib/app/db_encryption.dart
//
// At-rest encryption for sensitive SQLite string columns.
//
// Strategy:
//   • New writes use AES-256-GCM (authenticated encryption).
//   • Legacy rows encrypted with AES-256-CBC are still readable.
//   • A 256-bit key is generated on first launch with [Random.secure] and
//     persisted in the platform keystore via [FlutterSecureStorage]
//     (Android Keystore / iOS Secure Enclave).
//   • Every plaintext value is paired with a fresh nonce so that
//     identical messages produce different ciphertext.
//   • New stored format is:   v2:nonceBase64:ciphertextBase64
//   • Legacy format is still accepted: ivBase64:ciphertextBase64
//   • [decrypt] recognises the ':' separator and falls back to returning
//     the raw value when the format does not match (graceful migration for
//     rows that were written before encryption was enabled).
//
// Usage:
//   final enc = await DbEncryption.init();
//   sl.registerSingleton<DbEncryption>(enc);
//
//   // In repositories:
//   final stored = enc.encrypt(plaintext);
//   final plain  = enc.decrypt(stored);   // safe for legacy plaintext rows

import 'dart:math';
import 'dart:typed_data';
import 'dart:developer' as developer;

import 'package:encrypt/encrypt.dart';
import 'package:flutter/foundation.dart' show visibleForTesting;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

// ─────────────────────────────────────────────────────────────────────────────

/// Storage key used for the database encryption master key.
const _kStorageKey = 'sven_db_enc_key_v1';
const _kFormatV2 = 'v2';

/// Separator used between the IV and ciphertext in the stored string.
/// Base64-URL characters are [A-Za-z0-9\-_=], so ':' is never ambiguous.
const _kSep = ':';

// ─────────────────────────────────────────────────────────────────────────────

/// AES-256 authenticated encryption / decryption helper for local SQLite columns.
///
/// Obtain a fully initialised instance via [DbEncryption.init].  The
/// resulting object is cheap to keep as a singleton — it holds only the
/// [Encrypter] in memory.
///
/// **Thread safety**: [encrypt] and [decrypt] are pure functions that create
/// a new IV on each call; they are safe to call from multiple isolates.
class DbEncryption {
  DbEncryption._(this._encrypter, this._legacyEncrypter);

  final Encrypter _encrypter;
  final Encrypter _legacyEncrypter;
  @visibleForTesting
  static void Function(String code)? decryptFailureReporter;

  // ── Factory ───────────────────────────────────────────────────────────────

  /// Initialise the encryption service, generating and persisting a key on
  /// the very first call.
  ///
  /// Must be awaited before constructing [AppDatabase] / [MessagesRepository].
  static Future<DbEncryption> init() async {
    const storage = FlutterSecureStorage(
      aOptions: AndroidOptions(encryptedSharedPreferences: true),
      iOptions: IOSOptions(
        accessibility: KeychainAccessibility.first_unlock_this_device,
      ),
    );

    // Read or generate the 256-bit master key (stored as URL-safe base64).
    String? b64 = await storage.read(key: _kStorageKey);
    if (b64 == null || b64.isEmpty) {
      final rng = Random.secure();
      final bytes = Uint8List.fromList(
        List<int>.generate(32, (_) => rng.nextInt(256)),
      );
      b64 = Key(bytes).base64;
      await storage.write(key: _kStorageKey, value: b64);
    }

    final key = Key.fromBase64(b64);
    return DbEncryption._(
      Encrypter(AES(key, mode: AESMode.gcm)),
      Encrypter(AES(key, mode: AESMode.cbc)),
    );
  }

  /// Creates a [DbEncryption] instance directly from a 32-byte key.
  ///
  /// **For unit tests only** — bypasses [FlutterSecureStorage] so that the
  /// platform channel is never invoked in a pure-Dart test environment.
  @visibleForTesting
  factory DbEncryption.fromKeyBytes(List<int> bytes) {
    assert(bytes.length == 32, 'AES-256 requires a 32-byte key');
    final key = Key(Uint8List.fromList(bytes));
    return DbEncryption._(
      Encrypter(AES(key, mode: AESMode.gcm)),
      Encrypter(AES(key, mode: AESMode.cbc)),
    );
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /// Encrypt [plaintext] and return a storable string in the format
  /// `v2:<nonceBase64>:<ciphertextBase64>`.
  ///
  /// Passing an empty string returns an empty string (no-op).
  String encrypt(String plaintext) {
    if (plaintext.isEmpty) return plaintext;
    final iv = IV.fromSecureRandom(12);
    final encrypted = _encrypter.encrypt(plaintext, iv: iv);
    return '$_kFormatV2$_kSep${iv.base64}$_kSep${encrypted.base64}';
  }

  @visibleForTesting
  String encryptLegacyCbcForTest(String plaintext) {
    if (plaintext.isEmpty) return plaintext;
    final iv = IV.fromSecureRandom(16);
    final encrypted = _legacyEncrypter.encrypt(plaintext, iv: iv);
    return '${iv.base64}$_kSep${encrypted.base64}';
  }

  /// Decrypt a value produced by [encrypt].
  ///
  /// Returns [ciphertext] unchanged when:
  ///   - it does not contain the expected separator (legacy plain-text row).
  ///
  /// For authenticated `v2` rows, decryption failures fail closed and return
  /// an empty string so tampered payloads are never surfaced as trusted text.
  ///
  /// For legacy pre-v2 rows, decrypt failure still returns the raw value to
  /// preserve migration compatibility with historical plain/corrupt rows.
  String decrypt(String ciphertext) {
    if (ciphertext.isEmpty) return ciphertext;
    final parts = ciphertext.split(_kSep);
    if (ciphertext.startsWith('$_kFormatV2$_kSep')) {
      if (parts.length != 3) {
        _reportDecryptFailure('v2_malformed');
        return '';
      }
      try {
        final iv = IV.fromBase64(parts[1]);
        return _encrypter.decrypt64(parts[2], iv: iv);
      } catch (_) {
        _reportDecryptFailure('v2_decrypt_failed');
        return '';
      }
    }
    final sepIndex = ciphertext.indexOf(_kSep);
    if (sepIndex < 0) return ciphertext; // legacy plain-text fallback
    IV iv;
    try {
      iv = IV.fromBase64(ciphertext.substring(0, sepIndex));
    } catch (_) {
      _reportDecryptFailure('legacy_malformed');
      // Keep compatibility for plain/corrupt historical rows that only happen
      // to contain ':' but are not valid encrypted payloads.
      return ciphertext;
    }
    try {
      final ct = ciphertext.substring(sepIndex + 1);
      return _legacyEncrypter.decrypt64(ct, iv: iv);
    } catch (_) {
      _reportDecryptFailure('legacy_decrypt_failed');
      // Fail closed for rows that look like structured encrypted payloads.
      return '';
    }
  }

  static void _reportDecryptFailure(String code) {
    developer.log(
      'db encryption decrypt failure',
      name: 'sven.db_encryption',
      error: code,
      level: 900,
    );
    try {
      decryptFailureReporter?.call(code);
    } catch (error, stackTrace) {
      // Reporter hooks are best-effort only and must never affect decrypt flow.
      developer.log(
        'db encryption decrypt reporter failure',
        name: 'sven.db_encryption',
        error: error,
        stackTrace: stackTrace,
        level: 900,
      );
    }
  }
}
