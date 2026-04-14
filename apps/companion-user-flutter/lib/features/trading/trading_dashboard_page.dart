// ═══════════════════════════════════════════════════════════════════════════
// TradingDashboardPage — Sven's live trading activity dashboard.
//
// Shows: Sven status, auto-trade config, GPU fleet health, live loop ticks,
// recent trades, and market positions. All data fetched from trading API.
// ═══════════════════════════════════════════════════════════════════════════

import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../app/app_models.dart';
import '../../app/sven_tokens.dart';
import 'trading_cache.dart';
import 'trading_models.dart';
import 'trading_service.dart';
import 'trading_sse_service.dart';
import 'sven_messages_page.dart';
import 'sven_control_page.dart';
import 'portfolio_positions_page.dart';
import 'price_alerts_page.dart';
import 'sven_goals_page.dart';
import 'trade_history_page.dart';
import 'news_feed_page.dart';
import 'trend_scout_page.dart';
import 'pnl_summary_page.dart';

class TradingDashboardPage extends StatefulWidget {
  const TradingDashboardPage({
    super.key,
    required this.tradingService,
    required this.sseService,
    required this.visualMode,
  });

  final TradingService tradingService;
  final TradingSseService sseService;
  final VisualMode visualMode;

  @override
  State<TradingDashboardPage> createState() => _TradingDashboardPageState();
}

class _TradingDashboardPageState extends State<TradingDashboardPage> {
  StreamSubscription<TradingEvent>? _sseSub;
  final List<TradingEvent> _liveEvents = [];
  Timer? _refreshTimer;

  // Trade confirmation overlay.
  _TradeConfirmation? _pendingConfirmation;
  Timer? _confirmationTimer;

  @override
  void initState() {
    super.initState();
    widget.tradingService.addListener(_onServiceUpdate);
    // Load cached data first, then fetch live.
    widget.tradingService.loadFromCache().then((_) {
      widget.tradingService.refreshAll();
    });
    widget.sseService.connect();
    _sseSub = widget.sseService.events.listen(_onSseEvent);
    // Periodic refresh every 30 s for status.
    _refreshTimer = Timer.periodic(
      const Duration(seconds: 30),
      (_) => widget.tradingService.fetchStatus(),
    );
  }

  @override
  void dispose() {
    widget.tradingService.removeListener(_onServiceUpdate);
    _sseSub?.cancel();
    _refreshTimer?.cancel();
    _confirmationTimer?.cancel();
    super.dispose();
  }

  void _onServiceUpdate() => setState(() {});

  void _onSseEvent(TradingEvent event) {
    setState(() {
      _liveEvents.insert(0, event);
      // Keep at most 50 live events.
      if (_liveEvents.length > 50) _liveEvents.removeLast();
    });
    // Refresh trades when a trade is executed.
    if (event.type == 'trade_executed') {
      HapticFeedback.heavyImpact();
      widget.tradingService.fetchTrades();
      widget.tradingService.fetchPositions();
      _showTradeConfirmation(event);
    }
    // Refresh messages when Sven sends one.
    if (event.type == 'sven_message') {
      HapticFeedback.mediumImpact();
      widget.tradingService.fetchMessages();
    }
    // Haptic for circuit breaker.
    if (event.type == 'circuit_breaker') {
      HapticFeedback.heavyImpact();
    }
    // Light haptic for loop ticks.
    if (event.type == 'loop_tick') {
      HapticFeedback.selectionClick();
    }
  }

  void _showTradeConfirmation(TradingEvent event) {
    _confirmationTimer?.cancel();
    setState(() {
      _pendingConfirmation = _TradeConfirmation(
        symbol: event.data['symbol'] as String? ?? '',
        side: event.data['side'] as String? ?? '',
        price: (event.data['price'] as num?)?.toDouble() ?? 0,
        quantity: (event.data['quantity'] as num?)?.toDouble() ?? 0,
      );
    });
    _confirmationTimer = Timer(const Duration(seconds: 6), () {
      if (mounted) setState(() => _pendingConfirmation = null);
    });
  }

  void _dismissConfirmation() {
    _confirmationTimer?.cancel();
    setState(() => _pendingConfirmation = null);
  }

