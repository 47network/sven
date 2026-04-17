// ---------------------------------------------------------------------------
// @sven/trading-platform — Alert Engine Unit Tests
// ---------------------------------------------------------------------------
import {
  createPriceAlert,
  createSignalAlert,
  createDrawdownAlert,
  createVolatilityAlert,
  createNewsAlert,
  AlertEngine,
} from '../alerts/index';

describe('Alert Factories', () => {
  it('creates price alert with correct defaults', () => {
    const alert = createPriceAlert({ symbol: 'BTCUSDT', condition: 'above', threshold: 70000 });
    expect(alert.type).toBe('price');
    expect(alert.symbol).toBe('BTCUSDT');
    expect(alert.condition).toBe('above');
    expect(alert.threshold).toBe(70000);
    expect(alert.status).toBe('active');
    expect(alert.priority).toBe('medium');
    expect(alert.triggerCount).toBe(0);
  });

  it('creates signal alert', () => {
    const alert = createSignalAlert({ minConfidence: 0.8, direction: 'long' });
    expect(alert.type).toBe('signal');
    expect(alert.threshold).toBe(0.8);
    expect(alert.metadata?.direction).toBe('long');
  });

  it('creates drawdown alert with critical priority', () => {
    const alert = createDrawdownAlert({ maxDrawdownPct: 5 });
    expect(alert.type).toBe('drawdown');
    expect(alert.priority).toBe('critical');
  });

  it('creates volatility alert', () => {
    const alert = createVolatilityAlert({ symbol: 'ETHUSDT', volatilityThreshold: 3.5 });
    expect(alert.type).toBe('volatility');
    expect(alert.symbol).toBe('ETHUSDT');
  });

  it('creates news alert', () => {
    const alert = createNewsAlert({ minImpactLevel: 4 });
    expect(alert.type).toBe('news');
    expect(alert.threshold).toBe(4);
  });
});

