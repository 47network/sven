function sma(prices: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = period - 1; i < prices.length; i++) {
    const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
    result.push(sum / period);
  }
  return result;
}

function rsi(prices: number[], period = 14): number[] {
  const result: number[] = [];
  const gains: number[] = [];
  const losses: number[] = [];

  for (let i = 1; i < prices.length; i++) {
    const change = prices[i]! - prices[i - 1]!;
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? -change : 0);
  }

  if (gains.length < period) return [];

  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]!) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]!) / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    result.push(100 - 100 / (1 + rs));
  }
  return result;
}

function macd(prices: number[], fast = 12, slow = 26, signal = 9) {
  const emaCalc = (data: number[], period: number): number[] => {
    const k = 2 / (period + 1);
    const ema: number[] = [data[0]!];
    for (let i = 1; i < data.length; i++) {
      ema.push(data[i]! * k + ema[i - 1]! * (1 - k));
    }
    return ema;
  };

  if (prices.length < slow) return { macdLine: [], signalLine: [], histogram: [] };

  const emaFast = emaCalc(prices, fast);
  const emaSlow = emaCalc(prices, slow);
  const macdLine = emaFast.map((f, i) => f - emaSlow[i]!);
  const signalLine = emaCalc(macdLine, signal);
  const histogram = macdLine.map((m, i) => m - signalLine[i]!);

  return { macdLine: macdLine.slice(-10), signalLine: signalLine.slice(-10), histogram: histogram.slice(-10) };
}

function bollingerBands(prices: number[], period = 20, stdDevMult = 2) {
  const result: Array<{ middle: number; upper: number; lower: number }> = [];
  for (let i = period - 1; i < prices.length; i++) {
    const window = prices.slice(i - period + 1, i + 1);
    const mean = window.reduce((a, b) => a + b, 0) / period;
    const variance = window.reduce((a, b) => a + (b - mean) ** 2, 0) / period;
    const stdDev = Math.sqrt(variance);
    result.push({ middle: mean, upper: mean + stdDevMult * stdDev, lower: mean - stdDevMult * stdDev });
  }
  return result;
}

function findSupportResistance(prices: number[], lookback = 20) {
  const levels: Array<{ price: number; type: 'support' | 'resistance'; touches: number }> = [];
  const bucketSize = (Math.max(...prices) - Math.min(...prices)) / 50;

  for (let i = lookback; i < prices.length - lookback; i++) {
    const window = prices.slice(i - lookback, i + lookback + 1);
    const current = prices[i]!;
    if (current === Math.min(...window)) {
      const existing = levels.find((l) => Math.abs(l.price - current) < bucketSize && l.type === 'support');
      if (existing) existing.touches++;
      else levels.push({ price: current, type: 'support', touches: 1 });
    }
    if (current === Math.max(...window)) {
      const existing = levels.find((l) => Math.abs(l.price - current) < bucketSize && l.type === 'resistance');
      if (existing) existing.touches++;
      else levels.push({ price: current, type: 'resistance', touches: 1 });
    }
  }

  return levels.sort((a, b) => b.touches - a.touches).slice(0, 8);
}