  @override
  Widget build(BuildContext context) {
    final tokens = SvenTokens.forMode(widget.visualMode);
    final svc = widget.tradingService;
    final status = svc.status;

    if (svc.loading && status == null) {
      return Center(child: CircularProgressIndicator(color: tokens.primary));
    }

    if (svc.error != null && status == null) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.cloud_off_rounded, color: tokens.onSurface, size: 48),
            const SizedBox(height: 12),
            Text('Could not reach Sven',
                style: TextStyle(color: tokens.onSurface, fontSize: 16)),
            const SizedBox(height: 8),
            FilledButton.icon(
              onPressed: svc.refreshAll,
              icon: const Icon(Icons.refresh_rounded),
              label: const Text('Retry'),
              style: FilledButton.styleFrom(
                  backgroundColor: tokens.primary),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      color: tokens.primary,
      onRefresh: svc.refreshAll,
      child: Stack(
        children: [
          ListView(
            padding: const EdgeInsets.all(16),
            children: [
              // ── Offline banner ───────────────────────────────────────
              if (svc.offline)
                Container(
                  margin: const EdgeInsets.only(bottom: 12),
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: Colors.orange.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(8),
                    border:
                        Border.all(color: Colors.orange.withValues(alpha: 0.4)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.cloud_off_rounded,
                          color: Colors.orange, size: 18),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'You are offline. Showing cached data.',
                          style: TextStyle(
                              color: Colors.orange.shade800, fontSize: 12),
                        ),
                      ),
                    ],
                  ),
                ),
              // ── Cache timestamp ──────────────────────────────────────
              if (svc.fromCache && !svc.offline)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Text(
                    TradingCache.formatCacheAge(svc.cache.statusCachedAt),
                    style: TextStyle(
                      color: tokens.onSurface.withValues(alpha: 0.4),
                      fontSize: 11,
                      fontStyle: FontStyle.italic,
                    ),
                  ),
                ),

              if (status != null) ...[
                _StatusCard(status: status, tokens: tokens),
                const SizedBox(height: 12),
                _AutoTradeCard(status: status, tokens: tokens),
                const SizedBox(height: 12),
                _GpuFleetCard(brain: status.brain, tokens: tokens),
                const SizedBox(height: 12),
              ],
              _QuickActionsRow(
                tokens: tokens,
                unreadMessages: status?.messaging.unreadCount ?? 0,
                onMessages: _openMessages,
                onControl: _openControl,
                onPortfolio: _openPortfolio,
                onAlerts: _openAlerts,
                milestonesAchieved: status?.goal?.achieved ?? 0,
                milestonesTotal: status?.goal?.total ?? 0,
                onGoals: _openGoals,
                onTradeHistory: _openTradeHistory,
                onNewsFeed: _openNewsFeed,
                onTrendScout: _openTrendScout,
                onPnl: _openPnl,
              ),
              const SizedBox(height: 12),
              _LiveEventsCard(
                events: _liveEvents,
                tokens: tokens,
              ),
              const SizedBox(height: 12),
              _RecentTradesCard(
                trades: svc.trades,
                tokens: tokens,
              ),
            ],
          ),
          // ── Trade confirmation overlay ────────────────────────────
          if (_pendingConfirmation != null)
            Positioned(
              top: 0,
              left: 16,
              right: 16,
              child: SafeArea(
                child: Material(
                  color: Colors.transparent,
                  child: GestureDetector(
                    onTap: _dismissConfirmation,
                    child: Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: Colors.green.shade900,
                        borderRadius: BorderRadius.circular(12),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.green.withValues(alpha: 0.3),
                            blurRadius: 12,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.check_circle_rounded,
                              color: Colors.greenAccent, size: 28),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  'Trade Executed',
                                  style: TextStyle(
                                    color: Colors.green.shade100,
                                    fontWeight: FontWeight.w700,
                                    fontSize: 14,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  '${_pendingConfirmation!.side.toUpperCase()} ${_pendingConfirmation!.symbol} — '
                                  '${_pendingConfirmation!.quantity} @ \$${_pendingConfirmation!.price.toStringAsFixed(2)}',
                                  style: const TextStyle(
                                      color: Colors.white70, fontSize: 12),
                                ),
                              ],
                            ),
                          ),
                          IconButton(
                            icon: const Icon(Icons.close_rounded,
                                color: Colors.white54, size: 18),
                            onPressed: _dismissConfirmation,
                            padding: EdgeInsets.zero,
                            constraints: const BoxConstraints(),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  void _openMessages() {
    HapticFeedback.lightImpact();
    Navigator.of(context).push(MaterialPageRoute<void>(
      builder: (_) => SvenMessagesPage(
        tradingService: widget.tradingService,
        visualMode: widget.visualMode,
      ),
    ));
  }

  void _openControl() {
    HapticFeedback.lightImpact();
    Navigator.of(context).push(MaterialPageRoute<void>(
      builder: (_) => SvenControlPage(
        tradingService: widget.tradingService,
        visualMode: widget.visualMode,
      ),
    ));
  }

  void _openPortfolio() {
    HapticFeedback.lightImpact();
    Navigator.of(context).push(MaterialPageRoute<void>(
      builder: (_) => PortfolioPositionsPage(
        tradingService: widget.tradingService,
        visualMode: widget.visualMode,
      ),
    ));
  }

  void _openAlerts() {
    HapticFeedback.lightImpact();
    Navigator.of(context).push(MaterialPageRoute<void>(
      builder: (_) => PriceAlertsPage(
        tradingService: widget.tradingService,
        visualMode: widget.visualMode,
      ),
    ));
  }

  void _openGoals() {
    HapticFeedback.lightImpact();
    Navigator.of(context).push(MaterialPageRoute<void>(
      builder: (_) => SvenGoalsPage(
        tradingService: widget.tradingService,
        visualMode: widget.visualMode,
      ),
    ));
  }

  void _openTradeHistory() {
    HapticFeedback.lightImpact();
    Navigator.of(context).push(MaterialPageRoute<void>(
      builder: (_) => TradeHistoryPage(
        tradingService: widget.tradingService,
        visualMode: widget.visualMode,
      ),
    ));
  }

  void _openNewsFeed() {
    HapticFeedback.lightImpact();
    Navigator.of(context).push(MaterialPageRoute<void>(
      builder: (_) => NewsFeedPage(
        tradingService: widget.tradingService,
        visualMode: widget.visualMode,
      ),
    ));
  }

  void _openTrendScout() {
    HapticFeedback.lightImpact();
    Navigator.of(context).push(MaterialPageRoute<void>(
      builder: (_) => TrendScoutPage(
        tradingService: widget.tradingService,
        visualMode: widget.visualMode,
      ),
    ));
  }

  void _openPnl() {
    HapticFeedback.lightImpact();
    Navigator.of(context).push(MaterialPageRoute<void>(
      builder: (_) => PnlSummaryPage(
        tradingService: widget.tradingService,
        visualMode: widget.visualMode,
      ),
    ));
  }
}

