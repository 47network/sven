// ═══════════════════════════════════════════════════════════════════════════
// SvenGoalsPage — Sven's trading goal milestones and progress tracker.
//
// Shows: current balance, P&L, milestone progress bars, rewards,
// and the next goal to achieve. Data comes from /v1/trading/sven/status.
// ═══════════════════════════════════════════════════════════════════════════

import 'package:flutter/material.dart';

import '../../app/app_models.dart';
import '../../app/sven_tokens.dart';
import 'trading_models.dart';
import 'trading_service.dart';

class SvenGoalsPage extends StatefulWidget {
  const SvenGoalsPage({
    super.key,
    required this.tradingService,
    required this.visualMode,
  });

  final TradingService tradingService;
  final VisualMode visualMode;

  @override
  State<SvenGoalsPage> createState() => _SvenGoalsPageState();
}

class _SvenGoalsPageState extends State<SvenGoalsPage> {
  @override
  void initState() {
    super.initState();
    widget.tradingService.addListener(_onUpdate);
    widget.tradingService.fetchStatus();
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
    final goal = widget.tradingService.status?.goal;

    return Scaffold(
      backgroundColor: tokens.scaffold,
      appBar: AppBar(
        backgroundColor: tokens.surface,
        foregroundColor: tokens.onSurface,
        title: const Text('Sven Goals'),
        elevation: 0,
      ),
      body: goal == null
          ? Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  CircularProgressIndicator(color: tokens.primary),
                  const SizedBox(height: 16),
                  Text('Loading goals...',
                      style: TextStyle(color: tokens.onSurface.withValues(alpha: 0.6))),
                ],
              ),
            )
          : RefreshIndicator(
              color: tokens.primary,
              onRefresh: () => widget.tradingService.fetchStatus(),
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  _BalanceHeader(goal: goal, tokens: tokens),
                  const SizedBox(height: 16),
                  _DailyStatsRow(goal: goal, tokens: tokens),
                  const SizedBox(height: 20),
                  _NextGoalCard(goal: goal, tokens: tokens),
                  const SizedBox(height: 20),
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Text(
                      'ALL MILESTONES',
                      style: TextStyle(
                        color: tokens.onSurface.withValues(alpha: 0.5),
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 1.2,
                      ),
                    ),
                  ),
                  ...goal.milestones.map((m) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: _MilestoneCard(
                          milestone: m,
                          currentBalance: goal.currentBalance,
                          tokens: tokens,
                        ),
                      )),
                  const SizedBox(height: 24),
                ],
              ),
            ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Balance header — big number + P&L
// ─────────────────────────────────────────────────────────────────────────────

class _BalanceHeader extends StatelessWidget {
  const _BalanceHeader({required this.goal, required this.tokens});
  final GoalInfo goal;
  final SvenModeTokens tokens;

