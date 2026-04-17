// ═══════════════════════════════════════════════════════════════════════════
// SvenIntelligencePage — Sven's learning engine and risk management dashboard.
//
// Shows: source weight distribution, model accuracy per signal source,
// learning iterations, trailing stop config, trend filter status,
// and dedup guard. Data comes from /v1/trading/sven/status.
// ═══════════════════════════════════════════════════════════════════════════

import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../app/app_models.dart';
import '../../app/sven_tokens.dart';
import 'trading_models.dart';
import 'trading_service.dart';

class SvenIntelligencePage extends StatefulWidget {
  const SvenIntelligencePage({
    super.key,
    required this.tradingService,
    required this.visualMode,
  });

  final TradingService tradingService;
  final VisualMode visualMode;

  @override
  State<SvenIntelligencePage> createState() => _SvenIntelligencePageState();
}

class _SvenIntelligencePageState extends State<SvenIntelligencePage> {
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
    final status = widget.tradingService.status;
    final learning = status?.learning;
    final risk = status?.riskManagement;

    return Scaffold(
      backgroundColor: tokens.scaffold,
      appBar: AppBar(
        title: const Text('Sven Intelligence'),
        backgroundColor: Colors.transparent,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () {
              HapticFeedback.lightImpact();
              widget.tradingService.fetchStatus();
            },
          ),
        ],
      ),
      body: RefreshIndicator(
        color: tokens.primary,
        onRefresh: widget.tradingService.fetchStatus,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // ── Learning Header ──────────────────────────────────────
            _SectionHeader(
              icon: Icons.psychology_rounded,
              label: 'LEARNING ENGINE',
              tokens: tokens,
            ),
            const SizedBox(height: 8),
            _LearningOverviewCard(learning: learning, tokens: tokens),
            const SizedBox(height: 12),

            // ── Source Weights ────────────────────────────────────────
            _SectionHeader(
              icon: Icons.tune_rounded,
              label: 'SOURCE WEIGHTS',
              tokens: tokens,
            ),
            const SizedBox(height: 8),
            _SourceWeightsCard(learning: learning, tokens: tokens),
            const SizedBox(height: 12),

            // ── Model Accuracy ───────────────────────────────────────
            _SectionHeader(
              icon: Icons.analytics_rounded,
              label: 'MODEL ACCURACY',
              tokens: tokens,
            ),
            const SizedBox(height: 8),
            _ModelAccuracyCard(learning: learning, tokens: tokens),
            const SizedBox(height: 12),

            // ── Risk Management ──────────────────────────────────────
            _SectionHeader(
              icon: Icons.shield_rounded,
              label: 'RISK MANAGEMENT',
              tokens: tokens,
            ),
            const SizedBox(height: 8),
            if (risk != null) ...[
              _TrailingStopCard(info: risk.trailingStop, tokens: tokens),
              const SizedBox(height: 8),
              _TrendFilterCard(info: risk.trendFilter, tokens: tokens),
              const SizedBox(height: 8),
              _DedupGuardCard(info: risk.dedupGuard, tokens: tokens),
            ] else
              _EmptyCard(
                message: 'Risk management data unavailable',
                tokens: tokens,
              ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Section Header
// ═══════════════════════════════════════════════════════════════════════════

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({
    required this.icon,
    required this.label,
    required this.tokens,
  });

  final IconData icon;
  final String label;
  final SvenModeTokens tokens;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, color: tokens.primary, size: 18),
        const SizedBox(width: 8),
        Text(
          label,
          style: TextStyle(
            color: tokens.onSurface.withValues(alpha: 0.7),
            fontWeight: FontWeight.w700,
            fontSize: 12,
            letterSpacing: 1.2,
          ),
        ),
      ],
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Learning Overview
// ═══════════════════════════════════════════════════════════════════════════

class _LearningOverviewCard extends StatelessWidget {
  const _LearningOverviewCard({required this.learning, required this.tokens});

  final LearningInfo? learning;
  final SvenModeTokens tokens;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: tokens.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: tokens.frame.withValues(alpha: 0.2)),
      ),
      child: learning == null
          ? Text(
              'Learning data unavailable',
              style: TextStyle(color: tokens.onSurface.withValues(alpha: 0.5)),
            )
          : Row(
              children: [
                _OverviewTile(
                  label: 'Iterations',
                  value: '${learning!.learningIterations}',
                  icon: Icons.loop_rounded,
                  tokens: tokens,
                ),
                _OverviewTile(
                  label: 'Patterns',
                  value: '${learning!.learnedPatterns}',
                  icon: Icons.pattern_rounded,
                  tokens: tokens,
                ),
                _OverviewTile(
                  label: 'Sources',
                  value: '${learning!.sourceWeights.length}',
                  icon: Icons.hub_rounded,
                  tokens: tokens,
                ),
              ],
            ),
    );
  }
}

class _OverviewTile extends StatelessWidget {
  const _OverviewTile({
    required this.label,
    required this.value,
    required this.icon,
    required this.tokens,
  });

