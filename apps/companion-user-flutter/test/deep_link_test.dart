import 'package:flutter_test/flutter_test.dart';
import 'package:sven_user_flutter/app/deep_link.dart';

void main() {
  group('parseDeepLink', () {
    test('parses approvals link', () {
      final target = parseDeepLink(Uri.parse('sven://approvals'));
      expect(target, isNotNull);
      expect(target!.kind, 'approvals');
      expect(target.chatId, isNull);
    });

    test('parses chat link', () {
      final target = parseDeepLink(Uri.parse('sven://chat/abc123'));
      expect(target, isNotNull);
      expect(target!.kind, 'chat');
      expect(target.chatId, 'abc123');
    });

    test('parses widget voice deep link', () {
      final target = parseDeepLink(Uri.parse('sven://widget/voice'));
      expect(target, isNotNull);
      expect(target!.kind, 'widget_voice');
      expect(target.chatId, isNull);
    });

    test('parses widget tap deep link to home', () {
      final target = parseDeepLink(Uri.parse('sven://widget/tap'));
      expect(target, isNotNull);
      expect(target!.kind, 'home');
      expect(target.chatId, isNull);
    });

    test('parses gateway connect deep link', () {
      final target = parseDeepLink(
        Uri.parse('sven://gateway/connect?url=https%3A%2F%2Fremote.example'),
      );
      expect(target, isNotNull);
      expect(target!.kind, 'gateway_connect');
      expect(target.gatewayUrl, 'https://remote.example');
    });

    test('rejects unknown link paths', () {
      final target = parseDeepLink(Uri.parse('sven://unknown/path'));
      expect(target, isNull);
    });

  });
}
