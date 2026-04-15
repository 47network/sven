// ---------------------------------------------------------------------------
// @sven/trading-platform — barrel export
// ---------------------------------------------------------------------------

export * from './market-data/index.js';
export * from './engine/index.js';
export * from './risk/index.js';
export * from './oms/index.js';
export * from './predictions/index.js';
export * from './news/index.js';
export * from './indicators/index.js';
export * from './autonomous/index.js';
export * from './broker/index.js';
export * from './backtest/index.js';
export {
  type EquitySnapshot, type DrawdownPeriod, type RollingMetrics,
  type ExposureBreakdown, type CorrelationEntry, type PortfolioAnalytics,
  buildEquityCurve, computeDrawdowns, findMaxDrawdown, computeRollingMetrics,
  computeAnnualizedReturn, computeAnnualizedVolatility, computeCalmarRatio,
  computeExposure, buildCorrelationMatrix, buildPortfolioAnalytics,
  computeCorrelation as computeReturnsCorrelation,
} from './analytics/index.js';
export * from './alerts/index.js';
