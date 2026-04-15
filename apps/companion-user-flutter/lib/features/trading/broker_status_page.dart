// ═══════════════════════════════════════════════════════════════════════════
// BrokerStatusPage — Connected broker health, latency, and paper/live mode.
//
// Uses the /v1/trading/broker/list endpoint (Batch 12C) to display
// which brokers are connected, their latency, and paper vs live mode.
// ═══════════════════════════════════════════════════════════════════════════

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../app/app_models.dart';
import '../../app/sven_tokens.dart';
import 'trading_models.dart';
import 'trading_service.dart';

class BrokerStatusPage extends StatefulWidget {
  const BrokerStatusPage({
    super.key,
    required this.tradingService,
    required this.visualMode,
  });

  final TradingService tradingService;
  final VisualMode visualMode;

  @override
  State<BrokerStatusPage> createState() => _BrokerStatusPageState();
}

class _BrokerStatusPageState extends State<BrokerStatusPage> {
  bool _refreshing = false;

  @override
  void initState() {
    super.initState();
    widget.tradingService.addListener(_onUpdate);
    widget.tradingService.fetchBrokerList();
  }

  @override
  void dispose() {
    widget.tradingService.removeListener(_onUpdate);
    super.dispose();
  }

  void _onUpdate() => setState(() {});

  Future<void> _refresh() async {
    setState(() => _refreshing = true);
    HapticFeedback.lightImpact();
    await widget.tradingService.fetchBrokerList();
    if (mounted) setState(() => _refreshing = false);
  }

  @override
  Widget build(BuildContext context) {
    final tokens = SvenTokens.forMode(widget.visualMode);
    final brokers = widget.tradingService.brokerList;

    return Scaffold(
      backgroundColor: tokens.scaffold,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: Text('Broker Health',
            style: TextStyle(color: tokens.onSurface)),
        iconTheme: IconThemeData(color: tokens.onSurface),
        actions: [
          IconButton(
            onPressed: _refreshing ? null : _refresh,
            icon: _refreshing
                ? SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: tokens.primary),
                  )
                : Icon(Icons.refresh_rounded, color: tokens.primary),
            tooltip: 'Refresh',
          ),
        ],
      ),
      body: brokers.isEmpty
          ? Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.cloud_off_rounded,
                      size: 48,
                      color: tokens.onSurface.withValues(alpha: 0.3)),
                  const SizedBox(height: 12),
                  Text('No brokers connected',
                      style: TextStyle(
                          color:
                              tokens.onSurface.withValues(alpha: 0.5))),
                  const SizedBox(height: 8),
                  Text(
                      'Add exchange credentials to connect a broker',
                      style: TextStyle(
                          color:
                              tokens.onSurface.withValues(alpha: 0.35),
                          fontSize: 12)),
                ],
              ),
            )
          : RefreshIndicator(
              onRefresh: _refresh,
              color: tokens.primary,
              child: ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: brokers.length + 1, // +1 for summary card
                separatorBuilder: (_, __) => const SizedBox(height: 12),
                itemBuilder: (ctx, i) {
                  if (i == 0) {
                    return _SummaryCard(
                        brokers: brokers, tokens: tokens);
                  }
                  return _BrokerTile(
                    broker: brokers[i - 1],
                    tokens: tokens,
                  );
                },
              ),
            ),
    );
  }
}

// ── Summary card ─────────────────────────────────────────────────────────────

class _SummaryCard extends StatelessWidget {
  const _SummaryCard({required this.brokers, required this.tokens});
  final List<BrokerHealth> brokers;
  final SvenModeTokens tokens;

  @override
  Widget build(BuildContext context) {
    final connected = brokers.where((b) => b.connected).length;
    final total = brokers.length;
    final avgLatency = brokers
        .where((b) => b.connected && b.latencyMs != null)
        .fold<int>(0, (sum, b) => sum + b.latencyMs!);
    final connectedCount =
        brokers.where((b) => b.connected && b.latencyMs != null).length;
    final avg = connectedCount > 0 ? avgLatency ~/ connectedCount : 0;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: tokens.card,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: tokens.frame),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              children: [
                Text('$connected / $total',
                    style: TextStyle(
                      color: connected == total
                          ? Colors.green
                          : Colors.orange,
                      fontSize: 28,
                      fontWeight: FontWeight.w800,
                    )),
                const SizedBox(height: 2),
                Text('Connected',
                    style: TextStyle(
                        color:
                            tokens.onSurface.withValues(alpha: 0.5),
                        fontSize: 11)),
              ],
            ),
          ),
          Container(
            width: 1,
            height: 40,
            color: tokens.frame,
          ),
          Expanded(
            child: Column(
              children: [
                Text('${avg}ms',
                    style: TextStyle(
                      color: avg < 100
                          ? Colors.green
                          : avg < 500
                              ? Colors.orange
                              : Colors.red,
                      fontSize: 28,
                      fontWeight: FontWeight.w800,
                    )),
                const SizedBox(height: 2),
                Text('Avg Latency',
                    style: TextStyle(
                        color:
                            tokens.onSurface.withValues(alpha: 0.5),
                        fontSize: 11)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── Broker tile ──────────────────────────────────────────────────────────────

class _BrokerTile extends StatelessWidget {
  const _BrokerTile({required this.broker, required this.tokens});
  final BrokerHealth broker;
  final SvenModeTokens tokens;

  IconData _icon() {
    switch (broker.name) {
      case 'ccxt_binance':
        return Icons.currency_bitcoin_rounded;
      case 'ccxt_bybit':
        return Icons.candlestick_chart_rounded;
      case 'alpaca':
        return Icons.show_chart_rounded;
      case 'paper':
        return Icons.description_rounded;
      default:
        return Icons.account_balance_rounded;
    }
  }

  @override
  Widget build(BuildContext context) {
    final latency = broker.latencyMs;
    final latencyColor = latency == null
        ? Colors.grey
        : latency < 100
            ? Colors.green
            : latency < 500
                ? Colors.orange
                : Colors.red;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: tokens.card,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: tokens.frame),
      ),
      child: Row(
        children: [
          // Icon
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: broker.connected
                  ? Colors.green.withValues(alpha: 0.1)
                  : Colors.red.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(_icon(),
                color: broker.connected ? tokens.primary : Colors.red,
                size: 22),
          ),
          const SizedBox(width: 14),

          // Name + status
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(broker.displayName,
                    style: TextStyle(
                      color: tokens.onSurface,
                      fontWeight: FontWeight.w600,
                      fontSize: 15,
                    )),
                const SizedBox(height: 3),
                Row(
                  children: [
                    Container(
                      width: 8,
                      height: 8,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: broker.connected
                            ? Colors.green
                            : Colors.red,
                      ),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      broker.connected
                          ? 'Connected'
                          : 'Disconnected',
                      style: TextStyle(
                        color: tokens.onSurface.withValues(alpha: 0.5),
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),

          // Latency badge
          if (broker.connected && latency != null)
            Container(
              padding: const EdgeInsets.symmetric(
                  horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: latencyColor.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                '${latency}ms',
                style: TextStyle(
                  color: latencyColor,
                  fontWeight: FontWeight.w700,
                  fontSize: 13,
                ),
              ),
            )
          else if (!broker.connected)
            Icon(Icons.warning_amber_rounded,
                color: Colors.red.withValues(alpha: 0.5), size: 20),
        ],
      ),
    );
  }
}
