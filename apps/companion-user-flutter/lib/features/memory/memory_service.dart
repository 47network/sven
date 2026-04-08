import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../app/app_models.dart';
import '../../app/scoped_preferences.dart';
import 'memory_models.dart';

// ═══════════════════════════════════════════════════════════════════════════
// MemoryService — persists user facts + custom instructions locally
// ═══════════════════════════════════════════════════════════════════════════

class MemoryService extends ChangeNotifier {
  MemoryService() {
    _load();
  }

  static const _kFacts = 'sven.memory.facts';
  static const _kName = 'sven.memory.name';
  static const _kInstructionsContext = 'sven.memory.instructions.context';
  static const _kInstructionsStyle = 'sven.memory.instructions.style';
  static const _kMemoryEnabled = 'sven.memory.enabled';
  static const _kConversationSummaries = 'sven.memory.conversation_summaries';
  static const _kPersonalityOverride = 'sven.memory.personality_override';
  static const _kPreferredLanguage = 'sven.memory.preferred_language';

  /// All keys managed by this service (for migration).
  static const allKeys = [
    _kFacts,
    _kName,
    _kInstructionsContext,
    _kInstructionsStyle,
    _kMemoryEnabled,
    _kConversationSummaries,
    _kPersonalityOverride,
    _kPreferredLanguage,
  ];

  ScopedPreferences? _scopedPrefs;

  List<UserFact> _facts = [];
  String _userName = '';
  CustomInstructions _instructions = const CustomInstructions();
  bool _memoryEnabled = true;
  bool _loaded = false;
  bool _disposed = false;
  int _idCounter = 0;
  List<ConversationSummary> _conversationSummaries = [];
  String _personalityOverride = '';

  /// ISO-639-1 language code detected from recent message content.
  /// Empty string = no detection yet (assume English).
  String _detectedLanguage = '';

  /// User's explicit language preference. 'auto' = follow auto-detection.
  String _preferredLanguage = 'auto';

  /// Maximum number of recent conversation summaries to keep.
  static const _maxSummaries = 10;

  @override
  void dispose() {
    if (_disposed) return;
    _disposed = true;
    super.dispose();
  }

  // ── Scoped storage helpers ──

  Future<String?> _getString(String key) async {
    if (_scopedPrefs != null && _scopedPrefs!.isBound) {
      return _scopedPrefs!.getString(key);
    }
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(key);
  }

  Future<bool?> _getBool(String key) async {
    if (_scopedPrefs != null && _scopedPrefs!.isBound) {
      return _scopedPrefs!.getBool(key);
    }
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(key);
  }

  Future<void> _setString(String key, String value) async {
    if (_scopedPrefs != null && _scopedPrefs!.isBound) {
      await _scopedPrefs!.setString(key, value);
    } else {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(key, value);
    }
  }

  Future<void> _setBool(String key, bool value) async {
    if (_scopedPrefs != null && _scopedPrefs!.isBound) {
      await _scopedPrefs!.setBool(key, value);
    } else {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool(key, value);
    }
  }

  Future<void> _removeKey(String key) async {
    if (_scopedPrefs != null && _scopedPrefs!.isBound) {
      await _scopedPrefs!.remove(key);
    } else {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(key);
    }
  }

  /// Bind to a user and reload from scoped storage.
  Future<void> bindUser(ScopedPreferences scopedPrefs) async {
    _scopedPrefs = scopedPrefs;
    await _scopedPrefs!.migrateUnscopedKeys(allKeys);
    await _reload();
  }

  /// Reset in-memory state on logout.
  void resetForLogout() {
    _scopedPrefs = null;
    _facts = [];
    _userName = '';
    _instructions = const CustomInstructions();
    _memoryEnabled = true;
    _loaded = false;
    _idCounter = 0;
    _conversationSummaries = [];
    _personalityOverride = '';
    _detectedLanguage = '';
    _preferredLanguage = 'auto';
    notifyListeners();
  }

