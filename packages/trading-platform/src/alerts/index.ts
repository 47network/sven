// ---------------------------------------------------------------------------
// @sven/trading-platform — Alert System
// ---------------------------------------------------------------------------
// Price alerts, signal alerts, portfolio alerts, and custom condition alerts.
// Integrates with the proactive notification system for delivery.
// ---------------------------------------------------------------------------

/* ── Types ─────────────────────────────────────────────────────────────── */

export type AlertType = 'price' | 'signal' | 'portfolio' | 'drawdown' | 'volatility' | 'news' | 'custom';
export type AlertCondition = 'above' | 'below' | 'crosses_above' | 'crosses_below' | 'equals' | 'pct_change';
export type AlertPriority = 'low' | 'medium' | 'high' | 'critical';
export type AlertStatus = 'active' | 'triggered' | 'expired' | 'disabled';
export type AlertDelivery = 'sse' | 'email' | 'webhook' | 'nats';

export interface Alert {
  id: string;
  type: AlertType;
  name: string;
  symbol?: string;
  condition: AlertCondition;
  threshold: number;
  currentValue?: number;
  priority: AlertPriority;
  status: AlertStatus;
  deliveryChannels: AlertDelivery[];
  createdAt: Date;
  triggeredAt?: Date;
  expiresAt?: Date;
  cooldownMs: number;          // minimum time between re-triggers
  lastTriggeredAt?: Date;
  triggerCount: number;
  maxTriggers: number;         // 0 = unlimited
  message?: string;
  metadata?: Record<string, unknown>;
}

export interface AlertEvent {
  id: string;
  alertId: string;
  alertName: string;
  type: AlertType;
  priority: AlertPriority;
  symbol?: string;
  condition: AlertCondition;
  threshold: number;
  actualValue: number;
  message: string;
  timestamp: Date;
}

/* ── Alert Factory ─────────────────────────────────────────────────────── */

let alertIdCounter = 0;

function nextAlertId(): string {
  return `alert-${Date.now()}-${++alertIdCounter}`;
}

export function createPriceAlert(params: {
  symbol: string;
  condition: AlertCondition;
  threshold: number;
  name?: string;
  priority?: AlertPriority;
  deliveryChannels?: AlertDelivery[];
  expiresAt?: Date;
  cooldownMs?: number;
  maxTriggers?: number;
}): Alert {
  return {
    id: nextAlertId(),
    type: 'price',
    name: params.name ?? `${params.symbol} ${params.condition} ${params.threshold}`,
    symbol: params.symbol,
    condition: params.condition,
    threshold: params.threshold,
    priority: params.priority ?? 'medium',
    status: 'active',
    deliveryChannels: params.deliveryChannels ?? ['sse'],
    createdAt: new Date(),
    cooldownMs: params.cooldownMs ?? 300_000,   // 5 min default
    triggerCount: 0,
    maxTriggers: params.maxTriggers ?? 0,
    expiresAt: params.expiresAt,
  };
}

export function createSignalAlert(params: {
  symbol?: string;
  minConfidence: number;
  direction?: 'long' | 'short' | 'any';
  name?: string;
  priority?: AlertPriority;
  deliveryChannels?: AlertDelivery[];
}): Alert {
  return {
    id: nextAlertId(),
    type: 'signal',
    name: params.name ?? `Signal alert ${params.symbol ?? 'all'} conf>=${params.minConfidence}`,
    symbol: params.symbol,
    condition: 'above',
    threshold: params.minConfidence,
    priority: params.priority ?? 'high',
    status: 'active',
    deliveryChannels: params.deliveryChannels ?? ['sse'],
    createdAt: new Date(),
    cooldownMs: 60_000,
    triggerCount: 0,
    maxTriggers: 0,
    metadata: { direction: params.direction ?? 'any' },
  };
}

export function createDrawdownAlert(params: {
  maxDrawdownPct: number;
  name?: string;
  priority?: AlertPriority;
  deliveryChannels?: AlertDelivery[];
}): Alert {
  return {
    id: nextAlertId(),
    type: 'drawdown',
    name: params.name ?? `Drawdown > ${params.maxDrawdownPct}%`,
    condition: 'above',
    threshold: params.maxDrawdownPct,
    priority: params.priority ?? 'critical',
    status: 'active',
    deliveryChannels: params.deliveryChannels ?? ['sse', 'email'],
    createdAt: new Date(),
    cooldownMs: 600_000,   // 10 min
    triggerCount: 0,
    maxTriggers: 0,
  };
}

export function createVolatilityAlert(params: {
  symbol: string;
  volatilityThreshold: number;
  name?: string;
  priority?: AlertPriority;
}): Alert {
  return {
    id: nextAlertId(),
    type: 'volatility',
    name: params.name ?? `${params.symbol} vol > ${params.volatilityThreshold}%`,
    symbol: params.symbol,
    condition: 'above',
    threshold: params.volatilityThreshold,
    priority: params.priority ?? 'medium',
    status: 'active',
    deliveryChannels: ['sse'],
    createdAt: new Date(),
    cooldownMs: 900_000,   // 15 min
    triggerCount: 0,
    maxTriggers: 0,
  };
}

export function createNewsAlert(params: {
  symbol?: string;
  minImpactLevel: number;
  name?: string;
  priority?: AlertPriority;
}): Alert {
  return {
    id: nextAlertId(),
    type: 'news',
    name: params.name ?? `News impact >= ${params.minImpactLevel} ${params.symbol ?? 'all'}`,
    symbol: params.symbol,
    condition: 'above',
    threshold: params.minImpactLevel,
    priority: params.priority ?? 'high',
    status: 'active',
    deliveryChannels: ['sse'],
    createdAt: new Date(),
    cooldownMs: 120_000,
    triggerCount: 0,
    maxTriggers: 0,
  };
}

