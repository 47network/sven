// ═══════════════════════════════════════════════════════════════════════════
// PortfolioPositionsPage — Detailed breakdown of Sven's open positions.
//
// Shows each position with: symbol, side, quantity, entry price, current
// price, unrealized P&L, and a mini sparkline chart.
// ═══════════════════════════════════════════════════════════════════════════

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../app/app_models.dart';
import '../../app/sven_tokens.dart';
import 'trading_models.dart';
import 'trading_service.dart';

class PortfolioPositionsPage extends StatefulWidget {
  const PortfolioPositionsPage({
    super.key,
    required this.tradingService,
    required this.visualMode,
  });

  final TradingService tradingService;
  final VisualMode visualMode;

  @override
  State<PortfolioPositionsPage> createState() => _PortfolioPositionsPageState();
}

class _PortfolioPositionsPageState extends State<PortfolioPositionsPage> {
  @override
  void initState() {
    super.initState();
    widget.tradingService.addListener(_onUpdate);
    widget.tradingService.fetchPositions();
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
    final positions = widget.tradingService.positions;
    final status = widget.tradingService.status;

    return Scaffold(
      backgroundColor: tokens.scaffold,
      appBar: AppBar(
        title: const Text('Portfolio'),
        backgroundColor: Colors.transparent,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () {
              HapticFeedback.lightImpact();
              widget.tradingService.fetchPositions();
            },
          ),
        ],
      ),
      body: RefreshIndicator(
        color: tokens.primary,
        onRefresh: widget.tradingService.fetchPositions,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // ── Summary bar ──────────────────────────────────────────────
            if (status != null)
              Container(
                padding: const EdgeInsets.all(14),
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: tokens.card,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: tokens.frame.withValues(alpha: 0.2)),
                ),
                child: Row(
                  children: [
                    _SummaryTile(
                      label: 'Open',
                      value: '${status.openPositions}',
                      tokens: tokens,
                    ),
                    _SummaryTile(
                      label: 'Today P&L',
                      value:
                          '${status.todayPnl >= 0 ? '+' : ''}${status.todayPnl.toStringAsFixed(2)}%',
                      tokens: tokens,
                      color: status.todayPnl >= 0 ? Colors.green : Colors.red,
                    ),
                    _SummaryTile(
                      label: 'Trades',
                      value: '${status.todayTrades}',
                      tokens: tokens,
                    ),
                    _SummaryTile(
                      label: 'Pending',
                      value: '${status.pendingOrders}',
                      tokens: tokens,
                    ),
                  ],
                ),
              ),

            // ── Position cards ───────────────────────────────────────────
            if (positions.isEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 60),
                child: Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.account_balance_wallet_outlined,
                          color: tokens.onSurface.withValues(alpha: 0.3), size: 56),
                      const SizedBox(height: 12),
                      Text(
                        'No open positions',
                        style: TextStyle(
                            color: tokens.onSurface.withValues(alpha: 0.5),
                            fontSize: 15),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Sven will open positions when market conditions\nmatch the configured strategy.',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                            color: tokens.onSurface.withValues(alpha: 0.35),
                            fontSize: 13),
                      ),
                    ],
                  ),
                ),
              )
            else
              ...positions.map((p) => _PositionCard(position: p, tokens: tokens)),
          ],
        ),
      ),
    );
  }
}

