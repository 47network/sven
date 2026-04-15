// ═══════════════════════════════════════════════════════════════════════════
// BacktestPage — Run strategy backtests with real Binance historical data.
//
// Uses the /v1/trading/backtest/run-auto endpoint (Batch 12A) which
// auto-fetches candles from Binance, runs the strategy, and returns results.
// ═══════════════════════════════════════════════════════════════════════════

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../app/app_models.dart';
import '../../app/sven_tokens.dart';
import 'trading_models.dart';
import 'trading_service.dart';

class BacktestPage extends StatefulWidget {
  const BacktestPage({
    super.key,
    required this.tradingService,
    required this.visualMode,
  });

  final TradingService tradingService;
  final VisualMode visualMode;

  @override
  State<BacktestPage> createState() => _BacktestPageState();
}

class _BacktestPageState extends State<BacktestPage> {
  String _selectedStrategy = 'sma-crossover-20-50';
  String _selectedSymbol = 'BTC/USDT';
  String _selectedTimeframe = '1h';
  int _bars = 1000;
  final double _initialCapital = 100000;

  static const _symbols = [
    'BTC/USDT',
    'ETH/USDT',
    'SOL/USDT',
    'BNB/USDT',
    'XRP/USDT',
    'ADA/USDT',
    'DOGE/USDT',
    'AVAX/USDT',
    'DOT/USDT',
    'LINK/USDT',
  ];

  static const _timeframes = ['1m', '5m', '15m', '1h', '4h', '1d'];

  static const _barOptions = [100, 250, 500, 1000, 2000, 5000];

  @override
  void initState() {
    super.initState();
    widget.tradingService.addListener(_onUpdate);
    widget.tradingService.fetchBacktestStrategies();
  }

  @override
  void dispose() {
    widget.tradingService.removeListener(_onUpdate);
    super.dispose();
  }

  void _onUpdate() => setState(() {});

  Future<void> _runBacktest() async {
    HapticFeedback.mediumImpact();
    await widget.tradingService.runBacktestAuto(
      strategy: _selectedStrategy,
      symbol: _selectedSymbol,
      timeframe: _selectedTimeframe,
      bars: _bars,
      initialCapital: _initialCapital,
    );
    if (mounted) HapticFeedback.heavyImpact();
  }

  @override
  Widget build(BuildContext context) {
    final tokens = SvenTokens.forMode(widget.visualMode);
    final svc = widget.tradingService;
    final strategies = svc.backtestStrategies;
    final result = svc.lastBacktestResult;
    final running = svc.backtestRunning;

    return Scaffold(
      backgroundColor: tokens.scaffold,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: Text('Strategy Backtest',
            style: TextStyle(color: tokens.onSurface)),
        iconTheme: IconThemeData(color: tokens.onSurface),
        actions: [
          if (running)
            Padding(
              padding: const EdgeInsets.only(right: 16),
              child: SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: tokens.primary,
                ),
              ),
            ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // ── Config section ──────────────────────────────────────
          _SectionHeader(label: 'Configuration', tokens: tokens),
          const SizedBox(height: 8),
          _ConfigCard(
            tokens: tokens,
            children: [
              _DropdownRow<String>(
                label: 'Strategy',
                value: _selectedStrategy,
                items: strategies.isNotEmpty
                    ? strategies
                        .map((s) => DropdownMenuItem(
                              value: s.name,
                              child: Text(s.name,
                                  style: TextStyle(
                                      color: tokens.onSurface,
                                      fontSize: 13)),
                            ))
                        .toList()
                    : [
                        for (final s in [
                          'sma-crossover-20-50',
                          'sma-crossover-9-21',
                          'rsi-30-70',
                          'rsi-20-80',
                          'mean-reversion-2',
                          'mean-reversion-1.5',
                        ])
                          DropdownMenuItem(
                            value: s,
                            child: Text(s,
                                style: TextStyle(
                                    color: tokens.onSurface,
                                    fontSize: 13)),
                          ),
                      ],
                onChanged: (v) => setState(() => _selectedStrategy = v!),
                tokens: tokens,
              ),
              const Divider(height: 1),
              _DropdownRow<String>(
                label: 'Symbol',
                value: _selectedSymbol,
                items: _symbols
                    .map((s) => DropdownMenuItem(
                          value: s,
                          child: Text(s,
                              style: TextStyle(
                                  color: tokens.onSurface, fontSize: 13)),
                        ))
                    .toList(),
                onChanged: (v) => setState(() => _selectedSymbol = v!),
                tokens: tokens,
              ),
              const Divider(height: 1),
              _DropdownRow<String>(
                label: 'Timeframe',
                value: _selectedTimeframe,
                items: _timeframes
                    .map((t) => DropdownMenuItem(
                          value: t,
                          child: Text(t,
                              style: TextStyle(
                                  color: tokens.onSurface, fontSize: 13)),
                        ))
                    .toList(),
                onChanged: (v) =>
                    setState(() => _selectedTimeframe = v!),
                tokens: tokens,
              ),
              const Divider(height: 1),
              _DropdownRow<int>(
                label: 'Candles',
                value: _bars,
                items: _barOptions
                    .map((b) => DropdownMenuItem(
                          value: b,
                          child: Text('$b',
                              style: TextStyle(
                                  color: tokens.onSurface, fontSize: 13)),
                        ))
                    .toList(),
                onChanged: (v) => setState(() => _bars = v!),
                tokens: tokens,
              ),
            ],
          ),
          const SizedBox(height: 16),

          // ── Run button ─────────────────────────────────────────
          SizedBox(
            width: double.infinity,
            height: 50,
            child: ElevatedButton.icon(
              onPressed: running ? null : _runBacktest,
              icon: running
                  ? SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: tokens.scaffold,
                      ),
                    )
                  : const Icon(Icons.play_arrow_rounded),
              label: Text(running
                  ? 'Running backtest…'
                  : 'Run Backtest'),
              style: ElevatedButton.styleFrom(
                backgroundColor: tokens.primary,
                foregroundColor: tokens.scaffold,
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12)),
              ),
            ),
          ),
          const SizedBox(height: 24),

          // ── Results section ────────────────────────────────────
          if (result != null) ...[
            _SectionHeader(label: 'Results', tokens: tokens),
            const SizedBox(height: 8),
            _ResultsCard(result: result, tokens: tokens),
          ],
        ],
      ),
    );
  }
}

