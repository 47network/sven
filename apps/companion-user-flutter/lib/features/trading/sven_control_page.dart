// ═══════════════════════════════════════════════════════════════════════════
// SvenControlPage — Configure Sven's trading behaviour from the app.
//
// Lets users:
//   • Toggle auto-trade on/off
//   • Adjust confidence threshold and max position size
//   • Send a message as Sven
//   • Schedule a future message
// ═══════════════════════════════════════════════════════════════════════════

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../app/app_models.dart';
import '../../app/sven_tokens.dart';
import '../../features/security/app_lock_service.dart';
import 'trading_service.dart';

class SvenControlPage extends StatefulWidget {
  const SvenControlPage({
    super.key,
    required this.tradingService,
    required this.visualMode,
    this.appLockService,
  });

  final TradingService tradingService;
  final VisualMode visualMode;
  final AppLockService? appLockService;

  @override
  State<SvenControlPage> createState() => _SvenControlPageState();
}

class _SvenControlPageState extends State<SvenControlPage> {
  late bool _autoTradeEnabled;
  late double _confidenceThreshold;
  late double _maxPositionPct;
  bool _saving = false;

  final _msgTitleCtrl = TextEditingController();
  final _msgBodyCtrl = TextEditingController();
  String _msgType = 'system';
  String _msgSeverity = 'info';
  bool _sendingMsg = false;

  @override
  void initState() {
    super.initState();
    final at = widget.tradingService.status?.autoTrade;
    _autoTradeEnabled = at?.enabled ?? false;
    _confidenceThreshold = at?.confidenceThreshold ?? 0.6;
    _maxPositionPct = at?.maxPositionPct ?? 0.05;
    widget.tradingService.addListener(_onUpdate);
  }

  @override
  void dispose() {
    widget.tradingService.removeListener(_onUpdate);
    _msgTitleCtrl.dispose();
    _msgBodyCtrl.dispose();
    super.dispose();
  }

  void _onUpdate() {
    final at = widget.tradingService.status?.autoTrade;
    if (at != null && !_saving) {
      setState(() {
        _autoTradeEnabled = at.enabled;
        _confidenceThreshold = at.confidenceThreshold;
        _maxPositionPct = at.maxPositionPct;
      });
    }
  }

  Future<void> _onAutoTradeToggle(bool value) async {
    // Enabling auto-trade requires biometric authentication.
    if (value) {
      final lockSvc = widget.appLockService ?? AppLockService();
      final ok = await lockSvc.authenticate(
        'Authenticate to enable auto-trade',
      );
      if (!ok) return; // Auth failed or cancelled — don't toggle.
      HapticFeedback.heavyImpact();
    } else {
      HapticFeedback.mediumImpact();
    }
    setState(() => _autoTradeEnabled = value);
  }

