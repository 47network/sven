// ═══════════════════════════════════════════════════════════════════════════
// PnlSummaryPage — Sven's profit & loss overview.
//
// Shows: balance, account equity, unrealized P&L across positions,
// trade performance stats, and a visual P&L breakdown by position.
// Data pulled from /positions and /sven/status endpoints.
// ═══════════════════════════════════════════════════════════════════════════

import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../app/app_models.dart';
import '../../app/sven_tokens.dart';
import 'trading_models.dart';
import 'trading_service.dart';

class PnlSummaryPage extends StatefulWidget {
  const PnlSummaryPage({
    super.key,
    required this.tradingService,
    required this.visualMode,
  });

  final TradingService tradingService;
  final VisualMode visualMode;

  @override
  State<PnlSummaryPage> createState() => _PnlSummaryPageState();
}

class _PnlSummaryPageState extends State<PnlSummaryPage> {
  @override
  void initState() {
    super.initState();
    widget.tradingService.addListener(_onUpdate);
    _refresh();
  }

  @override
  void dispose() {
    widget.tradingService.removeListener(_onUpdate);
    super.dispose();
  }

  void _onUpdate() => setState(() {});

  Future<void> _refresh() async {
    await Future.wait([
      widget.tradingService.fetchPositions(),
      widget.tradingService.fetchTrades(),
      widget.tradingService.fetchStatus(),
    ]);
  }

  @override
  Widget build(BuildContext context) {
    final tokens = SvenTokens.forMode(widget.visualMode);
    final positions = widget.tradingService.positions;
    final trades = widget.tradingService.trades;
    final status = widget.tradingService.status;

    // Aggregate unrealized P&L from positions.
    final totalUnrealizedPnl =
        positions.fold<double>(0, (sum, p) => sum + p.unrealizedPnl);
    final totalPositionValue = positions.fold<double>(
        0, (sum, p) => sum + (p.currentPrice * p.quantity));

    // Sort positions by P&L for the breakdown.
    final sortedPositions = [...positions]
      ..sort((a, b) => b.unrealizedPnl.compareTo(a.unrealizedPnl));

    return Scaffold(
      backgroundColor: tokens.scaffold,
      appBar: AppBar(
        title: const Text('P&L Summary'),
        backgroundColor: Colors.transparent,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () {
              HapticFeedback.lightImpact();
              _refresh();
            },
          ),
        ],
      ),
      body: RefreshIndicator(
        color: tokens.primary,
        onRefresh: _refresh,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // ── P&L Hero ─────────────────────────────────────────────
            _PnlHeroCard(
              tokens: tokens,
              unrealizedPnl: totalUnrealizedPnl,
              positionValue: totalPositionValue,
              openPositions: positions.length,
              totalExecuted: status?.autoTrade.totalExecuted ?? 0,
            ),
            const SizedBox(height: 16),

            // ── Trade stats ──────────────────────────────────────────
            _TradeStatsCard(
              tokens: tokens,
              trades: trades,
            ),
            const SizedBox(height: 16),

            // ── Position P&L breakdown ───────────────────────────────
            _SectionHeader(
              icon: Icons.bar_chart_rounded,
              label: 'P&L BY POSITION',
              tokens: tokens,
              trailing: '${positions.length} open',
            ),
            const SizedBox(height: 8),

            if (sortedPositions.isEmpty)
              _EmptyState(tokens: tokens)
            else
              ...sortedPositions.map((pos) => Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: _PositionPnlCard(
                      position: pos,
                      tokens: tokens,
                      maxAbsPnl: sortedPositions.isEmpty
                          ? 1
                          : sortedPositions
                              .map((p) => p.unrealizedPnl.abs())
                              .reduce(math.max),
                    ),
                  )),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Hero card with total unrealized P&L
// ─────────────────────────────────────────────────────────────────────────────

class _PnlHeroCard extends StatelessWidget {
  const _PnlHeroCard({
    required this.tokens,
    required this.unrealizedPnl,
    required this.positionValue,
    required this.openPositions,
    required this.totalExecuted,
  });

  final SvenModeTokens tokens;
  final double unrealizedPnl;
  final double positionValue;
  final int openPositions;
  final int totalExecuted;

