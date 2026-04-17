import 'package:flutter_test/flutter_test.dart';
import 'package:sven_user_flutter/features/trading/trading_models.dart';

void main() {
  group('TradingStatus.fromJson', () {
    test('parses full status payload', () {
      final json = <String, dynamic>{
        'state': 'active',
        'openPositions': 3,
        'pendingOrders': 1,
        'todayPnl': 250.0,
        'todayTrades': 7,
        'uptime': 3600.0,
        'mode': 'live',
        'circuitBreaker': {
          'tripped': false,
          'dailyLossPct': 0.01,
          'dailyLossLimit': 0.05,
        },
        'loop': {
          'running': true,
          'intervalMs': 5000,
          'iterations': 42,
          'trackedSymbols': ['BTC', 'ETH'],
        },
        'brain': {
          'fleet': [
            {
              'name': 'vm13-fast',
              'role': 'fast',
              'model': 'qwen2.5:7b',
              'healthy': true,
            }
          ],
          'escalationThreshold': 0.55,
        },
        'autoTrade': {
          'enabled': true,
          'confidenceThreshold': 0.6,
          'maxPositionPct': 0.05,
          'totalExecuted': 3,
        },
        'messaging': {
          'totalMessages': 50,
          'unreadCount': 2,
          'scheduledPending': 1,
        },
      };
      final status = TradingStatus.fromJson(json);

      expect(status.state, 'active');
      expect(status.openPositions, 3);
      expect(status.todayPnl, 250.0);
      expect(status.mode, 'live');
      expect(status.circuitBreaker.tripped, isFalse);
      expect(status.circuitBreaker.dailyLossPct, 0.01);
      expect(status.loop.running, isTrue);
      expect(status.loop.intervalMs, 5000);
      expect(status.loop.trackedSymbols, ['BTC', 'ETH']);
      expect(status.brain.fleet, hasLength(1));
      expect(status.brain.fleet.first.name, 'vm13-fast');
      expect(status.brain.escalationThreshold, 0.55);
      expect(status.autoTrade.enabled, isTrue);
      expect(status.autoTrade.confidenceThreshold, 0.6);
      expect(status.autoTrade.maxPositionPct, 0.05);
      expect(status.autoTrade.totalExecuted, 3);
      expect(status.messaging.totalMessages, 50);
      expect(status.messaging.unreadCount, 2);
    });
  });

  group('SvenMessage.fromJson', () {
    test('parses message with all fields', () {
      final json = <String, dynamic>{
        'id': 'msg-1',
        'title': 'Market Alert',
        'body': 'BTC broke \$100k',
        'type': 'trade_alert',
        'severity': 'warning',
        'symbol': 'BTC',
        'createdAt': '2025-01-01T12:00:00.000Z',
        'read': false,
      };
      final msg = SvenMessage.fromJson(json);
      expect(msg.id, 'msg-1');
      expect(msg.title, 'Market Alert');
      expect(msg.type, 'trade_alert');
      expect(msg.severity, 'warning');
      expect(msg.symbol, 'BTC');
      expect(msg.read, isFalse);
    });
  });

  group('SvenTrade.fromJson', () {
    test('parses trade with all fields', () {
      final json = <String, dynamic>{
        'symbol': 'AAPL',
        'side': 'buy',
        'quantity': 10.0,
        'price': 155.5,
        'confidence': 0.85,
        'broker': 'alpaca',
        'timestamp': '2025-01-01T14:30:00.000Z',
      };
      final trade = SvenTrade.fromJson(json);
      expect(trade.symbol, 'AAPL');
      expect(trade.side, 'buy');
      expect(trade.quantity, 10.0);
      expect(trade.price, 155.5);
      expect(trade.confidence, 0.85);
      expect(trade.broker, 'alpaca');
    });
  });

  group('Position.fromJson', () {
    test('parses position with price history', () {
      final json = <String, dynamic>{
        'id': 'pos-1',
        'symbol': 'TSLA',
        'side': 'long',
        'quantity': 5.0,
        'entryPrice': 200.0,
        'currentPrice': 210.0,
        'unrealizedPnl': 50.0,
        'broker': 'alpaca',
        'openedAt': '2025-01-01T10:00:00Z',
        'priceHistory': [200.0, 205.0, 208.0, 210.0],
      };
      final pos = Position.fromJson(json);
      expect(pos.id, 'pos-1');
      expect(pos.symbol, 'TSLA');
      expect(pos.side, 'long');
      expect(pos.quantity, 5.0);
      expect(pos.entryPrice, 200.0);
      expect(pos.currentPrice, 210.0);
      expect(pos.unrealizedPnl, 50.0);
      expect(pos.priceHistory, [200.0, 205.0, 208.0, 210.0]);
    });

    test('handles missing price history', () {
      final json = <String, dynamic>{
        'id': 'pos-2',
        'symbol': 'GOOG',
        'side': 'short',
        'quantity': 2.0,
        'entryPrice': 180.0,
        'currentPrice': 175.0,
        'unrealizedPnl': 10.0,
        'broker': 'ibkr',
        'openedAt': '2025-01-01T09:00:00Z',
      };
      final pos = Position.fromJson(json);
      expect(pos.priceHistory, isEmpty);
    });
  });

  group('PriceAlert.fromJson', () {
    test('parses alert', () {
      final json = <String, dynamic>{
        'id': 'alert-1',
        'symbol': 'ETH',
        'targetPrice': 4000.0,
        'direction': 'above',
        'status': 'active',
        'createdAt': '2025-01-01T08:00:00Z',
      };
      final alert = PriceAlert.fromJson(json);
      expect(alert.id, 'alert-1');
      expect(alert.symbol, 'ETH');
      expect(alert.targetPrice, 4000.0);
      expect(alert.direction, 'above');
      expect(alert.status, 'active');
    });
  });

  group('TradingEvent', () {
    test('parses SSE event', () {
      final json = <String, dynamic>{
        'type': 'trade_executed',
        'data': {'symbol': 'BTC', 'side': 'buy', 'price': 100000},
        'timestamp': '2025-01-01T15:00:00Z',
      };
      final event = TradingEvent.fromJson(json);
      expect(event.type, 'trade_executed');
      expect(event.data['symbol'], 'BTC');
    });
  });
}