describe('AlertEngine', () => {
  let engine: AlertEngine;

  beforeEach(() => {
    engine = new AlertEngine();
  });

  it('adds and retrieves alerts', () => {
    const alert = createPriceAlert({ symbol: 'BTCUSDT', condition: 'above', threshold: 70000 });
    engine.add(alert);
    expect(engine.getAll()).toHaveLength(1);
    expect(engine.getActive()).toHaveLength(1);
  });

  it('removes alerts', () => {
    const alert = createPriceAlert({ symbol: 'BTCUSDT', condition: 'above', threshold: 70000 });
    engine.add(alert);
    engine.remove(alert.id);
    expect(engine.getAll()).toHaveLength(0);
  });

  it('disables and re-enables alerts', () => {
    const alert = createPriceAlert({ symbol: 'BTCUSDT', condition: 'above', threshold: 70000 });
    engine.add(alert);
    engine.disable(alert.id);
    expect(engine.getActive()).toHaveLength(0);
    engine.enable(alert.id);
    expect(engine.getActive()).toHaveLength(1);
  });

  describe('checkPrice', () => {
    it('triggers above alert when price exceeds threshold', () => {
      const alert = createPriceAlert({ symbol: 'BTCUSDT', condition: 'above', threshold: 70000 });
      engine.add(alert);
      const events = engine.checkPrice('BTCUSDT', 71000);
      expect(events).toHaveLength(1);
      expect(events[0].alertName).toBe(alert.name);
      expect(events[0].actualValue).toBe(71000);
    });

    it('does not trigger above alert when price below threshold', () => {
      const alert = createPriceAlert({ symbol: 'BTCUSDT', condition: 'above', threshold: 70000 });
      engine.add(alert);
      const events = engine.checkPrice('BTCUSDT', 69000);
      expect(events).toHaveLength(0);
    });

    it('triggers below alert', () => {
      const alert = createPriceAlert({ symbol: 'BTCUSDT', condition: 'below', threshold: 60000 });
      engine.add(alert);
      const events = engine.checkPrice('BTCUSDT', 59000);
      expect(events).toHaveLength(1);
    });

    it('triggers crosses_above alert', () => {
      const alert = createPriceAlert({ symbol: 'BTCUSDT', condition: 'crosses_above', threshold: 70000 });
      engine.add(alert);
      const events = engine.checkPrice('BTCUSDT', 71000, 69000);
      expect(events).toHaveLength(1);
    });

    it('does not trigger crosses_above without previous price', () => {
      const alert = createPriceAlert({ symbol: 'BTCUSDT', condition: 'crosses_above', threshold: 70000 });
      engine.add(alert);
      const events = engine.checkPrice('BTCUSDT', 71000);
      expect(events).toHaveLength(0);
    });

    it('triggers crosses_below alert', () => {
      const alert = createPriceAlert({ symbol: 'BTCUSDT', condition: 'crosses_below', threshold: 60000 });
      engine.add(alert);
      const events = engine.checkPrice('BTCUSDT', 59000, 61000);
      expect(events).toHaveLength(1);
    });

    it('triggers pct_change alert', () => {
      const alert = createPriceAlert({ symbol: 'BTCUSDT', condition: 'pct_change', threshold: 5 });
      engine.add(alert);
      const events = engine.checkPrice('BTCUSDT', 63000, 60000); // 5% change
      expect(events).toHaveLength(1);
    });

    it('ignores disabled alerts', () => {
      const alert = createPriceAlert({ symbol: 'BTCUSDT', condition: 'above', threshold: 70000 });
      engine.add(alert);
      engine.disable(alert.id);
      const events = engine.checkPrice('BTCUSDT', 75000);
      expect(events).toHaveLength(0);
    });

    it('ignores alerts for wrong symbol', () => {
      const alert = createPriceAlert({ symbol: 'ETHUSDT', condition: 'above', threshold: 5000 });
      engine.add(alert);
      const events = engine.checkPrice('BTCUSDT', 100000);
      expect(events).toHaveLength(0);
    });
  });

  describe('checkSignal', () => {
    it('triggers signal alert when confidence exceeds threshold', () => {
      const alert = createSignalAlert({ minConfidence: 0.7, direction: 'any' });
      engine.add(alert);
      const events = engine.checkSignal('BTCUSDT', 'long', 0.85);
      expect(events).toHaveLength(1);
    });

    it('does not trigger below threshold', () => {
      const alert = createSignalAlert({ minConfidence: 0.9 });
      engine.add(alert);
      const events = engine.checkSignal('BTCUSDT', 'long', 0.7);
      expect(events).toHaveLength(0);
    });

    it('filters by direction', () => {
      const alert = createSignalAlert({ minConfidence: 0.7, direction: 'short' });
      engine.add(alert);
      const events = engine.checkSignal('BTCUSDT', 'long', 0.9);
      expect(events).toHaveLength(0);
    });
  });

  describe('checkDrawdown', () => {
    it('triggers drawdown alert', () => {
      const alert = createDrawdownAlert({ maxDrawdownPct: 5 });
      engine.add(alert);
      const events = engine.checkDrawdown(6);
      expect(events).toHaveLength(1);
    });

    it('does not trigger below threshold', () => {
      const alert = createDrawdownAlert({ maxDrawdownPct: 5 });
      engine.add(alert);
      const events = engine.checkDrawdown(3);
      expect(events).toHaveLength(0);
    });
  });

  describe('onAlert listener', () => {
    it('notifies listeners on trigger', () => {
      const alert = createPriceAlert({ symbol: 'BTCUSDT', condition: 'above', threshold: 70000 });
      engine.add(alert);
      const received: unknown[] = [];
      engine.onAlert((event) => received.push(event));
      engine.checkPrice('BTCUSDT', 75000);
      expect(received).toHaveLength(1);
    });

    it('unsubscribes correctly', () => {
      const alert = createPriceAlert({ symbol: 'BTCUSDT', condition: 'above', threshold: 70000 });
      engine.add(alert);
      const received: unknown[] = [];
      const unsub = engine.onAlert((event) => received.push(event));
      unsub();
      engine.checkPrice('BTCUSDT', 75000);
      expect(received).toHaveLength(0);
    });
  });
});
