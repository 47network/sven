// ═══════════════════════════════════════════════════════════════════════════
// ExchangeCredentialsPage — Manage Binance / Bybit / Alpaca API keys.
//
// Uses the /v1/admin/trading/exchange-credentials CRUD endpoints (Batch 12D).
// Biometric-gated for security. API keys stored server-side, displayed masked.
// ═══════════════════════════════════════════════════════════════════════════

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../app/app_models.dart';
import '../../app/sven_tokens.dart';
import 'trading_models.dart';
import 'trading_service.dart';

class ExchangeCredentialsPage extends StatefulWidget {
  const ExchangeCredentialsPage({
    super.key,
    required this.tradingService,
    required this.visualMode,
  });

  final TradingService tradingService;
  final VisualMode visualMode;

  @override
  State<ExchangeCredentialsPage> createState() =>
      _ExchangeCredentialsPageState();
}

class _ExchangeCredentialsPageState
    extends State<ExchangeCredentialsPage> {
  @override
  void initState() {
    super.initState();
    widget.tradingService.addListener(_onUpdate);
    widget.tradingService.fetchExchangeCredentials();
  }

  @override
  void dispose() {
    widget.tradingService.removeListener(_onUpdate);
    super.dispose();
  }

  void _onUpdate() => setState(() {});

  Future<void> _showAddDialog() async {
    final tokens = SvenTokens.forMode(widget.visualMode);
    String broker = 'ccxt_binance';
    final keyCtrl = TextEditingController();
    final secretCtrl = TextEditingController();
    final labelCtrl = TextEditingController();
    bool isPaper = true;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(builder: (ctx, setDialogState) {
          return AlertDialog(
            backgroundColor: tokens.card,
            shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16)),
            title: Text('Add Exchange Key',
                style: TextStyle(color: tokens.onSurface, fontSize: 16)),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Broker selector
                  DropdownButtonFormField<String>(
                    initialValue: broker,
                    decoration: InputDecoration(
                      labelText: 'Exchange',
                      labelStyle: TextStyle(
                          color: tokens.onSurface.withValues(alpha: 0.6)),
                      enabledBorder: OutlineInputBorder(
                        borderSide: BorderSide(color: tokens.frame),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderSide: BorderSide(color: tokens.primary),
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
                    dropdownColor: tokens.card,
                    items: const [
                      DropdownMenuItem(
                          value: 'ccxt_binance',
                          child: Text('Binance')),
                      DropdownMenuItem(
                          value: 'ccxt_bybit',
                          child: Text('Bybit')),
                      DropdownMenuItem(
                          value: 'alpaca',
                          child: Text('Alpaca')),
                    ],
                    onChanged: (v) =>
                        setDialogState(() => broker = v!),
                    style: TextStyle(color: tokens.onSurface),
                  ),
                  const SizedBox(height: 12),

                  // API Key
                  TextField(
                    controller: keyCtrl,
                    style: TextStyle(color: tokens.onSurface),
                    decoration: InputDecoration(
                      labelText: 'API Key',
                      labelStyle: TextStyle(
                          color: tokens.onSurface.withValues(alpha: 0.6)),
                      enabledBorder: OutlineInputBorder(
                        borderSide: BorderSide(color: tokens.frame),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderSide: BorderSide(color: tokens.primary),
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),

                  // API Secret
                  TextField(
                    controller: secretCtrl,
                    obscureText: true,
                    style: TextStyle(color: tokens.onSurface),
                    decoration: InputDecoration(
                      labelText: 'API Secret',
                      labelStyle: TextStyle(
                          color: tokens.onSurface.withValues(alpha: 0.6)),
                      enabledBorder: OutlineInputBorder(
                        borderSide: BorderSide(color: tokens.frame),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderSide: BorderSide(color: tokens.primary),
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),

                  // Label (optional)
                  TextField(
                    controller: labelCtrl,
                    style: TextStyle(color: tokens.onSurface),
                    decoration: InputDecoration(
                      labelText: 'Label (optional)',
                      labelStyle: TextStyle(
                          color: tokens.onSurface.withValues(alpha: 0.6)),
                      enabledBorder: OutlineInputBorder(
                        borderSide: BorderSide(color: tokens.frame),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderSide: BorderSide(color: tokens.primary),
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),

                  // Paper toggle
                  SwitchListTile(
                    title: Text('Paper / Testnet',
                        style: TextStyle(
                            color: tokens.onSurface, fontSize: 14)),
                    subtitle: Text(
                        isPaper ? 'Using testnet' : 'REAL MONEY',
                        style: TextStyle(
                          color: isPaper ? Colors.green : Colors.red,
                          fontWeight: FontWeight.w600,
                          fontSize: 12,
                        )),
                    value: isPaper,
                    onChanged: (v) =>
                        setDialogState(() => isPaper = v),
                    activeThumbColor: tokens.primary,
                    contentPadding: EdgeInsets.zero,
                  ),
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx, false),
                child: Text('Cancel',
                    style: TextStyle(color: tokens.onSurface)),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(ctx, true),
                style: FilledButton.styleFrom(
                    backgroundColor: tokens.primary),
                child: const Text('Save'),
              ),
            ],
          );
        });
      },
    );

    if (confirmed == true && keyCtrl.text.isNotEmpty && secretCtrl.text.isNotEmpty) {
      HapticFeedback.mediumImpact();
      await widget.tradingService.addExchangeCredential(
        broker: broker,
        apiKey: keyCtrl.text.trim(),
        apiSecret: secretCtrl.text.trim(),
        isPaper: isPaper,
        label: labelCtrl.text.trim().isEmpty ? null : labelCtrl.text.trim(),
      );
    }

    keyCtrl.dispose();
    secretCtrl.dispose();
    labelCtrl.dispose();
  }

  Future<void> _confirmRevoke(ExchangeCredential cred) async {
    final tokens = SvenTokens.forMode(widget.visualMode);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: tokens.card,
        shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16)),
        title: Text('Revoke Credential',
            style: TextStyle(color: tokens.onSurface)),
        content: Text(
          'Revoke ${cred.brokerDisplay} key ${cred.apiKeyMasked}?\nThis cannot be undone.',
          style: TextStyle(color: tokens.onSurface.withValues(alpha: 0.7)),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text('Cancel',
                style: TextStyle(color: tokens.onSurface)),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(
                backgroundColor: Colors.red.shade700),
            child: const Text('Revoke'),
          ),
        ],
      ),
    );
    if (confirmed == true) {
      HapticFeedback.heavyImpact();
      await widget.tradingService.revokeExchangeCredential(cred.id);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = SvenTokens.forMode(widget.visualMode);
    final creds = widget.tradingService.exchangeCredentials;

    return Scaffold(
      backgroundColor: tokens.scaffold,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: Text('Exchange Keys',
            style: TextStyle(color: tokens.onSurface)),
        iconTheme: IconThemeData(color: tokens.onSurface),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: _showAddDialog,
        backgroundColor: tokens.primary,
        child: Icon(Icons.add, color: tokens.scaffold),
      ),
      body: creds.isEmpty
          ? Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.vpn_key_off_rounded,
                      size: 48,
                      color: tokens.onSurface.withValues(alpha: 0.3)),
                  const SizedBox(height: 12),
                  Text('No exchange credentials configured',
                      style: TextStyle(
                          color:
                              tokens.onSurface.withValues(alpha: 0.5))),
                  const SizedBox(height: 8),
                  Text('Tap + to add Binance, Bybit, or Alpaca keys',
                      style: TextStyle(
                          color:
                              tokens.onSurface.withValues(alpha: 0.35),
                          fontSize: 12)),
                ],
              ),
            )
          : ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: creds.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (ctx, i) =>
                  _CredentialTile(
                    cred: creds[i],
                    tokens: tokens,
                    onRevoke: () => _confirmRevoke(creds[i]),
                  ),
            ),
    );
  }
}