  @override
  Widget build(BuildContext context) {
    final isPositive = unrealizedPnl >= 0;
    final pnlColor = isPositive ? Colors.greenAccent : Colors.redAccent;
    final pnlSign = isPositive ? '+' : '';
    final pnlPct = positionValue > 0
        ? (unrealizedPnl / positionValue * 100).toStringAsFixed(2)
        : '0.00';

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: tokens.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: pnlColor.withValues(alpha: 0.3)),
        boxShadow: [
          BoxShadow(
            color: pnlColor.withValues(alpha: 0.08),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        children: [
          Text(
            'Unrealized P&L',
            style: TextStyle(
              color: tokens.onSurface.withValues(alpha: 0.5),
              fontSize: 13,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            '$pnlSign\$${unrealizedPnl.abs().toStringAsFixed(2)}',
            style: TextStyle(
              color: pnlColor,
              fontWeight: FontWeight.w800,
              fontSize: 32,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            '$pnlSign$pnlPct%',
            style: TextStyle(
              color: pnlColor.withValues(alpha: 0.7),
              fontWeight: FontWeight.w600,
              fontSize: 16,
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              _SmallStat(
                label: 'Position Value',
                value: '\$${positionValue.toStringAsFixed(2)}',
                tokens: tokens,
              ),
              _SmallStat(
                label: 'Open',
                value: '$openPositions',
                tokens: tokens,
              ),
              _SmallStat(
                label: 'Executed',
                value: '$totalExecuted',
                tokens: tokens,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _SmallStat extends StatelessWidget {
  const _SmallStat({
    required this.label,
    required this.value,
    required this.tokens,
  });

  final String label;
  final String value;
  final SvenModeTokens tokens;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        children: [
          Text(
            value,
            style: TextStyle(
              color: tokens.onSurface,
              fontWeight: FontWeight.w600,
              fontSize: 14,
            ),
          ),
          const SizedBox(height: 1),
          Text(
            label,
            style: TextStyle(
              color: tokens.onSurface.withValues(alpha: 0.4),
              fontSize: 10,
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Trade stats card
// ─────────────────────────────────────────────────────────────────────────────

class _TradeStatsCard extends StatelessWidget {
  const _TradeStatsCard({required this.tokens, required this.trades});

  final SvenModeTokens tokens;
  final List<SvenTrade> trades;

  @override
  Widget build(BuildContext context) {
    final buys = trades.where((t) => t.side == 'buy').toList();
    final sells = trades.where((t) => t.side == 'sell').toList();

    // Average confidence.
    final avgConf = trades.isEmpty
        ? 0.0
        : trades.fold<double>(0, (s, t) => s + t.confidence) / trades.length;

    // Volume (sum of quantity × price).
    final volume =
        trades.fold<double>(0, (s, t) => s + t.quantity * t.price);

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: tokens.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: tokens.frame),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.analytics_rounded,
                  color: tokens.primary, size: 18),
              const SizedBox(width: 6),
              Text(
                'TRADE PERFORMANCE',
                style: TextStyle(
                  color: tokens.onSurface,
                  fontWeight: FontWeight.w700,
                  fontSize: 13,
                  letterSpacing: 1.0,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              _StatBadge(
                label: 'Buys',
                value: '${buys.length}',
                color: Colors.greenAccent,
                tokens: tokens,
              ),
              const SizedBox(width: 8),
              _StatBadge(
                label: 'Sells',
                value: '${sells.length}',
                color: Colors.redAccent,
                tokens: tokens,
              ),
              const SizedBox(width: 8),
              _StatBadge(
                label: 'Avg Conf',
                value: '${(avgConf * 100).toStringAsFixed(0)}%',
                color: tokens.primary,
                tokens: tokens,
              ),
              const SizedBox(width: 8),
              _StatBadge(
                label: 'Volume',
                value: _formatVolume(volume),
                color: tokens.secondary,
                tokens: tokens,
              ),
            ],
          ),
        ],
      ),
    );
  }

  String _formatVolume(double v) {
    if (v >= 1e6) return '\$${(v / 1e6).toStringAsFixed(1)}M';
    if (v >= 1e3) return '\$${(v / 1e3).toStringAsFixed(1)}K';
    return '\$${v.toStringAsFixed(0)}';
  }
}

class _StatBadge extends StatelessWidget {
  const _StatBadge({
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
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Column(
          children: [
            Text(
              value,
              style: TextStyle(
                color: color,
                fontWeight: FontWeight.w700,
                fontSize: 15,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: TextStyle(
                color: tokens.onSurface.withValues(alpha: 0.4),
                fontSize: 10,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Position P&L card with bar
// ─────────────────────────────────────────────────────────────────────────────

class _PositionPnlCard extends StatelessWidget {
  const _PositionPnlCard({
    required this.position,
    required this.tokens,
    required this.maxAbsPnl,
  });

  final Position position;
  final SvenModeTokens tokens;
  final double maxAbsPnl;

  @override
  Widget build(BuildContext context) {
    final pnl = position.unrealizedPnl;
    final isPositive = pnl >= 0;
    final color = isPositive ? Colors.greenAccent : Colors.redAccent;
    final barWidth = maxAbsPnl > 0 ? (pnl.abs() / maxAbsPnl) : 0.0;
    final pnlPct = position.entryPrice > 0
        ? ((position.currentPrice - position.entryPrice) /
                position.entryPrice *
                100)
            .toStringAsFixed(2)
        : '0.00';

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: tokens.card,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: color.withValues(alpha: 0.2),
          width: 0.8,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                position.symbol,
                style: TextStyle(
                  color: tokens.onSurface,
                  fontWeight: FontWeight.w600,
                  fontSize: 14,
                ),
              ),
              const SizedBox(width: 6),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(3),
                ),
                child: Text(
                  position.side.toUpperCase(),
                  style: TextStyle(
                    color: color,
                    fontWeight: FontWeight.w600,
                    fontSize: 9,
                  ),
                ),
              ),
              const Spacer(),
              Text(
                '${isPositive ? '+' : ''}\$${pnl.abs().toStringAsFixed(2)}',
                style: TextStyle(
                  color: color,
                  fontWeight: FontWeight.w700,
                  fontSize: 14,
                ),
              ),
              const SizedBox(width: 4),
              Text(
                '(${isPositive ? '+' : ''}$pnlPct%)',
                style: TextStyle(
                  color: color.withValues(alpha: 0.7),
                  fontSize: 11,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          // P&L bar
          ClipRRect(
            borderRadius: BorderRadius.circular(3),
            child: LinearProgressIndicator(
              value: barWidth.clamp(0.0, 1.0),
              backgroundColor: tokens.onSurface.withValues(alpha: 0.08),
              valueColor:
                  AlwaysStoppedAnimation(color.withValues(alpha: 0.6)),
              minHeight: 4,
            ),
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              Text(
                'Entry: \$${position.entryPrice.toStringAsFixed(2)}',
                style: TextStyle(
                  color: tokens.onSurface.withValues(alpha: 0.4),
                  fontSize: 10,
                ),
              ),
              const SizedBox(width: 12),
              Text(
                'Current: \$${position.currentPrice.toStringAsFixed(2)}',
                style: TextStyle(
                  color: tokens.onSurface.withValues(alpha: 0.4),
                  fontSize: 10,
                ),
              ),
              const Spacer(),
              Text(
                'Qty: ${position.quantity.toStringAsFixed(4)}',
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
// Section header
// ─────────────────────────────────────────────────────────────────────────────

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({
    required this.icon,
    required this.label,
    required this.tokens,
    this.trailing,
  });

  final IconData icon;
  final String label;
  final SvenModeTokens tokens;
  final String? trailing;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, color: tokens.primary, size: 16),
        const SizedBox(width: 6),
        Text(
          label,
          style: TextStyle(
            color: tokens.onSurface,
            fontWeight: FontWeight.w700,
            fontSize: 13,
            letterSpacing: 1.0,
          ),
        ),
        const Spacer(),
        if (trailing != null)
          Text(
            trailing!,
            style: TextStyle(
              color: tokens.onSurface.withValues(alpha: 0.4),
              fontSize: 11,
            ),
          ),
      ],
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
          Icon(Icons.show_chart_rounded,
              color: tokens.onSurface.withValues(alpha: 0.3), size: 48),
          const SizedBox(height: 12),
          Text(
            'No open positions',
            style: TextStyle(
              color: tokens.onSurface.withValues(alpha: 0.5),
              fontSize: 15,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'P&L data will appear once Sven opens positions.',
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
