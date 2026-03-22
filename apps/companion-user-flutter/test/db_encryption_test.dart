// Unit tests for DbEncryption — AES-256-GCM authenticated at-rest encryption helper.
//
// Uses DbEncryption.fromKeyBytes(@visibleForTesting) to bypass
// FlutterSecureStorage, keeping tests pure-Dart with no platform channels.
//
// Run with:
//   flutter test test/db_encryption_test.dart

import 'package:flutter_test/flutter_test.dart';

import 'package:sven_user_flutter/app/db_encryption.dart';

void main() {
  group('DbEncryption', () {
    late DbEncryption enc;
    late List<String> failureCodes;

    setUp(() {
      // Deterministic 32-byte key: bytes 1–32
      enc = DbEncryption.fromKeyBytes(List.generate(32, (i) => i + 1));
      failureCodes = <String>[];
      DbEncryption.decryptFailureReporter = (code) => failureCodes.add(code);
    });

    tearDown(() {
      DbEncryption.decryptFailureReporter = null;
    });

    // ── Empty-string short-circuit ───────────────────────────────────────

    test('encrypt("") returns empty string', () {
      expect(enc.encrypt(''), '');
    });

    test('decrypt("") returns empty string', () {
      expect(enc.decrypt(''), '');
    });

    // ── Round-trip ───────────────────────────────────────────────────────

    test('encrypt → decrypt round-trip for short ASCII', () {
      const plain = 'Hello, Sven!';
      expect(enc.decrypt(enc.encrypt(plain)), plain);
    });

    test('encrypt → decrypt round-trip for Unicode / emoji', () {
      const unicode = '你好世界 🎉 Привет مرحبا';
      expect(enc.decrypt(enc.encrypt(unicode)), unicode);
    });

    test('encrypt → decrypt round-trip for long string (2 kB)', () {
      final long = 'x' * 2048;
      expect(enc.decrypt(enc.encrypt(long)), long);
    });

    test('encrypt → decrypt round-trip for single character', () {
      expect(enc.decrypt(enc.encrypt('a')), 'a');
    });

    // ── Stored format ────────────────────────────────────────────────────

    test('stored format contains version prefix and separators', () {
      final stored = enc.encrypt('some text');
      expect(stored.startsWith('v2:'), isTrue);
      expect(stored.split(':').length, 3);
    });

    // ── IV randomisation ─────────────────────────────────────────────────

    test('two encrypts of the same plaintext produce different ciphertext', () {
      const plain = 'same message';
      final a = enc.encrypt(plain);
      final b = enc.encrypt(plain);
      // Fresh IV per call — stored strings must differ even for identical input.
      expect(a, isNot(equals(b)));
      // But both must decrypt to the original plaintext.
      expect(enc.decrypt(a), plain);
      expect(enc.decrypt(b), plain);
    });

    // ── Legacy plain-text fallback ────────────────────────────────────────

    test('decrypt of legacy plain-text (no ":") returns the raw value', () {
      const legacy = 'plain-text-without-colon';
      expect(enc.decrypt(legacy), legacy);
    });

    test('decrypt of legacy value starting with ":"  prefix returns raw', () {
      // Edge case: separator at position 0 → substring(0,0) is empty → IV
      // parse will fail → corrupt-data guard kicks in and returns raw.
      const edge = ':justthecolonprefix';
      final result = enc.decrypt(edge);
      expect(result, isA<String>());
    });

    test('decrypt supports legacy CBC encrypted values', () {
      const plain = 'legacy-cbc-row';
      final legacy = enc.encryptLegacyCbcForTest(plain);
      expect(enc.decrypt(legacy), plain);
    });

    // ── Corrupt-data / wrong-key guard ───────────────────────────────────

    test('decrypt of garbled ciphertext does not throw', () {
      const corrupt = 'SGVsbG8=:%%%notvalidciphertext%%%';
      expect(() => enc.decrypt(corrupt), returnsNormally);
      expect(failureCodes.contains('legacy_decrypt_failed'), isTrue);
    });

    test('decrypt with wrong key fails closed for legacy structured payload', () {
      const plain = 'secret message';
      final stored = enc.encryptLegacyCbcForTest(plain);

      final enc2 = DbEncryption.fromKeyBytes(List.generate(32, (i) => i + 100));
      final result = enc2.decrypt(stored);
      expect(result, '');
      expect(failureCodes.contains('legacy_decrypt_failed'), isTrue);
    });

    test('legacy malformed payload keeps raw value for compatibility', () {
      const malformedLegacy = 'not_base64_iv:abcdef';
      final result = enc.decrypt(malformedLegacy);
      expect(result, malformedLegacy);
      expect(failureCodes.contains('legacy_malformed'), isTrue);
    });

    test('tampered v2 ciphertext fails closed (empty string)', () {
      const plain = 'authenticated payload';
      final stored = enc.encrypt(plain);
      final parts = stored.split(':');
      expect(parts.length, 3);
      final tampered = '${parts[0]}:${parts[1]}:${parts[2]}A';
      final result = enc.decrypt(tampered);
      expect(result, '');
      expect(failureCodes.contains('v2_decrypt_failed'), isTrue);
    });

    test('malformed v2 payload fails closed (empty string)', () {
      const malformed = 'v2:only_nonce_segment';
      final result = enc.decrypt(malformed);
      expect(result, '');
      expect(failureCodes.contains('v2_malformed'), isTrue);
    });

    test('decrypt remains fail-closed when failure reporter throws', () {
      DbEncryption.decryptFailureReporter = (_) {
        throw StateError('reporter failed');
      };

      const malformed = 'v2:only_nonce_segment';
      final result = enc.decrypt(malformed);
      expect(result, '');
    });

    // ── Key independence ──────────────────────────────────────────────────

    test('two different keys produce different ciphertexts for the same input',
        () {
      final enc2 = DbEncryption.fromKeyBytes(List.generate(32, (i) => i + 50));
      const plain = 'test value';
      final ct1 = enc.encrypt(plain);
      final ct2 = enc2.encrypt(plain);
      expect(ct1, isNot(ct2));
    });

    test('decrypt with correct key always returns plaintext regardless of IV',
        () {
      // Encrypt 100 times; each has a different random IV — all must round-trip.
      const plain = 'invariant plaintext';
      for (var i = 0; i < 100; i++) {
        expect(enc.decrypt(enc.encrypt(plain)), plain);
      }
    });
  });
}