class _SummaryTile extends StatelessWidget {
  const _SummaryTile({
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

class _PositionCard extends StatelessWidget {
  const _PositionCard({required this.position, required this.tokens});

  final Position position;
  final SvenModeTokens tokens;

  @override
  Widget build(BuildContext context) {
    final isLong = position.side == 'long';
    final sideColor = isLong ? Colors.green : Colors.red;
    final pnlColor = position.unrealizedPnl >= 0 ? Colors.green : Colors.red;
    final pnlSign = position.unrealizedPnl >= 0 ? '+' : '';

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
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
              Icon(
                isLong ? Icons.trending_up_rounded : Icons.trending_down_rounded,
                color: sideColor,
                size: 20,
              ),
              const SizedBox(width: 8),
              Text(
                position.symbol,
                style: TextStyle(
                  color: tokens.onSurface,
                  fontWeight: FontWeight.w700,
                  fontSize: 16,
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: sideColor.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  position.side.toUpperCase(),
                  style: TextStyle(
                    color: sideColor,
                    fontWeight: FontWeight.w700,
                    fontSize: 10,
                    letterSpacing: 0.6,
                  ),
                ),
              ),
              const Spacer(),
              Text(
                '$pnlSign${position.unrealizedPnl.toStringAsFixed(2)}%',
                style: TextStyle(
                  color: pnlColor,
                  fontWeight: FontWeight.w700,
                  fontSize: 16,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          // ── Sparkline ──────────────────────────────────────────────
          if (position.priceHistory.length > 1)
            SizedBox(
              height: 40,
              child: CustomPaint(
                size: const Size(double.infinity, 40),
                painter: _SparklinePainter(
                  data: position.priceHistory,
                  lineColor: pnlColor,
                ),
              ),
            ),
          if (position.priceHistory.length > 1) const SizedBox(height: 10),
          // ── Detail row ─────────────────────────────────────────────
          Row(
            children: [
              _DetailCol(label: 'Entry', value: '\$${position.entryPrice.toStringAsFixed(2)}', tokens: tokens),
              _DetailCol(label: 'Current', value: '\$${position.currentPrice.toStringAsFixed(2)}', tokens: tokens),
              _DetailCol(label: 'Qty', value: position.quantity.toStringAsFixed(4), tokens: tokens),
              _DetailCol(
                label: 'Value',
                value: '\$${(position.quantity * position.currentPrice).toStringAsFixed(2)}',
                tokens: tokens,
              ),
            ],
          ),
          if (position.broker.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(
              'Broker: ${position.broker} • Opened: ${_formatTime(position.openedAt)}',
              style: TextStyle(
                color: tokens.onSurface.withValues(alpha: 0.4),
                fontSize: 11,
              ),
            ),
          ],
        ],
      ),
    );
  }

  static String _formatTime(String iso) {
    final dt = DateTime.tryParse(iso);
    if (dt == null) return iso;
    final local = dt.toLocal();
    final diff = DateTime.now().difference(local);
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    return '${local.day}/${local.month} ${local.hour.toString().padLeft(2, '0')}:${local.minute.toString().padLeft(2, '0')}';
  }
}

class _DetailCol extends StatelessWidget {
  const _DetailCol({
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
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label,
              style: TextStyle(
                  color: tokens.onSurface.withValues(alpha: 0.45), fontSize: 10)),
          const SizedBox(height: 1),
          Text(value,
              style: TextStyle(
                  color: tokens.onSurface,
                  fontWeight: FontWeight.w600,
                  fontSize: 13)),
        ],
      ),
    );
  }
}

/// Custom sparkline painter — draws a simple line chart from price history.
/// Avoids adding fl_chart as a dependency; uses raw Canvas API.
class _SparklinePainter extends CustomPainter {
  const _SparklinePainter({required this.data, required this.lineColor});

  final List<double> data;
  final Color lineColor;

  @override
  void paint(Canvas canvas, Size size) {
    if (data.length < 2) return;

    final minY = data.reduce((a, b) => a < b ? a : b);
    final maxY = data.reduce((a, b) => a > b ? a : b);
    final rangeY = maxY - minY;
    if (rangeY == 0) return;

    final stepX = size.width / (data.length - 1);

    final linePaint = Paint()
      ..color = lineColor
      ..strokeWidth = 1.5
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..isAntiAlias = true;

    final fillPaint = Paint()
      ..shader = LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [lineColor.withValues(alpha: 0.25), lineColor.withValues(alpha: 0.0)],
      ).createShader(Rect.fromLTWH(0, 0, size.width, size.height))
      ..style = PaintingStyle.fill;

    final path = Path();
    final fillPath = Path();

    for (var i = 0; i < data.length; i++) {
      final x = i * stepX;
      final y = size.height - ((data[i] - minY) / rangeY) * size.height;
      if (i == 0) {
        path.moveTo(x, y);
        fillPath.moveTo(x, y);
      } else {
        path.lineTo(x, y);
        fillPath.lineTo(x, y);
      }
    }

    // Close the fill path.
    fillPath.lineTo(size.width, size.height);
    fillPath.lineTo(0, size.height);
    fillPath.close();

    canvas.drawPath(fillPath, fillPaint);
    canvas.drawPath(path, linePaint);
  }

  @override
  bool shouldRepaint(covariant _SparklinePainter oldDelegate) =>
      !identical(data, oldDelegate.data) || lineColor != oldDelegate.lineColor;
}
