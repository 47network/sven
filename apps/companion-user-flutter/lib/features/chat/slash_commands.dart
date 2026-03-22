import 'package:flutter/material.dart';

/// A slash command that can be typed in the composer.
///
/// When the user types `/` the composer shows a filterable list of these
/// commands.  Selecting one either dispatches an action immediately or inserts
/// a replacement text into the field.
class SlashCommand {
  const SlashCommand({
    required this.command,
    required this.description,
    required this.icon,
    this.insertText,
    this.action,
  });

  /// The trigger word, e.g. `new` (displayed as `/new`).
  final String command;
  final String description;
  final IconData icon;

  /// If non-null, replaces the text field content with this value.
  final String? insertText;

  /// If non-null, called instead of inserting text (e.g., clear, new).
  final void Function(BuildContext ctx)? action;
}

/// All built-in slash commands.
const List<SlashCommand> kSlashCommands = [
  SlashCommand(
    command: 'new',
    description: 'Start a new conversation',
    icon: Icons.add_circle_outline_rounded,
  ),
  SlashCommand(
    command: 'clear',
    description: 'Clear the current conversation',
    icon: Icons.delete_sweep_rounded,
  ),
  SlashCommand(
    command: 'help',
    description: 'Show what Sven can do',
    icon: Icons.help_outline_rounded,
    insertText:
        'Can you give me a quick overview of everything you can help me with?',
  ),
  SlashCommand(
    command: 'mode',
    description: 'Switch conversation mode',
    icon: Icons.tune_rounded,
  ),
  SlashCommand(
    command: 'summarize',
    description: 'Summarize this conversation so far',
    icon: Icons.compress_rounded,
    insertText: 'Please summarize our conversation so far.',
  ),
  SlashCommand(
    command: 'translate',
    description: 'Translate the last message',
    icon: Icons.translate_rounded,
    insertText: 'Translate the above to English.',
  ),
  SlashCommand(
    command: 'explain',
    description: 'Explain in simpler terms',
    icon: Icons.lightbulb_outline_rounded,
    insertText: 'Can you explain that in simpler terms?',
  ),
  SlashCommand(
    command: 'code',
    description: 'Rewrite as clean code',
    icon: Icons.code_rounded,
    insertText: 'Rewrite that as clean, production-ready code.',
  ),
  SlashCommand(
    command: 'remind',
    description: 'Set a reminder notification',
    icon: Icons.alarm_add_rounded,
  ),
  SlashCommand(
    command: 'save',
    description: 'Save current prompt as a template',
    icon: Icons.bookmark_add_outlined,
  ),
  SlashCommand(
    command: 'templates',
    description: 'Insert a saved prompt template',
    icon: Icons.bookmarks_outlined,
  ),
];
