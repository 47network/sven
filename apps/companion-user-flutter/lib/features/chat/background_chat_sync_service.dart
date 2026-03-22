import '../../app/authenticated_client.dart';
import '../../app/service_locator.dart';
import 'chat_service.dart';
import 'messages_repository.dart';

abstract final class BackgroundChatSyncService {
  static Future<void> sync({String? chatId}) async {
    try {
      await setupServiceLocator();
      final repo = sl<MessagesRepository>();
      final client = AuthenticatedClient();
      final chatService = ChatService(client: client, repo: repo);
      if (chatId != null && chatId.trim().isNotEmpty) {
        await chatService.listMessages(chatId.trim(), limit: 30);
        return;
      }
      final page = await chatService.listChats(limit: 10, offset: 0);
      for (final thread in page.threads.take(5)) {
        try {
          await chatService.listMessages(thread.id, limit: 20);
        } catch (_) {}
      }
    } catch (_) {
      // Best-effort background refresh only.
    }
  }
}