// ── Trade confirmation data ──────────────────────────────────────────────────

class _TradeConfirmation {
  const _TradeConfirmation({
    required this.symbol,
    required this.side,
    required this.price,
    required this.quantity,
  });
  final String symbol;
  final String side;
  final double price;
  final double quantity;
}

// ─────────────────────────────────────────────────────────────────────────────
// Status card — Sven's current state
// ─────────────────────────────────────────────────────────────────────────────

class _StatusCard extends StatelessWidget {
  const _StatusCard({required this.status, required this.tokens});

  final TradingStatus status;
  final SvenModeTokens tokens;

  @override
  Widget build(BuildContext context) {
    final stateColor = switch (status.state) {
      'running' => Colors.green,
      'paused' => Colors.orange,
      _ => Colors.red,
    };

    return _Card(
      tokens: tokens,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 12,
                height: 12,
                decoration: BoxDecoration(
                  color: stateColor,
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(color: stateColor.withValues(alpha: 0.5), blurRadius: 8),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Text(
                'SVEN — ${status.state.toUpperCase()}',
                style: TextStyle(
                  color: tokens.onSurface,
                  fontWeight: FontWeight.w700,
                  fontSize: 16,
                  letterSpacing: 1.2,
                ),
              ),
              const Spacer(),
              _Chip(
                label: status.mode.toUpperCase(),
                color: status.mode == 'live' ? Colors.green : Colors.blue,
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              _StatTile(
                label: 'Positions',
                value: '${status.openPositions}',
                tokens: tokens,
              ),
              _StatTile(
                label: 'Orders',
                value: '${status.pendingOrders}',
                tokens: tokens,
              ),
              _StatTile(
                label: 'Trades Today',
                value: '${status.todayTrades}',
                tokens: tokens,
              ),
              _StatTile(
                label: 'P&L',
                value: '${status.todayPnl >= 0 ? '+' : ''}${status.todayPnl.toStringAsFixed(2)}%',
                tokens: tokens,
                valueColor:
                    status.todayPnl >= 0 ? Colors.green : Colors.red,
              ),
            ],
          ),
          if (status.loop.running) ...[
            const SizedBox(height: 8),
            Text(
              'Loop: ${status.loop.iterations} ticks • ${status.loop.trackedSymbols.join(', ')}',
              style: TextStyle(color: tokens.onSurface.withValues(alpha: 0.6), fontSize: 12),
            ),
          ],
          if (status.circuitBreaker.tripped) ...[
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: Colors.red.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(6),
              ),
              child: Text(
                '⚠ Circuit Breaker Tripped: ${status.circuitBreaker.reason ?? 'daily loss limit'}',
                style: const TextStyle(color: Colors.red, fontSize: 12, fontWeight: FontWeight.w600),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Auto-trade card
// ─────────────────────────────────────────────────────────────────────────────

class _AutoTradeCard extends StatelessWidget {
  const _AutoTradeCard({required this.status, required this.tokens});

  final TradingStatus status;
  final SvenModeTokens tokens;

  @override
  Widget build(BuildContext context) {
    final at = status.autoTrade;
    return _Card(
      tokens: tokens,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                at.enabled ? Icons.auto_awesome_rounded : Icons.pause_circle_outline_rounded,
                color: at.enabled ? Colors.green : Colors.orange,
                size: 20,
              ),
              const SizedBox(width: 8),
              Text(
                'AUTO-TRADE',
                style: TextStyle(
                  color: tokens.onSurface,
                  fontWeight: FontWeight.w700,
                  fontSize: 14,
                  letterSpacing: 1.0,
                ),
              ),
              const Spacer(),
              _Chip(
                label: at.enabled ? 'ENABLED' : 'DISABLED',
                color: at.enabled ? Colors.green : Colors.grey,
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              _StatTile(
                label: 'Confidence',
                value: '${(at.confidenceThreshold * 100).toStringAsFixed(0)}%',
                tokens: tokens,
              ),
              _StatTile(
                label: 'Max Position',
                value: '${(at.maxPositionPct * 100).toStringAsFixed(1)}%',
                tokens: tokens,
              ),
              _StatTile(
                label: 'Total Executed',
                value: '${at.totalExecuted}',
                tokens: tokens,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GPU Fleet card
// ─────────────────────────────────────────────────────────────────────────────

class _GpuFleetCard extends StatelessWidget {
  const _GpuFleetCard({required this.brain, required this.tokens});

  final BrainInfo brain;
  final SvenModeTokens tokens;

  @override
  Widget build(BuildContext context) {
    if (brain.fleet.isEmpty) return const SizedBox.shrink();
    return _Card(
      tokens: tokens,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'GPU FLEET',
            style: TextStyle(
              color: tokens.onSurface,
              fontWeight: FontWeight.w700,
              fontSize: 14,
              letterSpacing: 1.0,
            ),
          ),
          const SizedBox(height: 8),
          ...brain.fleet.map((node) => Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Row(
                  children: [
                    Container(
                      width: 8,
                      height: 8,
                      decoration: BoxDecoration(
                        color: node.healthy ? Colors.green : Colors.red,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        '${node.name} (${node.role})',
                        style: TextStyle(
                          color: tokens.onSurface,
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                    Text(
                      node.model,
                      style: TextStyle(
                        color: tokens.onSurface.withValues(alpha: 0.6),
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              )),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Quick actions row
// ─────────────────────────────────────────────────────────────────────────────

class _QuickActionsRow extends StatelessWidget {
  const _QuickActionsRow({
    required this.tokens,
    required this.unreadMessages,
    required this.onMessages,
    required this.onControl,
    required this.onPortfolio,
    required this.onAlerts,
    required this.milestonesAchieved,
    required this.milestonesTotal,
    required this.onGoals,
    required this.onTradeHistory,
    required this.onNewsFeed,
    required this.onTrendScout,
    required this.onPnl,
  });

  final SvenModeTokens tokens;
  final int unreadMessages;
  final VoidCallback onMessages;
  final VoidCallback onControl;
  final VoidCallback onPortfolio;
  final VoidCallback onAlerts;
  final int milestonesAchieved;
  final int milestonesTotal;
  final VoidCallback onGoals;
  final VoidCallback onTradeHistory;
  final VoidCallback onNewsFeed;
  final VoidCallback onTrendScout;
  final VoidCallback onPnl;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: _ActionButton(
                tokens: tokens,
                icon: Icons.message_rounded,
                label: 'Messages',
                badge: unreadMessages > 0 ? '$unreadMessages' : null,
                onTap: onMessages,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _ActionButton(
                tokens: tokens,
                icon: Icons.tune_rounded,
                label: 'Control Sven',
                onTap: onControl,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: _ActionButton(
                tokens: tokens,
                icon: Icons.pie_chart_rounded,
                label: 'Portfolio',
                onTap: onPortfolio,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _ActionButton(
                tokens: tokens,
                icon: Icons.notifications_active_rounded,
                label: 'Price Alerts',
                onTap: onAlerts,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: _ActionButton(
                tokens: tokens,
                icon: Icons.emoji_events_rounded,
                label: 'Goals',
                badge: milestonesTotal > 0
                    ? '$milestonesAchieved/$milestonesTotal'
                    : null,
                onTap: onGoals,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _ActionButton(
                tokens: tokens,
                icon: Icons.show_chart_rounded,
                label: 'P&L',
                onTap: onPnl,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: _ActionButton(
                tokens: tokens,
                icon: Icons.history_rounded,
                label: 'Trade History',
                onTap: onTradeHistory,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _ActionButton(
                tokens: tokens,
                icon: Icons.newspaper_rounded,
                label: 'News Feed',
                onTap: onNewsFeed,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: _ActionButton(
                tokens: tokens,
                icon: Icons.explore_rounded,
                label: 'Trend Scout',
                onTap: onTrendScout,
              ),
            ),
            const SizedBox(width: 12),
            const Expanded(child: SizedBox()),
          ],
        ),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Live events card
// ─────────────────────────────────────────────────────────────────────────────

class _LiveEventsCard extends StatelessWidget {
  const _LiveEventsCard({required this.events, required this.tokens});

  final List<TradingEvent> events;
  final SvenModeTokens tokens;

  @override
  Widget build(BuildContext context) {
    return _Card(
      tokens: tokens,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.bolt_rounded, color: tokens.primary, size: 18),
              const SizedBox(width: 6),
              Text(
                'LIVE ACTIVITY',
                style: TextStyle(
                  color: tokens.onSurface,
                  fontWeight: FontWeight.w700,
                  fontSize: 14,
                  letterSpacing: 1.0,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          if (events.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 12),
              child: Text(
                'Waiting for events...',
                style: TextStyle(
                    color: tokens.onSurface.withValues(alpha: 0.5), fontSize: 13),
              ),
            )
          else
            ...events.take(10).map((e) => Padding(
                  padding: const EdgeInsets.only(bottom: 4),
                  child: Row(
                    children: [
                      _EventDot(type: e.type),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          _eventLabel(e),
                          style: TextStyle(
                              color: tokens.onSurface, fontSize: 12),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      Text(
                        _timeAgo(e.timestamp),
                        style: TextStyle(
                          color: tokens.onSurface.withValues(alpha: 0.4),
                          fontSize: 11,
                        ),
                      ),
                    ],
                  ),
                )),
        ],
      ),
    );
  }

  static String _eventLabel(TradingEvent e) {
    final d = e.data;
    return switch (e.type) {
      'loop_tick' =>
        'Loop tick #${d['iteration'] ?? ''} — ${d['symbol'] ?? ''} confidence ${((d['confidence'] as num?)?.toDouble() ?? 0 * 100).toStringAsFixed(1)}%',
      'trade_executed' =>
        '🟢 TRADE: ${d['side'] ?? ''} ${d['symbol'] ?? ''} @ \$${d['price'] ?? ''}',
      'sven_message' => '💬 ${d['title'] ?? 'Sven message'}',
      'circuit_breaker' => '⚠ Circuit breaker: ${d['reason'] ?? 'tripped'}',
      'analysis_complete' =>
        'Analysis done: ${d['symbol'] ?? ''} → ${d['decision'] ?? ''}',
      _ => '${e.type}: ${d.toString().length > 60 ? '${d.toString().substring(0, 60)}…' : d}',
    };
  }

  static String _timeAgo(DateTime t) {
    final diff = DateTime.now().difference(t);
    if (diff.inSeconds < 60) return '${diff.inSeconds}s ago';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    return '${diff.inHours}h ago';
  }
}

class _EventDot extends StatelessWidget {
  const _EventDot({required this.type});
  final String type;

  @override
  Widget build(BuildContext context) {
    final color = switch (type) {
      'trade_executed' => Colors.green,
      'sven_message' => Colors.blue,
      'circuit_breaker' => Colors.red,
      'loop_tick' => Colors.grey,
      _ => Colors.orange,
    };
    return Container(
      width: 6,
      height: 6,
      decoration: BoxDecoration(color: color, shape: BoxShape.circle),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Recent trades card
// ─────────────────────────────────────────────────────────────────────────────

class _RecentTradesCard extends StatelessWidget {
  const _RecentTradesCard({required this.trades, required this.tokens});

  final List<SvenTrade> trades;
  final SvenModeTokens tokens;

  @override
  Widget build(BuildContext context) {
    return _Card(
      tokens: tokens,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'RECENT TRADES',
            style: TextStyle(
              color: tokens.onSurface,
              fontWeight: FontWeight.w700,
              fontSize: 14,
              letterSpacing: 1.0,
            ),
          ),
          const SizedBox(height: 8),
          if (trades.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 12),
              child: Text(
                'No trades yet — Sven is analyzing markets.',
                style: TextStyle(
                    color: tokens.onSurface.withValues(alpha: 0.5), fontSize: 13),
              ),
            )
          else
            ...trades.take(10).map((t) => Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Row(
                    children: [
                      Icon(
                        t.side == 'buy'
                            ? Icons.arrow_upward_rounded
                            : Icons.arrow_downward_rounded,
                        color: t.side == 'buy' ? Colors.green : Colors.red,
                        size: 16,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              '${t.side.toUpperCase()} ${t.symbol}',
                              style: TextStyle(
                                color: tokens.onSurface,
                                fontWeight: FontWeight.w600,
                                fontSize: 13,
                              ),
                            ),
                            Text(
                              'Qty: ${t.quantity} @ \$${t.price.toStringAsFixed(2)} • ${(t.confidence * 100).toStringAsFixed(0)}% conf',
                              style: TextStyle(
                                color: tokens.onSurface.withValues(alpha: 0.6),
                                fontSize: 11,
                              ),
                            ),
                          ],
                        ),
                      ),
                      _Chip(
                        label: t.broker.toUpperCase(),
                        color: t.broker == 'live' ? Colors.green : Colors.blue,
                      ),
                    ],
                  ),
                )),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared widgets
// ─────────────────────────────────────────────────────────────────────────────

class _Card extends StatelessWidget {
  const _Card({required this.tokens, required this.child});

  final SvenModeTokens tokens;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: tokens.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: tokens.frame.withValues(alpha: 0.2)),
      ),
      child: child,
    );
  }
}

class _StatTile extends StatelessWidget {
  const _StatTile({
    required this.label,
    required this.value,
    required this.tokens,
    this.valueColor,
  });

  final String label;
  final String value;
  final SvenModeTokens tokens;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        children: [
          Text(
            value,
            style: TextStyle(
              color: valueColor ?? tokens.onSurface,
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

class _Chip extends StatelessWidget {
  const _Chip({required this.label, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontWeight: FontWeight.w700,
          fontSize: 10,
          letterSpacing: 0.8,
        ),
      ),
    );
  }
}

class _ActionButton extends StatelessWidget {
  const _ActionButton({
    required this.tokens,
    required this.icon,
    required this.label,
    required this.onTap,
    this.badge,
  });

  final SvenModeTokens tokens;
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final String? badge;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          color: tokens.card,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: tokens.primary.withValues(alpha: 0.3)),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Stack(
              clipBehavior: Clip.none,
              children: [
                Icon(icon, color: tokens.primary, size: 20),
                if (badge != null)
                  Positioned(
                    right: -6,
                    top: -6,
                    child: Container(
                      padding: const EdgeInsets.all(3),
                      decoration: const BoxDecoration(
                        color: Colors.red,
                        shape: BoxShape.circle,
                      ),
                      child: Text(
                        badge!,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 9,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(width: 8),
            Text(
              label,
              style: TextStyle(
                color: tokens.onSurface,
                fontWeight: FontWeight.w600,
                fontSize: 13,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