/* ── Alert Engine ──────────────────────────────────────────────────────── */

export class AlertEngine {
  private alerts = new Map<string, Alert>();
  private listeners: Array<(event: AlertEvent) => void> = [];

  add(alert: Alert): void {
    this.alerts.set(alert.id, alert);
  }

  remove(alertId: string): boolean {
    return this.alerts.delete(alertId);
  }

  disable(alertId: string): void {
    const alert = this.alerts.get(alertId);
    if (alert) alert.status = 'disabled';
  }

  enable(alertId: string): void {
    const alert = this.alerts.get(alertId);
    if (alert && alert.status === 'disabled') alert.status = 'active';
  }

  getAll(): Alert[] {
    return Array.from(this.alerts.values());
  }

  getActive(): Alert[] {
    return this.getAll().filter((a) => a.status === 'active');
  }

  onAlert(listener: (event: AlertEvent) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /** Check a price update against all active price alerts */
  checkPrice(symbol: string, price: number, previousPrice?: number): AlertEvent[] {
    const events: AlertEvent[] = [];
    const now = new Date();

    for (const alert of this.alerts.values()) {
      if (alert.status !== 'active') continue;
      if (alert.type !== 'price') continue;
      if (alert.symbol !== symbol) continue;
      if (!this.canTrigger(alert, now)) continue;

      let triggered = false;

      switch (alert.condition) {
        case 'above':
          triggered = price > alert.threshold;
          break;
        case 'below':
          triggered = price < alert.threshold;
          break;
        case 'crosses_above':
          triggered = previousPrice != null && previousPrice <= alert.threshold && price > alert.threshold;
          break;
        case 'crosses_below':
          triggered = previousPrice != null && previousPrice >= alert.threshold && price < alert.threshold;
          break;
        case 'pct_change':
          if (previousPrice != null && previousPrice > 0) {
            const pctChange = Math.abs((price - previousPrice) / previousPrice) * 100;
            triggered = pctChange >= alert.threshold;
          }
          break;
      }

      if (triggered) {
        const event = this.trigger(alert, price, now);
        events.push(event);
      }
    }

    return events;
  }

  /** Check signal strength against signal alerts */
  checkSignal(symbol: string, direction: string, confidence: number): AlertEvent[] {
    const events: AlertEvent[] = [];
    const now = new Date();

    for (const alert of this.alerts.values()) {
      if (alert.status !== 'active' || alert.type !== 'signal') continue;
      if (alert.symbol && alert.symbol !== symbol) continue;
      if (!this.canTrigger(alert, now)) continue;

      const dir = alert.metadata?.direction as string;
      if (dir && dir !== 'any' && dir !== direction) continue;

      if (confidence >= alert.threshold) {
        const event = this.trigger(alert, confidence, now);
        events.push(event);
      }
    }

    return events;
  }

  /** Check portfolio drawdown against drawdown alerts */
  checkDrawdown(currentDrawdownPct: number): AlertEvent[] {
    const events: AlertEvent[] = [];
    const now = new Date();

    for (const alert of this.alerts.values()) {
      if (alert.status !== 'active' || alert.type !== 'drawdown') continue;
      if (!this.canTrigger(alert, now)) continue;

      if (currentDrawdownPct >= alert.threshold) {
        const event = this.trigger(alert, currentDrawdownPct, now);
        events.push(event);
      }
    }

    return events;
  }

  /** Check news impact level */
  checkNews(symbol: string | undefined, impactLevel: number, headline: string): AlertEvent[] {
    const events: AlertEvent[] = [];
    const now = new Date();

    for (const alert of this.alerts.values()) {
      if (alert.status !== 'active' || alert.type !== 'news') continue;
      if (alert.symbol && symbol && alert.symbol !== symbol) continue;
      if (!this.canTrigger(alert, now)) continue;

      if (impactLevel >= alert.threshold) {
        const event = this.trigger(alert, impactLevel, now);
        event.message = `News alert: ${headline} (impact ${impactLevel.toFixed(2)})`;
        events.push(event);
      }
    }

    return events;
  }

  private canTrigger(alert: Alert, now: Date): boolean {
    if (alert.expiresAt && now > alert.expiresAt) {
      alert.status = 'expired';
      return false;
    }
    if (alert.maxTriggers > 0 && alert.triggerCount >= alert.maxTriggers) {
      alert.status = 'expired';
      return false;
    }
    if (alert.lastTriggeredAt) {
      const elapsed = now.getTime() - alert.lastTriggeredAt.getTime();
      if (elapsed < alert.cooldownMs) return false;
    }
    return true;
  }

  private trigger(alert: Alert, actualValue: number, now: Date): AlertEvent {
    alert.triggerCount += 1;
    alert.lastTriggeredAt = now;
    alert.triggeredAt = now;
    alert.currentValue = actualValue;

    if (alert.maxTriggers > 0 && alert.triggerCount >= alert.maxTriggers) {
      alert.status = 'triggered';
    }

    const event: AlertEvent = {
      id: `aevt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      alertId: alert.id,
      alertName: alert.name,
      type: alert.type,
      priority: alert.priority,
      symbol: alert.symbol,
      condition: alert.condition,
      threshold: alert.threshold,
      actualValue,
      message: alert.message ?? `${alert.name}: ${actualValue.toFixed(4)} ${alert.condition} ${alert.threshold}`,
      timestamp: now,
    };

    for (const listener of this.listeners) {
      try { listener(event); } catch { /* non-blocking */ }
    }

    return event;
  }
}

export function createAlertEngine(): AlertEngine {
  return new AlertEngine();
}