// ── Results card ─────────────────────────────────────────────────────────────

class _ResultsCard extends StatelessWidget {
  const _ResultsCard({required this.result, required this.tokens});
  final BacktestResult result;
  final SvenModeTokens tokens;

  @override
  Widget build(BuildContext context) {
    final isProfit = result.totalReturn > 0;
    final returnColor = isProfit ? Colors.green : Colors.red;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: tokens.card,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: tokens.frame),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header — strategy + symbol
          Row(
            children: [
              Icon(Icons.science_rounded,
                  color: tokens.primary, size: 20),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  '${result.strategy}  •  ${result.symbol}  •  ${result.timeframe}',
                  style: TextStyle(
                    color: tokens.onSurface,
                    fontWeight: FontWeight.w600,
                    fontSize: 14,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // Key metrics grid
          Row(
            children: [
              _MetricCell(
                label: 'Total Return',
                value: '${result.totalReturnPct >= 0 ? '+' : ''}${result.totalReturnPct.toStringAsFixed(2)}%',
                color: returnColor,
                tokens: tokens,
              ),
              _MetricCell(
                label: 'Total P&L',
                value: '\$${result.totalReturn.toStringAsFixed(2)}',
                color: returnColor,
                tokens: tokens,
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              _MetricCell(
                label: 'Win Rate',
                value: '${result.winRate.toStringAsFixed(1)}%',
                color: result.winRate > 50 ? Colors.green : Colors.orange,
                tokens: tokens,
              ),
              _MetricCell(
                label: 'Trades',
                value: '${result.totalTrades}',
                color: tokens.onSurface,
                tokens: tokens,
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              _MetricCell(
                label: 'Sharpe Ratio',
                value: result.sharpeRatio.toStringAsFixed(2),
                color: result.sharpeRatio > 1
                    ? Colors.green
                    : result.sharpeRatio > 0
                        ? Colors.orange
                        : Colors.red,
                tokens: tokens,
              ),
              _MetricCell(
                label: 'Max Drawdown',
                value: '${result.maxDrawdown.toStringAsFixed(2)}%',
                color: result.maxDrawdown.abs() < 10
                    ? Colors.green
                    : Colors.red,
                tokens: tokens,
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              _MetricCell(
                label: 'Profit Factor',
                value: result.profitFactor.toStringAsFixed(2),
                color: result.profitFactor > 1 ? Colors.green : Colors.red,
                tokens: tokens,
              ),
              _MetricCell(
                label: 'Capital',
                value: '\$${result.initialCapital.toStringAsFixed(0)}',
                color: tokens.onSurface.withValues(alpha: 0.6),
                tokens: tokens,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _MetricCell extends StatelessWidget {
  const _MetricCell({
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
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label,
              style: TextStyle(
                  color: tokens.onSurface.withValues(alpha: 0.5),
                  fontSize: 11)),
          const SizedBox(height: 2),
          Text(value,
              style: TextStyle(
                  color: color,
                  fontWeight: FontWeight.w700,
                  fontSize: 16)),
        ],
      ),
    );
  }
}

// ── Config card + dropdown row ───────────────────────────────────────────────

class _ConfigCard extends StatelessWidget {
  const _ConfigCard({required this.tokens, required this.children});
  final SvenModeTokens tokens;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: tokens.card,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: tokens.frame),
      ),
      child: Column(children: children),
    );
  }
}

class _DropdownRow<T> extends StatelessWidget {
  const _DropdownRow({
    required this.label,
    required this.value,
    required this.items,
    required this.onChanged,
    required this.tokens,
  });
  final String label;
  final T value;
  final List<DropdownMenuItem<T>> items;
  final ValueChanged<T?> onChanged;
  final SvenModeTokens tokens;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Expanded(
            child: Text(label,
                style: TextStyle(
                    color: tokens.onSurface.withValues(alpha: 0.7),
                    fontSize: 13)),
          ),
          DropdownButton<T>(
            value: value,
            items: items,
            onChanged: onChanged,
            underline: const SizedBox.shrink(),
            dropdownColor: tokens.card,
            iconEnabledColor: tokens.primary,
            style: TextStyle(color: tokens.onSurface, fontSize: 13),
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
      label.toUpperCase(),
      style: TextStyle(
        color: tokens.primary,
        fontWeight: FontWeight.w700,
        fontSize: 11,
        letterSpacing: 1.2,
      ),
    );
  }
}