export default async function handler(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const action = input.action as string;
  const prices = (input.prices as number[]) ?? Array.from({ length: 100 }, (_, i) => 60000 + (Math.random() - 0.48) * 500 * Math.sin(i / 10));
  const period = (input.period as number) ?? 14;

  switch (action) {
    case 'indicators': {
      const sma20 = sma(prices, 20);
      const sma50 = sma(prices, 50);
      const rsiValues = rsi(prices, period);
      const macdResult = macd(prices);
      const bbands = bollingerBands(prices, 20);
      const latest = bbands[bbands.length - 1];

      return {
        result: {
          sma20: sma20.slice(-5).map((v) => v.toFixed(2)),
          sma50: sma50.slice(-5).map((v) => v.toFixed(2)),
          rsi: rsiValues.slice(-5).map((v) => v.toFixed(2)),
          latestRsi: rsiValues[rsiValues.length - 1]?.toFixed(2) ?? 'N/A',
          macd: { line: macdResult.macdLine.slice(-3).map((v) => v.toFixed(2)), signal: macdResult.signalLine.slice(-3).map((v) => v.toFixed(2)) },
          bollingerBands: latest ? { upper: latest.upper.toFixed(2), middle: latest.middle.toFixed(2), lower: latest.lower.toFixed(2) } : null,
          currentPrice: prices[prices.length - 1]?.toFixed(2),
        },
      };
    }

    case 'patterns': {
      // Simple candlestick pattern detection from close prices
      const n = prices.length;
      const patterns: string[] = [];

      if (n >= 3) {
        const [a, b, c] = [prices[n - 3]!, prices[n - 2]!, prices[n - 1]!];
        if (b < a && b < c) patterns.push('hammer/morning_star');
        if (b > a && b > c) patterns.push('shooting_star/evening_star');
        if (Math.abs(b - a) < (Math.max(a, b) - Math.min(a, b)) * 0.1) patterns.push('doji');
        if (c > a && c > b && b > a) patterns.push('three_white_soldiers');
        if (c < a && c < b && b < a) patterns.push('three_black_crows');
      }

      if (patterns.length === 0) patterns.push('no_clear_pattern');

      return { result: { patterns, note: 'Based on close-price approximation. Full OHLCV needed for precise detection.' } };
    }

    case 'support_resistance': {
      const levels = findSupportResistance(prices);
      return {
        result: {
          levels: levels.map((l) => ({ price: l.price.toFixed(2), type: l.type, strength: l.touches })),
          currentPrice: prices[prices.length - 1]?.toFixed(2),
        },
      };
    }

    case 'trend': {
      const sma20Values = sma(prices, 20);
      const sma50Values = sma(prices, 50);
      const latest = prices[prices.length - 1]!;
      const latestSma20 = sma20Values[sma20Values.length - 1] ?? latest;
      const latestSma50 = sma50Values[sma50Values.length - 1] ?? latest;
      const rsiVal = rsi(prices, 14);
      const latestRsi = rsiVal[rsiVal.length - 1] ?? 50;

      let trend = 'neutral';
      if (latest > latestSma20 && latestSma20 > latestSma50) trend = 'bullish';
      else if (latest < latestSma20 && latestSma20 < latestSma50) trend = 'bearish';

      let momentum = 'neutral';
      if (latestRsi > 70) momentum = 'overbought';
      else if (latestRsi < 30) momentum = 'oversold';
      else if (latestRsi > 55) momentum = 'bullish';
      else if (latestRsi < 45) momentum = 'bearish';

      return {
        result: {
          trend,
          momentum,
          currentPrice: latest.toFixed(2),
          sma20: latestSma20.toFixed(2),
          sma50: latestSma50.toFixed(2),
          rsi: latestRsi.toFixed(2),
          priceVsSma20: ((latest / latestSma20 - 1) * 100).toFixed(2) + '%',
        },
      };
    }

    case 'full_analysis': {
      const sma20Values = sma(prices, 20);
      const rsiValues = rsi(prices, 14);
      const macdResult = macd(prices);
      const bbands = bollingerBands(prices, 20);
      const levels = findSupportResistance(prices);
      const latest = prices[prices.length - 1]!;
      const latestSma20 = sma20Values[sma20Values.length - 1] ?? latest;
      const latestRsi = rsiValues[rsiValues.length - 1] ?? 50;
      const latestBB = bbands[bbands.length - 1];

      let bias = 'neutral';
      let score = 0;
      if (latest > latestSma20) score++;
      if (latestRsi > 50 && latestRsi < 70) score++;
      if (latestRsi > 70) score--;
      if (latestRsi < 30) score++;
      if (macdResult.histogram.length > 0 && macdResult.histogram[macdResult.histogram.length - 1]! > 0) score++;
      if (score >= 2) bias = 'bullish';
      else if (score <= -1) bias = 'bearish';

      return {
        result: {
          symbol: (input.symbol as string) ?? 'BTC/USDT',
          timeframe: (input.timeframe as string) ?? '1h',
          bias,
          score,
          currentPrice: latest.toFixed(2),
          indicators: {
            sma20: latestSma20.toFixed(2),
            rsi: latestRsi.toFixed(2),
            bollingerBands: latestBB ? { upper: latestBB.upper.toFixed(2), middle: latestBB.middle.toFixed(2), lower: latestBB.lower.toFixed(2) } : null,
          },
          supportResistance: levels.slice(0, 4).map((l) => ({ price: l.price.toFixed(2), type: l.type })),
        },
      };
    }

    default:
      return { error: `Unknown action "${action}". Use: indicators, patterns, support_resistance, trend, full_analysis` };
  }
}
