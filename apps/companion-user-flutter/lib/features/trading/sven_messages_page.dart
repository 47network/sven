// ═══════════════════════════════════════════════════════════════════════════
// SvenMessagesPage — Sven's proactive messages feed.
//
// Displays messages from Sven: trade alerts, market insights, scheduled
// messages, and system notifications. Pull-to-refresh. Badge-aware.
// ═══════════════════════════════════════════════════════════════════════════

import 'package:flutter/material.dart';

import '../../app/app_models.dart';
import '../../app/sven_tokens.dart';
import 'trading_models.dart';
import 'trading_service.dart';

class SvenMessagesPage extends StatefulWidget {
  const SvenMessagesPage({
    super.key,
    required this.tradingService,
    required this.visualMode,
  });

  final TradingService tradingService;
  final VisualMode visualMode;

  @override
  State<SvenMessagesPage> createState() => _SvenMessagesPageState();
}

class _SvenMessagesPageState extends State<SvenMessagesPage> {
  @override
  void initState() {
    super.initState();
    widget.tradingService.addListener(_onUpdate);
    widget.tradingService.fetchMessages();
  }

  @override
  void dispose() {
    widget.tradingService.removeListener(_onUpdate);
    super.dispose();
  }

  void _onUpdate() => setState(() {});

  @override
  Widget build(BuildContext context) {
    final tokens = SvenTokens.forMode(widget.visualMode);
    final messages = widget.tradingService.messages;

    return Scaffold(
      backgroundColor: tokens.scaffold,
      appBar: AppBar(
        title: const Text('Sven Messages'),
        backgroundColor: Colors.transparent,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: widget.tradingService.fetchMessages,
          ),
        ],
      ),
      body: RefreshIndicator(
        color: tokens.primary,
        onRefresh: widget.tradingService.fetchMessages,
        child: messages.isEmpty
            ? _EmptyState(tokens: tokens)
            : ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: messages.length,
                itemBuilder: (_, i) => _MessageTile(
                  message: messages[i],
                  tokens: tokens,
                ),
              ),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.tokens});
  final SvenModeTokens tokens;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.message_outlined, color: tokens.onSurface.withValues(alpha: 0.3), size: 56),
          const SizedBox(height: 12),
          Text(
            'No messages from Sven yet',
            style: TextStyle(color: tokens.onSurface.withValues(alpha: 0.5), fontSize: 15),
          ),
          const SizedBox(height: 4),
          Text(
            'Sven will send alerts when trades execute\nor market conditions change.',
            textAlign: TextAlign.center,
            style: TextStyle(color: tokens.onSurface.withValues(alpha: 0.35), fontSize: 13),
          ),
        ],
      ),
    );
  }
}

class _MessageTile extends StatelessWidget {
  const _MessageTile({required this.message, required this.tokens});

  final SvenMessage message;
  final SvenModeTokens tokens;

  @override
  Widget build(BuildContext context) {
    final typeIcon = switch (message.type) {
      'trade_alert' => Icons.trending_up_rounded,
      'market_insight' => Icons.insights_rounded,
      'scheduled' => Icons.schedule_rounded,
      _ => Icons.info_outline_rounded,
    };

    final severityColor = switch (message.severity) {
      'critical' => Colors.red,
      'warning' => Colors.orange,
      _ => tokens.primary,
    };

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: tokens.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: message.read
              ? tokens.frame.withValues(alpha: 0.15)
              : severityColor.withValues(alpha: 0.4),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(typeIcon, color: severityColor, size: 18),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  message.title,
                  style: TextStyle(
                    color: tokens.onSurface,
                    fontWeight: message.read ? FontWeight.w500 : FontWeight.w700,
                    fontSize: 14,
                  ),
                ),
              ),
              if (!message.read)
                Container(
                  width: 8,
                  height: 8,
                  decoration: BoxDecoration(
                    color: severityColor,
                    shape: BoxShape.circle,
                  ),
                ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            message.body,
            style: TextStyle(
              color: tokens.onSurface.withValues(alpha: 0.7),
              fontSize: 13,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              if (message.symbol != null) ...[
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: tokens.primary.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    message.symbol!,
                    style: TextStyle(
                      color: tokens.primary,
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
              ],
              Text(
                _formatTime(message.createdAt),
                style: TextStyle(
                  color: tokens.onSurface.withValues(alpha: 0.4),
                  fontSize: 11,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  static String _formatTime(String iso) {
    final dt = DateTime.tryParse(iso);
    if (dt == null) return iso;
    final local = dt.toLocal();
    final diff = DateTime.now().difference(local);
    if (diff.inMinutes < 1) return 'Just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    return '${local.day}/${local.month} ${local.hour.toString().padLeft(2, '0')}:${local.minute.toString().padLeft(2, '0')}';
  }
}