  // ── Getters ──
  List<UserFact> get facts => List.unmodifiable(_facts);
  String get userName => _userName;
  CustomInstructions get instructions => _instructions;
  bool get memoryEnabled => _memoryEnabled;
  bool get loaded => _loaded;
  List<ConversationSummary> get conversationSummaries =>
      List.unmodifiable(_conversationSummaries);

  /// User-authored personality description layered on top of the
  /// selected [VoicePersonality] preset.
  String get personalityOverride => _personalityOverride;

  /// True if the user has any non-empty memory.
  bool get hasAnyMemory =>
      _userName.isNotEmpty ||
      _facts.isNotEmpty ||
      !_instructions.isEmpty ||
      _conversationSummaries.isNotEmpty;

  // ── Load / Save ──

  Future<void> _load() async {
    _userName = (await _getString(_kName)) ?? '';
    _memoryEnabled = (await _getBool(_kMemoryEnabled)) ?? true;
    _instructions = CustomInstructions(
      userContext: (await _getString(_kInstructionsContext)) ?? '',
      responseStyle: (await _getString(_kInstructionsStyle)) ?? '',
    );
    final factsJson = await _getString(_kFacts);
    if (factsJson != null) {
      try {
        final list = jsonDecode(factsJson) as List<dynamic>;
        _facts = list
            .map((e) => UserFact.fromJson(e as Map<String, dynamic>))
            .toList();
      } catch (_) {
        _facts = [];
      }
    }

    final summariesJson = await _getString(_kConversationSummaries);
    if (summariesJson != null) {
      try {
        final list = jsonDecode(summariesJson) as List<dynamic>;
        _conversationSummaries = list
            .map((e) => ConversationSummary.fromJson(e as Map<String, dynamic>))
            .toList();
      } catch (_) {
        _conversationSummaries = [];
      }
    }

    _personalityOverride = (await _getString(_kPersonalityOverride)) ?? '';
    _preferredLanguage = (await _getString(_kPreferredLanguage)) ?? 'auto';

    _loaded = true;
    notifyListeners();
  }

  Future<void> _reload() async {
    _loaded = false;
    await _load();
  }

  Future<void> _saveFacts() async {
    await _setString(
      _kFacts,
      jsonEncode(_facts.map((f) => f.toJson()).toList()),
    );
  }

  // ── User name ──

  Future<void> setUserName(String name) async {
    _userName = name.trim();
    notifyListeners();
    await _setString(_kName, _userName);
  }

  // ── Memory enabled toggle ──

  Future<void> setMemoryEnabled(bool enabled) async {
    _memoryEnabled = enabled;
    notifyListeners();
    await _setBool(_kMemoryEnabled, enabled);
  }

  // ── Facts CRUD ──

  Future<void> addFact(String content,
      {FactCategory category = FactCategory.general}) async {
    if (content.trim().isEmpty) return;
    final fact = UserFact(
      id: '${DateTime.now().millisecondsSinceEpoch}_${_idCounter++}',
      content: content.trim(),
      createdAt: DateTime.now(),
      category: category,
    );
    _facts.add(fact);
    notifyListeners();
    await _saveFacts();
  }

  Future<void> updateFact(String id, String newContent,
      {FactCategory? category}) async {
    final idx = _facts.indexWhere((f) => f.id == id);
    if (idx < 0) return;
    _facts[idx] = _facts[idx].copyWith(
      content: newContent.trim(),
      category: category,
    );
    notifyListeners();
    await _saveFacts();
  }

  Future<void> toggleStarFact(String id) async {
    final idx = _facts.indexWhere((f) => f.id == id);
    if (idx < 0) return;
    _facts[idx] = _facts[idx].copyWith(isStarred: !_facts[idx].isStarred);
    notifyListeners();
    await _saveFacts();
  }

  Future<void> deleteFact(String id) async {
    _facts.removeWhere((f) => f.id == id);
    notifyListeners();
    await _saveFacts();
  }

  Future<void> clearAllFacts() async {
    _facts.clear();
    notifyListeners();
    await _saveFacts();
  }

  // ── Custom instructions ──