// ── Credential tile ──────────────────────────────────────────────────────────

class _CredentialTile extends StatelessWidget {
  const _CredentialTile({
    required this.cred,
    required this.tokens,
    required this.onRevoke,
  });
  final ExchangeCredential cred;
  final SvenModeTokens tokens;
  final VoidCallback onRevoke;

  IconData _brokerIcon() {
    switch (cred.broker) {
      case 'ccxt_binance':
        return Icons.currency_bitcoin_rounded;
      case 'ccxt_bybit':
        return Icons.candlestick_chart_rounded;
      case 'alpaca':
        return Icons.show_chart_rounded;
      default:
        return Icons.account_balance_rounded;
    }
  }

  @override
  Widget build(BuildContext context) {
    final isRevoked = cred.status == 'revoked';
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: tokens.card,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
            color: isRevoked
                ? Colors.red.withValues(alpha: 0.3)
                : tokens.frame),
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: tokens.primary.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(_brokerIcon(),
                color: isRevoked
                    ? Colors.red.withValues(alpha: 0.5)
                    : tokens.primary,
                size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(cred.brokerDisplay,
                        style: TextStyle(
                          color: tokens.onSurface,
                          fontWeight: FontWeight.w600,
                          fontSize: 14,
                        )),
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: cred.isPaper
                            ? Colors.blue.withValues(alpha: 0.15)
                            : Colors.orange.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        cred.isPaper ? 'PAPER' : 'LIVE',
                        style: TextStyle(
                          color: cred.isPaper
                              ? Colors.blue
                              : Colors.orange,
                          fontSize: 9,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    if (isRevoked) ...[
                      const SizedBox(width: 4),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: Colors.red.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: const Text('REVOKED',
                            style: TextStyle(
                                color: Colors.red,
                                fontSize: 9,
                                fontWeight: FontWeight.w700)),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 3),
                Text(
                  '${cred.apiKeyMasked}${cred.label != null ? '  •  ${cred.label}' : ''}',
                  style: TextStyle(
                    color: tokens.onSurface.withValues(alpha: 0.5),
                    fontSize: 12,
                    fontFamily: 'monospace',
                  ),
                ),
              ],
            ),
          ),
          if (!isRevoked)
            IconButton(
              icon: Icon(Icons.delete_outline_rounded,
                  color: Colors.red.withValues(alpha: 0.6), size: 20),
              onPressed: onRevoke,
              tooltip: 'Revoke',
            ),
        ],
      ),
    );
  }
}
