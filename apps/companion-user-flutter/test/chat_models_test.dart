import 'package:flutter_test/flutter_test.dart';
import 'package:sven_user_flutter/features/chat/chat_models.dart';

void main() {
  test('ChatMessage parses ISO created_at timestamps', () {
    final message = ChatMessage.fromJson({
      'id': 'msg-1',
      'role': 'user',
      'text': 'hello',
      'created_at': '2026-03-25T19:45:10.547Z',
    });

    expect(message.timestamp.toUtc().toIso8601String(), '2026-03-25T19:45:10.547Z');
  });

  test('ChatMessage parses JavaScript-style created_at timestamps', () {
    final message = ChatMessage.fromJson({
      'id': 'msg-2',
      'role': 'user',
      'text': 'queued',
      'created_at':
          'Wed Mar 25 2026 20:35:06 GMT+0000 (Coordinated Universal Time)',
      'status': 'queued',
    });

    expect(message.timestamp.toUtc().toIso8601String(), '2026-03-25T20:35:06.000Z');
    expect(message.status, ChatMessageStatus.queued);
  });
}