  Future<void> setInstructions(CustomInstructions instructions) async {
    _instructions = instructions;
    notifyListeners();
    await _setString(_kInstructionsContext, instructions.userContext);
    await _setString(_kInstructionsStyle, instructions.responseStyle);
  }

  // ── Conversation summaries ──

  Future<void> _saveSummaries() async {
    await _setString(
      _kConversationSummaries,
      jsonEncode(_conversationSummaries.map((s) => s.toJson()).toList()),
    );
  }

  /// Upsert a summary for a conversation. Keeps at most [_maxSummaries].
  Future<void> upsertConversationSummary({
    required String chatId,
    required String title,
    required String summary,
    List<String> topicKeywords = const [],
  }) async {
    if (summary.trim().isEmpty) return;
    _conversationSummaries.removeWhere((s) => s.chatId == chatId);
    _conversationSummaries.add(ConversationSummary(
      chatId: chatId,
      title: title,
      summary: summary.trim(),
      updatedAt: DateTime.now(),
      topicKeywords: topicKeywords,
    ));
    // Prune to max
    if (_conversationSummaries.length > _maxSummaries) {
      _conversationSummaries.sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
      _conversationSummaries =
          _conversationSummaries.take(_maxSummaries).toList();
    }
    notifyListeners();
    await _saveSummaries();
  }

  /// Remove a conversation summary.
  Future<void> removeConversationSummary(String chatId) async {
    _conversationSummaries.removeWhere((s) => s.chatId == chatId);
    notifyListeners();
    await _saveSummaries();
  }

  /// Auto-extract a summary from message texts.
  /// Takes the last few user+assistant turns and produces a concise summary.
  String extractSummaryFromMessages(List<String> messages) {
    if (messages.isEmpty) return '';
    // Take the last 6 messages (3 turns max)
    final recent =
        messages.length > 6 ? messages.sublist(messages.length - 6) : messages;
    // Produce a simple topic-based summary from the messages
    final joined = recent.join(' ').replaceAll(RegExp(r'\s+'), ' ');
    // Truncate to 300 chars
    if (joined.length > 300) {
      return '${joined.substring(0, 297)}...';
    }
    return joined;
  }

