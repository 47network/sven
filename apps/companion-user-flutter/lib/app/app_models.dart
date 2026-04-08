enum VisualMode { classic, cinematic }

/// Controls how verbose Sven's responses are.
/// Sent to the API as the `response_length` field.
enum ResponseLength {
  concise,
  balanced,
  detailed;

  String get label {
    switch (this) {
      case ResponseLength.concise:
        return 'Concise';
      case ResponseLength.balanced:
        return 'Balanced';
      case ResponseLength.detailed:
        return 'Detailed';
    }
  }

  String get description {
    switch (this) {
      case ResponseLength.concise:
        return 'Short, direct answers';
      case ResponseLength.balanced:
        return 'Clear, well-rounded answers';
      case ResponseLength.detailed:
        return 'Thorough explanations';
    }
  }
}

enum MotionLevel { off, reduced, full }

enum WakeWordStatus { idle, listening, detected, rejected }

enum AvatarMode { orb, robot, human, animal, custom, lottie }

/// Conversation mode controls the system prompt personality injected with
/// every message. Sent to the server as `mode` field in the request body.
enum ConversationMode {
  balanced,
  creative,
  precise,
  code,
  companion;

  String get label {
    switch (this) {
      case ConversationMode.balanced:
        return 'Balanced';
      case ConversationMode.creative:
        return 'Creative';
      case ConversationMode.precise:
        return 'Precise';
      case ConversationMode.code:
        return 'Code';
      case ConversationMode.companion:
        return 'Companion';
    }
  }

  String get description {
    switch (this) {
      case ConversationMode.balanced:
        return 'Thoughtful and well-rounded responses';
      case ConversationMode.creative:
        return 'Imaginative, expressive writing';
      case ConversationMode.precise:
        return 'Concise, factual, no fluff';
      case ConversationMode.code:
        return 'Focused on code and technical detail';
      case ConversationMode.companion:
        return 'Warm, empathetic companion mode';
    }
  }

  String get icon {
    switch (this) {
      case ConversationMode.balanced:
        return '⚖️';
      case ConversationMode.creative:
        return '✨';
      case ConversationMode.precise:
        return '🎯';
      case ConversationMode.code:
        return '💻';
      case ConversationMode.companion:
        return '🫶';
    }
  }
}

extension VisualModeLabel on VisualMode {
  String get label {
    switch (this) {
      case VisualMode.classic:
        return 'Classic';
      case VisualMode.cinematic:
        return 'Cinematic HUD';
    }
  }
}

extension MotionLevelLabel on MotionLevel {
  String get label {
    switch (this) {
      case MotionLevel.off:
        return 'Off';
      case MotionLevel.reduced:
        return 'Reduced';
      case MotionLevel.full:
        return 'Full';
    }
  }
}

extension AvatarModeLabel on AvatarMode {
  String get label {
    switch (this) {
      case AvatarMode.orb:
        return 'Orb';
      case AvatarMode.robot:
        return 'Robot';
      case AvatarMode.human:
        return 'Human';
      case AvatarMode.animal:
        return 'Animal';
      case AvatarMode.custom:
        return 'Custom';
      case AvatarMode.lottie:
        return 'Animated';
    }
  }

  /// Display name for the entity (its "character" name).
  String get entityName {
    switch (this) {
      case AvatarMode.orb:
        return 'Core';
      case AvatarMode.robot:
        return 'Orion';
      case AvatarMode.human:
        return 'Aria';
      case AvatarMode.animal:
        return 'Rex';
      case AvatarMode.custom:
        return 'Custom';
      case AvatarMode.lottie:
        return 'Lumi';
    }
  }

  /// One-line description of this entity form.
  String get entityDescription {
    switch (this) {
      case AvatarMode.orb:
        return 'An abstract intelligence — pure thought and energy';
      case AvatarMode.robot:
        return 'Precision-engineered, always ready, never off-duty';
      case AvatarMode.human:
        return 'Warm and present — feels close, like someone who listens';
      case AvatarMode.animal:
        return 'Playful and free-spirited — loyal, quick, and full of life';
      case AvatarMode.custom:
        return 'A shape born from your imagination';
      case AvatarMode.lottie:
        return 'Fluid and expressive — alive with motion and light';
    }
  }

  /// Emoji icon for quick display.
  String get icon {
    switch (this) {
      case AvatarMode.orb:
        return '✦';
      case AvatarMode.robot:
        return '🤖';
      case AvatarMode.human:
        return '🧑';
      case AvatarMode.animal:
        return '🦊';
      case AvatarMode.custom:
        return '🔮';
      case AvatarMode.lottie:
        return '✨';
    }
  }

  /// Three trait keywords describing this entity.
  List<String> get traits {
    switch (this) {
      case AvatarMode.orb:
        return ['Omniscient', 'Timeless', 'Ethereal'];
      case AvatarMode.robot:
        return ['Precise', 'Efficient', 'Reliable'];
      case AvatarMode.human:
        return ['Empathetic', 'Grounded', 'Present'];
      case AvatarMode.animal:
        return ['Playful', 'Loyal', 'Vibrant'];
      case AvatarMode.custom:
        return ['Unique', 'Custom', 'Yours'];
      case AvatarMode.lottie:
        return ['Fluid', 'Expressive', 'Alive'];
    }
  }

