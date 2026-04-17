// ═══════════════════════════════════════════════════════════════════════════
// TradeHistoryPage — Full history of Sven's executed trades.
//
// Shows every trade with: symbol, side (buy/sell), quantity, price,
// confidence, P&L, and timestamp. Pull-to-refresh, grouped by date.
// ═══════════════════════════════════════════════════════════════════════════

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../app/app_models.dart';
import '../../app/sven_tokens.dart';
import 'trading_models.dart';
import 'trading_service.dart';

class TradeHistoryPage extends StatefulWidget {
  const TradeHistoryPage({
    super.key,
    required this.tradingService,
    required this.visualMode,
  });

  final TradingService tradingService;
  final VisualMode visualMode;

  @override
  State<TradeHistoryPage> createState() => _TradeHistoryPageState();
}

class _TradeHistoryPageState extends State<TradeHistoryPage> {
  @override
  void initState() {
    super.initState();
    widget.tradingService.addListener(_onUpdate);
    widget.tradingService.fetchTrades();
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
    final trades = widget.tradingService.trades;
    final status = widget.tradingService.status;

    // Compute aggregate stats from the trade list.
    final totalTrades = trades.length;
    final buyCount = trades.where((t) => t.side == 'buy').length;
    final sellCount = trades.where((t) => t.side == 'sell').length;

    return Scaffold(
      backgroundColor: tokens.scaffold,
      appBar: AppBar(
        title: const Text('Trade History'),
        backgroundColor: Colors.transparent,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () {
              HapticFeedback.lightImpact();
              widget.tradingService.fetchTrades();
            },
          ),
        ],
      ),
      body: RefreshIndicator(
        color: tokens.primary,
        onRefresh: widget.tradingService.fetchTrades,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // ── Summary bar ──────────────────────────────────────────
            _SummaryCard(
              tokens: tokens,
              totalTrades: totalTrades,
              buyCount: buyCount,
              sellCount: sellCount,
              totalExecuted: status?.autoTrade.totalExecuted ?? 0,
            ),
            const SizedBox(height: 16),
            // ── Trade list ───────────────────────────────────────────
            if (trades.isEmpty)
              _EmptyState(tokens: tokens)
            else
              ...trades.map((trade) => Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: _TradeCard(trade: trade, tokens: tokens),
                  )),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary card at the top
// ─────────────────────────────────────────────────────────────────────────────

class _SummaryCard extends StatelessWidget {
  const _SummaryCard({
    required this.tokens,
    required this.totalTrades,
    required this.buyCount,
    required this.sellCount,
    required this.totalExecuted,
  });

  final SvenModeTokens tokens;
  final int totalTrades;
  final int buyCount;
  final int sellCount;
  final int totalExecuted;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: tokens.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: tokens.frame),
      ),
      child: Row(
        children: [
          _StatColumn(
            label: 'Total',
            value: '$totalExecuted',
            color: tokens.primary,
            tokens: tokens,
          ),
          _StatColumn(
            label: 'In View',
            value: '$totalTrades',
            color: tokens.onSurface,
            tokens: tokens,
          ),
          _StatColumn(
            label: 'Buys',
            value: '$buyCount',
            color: Colors.greenAccent,
            tokens: tokens,
          ),
          _StatColumn(
            label: 'Sells',
            value: '$sellCount',
            color: Colors.redAccent,
            tokens: tokens,
          ),
        ],
      ),
    );
  }
}

class _StatColumn extends StatelessWidget {
  const _StatColumn({
    required this.label,
    required this.value,
    required this.color,
    required this.tokens,
  });

  final String label;
  final String value;
  final Color color;
  final SvenModeTokens tokens;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        children: [
          Text(
            value,
            style: TextStyle(
              color: color,
              fontWeight: FontWeight.w700,
              fontSize: 20,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: TextStyle(
              color: tokens.onSurface.withValues(alpha: 0.5),
              fontSize: 11,
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Individual trade card
// ─────────────────────────────────────────────────────────────────────────────

class _TradeCard extends StatelessWidget {
  const _TradeCard({required this.trade, required this.tokens});

  final SvenTrade trade;
  final SvenModeTokens tokens;

  @override
  Widget build(BuildContext context) {
    final isBuy = trade.side == 'buy';
    final sideColor = isBuy ? Colors.greenAccent : Colors.redAccent;
    final sideIcon =
        isBuy ? Icons.arrow_upward_rounded : Icons.arrow_downward_rounded;

    // Format timestamp.
    final ts = DateTime.tryParse(trade.timestamp);
    final timeStr = ts != null
        ? '${ts.month}/${ts.day} ${ts.hour.toString().padLeft(2, '0')}:${ts.minute.toString().padLeft(2, '0')}'
        : trade.timestamp;

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: tokens.card,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: sideColor.withValues(alpha: 0.3),
          width: 0.8,
        ),
      ),
      child: Row(
        children: [
          // Side icon
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: sideColor.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(sideIcon, color: sideColor, size: 18),
          ),
          const SizedBox(width: 12),
          // Symbol + side
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  trade.symbol,
                  style: TextStyle(
                    color: tokens.onSurface,
                    fontWeight: FontWeight.w600,
                    fontSize: 14,
                  ),
                ),
                const SizedBox(height: 2),
                Row(
                  children: [
                    Text(
                      trade.side.toUpperCase(),
                      style: TextStyle(
                        color: sideColor,
                        fontWeight: FontWeight.w600,
                        fontSize: 11,
                      ),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      '${trade.quantity.toStringAsFixed(4)} @ \$${trade.price.toStringAsFixed(2)}',
                      style: TextStyle(
                        color: tokens.onSurface.withValues(alpha: 0.6),
                        fontSize: 11,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          // Confidence + time
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.psychology_rounded,
                      color: tokens.primary, size: 12),
                  const SizedBox(width: 3),
                  Text(
                    '${(trade.confidence * 100).toStringAsFixed(0)}%',
                    style: TextStyle(
                      color: tokens.primary,
                      fontWeight: FontWeight.w600,
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                timeStr,
                style: TextStyle(
                  color: tokens.onSurface.withValues(alpha: 0.4),
                  fontSize: 10,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty state
// ─────────────────────────────────────────────────────────────────────────────

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.tokens});

  final SvenModeTokens tokens;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 48, horizontal: 24),
      decoration: BoxDecoration(
        color: tokens.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: tokens.frame),
      ),
      child: Column(
        children: [
          Icon(Icons.history_rounded,
              color: tokens.onSurface.withValues(alpha: 0.3), size: 48),
          const SizedBox(height: 12),
          Text(
            'No trades yet',
            style: TextStyle(
              color: tokens.onSurface.withValues(alpha: 0.5),
              fontSize: 15,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Sven will execute trades when conditions are right.',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: tokens.onSurface.withValues(alpha: 0.3),
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }
}
