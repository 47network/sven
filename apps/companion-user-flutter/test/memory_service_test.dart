import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sven_user_flutter/features/memory/memory_service.dart';
import 'package:sven_user_flutter/features/memory/memory_models.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  group('MemoryService', () {
    test('starts with empty state', () async {
      final svc = MemoryService();
      // Wait for async _load
      await Future<void>.delayed(const Duration(milliseconds: 50));
      expect(svc.userName, isEmpty);
      expect(svc.facts, isEmpty);
      expect(svc.memoryEnabled, isTrue);
    });

    test('setUserName persists and notifies', () async {
      final svc = MemoryService();
      await Future<void>.delayed(const Duration(milliseconds: 50));
      var notified = false;
      svc.addListener(() => notified = true);

      await svc.setUserName('Alice');
      expect(svc.userName, 'Alice');
      expect(notified, isTrue);
    });

    test('setUserName trims whitespace', () async {
      final svc = MemoryService();
      await svc.setUserName('  Bob  ');
      expect(svc.userName, 'Bob');
    });

    test('addFact appends and assigns id', () async {
      final svc = MemoryService();
      await Future<void>.delayed(const Duration(milliseconds: 50));
      await svc.addFact('I prefer Python');
      expect(svc.facts.length, 1);
      expect(svc.facts.first.content, 'I prefer Python');
      expect(svc.facts.first.id, isNotEmpty);
    });

    test('addFact ignores empty strings', () async {
      final svc = MemoryService();
      await svc.addFact('');
      expect(svc.facts, isEmpty);
    });

    test('deleteFact removes the correct fact', () async {
      final svc = MemoryService();
      await Future<void>.delayed(const Duration(milliseconds: 50));
      await svc.addFact('Fact A');
      await Future<void>.delayed(const Duration(milliseconds: 2));
      await svc.addFact('Fact B');
      final idA = svc.facts.first.id;
      await svc.deleteFact(idA);
      expect(svc.facts.length, 1);
      expect(svc.facts.first.content, 'Fact B');
    });

    test('updateFact changes content', () async {
      final svc = MemoryService();
      await Future<void>.delayed(const Duration(milliseconds: 50));
      await svc.addFact('Old content');
      final id = svc.facts.first.id;
      await svc.updateFact(id, 'New content');
      expect(svc.facts.first.content, 'New content');
    });

    test('clearAllFacts removes all facts', () async {
      final svc = MemoryService();
      await Future<void>.delayed(const Duration(milliseconds: 50));
      await svc.addFact('Fact 1');
      await svc.addFact('Fact 2');
      await svc.clearAllFacts();
      expect(svc.facts, isEmpty);
    });

    test('buildSystemPrompt includes user name', () async {
      final svc = MemoryService();
      await svc.setUserName('Charlie');
      final prompt = svc.buildSystemPrompt();
      expect(prompt, contains('Charlie'));
    });

    test('buildSystemPrompt returns empty when memory disabled', () async {
      final svc = MemoryService();
      await Future<void>.delayed(const Duration(milliseconds: 50));
      await svc.setUserName('Dave');
      await svc.addFact('Loves Dart');
      await svc.setMemoryEnabled(false);
      expect(svc.buildSystemPrompt(), isEmpty);
    });

    test('buildSystemPrompt includes facts', () async {
      final svc = MemoryService();
      await Future<void>.delayed(const Duration(milliseconds: 50));
      await svc.addFact('Likes Dart', category: FactCategory.professional);
      final prompt = svc.buildSystemPrompt();
      expect(prompt, contains('Likes Dart'));
    });

    test('setInstructions updates and reflects in system prompt', () async {
      final svc = MemoryService();
      await Future<void>.delayed(const Duration(milliseconds: 50));
      await svc.setInstructions(const CustomInstructions(
        userContext: 'I am a developer',
        responseStyle: 'Be concise',
      ));
      final prompt = svc.buildSystemPrompt();
      expect(prompt, contains('I am a developer'));
      expect(prompt, contains('Be concise'));
    });

    test('clearAll wipes everything', () async {
      final svc = MemoryService();
      await Future<void>.delayed(const Duration(milliseconds: 50));
      await svc.setUserName('Eve');
      await svc.addFact('Something');
      await svc.clearAll();
      expect(svc.userName, isEmpty);
      expect(svc.facts, isEmpty);
    });

    test('hasAnyMemory is false when nothing set', () async {
      final svc = MemoryService();
      await Future<void>.delayed(const Duration(milliseconds: 50));
      expect(svc.hasAnyMemory, isFalse);
    });

    test('hasAnyMemory is true after setting name', () async {
      final svc = MemoryService();
      await Future<void>.delayed(const Duration(milliseconds: 50));
      await svc.setUserName('Frank');
      expect(svc.hasAnyMemory, isTrue);
    });
  });
}