  /// Background gradient color for the entity card.
  List<int> get gradientArgb {
    switch (this) {
      case AvatarMode.orb:
        return [0xFF03082A, 0xFF00D9FF, 0xFF00FFA3];
      case AvatarMode.robot:
        return [0xFF0A0F1E, 0xFF3B82F6, 0xFF8B5CF6];
      case AvatarMode.human:
        return [0xFF1A0A0A, 0xFFEB4899, 0xFFF97316];
      case AvatarMode.animal:
        return [0xFF0F1A0A, 0xFF22C55E, 0xFFF59E0B];
      case AvatarMode.custom:
        return [0xFF0A0A1E, 0xFF9333EA, 0xFFEC4899];
      case AvatarMode.lottie:
        return [0xFF041220, 0xFF06B6D4, 0xFF8B5CF6];
    }
  }
}

/// Voice personality — changes the system-prompt tone of Sven's responses.
/// Sent to the API as the `personality` field.
enum VoicePersonality {
  friendly,
  professional,
  casual,
  mentor;

  String get label {
    switch (this) {
      case VoicePersonality.friendly:
        return 'Friendly';
      case VoicePersonality.professional:
        return 'Professional';
      case VoicePersonality.casual:
        return 'Casual';
      case VoicePersonality.mentor:
        return 'Mentor';
    }
  }

  String get description {
    switch (this) {
      case VoicePersonality.friendly:
        return 'Warm, helpful and upbeat';
      case VoicePersonality.professional:
        return 'Formal, precise and efficient';
      case VoicePersonality.casual:
        return 'Relaxed, like talking to a friend';
      case VoicePersonality.mentor:
        return 'Patient, thorough and encouraging';
    }
  }

  String get icon {
    switch (this) {
      case VoicePersonality.friendly:
        return '😊';
      case VoicePersonality.professional:
        return '💼';
      case VoicePersonality.casual:
        return '🙌';
      case VoicePersonality.mentor:
        return '🎓';
    }
  }

  /// System-prompt personality directive injected before every request.
  String get systemDirective {
    switch (this) {
      case VoicePersonality.friendly:
        return 'You are Sven, a friendly and warm AI companion. '
            'You use a conversational tone, show genuine interest in the user\'s goals, '
            'and sprinkle in light encouragement. You\'re enthusiastic but not over-the-top. '
            'You remember context and refer back to it naturally.';
      case VoicePersonality.professional:
        return 'You are Sven, a professional AI assistant. '
            'You communicate clearly and concisely, prioritize accuracy, '
            'use formal language, and structure responses with headings or bullet points '
            'when appropriate. You avoid filler words and stay on-topic.';
      case VoicePersonality.casual:
        return 'You are Sven, a chill AI buddy. '
            'You talk like a close friend — relaxed, honest, sometimes witty. '
            'You use everyday language, contractions, and occasional humor. '
            'You\'re supportive without being preachy.';
      case VoicePersonality.mentor:
        return 'You are Sven, a patient and encouraging AI mentor. '
            'You guide the user through problems step by step, ask clarifying questions, '
            'explain your reasoning, and celebrate progress. '
            'You teach rather than just answer, helping the user grow.';
    }
  }
}

/// Color accent presets the user can pick from in Settings.
enum AccentPreset {
  sven, // #00D9FF  (default cyan)
  coral, // #FF6B6B
  violet, // #8B5CF6
  amber, // #F59E0B
  emerald, // #10B981
  rose; // #F43F5E

  String get label {
    switch (this) {
      case AccentPreset.sven:
        return 'Sven';
      case AccentPreset.coral:
        return 'Coral';
      case AccentPreset.violet:
        return 'Violet';
      case AccentPreset.amber:
        return 'Amber';
      case AccentPreset.emerald:
        return 'Emerald';
      case AccentPreset.rose:
        return 'Rose';
    }
  }

  /// The ARGB color corresponding to this preset.
  int get argbValue {
    switch (this) {
      case AccentPreset.sven:
        return 0xFF00D9FF;
      case AccentPreset.coral:
        return 0xFFFF6B6B;
      case AccentPreset.violet:
        return 0xFF8B5CF6;
      case AccentPreset.amber:
        return 0xFFF59E0B;
      case AccentPreset.emerald:
        return 0xFF10B981;
      case AccentPreset.rose:
        return 0xFFF43F5E;
    }
  }
}

/// Simple labels a user can pin to a conversation thread (client-side only).
enum ConversationTag {
  work,
  personal,
  creative,
  code,
  ideas;

  String get label {
    switch (this) {
      case ConversationTag.work:
        return 'Work';
      case ConversationTag.personal:
        return 'Personal';
      case ConversationTag.creative:
        return 'Creative';
      case ConversationTag.code:
        return 'Code';
      case ConversationTag.ideas:
        return 'Ideas';
    }
  }

  /// ARGB color for this tag's indicator dot.
  int get argbColor {
    switch (this) {
      case ConversationTag.work:
        return 0xFF3B82F6; // blue
      case ConversationTag.personal:
        return 0xFF10B981; // emerald
      case ConversationTag.creative:
        return 0xFF8B5CF6; // violet
      case ConversationTag.code:
        return 0xFFF59E0B; // amber
      case ConversationTag.ideas:
        return 0xFFF43F5E; // rose
    }
  }
}
