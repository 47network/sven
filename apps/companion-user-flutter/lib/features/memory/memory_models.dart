// ═══════════════════════════════════════════════════════════════════════════
// Memory models — user facts + custom instructions
// ═══════════════════════════════════════════════════════════════════════════

class UserFact {
  const UserFact({
    required this.id,
    required this.content,
    required this.createdAt,
    this.category = FactCategory.general,
    this.isStarred = false,
  });

  final String id;
  final String content;
  final DateTime createdAt;
  final FactCategory category;
  final bool isStarred;

  UserFact copyWith(
          {String? content, FactCategory? category, bool? isStarred}) =>
      UserFact(
        id: id,
        content: content ?? this.content,
        createdAt: createdAt,
        category: category ?? this.category,
        isStarred: isStarred ?? this.isStarred,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'content': content,
        'createdAt': createdAt.toIso8601String(),
        'category': category.name,
        'isStarred': isStarred,
      };

  factory UserFact.fromJson(Map<String, dynamic> json) => UserFact(
        id: json['id'] as String,
        content: json['content'] as String,
        createdAt: DateTime.parse(json['createdAt'] as String),
        category: FactCategory.values.firstWhere(
          (c) => c.name == json['category'],
          orElse: () => FactCategory.general,
        ),
        isStarred: (json['isStarred'] as bool?) ?? false,
      );
}

enum FactCategory {
  general,
  preference,
  professional,
  personal;

  String get label {
    switch (this) {
      case FactCategory.general:
        return 'General';
      case FactCategory.preference:
        return 'Preference';
      case FactCategory.professional:
        return 'Professional';
      case FactCategory.personal:
        return 'Personal';
    }
  }
}

class CustomInstructions {
  const CustomInstructions({
    this.userContext = '',
    this.responseStyle = '',
  });

  /// Who the user is / what they do — added to system prompt context.
  final String userContext;

  /// How Sven should respond — tone, length, format preferences.
  final String responseStyle;

  CustomInstructions copyWith({String? userContext, String? responseStyle}) =>
      CustomInstructions(
        userContext: userContext ?? this.userContext,
        responseStyle: responseStyle ?? this.responseStyle,
      );

  bool get isEmpty =>
      userContext.trim().isEmpty && responseStyle.trim().isEmpty;

  /// Renders to a system prompt preamble.
  String toSystemPrompt() {
    final buf = StringBuffer();
    if (userContext.trim().isNotEmpty) {
      buf.writeln('About the user: ${userContext.trim()}');
    }
    if (responseStyle.trim().isNotEmpty) {
      buf.writeln('Response style: ${responseStyle.trim()}');
    }
    return buf.toString().trim();
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ConversationSummary — stores a short summary of a past conversation
// for cross-conversation context recall
// ═══════════════════════════════════════════════════════════════════════════

class ConversationSummary {
  const ConversationSummary({
    required this.chatId,
    required this.title,
    required this.summary,
    required this.updatedAt,
    this.topicKeywords = const [],
  });

  final String chatId;
  final String title;
  final String summary;
  final DateTime updatedAt;

  /// Extracted topic keywords for quick relevance matching.
  final List<String> topicKeywords;

  Map<String, dynamic> toJson() => {
        'chatId': chatId,
        'title': title,
        'summary': summary,
        'updatedAt': updatedAt.toIso8601String(),
        'topicKeywords': topicKeywords,
      };

  factory ConversationSummary.fromJson(Map<String, dynamic> json) =>
      ConversationSummary(
        chatId: json['chatId'] as String,
        title: json['title'] as String? ?? '',
        summary: json['summary'] as String,
        updatedAt: DateTime.parse(json['updatedAt'] as String),
        topicKeywords: (json['topicKeywords'] as List<dynamic>?)
                ?.map((e) => e as String)
                .toList() ??
            [],
      );
}