  @override
  Widget build(BuildContext context) {
    final pnlColor = goal.totalPnl >= 0 ? tokens.success : tokens.error;
    final pnlSign = goal.totalPnl >= 0 ? '+' : '';
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: tokens.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: tokens.frame),
        boxShadow: [
          BoxShadow(
            color: tokens.primary.withValues(alpha: 0.1),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        children: [
          Text(
            'SVEN\'S BALANCE',
            style: TextStyle(
              color: tokens.onSurface.withValues(alpha: 0.5),
              fontSize: 11,
              fontWeight: FontWeight.w700,
              letterSpacing: 1.5,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            '${_formatNumber(goal.currentBalance)} 47T',
            style: TextStyle(
              color: tokens.onSurface,
              fontSize: 32,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.5,
            ),
          ),
          const SizedBox(height: 4),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                goal.totalPnl >= 0
                    ? Icons.trending_up_rounded
                    : Icons.trending_down_rounded,
                color: pnlColor,
                size: 18,
              ),
              const SizedBox(width: 4),
              Text(
                '$pnlSign${_formatNumber(goal.totalPnl)} 47T',
                style: TextStyle(
                  color: pnlColor,
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(width: 8),
              Text(
                'from ${_formatNumber(goal.startingBalance)}',
                style: TextStyle(
                  color: tokens.onSurface.withValues(alpha: 0.4),
                  fontSize: 13,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          // Progress bar: overall
          Row(
            children: [
              Text(
                '${goal.achieved}/${goal.total} milestones',
                style: TextStyle(
                  color: tokens.primary,
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const Spacer(),
              Text(
                'Peak: ${_formatNumber(goal.peakBalance)} 47T',
                style: TextStyle(
                  color: tokens.onSurface.withValues(alpha: 0.4),
                  fontSize: 12,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: goal.total > 0 ? goal.achieved / goal.total : 0,
              backgroundColor: tokens.frame,
              valueColor: AlwaysStoppedAnimation<Color>(tokens.primary),
              minHeight: 6,
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Daily stats row
// ─────────────────────────────────────────────────────────────────────────────

class _DailyStatsRow extends StatelessWidget {
  const _DailyStatsRow({required this.goal, required this.tokens});
  final GoalInfo goal;
  final SvenModeTokens tokens;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: _StatChip(
            tokens: tokens,
            label: 'Daily P&L',
            value: '${goal.dailyPnl >= 0 ? '+' : ''}${goal.dailyPnl.toStringAsFixed(1)} 47T',
            valueColor: goal.dailyPnl >= 0 ? tokens.success : tokens.error,
            icon: Icons.today_rounded,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _StatChip(
            tokens: tokens,
            label: 'Daily Trades',
            value: '${goal.dailyTrades}',
            icon: Icons.swap_horiz_rounded,
          ),
        ),
      ],
    );
  }
}

class _StatChip extends StatelessWidget {
  const _StatChip({
    required this.tokens,
    required this.label,
    required this.value,
    required this.icon,
    this.valueColor,
  });
  final SvenModeTokens tokens;
  final String label;
  final String value;
  final IconData icon;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: tokens.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: tokens.frame),
      ),
      child: Row(
        children: [
          Icon(icon, color: tokens.primary.withValues(alpha: 0.6), size: 20),
          const SizedBox(width: 10),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: TextStyle(
                  color: tokens.onSurface.withValues(alpha: 0.5),
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                ),
              ),
              Text(
                value,
                style: TextStyle(
                  color: valueColor ?? tokens.onSurface,
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
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
// Next goal highlight card
// ─────────────────────────────────────────────────────────────────────────────

class _NextGoalCard extends StatelessWidget {
  const _NextGoalCard({required this.goal, required this.tokens});
  final GoalInfo goal;
  final SvenModeTokens tokens;

  @override
  Widget build(BuildContext context) {
    final next = goal.nextMilestone;
    if (next == null) {
      return Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [
              tokens.primary.withValues(alpha: 0.15),
              tokens.secondary.withValues(alpha: 0.1),
            ],
          ),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: tokens.primary.withValues(alpha: 0.3)),
        ),
        child: Row(
          children: [
            Icon(Icons.emoji_events_rounded, color: Colors.amber, size: 36),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'ALL GOALS ACHIEVED!',
                    style: TextStyle(
                      color: Colors.amber,
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  Text(
                    'Sven has completed every milestone.',
                    style: TextStyle(
                      color: tokens.onSurface.withValues(alpha: 0.6),
                      fontSize: 13,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      );
    }

    final remaining = next.targetBalance - goal.currentBalance;
    final pct = next.progressPct.clamp(0.0, 100.0);

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            tokens.primary.withValues(alpha: 0.12),
            tokens.card,
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: tokens.primary.withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.flag_rounded, color: tokens.primary, size: 22),
              const SizedBox(width: 8),
              Text(
                'NEXT GOAL',
                style: TextStyle(
                  color: tokens.primary,
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.2,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            next.name,
            style: TextStyle(
              color: tokens.onSurface,
              fontSize: 20,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            next.reward,
            style: TextStyle(
              color: tokens.onSurface.withValues(alpha: 0.6),
              fontSize: 13,
            ),
          ),
          const SizedBox(height: 14),
          ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: LinearProgressIndicator(
              value: pct / 100,
              backgroundColor: tokens.frame,
              valueColor: AlwaysStoppedAnimation<Color>(tokens.primary),
              minHeight: 10,
            ),
          ),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '${pct.toStringAsFixed(1)}%',
                style: TextStyle(
                  color: tokens.primary,
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                ),
              ),
              Text(
                remaining > 0
                    ? '${_formatNumber(remaining)} 47T to go'
                    : 'Almost there!',
                style: TextStyle(
                  color: tokens.onSurface.withValues(alpha: 0.5),
                  fontSize: 12,
                ),
              ),
              Text(
                'Target: ${_formatNumber(next.targetBalance)} 47T',
                style: TextStyle(
                  color: tokens.onSurface.withValues(alpha: 0.5),
                  fontSize: 12,
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
// Individual milestone card
// ─────────────────────────────────────────────────────────────────────────────

class _MilestoneCard extends StatelessWidget {
  const _MilestoneCard({
    required this.milestone,
    required this.currentBalance,
    required this.tokens,
  });
  final GoalMilestone milestone;
  final double currentBalance;
  final SvenModeTokens tokens;

  IconData get _icon {
    switch (milestone.id) {
      case 'gpu-1':
        return Icons.memory_rounded;
      case 'storage-1':
        return Icons.storage_rounded;
      case 'gpu-2':
        return Icons.developer_board_rounded;
      case 'vm-fleet':
        return Icons.dns_rounded;
      case 'cluster':
        return Icons.cloud_rounded;
      case 'real-trading':
        return Icons.account_balance_rounded;
      default:
        return Icons.star_rounded;
    }
  }

  @override
  Widget build(BuildContext context) {
    final achieved = milestone.achieved;
    final pct = milestone.progressPct.clamp(0.0, 100.0);

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: achieved
            ? tokens.primary.withValues(alpha: 0.08)
            : tokens.card,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: achieved
              ? tokens.primary.withValues(alpha: 0.4)
              : tokens.frame,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: achieved
                      ? tokens.primary.withValues(alpha: 0.15)
                      : tokens.frame.withValues(alpha: 0.5),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(
                  achieved ? Icons.check_circle_rounded : _icon,
                  color: achieved ? tokens.primary : tokens.onSurface.withValues(alpha: 0.4),
                  size: 22,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      milestone.name,
                      style: TextStyle(
                        color: tokens.onSurface,
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    Text(
                      milestone.reward,
                      style: TextStyle(
                        color: tokens.onSurface.withValues(alpha: 0.5),
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              if (achieved)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: tokens.primary.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    'ACHIEVED',
                    style: TextStyle(
                      color: tokens.primary,
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.5,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(3),
                  child: LinearProgressIndicator(
                    value: pct / 100,
                    backgroundColor: tokens.frame,
                    valueColor: AlwaysStoppedAnimation<Color>(
                      achieved ? tokens.primary : tokens.primary.withValues(alpha: 0.6),
                    ),
                    minHeight: 5,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Text(
                '${_formatNumber(milestone.targetBalance)} 47T',
                style: TextStyle(
                  color: tokens.onSurface.withValues(alpha: 0.4),
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
          if (achieved && milestone.achievedAt != null) ...[
            const SizedBox(height: 6),
            Text(
              'Achieved ${_formatDate(milestone.achievedAt!)}',
              style: TextStyle(
                color: tokens.primary.withValues(alpha: 0.6),
                fontSize: 11,
                fontStyle: FontStyle.italic,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

String _formatNumber(double n) {
  if (n.abs() >= 1000000) return '${(n / 1000000).toStringAsFixed(2)}M';
  if (n.abs() >= 1000) return '${(n / 1000).toStringAsFixed(1)}K';
  return n.toStringAsFixed(n.truncateToDouble() == n ? 0 : 2);
}

String _formatDate(String iso) {
  final d = DateTime.tryParse(iso);
  if (d == null) return iso;
  return '${d.day}/${d.month}/${d.year} ${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
}
