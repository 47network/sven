// ═══════════════════════════════════════════════════════════════════════════
// PriceAlertsPage — Configure price threshold alerts from the app.
//
// Users set symbol + direction + price → Sven monitors and pushes a
// notification when the threshold is breached.
// ═══════════════════════════════════════════════════════════════════════════

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../app/app_models.dart';
import '../../app/sven_tokens.dart';
import 'trading_models.dart';
import 'trading_service.dart';

class PriceAlertsPage extends StatefulWidget {
  const PriceAlertsPage({
    super.key,
    required this.tradingService,
    required this.visualMode,
  });

  final TradingService tradingService;
  final VisualMode visualMode;

  @override
  State<PriceAlertsPage> createState() => _PriceAlertsPageState();
}

class _PriceAlertsPageState extends State<PriceAlertsPage> {
  @override
  void initState() {
    super.initState();
    widget.tradingService.addListener(_onUpdate);
    widget.tradingService.fetchAlerts();
  }

  @override
  void dispose() {
    widget.tradingService.removeListener(_onUpdate);
    super.dispose();
  }

  void _onUpdate() => setState(() {});

  void _showCreateDialog() {
    final tokens = SvenTokens.forMode(widget.visualMode);
    final symbolCtrl = TextEditingController();
    final priceCtrl = TextEditingController();
    String direction = 'above';

    showDialog<void>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          backgroundColor: tokens.card,
          title: Text('New Price Alert',
              style: TextStyle(color: tokens.onSurface)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: symbolCtrl,
                style: TextStyle(color: tokens.onSurface),
                textCapitalization: TextCapitalization.characters,
                decoration: InputDecoration(
                  labelText: 'Symbol (e.g. BTCUSD)',
                  labelStyle:
                      TextStyle(color: tokens.onSurface.withValues(alpha: 0.5)),
                  border: const OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: priceCtrl,
                style: TextStyle(color: tokens.onSurface),
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                inputFormatters: [
                  FilteringTextInputFormatter.allow(RegExp(r'[\d.]')),
                ],
                decoration: InputDecoration(
                  labelText: 'Target Price',
                  labelStyle:
                      TextStyle(color: tokens.onSurface.withValues(alpha: 0.5)),
                  border: const OutlineInputBorder(),
                  prefixText: '\$ ',
                ),
              ),
              const SizedBox(height: 12),
              SegmentedButton<String>(
                segments: const [
                  ButtonSegment(value: 'above', label: Text('Above')),
                  ButtonSegment(value: 'below', label: Text('Below')),
                ],
                selected: {direction},
                onSelectionChanged: (v) =>
                    setDialogState(() => direction = v.first),
                style: ButtonStyle(
                  foregroundColor: WidgetStateProperty.resolveWith(
                    (states) => states.contains(WidgetState.selected)
                        ? Colors.white
                        : tokens.onSurface,
                  ),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: Text('Cancel',
                  style: TextStyle(color: tokens.onSurface.withValues(alpha: 0.6))),
            ),
            FilledButton(
              onPressed: () async {
                final symbol = symbolCtrl.text.trim().toUpperCase();
                final price = double.tryParse(priceCtrl.text.trim());
                if (symbol.isEmpty || price == null || price <= 0) return;
                HapticFeedback.lightImpact();
                Navigator.pop(ctx);
                await widget.tradingService.createAlert(
                  symbol: symbol,
                  targetPrice: price,
                  direction: direction,
                );
              },
              style: FilledButton.styleFrom(backgroundColor: tokens.primary),
              child: const Text('Create'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _deleteAlert(PriceAlert alert) async {
    HapticFeedback.mediumImpact();
    await widget.tradingService.deleteAlert(alert.id);
  }

  @override
  Widget build(BuildContext context) {
    final tokens = SvenTokens.forMode(widget.visualMode);
    final alerts = widget.tradingService.alerts;

    return Scaffold(
      backgroundColor: tokens.scaffold,
      appBar: AppBar(
        title: const Text('Price Alerts'),
        backgroundColor: Colors.transparent,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: widget.tradingService.fetchAlerts,
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: _showCreateDialog,
        backgroundColor: tokens.primary,
        child: const Icon(Icons.add_alert_rounded, color: Colors.white),
      ),
      body: alerts.isEmpty
          ? Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.notifications_none_rounded,
                      color: tokens.onSurface.withValues(alpha: 0.3), size: 56),
                  const SizedBox(height: 12),
                  Text(
                    'No price alerts set',
                    style: TextStyle(
                        color: tokens.onSurface.withValues(alpha: 0.5), fontSize: 15),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Tap + to create an alert.\nSven will notify you when the price crosses your target.',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                        color: tokens.onSurface.withValues(alpha: 0.35), fontSize: 13),
                  ),
                ],
              ),
            )
          : ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: alerts.length,
              itemBuilder: (_, i) => _AlertTile(
                alert: alerts[i],
                tokens: tokens,
                onDelete: () => _deleteAlert(alerts[i]),
              ),
            ),
    );
  }
}

class _AlertTile extends StatelessWidget {
  const _AlertTile({
    required this.alert,
    required this.tokens,
    required this.onDelete,
  });

  final PriceAlert alert;
  final SvenModeTokens tokens;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final dirIcon = alert.direction == 'above'
        ? Icons.arrow_upward_rounded
        : Icons.arrow_downward_rounded;
    final dirColor = alert.direction == 'above' ? Colors.green : Colors.red;

    final statusColor = switch (alert.status) {
      'triggered' => Colors.orange,
      'expired' => Colors.grey,
      _ => tokens.primary,
    };

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: tokens.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: tokens.frame.withValues(alpha: 0.2)),
      ),
      child: Row(
        children: [
          Icon(dirIcon, color: dirColor, size: 24),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  alert.symbol,
                  style: TextStyle(
                    color: tokens.onSurface,
                    fontWeight: FontWeight.w700,
                    fontSize: 15,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  '${alert.direction == 'above' ? '↑ Above' : '↓ Below'} \$${alert.targetPrice.toStringAsFixed(2)}',
                  style: TextStyle(
                    color: tokens.onSurface.withValues(alpha: 0.6),
                    fontSize: 13,
                  ),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: statusColor.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(
              alert.status.toUpperCase(),
              style: TextStyle(
                color: statusColor,
                fontWeight: FontWeight.w700,
                fontSize: 10,
              ),
            ),
          ),
          const SizedBox(width: 8),
          IconButton(
            icon: Icon(Icons.delete_outline_rounded,
                color: Colors.red.withValues(alpha: 0.7), size: 20),
            onPressed: onDelete,
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(),
          ),
        ],
      ),
    );
  }
}
