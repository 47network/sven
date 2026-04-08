/**
 * Heartbeat keepalive manager for adapter connections.
 *
 * Monitors connection health via periodic heartbeat pings and triggers
 * reconnection with exponential backoff when heartbeats fail. Adapters
 * wire this into their connect/disconnect lifecycle.
 *
 * Prior art: TCP keepalive (1988), MQTT ping/pong, WebSocket ping/pong,
 * gRPC health checking, Kubernetes liveness probes.
 */

import { createLogger, type Logger } from '../logger.js';

export interface HeartbeatConfig {
  /** Heartbeat interval in ms (default 30000) */
  intervalMs: number;
  /** Number of consecutive failures before declaring dead (default 3) */
  maxFailures: number;
  /** Initial reconnect delay in ms (default 1000) */
  reconnectBaseMs: number;
  /** Maximum reconnect delay in ms (default 60000) */
  reconnectMaxMs: number;
  /** Jitter factor 0-1 added to backoff (default 0.2) */
  jitterFactor: number;
}

export type ConnectionState =
  | 'connected'
  | 'degraded'      // heartbeat failures < maxFailures
  | 'disconnected'
  | 'reconnecting';

export interface HeartbeatStatus {
  state: ConnectionState;
  consecutiveFailures: number;
  lastHeartbeatAt: number | null;
  lastFailureAt: number | null;
  reconnectAttempts: number;
  uptimeMs: number;
}

export type HeartbeatPingFn = () => Promise<boolean>;
export type ReconnectFn = () => Promise<void>;
export type StateChangeFn = (
  prev: ConnectionState,
  next: ConnectionState,
  status: HeartbeatStatus,
) => void;

const DEFAULT_CONFIG: HeartbeatConfig = {
  intervalMs: 30_000,
  maxFailures: 3,
  reconnectBaseMs: 1_000,
  reconnectMaxMs: 60_000,
  jitterFactor: 0.2,
};

export class HeartbeatManager {
  private config: HeartbeatConfig;
  private logger: Logger;
  private pingFn: HeartbeatPingFn;
  private reconnectFn: ReconnectFn;
  private onStateChange?: StateChangeFn;

  private timer: ReturnType<typeof setInterval> | null = null;
  private state: ConnectionState = 'disconnected';
  private consecutiveFailures = 0;
  private lastHeartbeatAt: number | null = null;
  private lastFailureAt: number | null = null;
  private reconnectAttempts = 0;
  private connectedSince: number | null = null;
  private reconnecting = false;

  constructor(
    name: string,
    pingFn: HeartbeatPingFn,
    reconnectFn: ReconnectFn,
    config?: Partial<HeartbeatConfig>,
    onStateChange?: StateChangeFn,
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.logger = createLogger(`heartbeat-${name}`);
    this.pingFn = pingFn;
    this.reconnectFn = reconnectFn;
    this.onStateChange = onStateChange;
  }

  /**
   * Start heartbeat monitoring. Call after adapter connect() succeeds.
   */
  start(): void {
    this.stop();
    this.setState('connected');
    this.connectedSince = Date.now();
    this.consecutiveFailures = 0;
    this.reconnectAttempts = 0;
    this.lastHeartbeatAt = Date.now();

    this.timer = setInterval(() => this.beat(), this.config.intervalMs);
    this.logger.info('Heartbeat started', { intervalMs: this.config.intervalMs });
  }

  /**
   * Stop heartbeat monitoring. Call before adapter disconnect().
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.setState('disconnected');
    this.connectedSince = null;
    this.logger.info('Heartbeat stopped');
  }

  /**
   * Get current heartbeat status snapshot.
   */
  getStatus(): HeartbeatStatus {
    return {
      state: this.state,
      consecutiveFailures: this.consecutiveFailures,
      lastHeartbeatAt: this.lastHeartbeatAt,
      lastFailureAt: this.lastFailureAt,
      reconnectAttempts: this.reconnectAttempts,
      uptimeMs: this.connectedSince ? Date.now() - this.connectedSince : 0,
    };
  }

  /**
   * Manually mark connection as healthy (e.g. after receiving data).
   * Resets failure counter without waiting for next heartbeat.
   */
  markHealthy(): void {
    this.consecutiveFailures = 0;
    this.lastHeartbeatAt = Date.now();
    if (this.state === 'degraded') {
      this.setState('connected');
    }
  }

  private setState(next: ConnectionState): void {
    if (next === this.state) return;
    const prev = this.state;
    this.state = next;
    this.logger.debug('State change', { from: prev, to: next });
    this.onStateChange?.(prev, next, this.getStatus());
  }

  private async beat(): Promise<void> {
    if (this.reconnecting) return;

    try {
      const ok = await this.pingFn();
      if (ok) {
        this.consecutiveFailures = 0;
        this.lastHeartbeatAt = Date.now();
        if (this.state !== 'connected') {
          this.setState('connected');
        }
      } else {
        this.handleFailure();
      }
    } catch {
      this.handleFailure();
    }
  }

  private handleFailure(): void {
    this.consecutiveFailures += 1;
    this.lastFailureAt = Date.now();
    this.logger.warn('Heartbeat failed', {
      consecutive: this.consecutiveFailures,
      max: this.config.maxFailures,
    });

    if (this.consecutiveFailures >= this.config.maxFailures) {
      this.triggerReconnect();
    } else {
      this.setState('degraded');
    }
  }

  private async triggerReconnect(): Promise<void> {
    if (this.reconnecting) return;

    this.reconnecting = true;
    this.setState('reconnecting');

    // Exponential backoff with jitter
    const delay = Math.min(
      this.config.reconnectMaxMs,
      this.config.reconnectBaseMs * (2 ** this.reconnectAttempts),
    );
    const jitter = Math.floor(delay * this.config.jitterFactor * Math.random());
    const totalDelay = delay + jitter;

    this.reconnectAttempts += 1;
    this.logger.info('Reconnecting', {
      attempt: this.reconnectAttempts,
      delayMs: totalDelay,
    });

    await new Promise((resolve) => setTimeout(resolve, totalDelay));

    try {
      await this.reconnectFn();
      this.consecutiveFailures = 0;
      this.reconnectAttempts = 0;
      this.connectedSince = Date.now();
      this.lastHeartbeatAt = Date.now();
      this.setState('connected');
      this.logger.info('Reconnected successfully');
    } catch (err: any) {
      this.logger.error('Reconnect failed', { error: err.message });
      this.setState('disconnected');
      // Schedule another reconnect attempt
      if (this.timer) {
        setTimeout(() => this.triggerReconnect(), 1000);
      }
    } finally {
      this.reconnecting = false;
    }
  }
}