  Future<void> _saveAutoTrade() async {
    HapticFeedback.lightImpact();
    setState(() => _saving = true);
    final ok = await widget.tradingService.configureAutoTrade(
      enabled: _autoTradeEnabled,
      confidenceThreshold: _confidenceThreshold,
      maxPositionPct: _maxPositionPct,
    );
    setState(() => _saving = false);
    if (mounted) {
      final errorDetail = widget.tradingService.error;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(ok
            ? 'Auto-trade updated'
            : errorDetail != null && errorDetail.isNotEmpty
                ? errorDetail
                : 'Failed to update — check connection'),
        duration: const Duration(seconds: 3),
      ));
    }
  }

  Future<void> _sendMessage() async {
    final title = _msgTitleCtrl.text.trim();
    final body = _msgBodyCtrl.text.trim();
    if (title.isEmpty || body.isEmpty) return;

    HapticFeedback.lightImpact();
    setState(() => _sendingMsg = true);
    final ok = await widget.tradingService.sendMessage(
      title: title,
      body: body,
      type: _msgType,
      severity: _msgSeverity,
    );
    setState(() => _sendingMsg = false);
    if (ok) {
      _msgTitleCtrl.clear();
      _msgBodyCtrl.clear();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Message sent'),
          duration: Duration(seconds: 2),
        ));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = SvenTokens.forMode(widget.visualMode);

    return Scaffold(
      backgroundColor: tokens.scaffold,
      appBar: AppBar(
        title: const Text('Control Sven'),
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // ── Auto-trade config ──────────────────────────────────────────
          _SectionHeader(label: 'AUTO-TRADE CONFIG', tokens: tokens),
          const SizedBox(height: 8),
          _SettingsCard(
            tokens: tokens,
            child: Column(
              children: [
                SwitchListTile(
                  title: Text('Auto-Trade',
                      style: TextStyle(color: tokens.onSurface)),
                  subtitle: Text(
                    'Allow Sven to execute trades automatically',
                    style: TextStyle(
                        color: tokens.onSurface.withValues(alpha: 0.5), fontSize: 12),
                  ),
                  value: _autoTradeEnabled,
                  activeThumbColor: tokens.primary,
                  onChanged: (v) => _onAutoTradeToggle(v),
                ),
                const Divider(height: 1),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Confidence Threshold: ${(_confidenceThreshold * 100).toStringAsFixed(0)}%',
                        style: TextStyle(color: tokens.onSurface, fontSize: 13),
                      ),
                      Slider(
                        value: _confidenceThreshold,
                        min: 0.3,
                        max: 0.95,
                        divisions: 13,
                        activeColor: tokens.primary,
                        label: '${(_confidenceThreshold * 100).toStringAsFixed(0)}%',
                        onChanged: (v) =>
                            setState(() => _confidenceThreshold = v),
                      ),
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Max Position Size: ${(_maxPositionPct * 100).toStringAsFixed(1)}%',
                        style: TextStyle(color: tokens.onSurface, fontSize: 13),
                      ),
                      Slider(
                        value: _maxPositionPct,
                        min: 0.01,
                        max: 0.20,
                        divisions: 19,
                        activeColor: tokens.primary,
                        label: '${(_maxPositionPct * 100).toStringAsFixed(1)}%',
                        onChanged: (v) =>
                            setState(() => _maxPositionPct = v),
                      ),
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: _saving ? null : _saveAutoTrade,
                      style: FilledButton.styleFrom(
                          backgroundColor: tokens.primary),
                      child: _saving
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                  strokeWidth: 2, color: Colors.white),
                            )
                          : const Text('Save Configuration'),
                    ),
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 24),

          // ── Send message ───────────────────────────────────────────────
          _SectionHeader(label: 'SEND MESSAGE AS SVEN', tokens: tokens),
          const SizedBox(height: 8),
          _SettingsCard(
            tokens: tokens,
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  TextField(
                    controller: _msgTitleCtrl,
                    style: TextStyle(color: tokens.onSurface),
                    decoration: InputDecoration(
                      labelText: 'Title',
                      labelStyle:
                          TextStyle(color: tokens.onSurface.withValues(alpha: 0.5)),
                      enabledBorder: OutlineInputBorder(
                        borderSide: BorderSide(
                            color: tokens.frame.withValues(alpha: 0.3)),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderSide: BorderSide(color: tokens.primary),
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: _msgBodyCtrl,
                    style: TextStyle(color: tokens.onSurface),
                    maxLines: 3,
                    decoration: InputDecoration(
                      labelText: 'Message body',
                      labelStyle:
                          TextStyle(color: tokens.onSurface.withValues(alpha: 0.5)),
                      enabledBorder: OutlineInputBorder(
                        borderSide: BorderSide(
                            color: tokens.frame.withValues(alpha: 0.3)),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderSide: BorderSide(color: tokens.primary),
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: DropdownButtonFormField<String>(
                          initialValue: _msgType,
                          dropdownColor: tokens.card,
                          style: TextStyle(color: tokens.onSurface, fontSize: 13),
                          decoration: InputDecoration(
                            labelText: 'Type',
                            labelStyle: TextStyle(
                                color: tokens.onSurface.withValues(alpha: 0.5)),
                            border: const OutlineInputBorder(),
                          ),
                          items: const [
                            DropdownMenuItem(value: 'system', child: Text('System')),
                            DropdownMenuItem(
                                value: 'trade_alert', child: Text('Trade Alert')),
                            DropdownMenuItem(
                                value: 'market_insight',
                                child: Text('Market Insight')),
                          ],
                          onChanged: (v) {
                            if (v != null) setState(() => _msgType = v);
                          },
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: DropdownButtonFormField<String>(
                          initialValue: _msgSeverity,
                          dropdownColor: tokens.card,
                          style: TextStyle(color: tokens.onSurface, fontSize: 13),
                          decoration: InputDecoration(
                            labelText: 'Severity',
                            labelStyle: TextStyle(
                                color: tokens.onSurface.withValues(alpha: 0.5)),
                            border: const OutlineInputBorder(),
                          ),
                          items: const [
                            DropdownMenuItem(value: 'info', child: Text('Info')),
                            DropdownMenuItem(value: 'warning', child: Text('Warning')),
                            DropdownMenuItem(
                                value: 'critical', child: Text('Critical')),
                          ],
                          onChanged: (v) {
                            if (v != null) setState(() => _msgSeverity = v);
                          },
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      onPressed: _sendingMsg ? null : _sendMessage,
                      icon: _sendingMsg
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(
                                  strokeWidth: 2, color: Colors.white),
                            )
                          : const Icon(Icons.send_rounded),
                      label: const Text('Send as Sven'),
                      style: FilledButton.styleFrom(
                          backgroundColor: tokens.primary),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.label, required this.tokens});

  final String label;
  final SvenModeTokens tokens;

  @override
  Widget build(BuildContext context) {
    return Text(
      label,
      style: TextStyle(
        color: tokens.onSurface.withValues(alpha: 0.5),
        fontWeight: FontWeight.w700,
        fontSize: 12,
        letterSpacing: 1.2,
      ),
    );
  }
}

class _SettingsCard extends StatelessWidget {
  const _SettingsCard({required this.tokens, required this.child});

  final SvenModeTokens tokens;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: tokens.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: tokens.frame.withValues(alpha: 0.2)),
      ),
      child: child,
    );
  }
}