  /// Extract topic keywords from message texts for cross-conversation matching.
  List<String> extractTopicKeywords(List<String> messages) {
    if (messages.isEmpty) return [];
    final text = messages.join(' ').toLowerCase();
    // Simple keyword extraction: find frequently occurring non-stop-words
    final stopWords = {
      'the',
      'a',
      'an',
      'is',
      'are',
      'was',
      'were',
      'be',
      'been',
      'being',
      'have',
      'has',
      'had',
      'do',
      'does',
      'did',
      'will',
      'would',
      'shall',
      'should',
      'may',
      'might',
      'must',
      'can',
      'could',
      'to',
      'of',
      'in',
      'for',
      'on',
      'with',
      'at',
      'by',
      'from',
      'as',
      'into',
      'about',
      'between',
      'through',
      'after',
      'before',
      'above',
      'below',
      'that',
      'this',
      'it',
      'its',
      'i',
      'me',
      'my',
      'we',
      'our',
      'you',
      'your',
      'he',
      'she',
      'they',
      'them',
      'their',
      'what',
      'which',
      'who',
      'when',
      'where',
      'how',
      'not',
      'no',
      'but',
      'or',
      'and',
      'if',
      'then',
      'so',
      'just',
      'also',
      'like',
      'some',
      'any',
      'all',
      'more',
      'very',
      'too',
      'much',
      'many',
      'well',
      'here',
      'there',
      'now',
      'up',
      'out',
      'one',
      'two',
      'get',
      'got',
      'make',
      'know',
      'think',
      'want',
      'need',
      'use',
      'try',
      'tell',
      'give',
      'say',
      'said',
      'let',
      'see',
      'go',
      'come',
      'take',
      'sure',
      'ok',
      'yes',
    };
    final words = text
        .replaceAll(RegExp(r'[^a-z0-9\s]'), ' ')
        .split(RegExp(r'\s+'))
        .where((w) => w.length > 3 && !stopWords.contains(w))
        .toList();
    final freq = <String, int>{};
    for (final w in words) {
      freq[w] = (freq[w] ?? 0) + 1;
    }
    final sorted = freq.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));
    return sorted.take(5).map((e) => e.key).toList();
  }

  // ── Language detection ──

  /// Returns the ISO-639-1 language code currently stored, or empty string.
  String get detectedLanguage => _detectedLanguage;

  /// The user's preferred response language. 'auto' = follow auto-detection.
  String get preferredLanguage => _preferredLanguage;

  /// Persist the user's explicit language preference.
  /// Pass 'auto' to go back to auto-detection.
  Future<void> setPreferredLanguage(String lang) async {
    _preferredLanguage = lang;
    notifyListeners();
    if (lang == 'auto') {
      await _removeKey(_kPreferredLanguage);
    } else {
      await _setString(_kPreferredLanguage, lang);
    }
  }

  /// Heuristically detect the language from raw message texts.
  /// Stores the result and returns the detected language name (English label)
  /// or empty string when the language appears to be English / unrecognised.
  String detectLanguage(List<String> messages) {
    if (messages.isEmpty) return '';
    final sample = messages
        .where((m) => m.trim().length > 10)
        .take(10)
        .join(' ')
        .toLowerCase();

    // Language fingerprint — common stop-words/patterns per language.
    // These are chosen to have minimal overlap with English.
    const fingerprints = <String, List<String>>{
      'Spanish': [
        'que',
        'con',
        'para',
        'una',
        'est\u00e1',
        'est\u00e1n',
        'tambi\u00e9n',
        'pero',
        'como',
        'cuando',
        'porque',
        'esto',
        'ser\u00e1'
      ],
      'French': [
        'les',
        'des',
        'est',
        'une',
        'que',
        'pour',
        'dans',
        'avec',
        'qui',
        'pas',
        'mais',
        'donc',
        's\'il',
        'tr\u00e8s'
      ],
      'German': [
        'die',
        'der',
        'das',
        'und',
        'ist',
        'nicht',
        'sie',
        'wir',
        'auch',
        'aber',
        'oder',
        'ein',
        'ich',
        'eine'
      ],
      'Portuguese': [
        'que',
        'uma',
        'para',
        'com',
        'por',
        'mas',
        'como',
        'isso',
        'este',
        'n\u00e3o',
        'tamb\u00e9m'
      ],
      'Italian': [
        'che',
        'una',
        'per',
        'con',
        'sono',
        'come',
        'anche',
        'questo',
        'sulla',
        'della'
      ],
      'Dutch': [
        'het',
        'een',
        'van',
        'dat',
        'niet',
        'zijn',
        'aan',
        'ook',
        'maar',
        'over'
      ],
      'Russian': [
        '\u044d\u0442\u043e',
        '\u043d\u0435',
        '\u0447\u0442\u043e',
        '\u043a\u0430\u043a',
        '\u0442\u043e',
        '\u0432'
      ],
      'Arabic': [
        '\u0645\u0646',
        '\u0641\u064a',
        '\u0639\u0644\u0649',
        '\u0647\u0630\u0627',
        '\u0627\u0644'
      ],
      'Japanese': [
        '\u3067\u3059',
        '\u307e\u3059',
        '\u3092',
        '\u306f',
        '\u306b',
        '\u3044'
      ],
      'Chinese': ['\u7684', '\u662f', '\u6211', '\u4e0d', '\u5728', '\u4e86'],
      'Korean': [
        '\uc784\ub2c8\ub2e4',
        '\uc6a9',
        '\u0020\uc774',
        '\ub098',
        '\uac00'
      ],
    };

    final scores = <String, int>{};
    for (final entry in fingerprints.entries) {
      int hits = 0;
      for (final word in entry.value) {
        if (sample.contains(word)) hits++;
      }
      if (hits > 0) scores[entry.key] = hits;
    }

    if (scores.isEmpty) {
      _detectedLanguage = '';
      return '';
    }
    final best = scores.entries.reduce((a, b) => a.value >= b.value ? a : b);
    // Require at least 2 signal words to confidence-gate the result.
    if (best.value < 2) {
      _detectedLanguage = '';
      return '';
    }
    _detectedLanguage = best.key;
    return best.key;
  }

  /// Builds the system prompt preamble from memory + instructions +
  /// recent conversation summaries for cross-conversation context.
  /// Returns empty string if memory is disabled or nothing is set.
  String buildSystemPrompt({
    String? currentChatId,
    VoicePersonality? personality,
  }) {
    if (!_memoryEnabled) return '';
    final buf = StringBuffer();

    // ── Personality directive (always first) ──
    if (personality != null) {
      buf.writeln(personality.systemDirective);
      if (_personalityOverride.isNotEmpty) {
        buf.writeln(
          'Additional personality notes from the user: $_personalityOverride',
        );
      }
      buf.writeln();
    }

    if (_userName.isNotEmpty) {
      buf.writeln("The user's name is $_userName.");
    }

    // Language instruction: explicit user preference takes priority
    final effectiveLang =
        _preferredLanguage != 'auto' ? _preferredLanguage : _detectedLanguage;
    if (effectiveLang.isNotEmpty) {
      buf.writeln(
        'The user communicates in $effectiveLang. '
        'Unless they explicitly ask you to switch languages, '
        'respond in $effectiveLang.',
      );
    }

    if (_facts.isNotEmpty) {
      buf.writeln('\nWhat I know about the user:');
      for (final fact in _facts) {
        buf.writeln('- ${fact.content}');
      }
    }

    final instrPrompt = _instructions.toSystemPrompt();
    if (instrPrompt.isNotEmpty) {
      buf.writeln('\n$instrPrompt');
    }

    // Cross-conversation context — include recent conversation summaries
    // excluding the current one, with explicit recall instructions
    final otherSummaries = _conversationSummaries
        .where((s) => s.chatId != currentChatId && s.summary.isNotEmpty)
        .toList()
      ..sort((a, b) => b.updatedAt.compareTo(a.updatedAt));

    if (otherSummaries.isNotEmpty) {
      buf.writeln('\nYou have memory of past conversations with this user. '
          'When relevant, naturally reference them with phrases like '
          '"Last time you mentioned…", "Earlier we discussed…", '
          'or "You were working on…". '
          'Only reference past context when it is genuinely relevant — '
          'do not force it into every response.');
      buf.writeln();
      buf.writeln('Past conversations:');
      for (final s in otherSummaries.take(5)) {
        final label = s.title.isNotEmpty ? s.title : 'Untitled';
        final age = DateTime.now().difference(s.updatedAt);
        final timeAgo = age.inDays > 0
            ? '${age.inDays}d ago'
            : age.inHours > 0
                ? '${age.inHours}h ago'
                : 'recently';
        final keywords = s.topicKeywords.isNotEmpty
            ? ' [topics: ${s.topicKeywords.join(", ")}]'
            : '';
        buf.writeln('- [$label] ($timeAgo)$keywords: ${s.summary}');
      }
    }

    return buf.toString().trim();
  }

  // ── Clear everything ──

  Future<void> clearAll() async {
    _facts.clear();
    _userName = '';
    _instructions = const CustomInstructions();
    _conversationSummaries.clear();
    _personalityOverride = '';
    notifyListeners();
    await _removeKey(_kFacts);
    await _removeKey(_kName);
    await _removeKey(_kInstructionsContext);
    await _removeKey(_kInstructionsStyle);
    await _removeKey(_kConversationSummaries);
    await _removeKey(_kPersonalityOverride);
    _preferredLanguage = 'auto';
    await _removeKey(_kPreferredLanguage);
  }

  /// Set a custom personality override description.
  Future<void> setPersonalityOverride(String value) async {
    _personalityOverride = value.trim();
    notifyListeners();
    if (_personalityOverride.isEmpty) {
      await _removeKey(_kPersonalityOverride);
    } else {
      await _setString(_kPersonalityOverride, _personalityOverride);
    }
  }
}