  final String label;
  final String value;
  final IconData icon;
  final SvenModeTokens tokens;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        children: [
          Icon(icon, color: tokens.primary.withValues(alpha: 0.7), size: 22),
          const SizedBox(height: 6),
          Text(
            value,
            style: TextStyle(
              color: tokens.onSurface,
              fontWeight: FontWeight.w700,
              fontSize: 18,
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

// ═══════════════════════════════════════════════════════════════════════════
// Source Weights — horizontal bar chart showing signal weight distribution
// ═══════════════════════════════════════════════════════════════════════════

class _SourceWeightsCard extends StatelessWidget {
  const _SourceWeightsCard({required this.learning, required this.tokens});

  final LearningInfo? learning;
  final SvenModeTokens tokens;

  static const _sourceColors = <String, Color>{
    'kronos': Color(0xFF6C63FF),
    'mirofish': Color(0xFF00BFA5),
    'technical': Color(0xFFFF9800),
    'news-intelligence': Color(0xFFE91E63),
    'ensemble': Color(0xFF42A5F5),
  };

  static const _sourceIcons = <String, IconData>{
    'kronos': Icons.auto_graph_rounded,
    'mirofish': Icons.water_rounded,
    'technical': Icons.candlestick_chart_rounded,
    'news-intelligence': Icons.newspaper_rounded,
    'ensemble': Icons.merge_rounded,
  };

  @override
  Widget build(BuildContext context) {
    if (learning == null || learning!.sourceWeights.isEmpty) {
      return _EmptyCard(message: 'No source weight data', tokens: tokens);
    }

    final weights = learning!.sourceWeights;
    final maxWeight =
        weights.values.fold<double>(0, (a, b) => math.max(a, b));

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: tokens.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: tokens.frame.withValues(alpha: 0.2)),
      ),
      child: Column(
        children: weights.entries.map((e) {
          final pct = maxWeight > 0 ? e.value / maxWeight : 0.0;
          final color = _sourceColors[e.key] ?? tokens.primary;
          final icon = _sourceIcons[e.key] ?? Icons.circle;
          return Padding(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Row(
              children: [
                Icon(icon, color: color, size: 18),
                const SizedBox(width: 8),
                SizedBox(
                  width: 90,
                  child: Text(
                    _formatSourceName(e.key),
                    style: TextStyle(
                      color: tokens.onSurface,
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                Expanded(
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: LinearProgressIndicator(
                      value: pct,
                      backgroundColor: color.withValues(alpha: 0.15),
                      valueColor: AlwaysStoppedAnimation<Color>(color),
                      minHeight: 14,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                SizedBox(
                  width: 42,
                  child: Text(
                    '${(e.value * 100).toStringAsFixed(0)}%',
                    textAlign: TextAlign.right,
                    style: TextStyle(
                      color: color,
                      fontWeight: FontWeight.w700,
                      fontSize: 13,
                    ),
                  ),
                ),
              ],
            ),
          );
        }).toList(),
      ),
    );
  }

  String _formatSourceName(String key) {
    return switch (key) {
      'kronos' => 'Kronos',
      'mirofish' => 'MiroFish',
      'technical' => 'Technical',
      'news-intelligence' => 'News Intel',
      'ensemble' => 'Ensemble',
      _ => key,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Model Accuracy — win rate per signal source
// ═══════════════════════════════════════════════════════════════════════════

class _ModelAccuracyCard extends StatelessWidget {
  const _ModelAccuracyCard({required this.learning, required this.tokens});

  final LearningInfo? learning;
  final SvenModeTokens tokens;

  @override
  Widget build(BuildContext context) {
    if (learning == null || learning!.modelAccuracy.isEmpty) {
      return _EmptyCard(
        message: 'No accuracy data yet — needs closed trades',
        tokens: tokens,
      );
    }

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: tokens.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: tokens.frame.withValues(alpha: 0.2)),
      ),
      child: Column(
        children: learning!.modelAccuracy.entries.map((e) {
          final acc = e.value;
          final pct = acc.accuracy;
          final color = pct >= 0.6
              ? Colors.green
              : pct >= 0.4
                  ? Colors.orange
                  : Colors.red;
          return Padding(
            padding: const EdgeInsets.symmetric(vertical: 6),
            child: Row(
              children: [
                SizedBox(
                  width: 90,
                  child: Text(
                    _formatSourceName(e.key),
                    style: TextStyle(
                      color: tokens.onSurface,
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                Expanded(
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: LinearProgressIndicator(
                      value: pct,
                      backgroundColor: color.withValues(alpha: 0.15),
                      valueColor: AlwaysStoppedAnimation<Color>(color),
                      minHeight: 14,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                SizedBox(
                  width: 72,
                  child: Text(
                    '${(pct * 100).toStringAsFixed(0)}% (${acc.correct}/${acc.total})',
                    textAlign: TextAlign.right,
                    style: TextStyle(
                      color: color,
                      fontWeight: FontWeight.w600,
                      fontSize: 11,
                    ),
                  ),
                ),
              ],
            ),
          );
        }).toList(),
      ),
    );
  }

  String _formatSourceName(String key) {
    return switch (key) {
      'kronos_v1' => 'Kronos',
      'mirofish' => 'MiroFish',
      'technical' => 'Technical',
      'news' => 'News Intel',
      _ => key,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Trailing Stop Config Card
// ═══════════════════════════════════════════════════════════════════════════

class _TrailingStopCard extends StatelessWidget {
  const _TrailingStopCard({required this.info, required this.tokens});

  final TrailingStopInfo info;
  final SvenModeTokens tokens;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: tokens.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: tokens.frame.withValues(alpha: 0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.trending_up_rounded, color: Colors.green, size: 18),
              const SizedBox(width: 8),
              Text(
                'Trailing Stop',
                style: TextStyle(
                  color: tokens.onSurface,
                  fontWeight: FontWeight.w700,
                  fontSize: 14,
                ),
              ),
              const Spacer(),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: Colors.green.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  '${info.activeTrails} ACTIVE',
                  style: const TextStyle(
                    color: Colors.green,
                    fontWeight: FontWeight.w700,
                    fontSize: 11,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              _ConfigTile(
                label: 'Activation',
                value: '${info.activationPct}%',
                tokens: tokens,
              ),
              _ConfigTile(
                label: 'Trail Distance',
                value: '${info.trailDistancePct.toStringAsFixed(0)}%',
                tokens: tokens,
              ),
              _ConfigTile(
                label: 'Hard TP',
                value: '${info.hardTpPct}%',
                tokens: tokens,
                color: Colors.green,
              ),
              _ConfigTile(
                label: 'Hard SL',
                value: '-${info.hardSlPct}%',
                tokens: tokens,
                color: Colors.red,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Trend Filter Card
// ═══════════════════════════════════════════════════════════════════════════

class _TrendFilterCard extends StatelessWidget {
  const _TrendFilterCard({required this.info, required this.tokens});

  final TrendFilterInfo info;
  final SvenModeTokens tokens;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: tokens.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: tokens.frame.withValues(alpha: 0.2)),
      ),
      child: Row(
        children: [
          Icon(
            Icons.show_chart_rounded,
            color: info.enabled ? Colors.blue : Colors.grey,
            size: 18,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '50-SMA Trend Filter',
                  style: TextStyle(
                    color: tokens.onSurface,
                    fontWeight: FontWeight.w700,
                    fontSize: 14,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  'Blocks counter-trend trades above ${(info.strengthThreshold * 100).toStringAsFixed(0)}% strength',
                  style: TextStyle(
                    color: tokens.onSurface.withValues(alpha: 0.5),
                    fontSize: 11,
                  ),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: (info.enabled ? Colors.blue : Colors.grey)
                  .withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(
              info.enabled ? 'ACTIVE' : 'OFF',
              style: TextStyle(
                color: info.enabled ? Colors.blue : Colors.grey,
                fontWeight: FontWeight.w700,
                fontSize: 11,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Dedup Guard Card
// ═══════════════════════════════════════════════════════════════════════════

class _DedupGuardCard extends StatelessWidget {
  const _DedupGuardCard({required this.info, required this.tokens});

  final DedupGuardInfo info;
  final SvenModeTokens tokens;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: tokens.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: tokens.frame.withValues(alpha: 0.2)),
      ),
      child: Row(
        children: [
          Icon(
            Icons.block_rounded,
            color: info.enabled ? Colors.amber : Colors.grey,
            size: 18,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Duplicate Position Guard',
                  style: TextStyle(
                    color: tokens.onSurface,
                    fontWeight: FontWeight.w700,
                    fontSize: 14,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  'Max ${info.maxPerSymbol} position per symbol',
                  style: TextStyle(
                    color: tokens.onSurface.withValues(alpha: 0.5),
                    fontSize: 11,
                  ),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: (info.enabled ? Colors.amber : Colors.grey)
                  .withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(
              info.enabled ? 'ACTIVE' : 'OFF',
              style: TextStyle(
                color: info.enabled ? Colors.amber : Colors.grey,
                fontWeight: FontWeight.w700,
                fontSize: 11,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Shared widgets
// ═══════════════════════════════════════════════════════════════════════════

class _ConfigTile extends StatelessWidget {
  const _ConfigTile({
    required this.label,
    required this.value,
    required this.tokens,
    this.color,
  });

  final String label;
  final String value;
  final SvenModeTokens tokens;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        children: [
          Text(
            value,
            style: TextStyle(
              color: color ?? tokens.onSurface,
              fontWeight: FontWeight.w700,
              fontSize: 14,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: TextStyle(
              color: tokens.onSurface.withValues(alpha: 0.5),
              fontSize: 10,
            ),
          ),
        ],
      ),
    );
  }
}

class _EmptyCard extends StatelessWidget {
  const _EmptyCard({required this.message, required this.tokens});

  final String message;
  final SvenModeTokens tokens;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: tokens.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: tokens.frame.withValues(alpha: 0.2)),
      ),
      child: Center(
        child: Text(
          message,
          style: TextStyle(
            color: tokens.onSurface.withValues(alpha: 0.4),
            fontSize: 13,
          ),
        ),
      ),
    );
  }
}
