// ═══════════════════════════════════════════════════════════════════════════
// TrendScoutPage — Sven's dynamic watchlist powered by Trend Scout.
//
// Shows: discovered symbols from news analysis, each with news score,
// expiry countdown, trade count, and discovery source. Real-time from
// the /sven/status endpoint's trendScout section.
// ═══════════════════════════════════════════════════════════════════════════

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../app/app_models.dart';
import '../../app/sven_tokens.dart';
import 'trading_models.dart';
import 'trading_service.dart';

class TrendScoutPage extends StatefulWidget {
  const TrendScoutPage({
    super.key,
    required this.tradingService,
    required this.visualMode,
  });

  final TradingService tradingService;
  final VisualMode visualMode;

  @override
  State<TrendScoutPage> createState() => _TrendScoutPageState();
}

class _TrendScoutPageState extends State<TrendScoutPage> {
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
    final scout = status?.trendScout;
    final watchlist = scout?.dynamicWatchlist ?? [];

    return Scaffold(
      backgroundColor: tokens.scaffold,
      appBar: AppBar(
        title: const Text('Trend Scout'),
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
            // ── Scout status header ──────────────────────────────────
            if (scout != null)
              _ScoutStatusCard(scout: scout, tokens: tokens),
            if (scout != null) const SizedBox(height: 16),

            // ── Core symbols ─────────────────────────────────────────
            _SectionHeader(
              icon: Icons.stars_rounded,
              label: 'CORE WATCHLIST',
              tokens: tokens,
              trailing: '5 symbols',
            ),
            const SizedBox(height: 8),
            _CoreSymbolsChips(tokens: tokens),
            const SizedBox(height: 16),

            // ── Dynamic watchlist ────────────────────────────────────
            _SectionHeader(
              icon: Icons.explore_rounded,
              label: 'DYNAMIC DISCOVERIES',
              tokens: tokens,
              trailing: '${watchlist.length}/${scout?.maxDynamic ?? 10}',
            ),
            const SizedBox(height: 8),

            if (watchlist.isEmpty)
              _EmptyState(tokens: tokens)
            else
              ...watchlist.map((entry) => Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: _WatchlistCard(entry: entry, tokens: tokens),
                  )),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Scout status overview
// ─────────────────────────────────────────────────────────────────────────────

class _ScoutStatusCard extends StatelessWidget {
  const _ScoutStatusCard({required this.scout, required this.tokens});

  final TrendScoutInfo scout;
  final SvenModeTokens tokens;

  @override
  Widget build(BuildContext context) {
    final intervalMin = (scout.scoutIntervalMs / 60000).round();

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: tokens.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: tokens.primary.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          Icon(Icons.radar_rounded, color: tokens.primary, size: 28),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Trend Scout Active',
                  style: TextStyle(
                    color: tokens.primary,
                    fontWeight: FontWeight.w700,
                    fontSize: 14,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  'Scanning every ${intervalMin}min · ${scout.knownAlts} known alts · '
                  '${scout.dynamicWatchlist.length}/${scout.maxDynamic} dynamic slots',
                  style: TextStyle(
                    color: tokens.onSurface.withValues(alpha: 0.5),
                    fontSize: 11,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Core symbols chips
// ─────────────────────────────────────────────────────────────────────────────

class _CoreSymbolsChips extends StatelessWidget {
  const _CoreSymbolsChips({required this.tokens});

  final SvenModeTokens tokens;

  static const _coreSymbols = [
    'BTCUSDT',
    'ETHUSDT',
    'SOLUSDT',
    'BNBUSDT',
    'XRPUSDT',
  ];

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: _coreSymbols.map((sym) {
        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            color: tokens.primary.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: tokens.primary.withValues(alpha: 0.3),
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.lock_rounded,
                  color: tokens.primary, size: 12),
              const SizedBox(width: 4),
              Text(
                sym,
                style: TextStyle(
                  color: tokens.primary,
                  fontWeight: FontWeight.w600,
                  fontSize: 12,
                ),
              ),
            ],
          ),
        );
      }).toList(),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Individual watchlist entry card
// ─────────────────────────────────────────────────────────────────────────────

class _WatchlistCard extends StatelessWidget {
  const _WatchlistCard({required this.entry, required this.tokens});

  final DynamicWatchlistEntry entry;
  final SvenModeTokens tokens;

  @override
  Widget build(BuildContext context) {
    // Colour the expiry countdown.
    final expiryColor = entry.expiresInMin <= 30
        ? Colors.redAccent
        : entry.expiresInMin <= 120
            ? Colors.orange
            : Colors.greenAccent;

    // News score bar (0–1 mapped to 0–100%).
    final scorePct = (entry.newsScore.clamp(0.0, 1.0) * 100).toStringAsFixed(0);

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: tokens.card,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: tokens.frame),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              // Symbol
              Text(
                entry.symbol,
                style: TextStyle(
                  color: tokens.onSurface,
                  fontWeight: FontWeight.w700,
                  fontSize: 15,
                ),
              ),
              const Spacer(),
              // Expiry countdown
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: expiryColor.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.timer_rounded,
                        color: expiryColor, size: 12),
                    const SizedBox(width: 3),
                    Text(
                      _formatExpiry(entry.expiresInMin),
                      style: TextStyle(
                        color: expiryColor,
                        fontWeight: FontWeight.w600,
                        fontSize: 11,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          // Meta row
          Row(
            children: [
              // News score
              _MetaBadge(
                icon: Icons.trending_up_rounded,
                label: 'Score $scorePct%',
                color: tokens.primary,
                tokens: tokens,
              ),
              const SizedBox(width: 8),
              // Trades executed
              _MetaBadge(
                icon: Icons.swap_vert_rounded,
                label: '${entry.trades} trades',
                color: entry.trades > 0 ? Colors.greenAccent : Colors.grey,
                tokens: tokens,
              ),
              const Spacer(),
              // Source
              Text(
                entry.discoveredFrom,
                style: TextStyle(
                  color: tokens.onSurface.withValues(alpha: 0.4),
                  fontSize: 10,
                  fontStyle: FontStyle.italic,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          // News score bar
          ClipRRect(
            borderRadius: BorderRadius.circular(3),
            child: LinearProgressIndicator(
              value: entry.newsScore.clamp(0.0, 1.0),
              backgroundColor: tokens.onSurface.withValues(alpha: 0.1),
              valueColor:
                  AlwaysStoppedAnimation(tokens.primary.withValues(alpha: 0.7)),
              minHeight: 4,
            ),
          ),
        ],
      ),
    );
  }

  String _formatExpiry(int minutes) {
    if (minutes <= 0) return 'Expired';
    if (minutes < 60) return '${minutes}m left';
    final h = minutes ~/ 60;
    final m = minutes % 60;
    return '${h}h ${m}m left';
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
// Meta badge
// ─────────────────────────────────────────────────────────────────────────────

class _MetaBadge extends StatelessWidget {
  const _MetaBadge({
    required this.icon,
    required this.label,
    required this.color,
    required this.tokens,
  });

  final IconData icon;
  final String label;
  final Color color;
  final SvenModeTokens tokens;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: color, size: 11),
          const SizedBox(width: 3),
          Text(
            label,
            style: TextStyle(
              color: color,
              fontWeight: FontWeight.w500,
              fontSize: 10,
            ),
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
          Icon(Icons.explore_off_rounded,
              color: tokens.onSurface.withValues(alpha: 0.3), size: 48),
          const SizedBox(height: 12),
          Text(
            'No dynamic symbols yet',
            style: TextStyle(
              color: tokens.onSurface.withValues(alpha: 0.5),
              fontSize: 15,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Trend Scout discovers new symbols from news analysis.\n'
            'They appear here with a 4h TTL.',
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
