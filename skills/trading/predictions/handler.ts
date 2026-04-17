import {
  tokenizeCandle,
  tokenSequenceToString,
  generateMultiHorizon,
  ensembleVote,
  evaluatePrediction,
  computeAccuracy,
  DEFAULT_ENSEMBLE_WEIGHTS,
  type Prediction,
  type PredictionModel,
  type PredictionDirection,
  type BSQToken,
} from '@sven/trading-platform/predictions';
import type { Candle, Timeframe } from '@sven/trading-platform/market-data';

export default async function handler(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const action = input.action as string;

  switch (action) {
    case 'predict': {
      const symbol = (input.symbol as string) ?? 'BTC/USDT';
      const horizon = (input.horizon as string) ?? '1h';

      const mockPrediction: Prediction = {
        id: `pred-${Date.now()}`,
        createdAt: new Date(),
        model: 'kronos_v1',
        symbol,
        exchange: 'binance',
        timeframe: horizon as Timeframe,
        horizonCandles: 1,
        predictedClose: 60200,
        predictedDirection: 'up',
        confidence: 0.72,
        metadata: { priceBand: { low: 59500, mid: 60200, high: 61000 } },
      };

      return { result: { prediction: mockPrediction } };
    }

    case 'tokenize': {
      const candleInput = input.candle as { open: number; high: number; low: number; close: number; volume: number } | undefined;
      if (!candleInput) return { error: 'Missing candle data (open, high, low, close, volume)' };

      const candle: Candle = {
        time: new Date(),
        symbol: (input.symbol as string) ?? 'BTC/USDT',
        exchange: 'binance',
        timeframe: '1h',
        open: candleInput.open,
        high: candleInput.high,
        low: candleInput.low,
        close: candleInput.close,
        volume: candleInput.volume,
      };

      const token: BSQToken = tokenizeCandle(candle);
      return {
        result: {
          bits: token.bits,
          dimensions: token.dimensions,
          binaryString: token.bits.map((b) => (b === 1 ? '+' : '-')).join(''),
          tokenString: tokenSequenceToString([token]),
        },
      };
    }

    case 'multi_horizon': {
      const symbol = (input.symbol as string) ?? 'BTC/USDT';
      const model = ((input.model as string) ?? 'kronos_v1') as PredictionModel;
      const currentPrice = (input.current_price as number) ?? 60000;

      const directionScores = [
        { timeframe: '1h' as Timeframe, horizonCandles: 1, upProb: 0.62 },
        { timeframe: '4h' as Timeframe, horizonCandles: 4, upProb: 0.58 },
        { timeframe: '1d' as Timeframe, horizonCandles: 24, upProb: 0.53 },
      ];

      const horizons = generateMultiHorizon(symbol, model, currentPrice, directionScores);
      return { result: { symbol, horizons } };
    }

    case 'ensemble': {
      const direction = ((input.direction as string) ?? 'up') as PredictionDirection;
      const confidence = (input.confidence as number) ?? 0.7;

      const predictions: Prediction[] = DEFAULT_ENSEMBLE_WEIGHTS.map((w) => ({
        id: `pred-${w.model}-${Date.now()}`,
        createdAt: new Date(),
        model: w.model,
        symbol: (input.symbol as string) ?? 'BTC/USDT',
        exchange: 'binance',
        timeframe: '1h' as Timeframe,
        horizonCandles: 1,
        predictedClose: 60000,
        predictedDirection: direction,
        confidence,
      }));

      const vote = ensembleVote(predictions, DEFAULT_ENSEMBLE_WEIGHTS);
      return { result: { ensembleResult: vote } };
    }

    case 'evaluate': {
      const direction = ((input.direction as string) ?? 'up') as PredictionDirection;
      const actualClose = (input.actual_close as number) ?? 60500;
      const confidence = (input.confidence as number) ?? 0.7;

      const predicted: Prediction = {
        id: (input.prediction_id as string) ?? `pred-${Date.now()}`,
        createdAt: new Date(),
        model: 'kronos_v1',
        symbol: (input.symbol as string) ?? 'BTC/USDT',
        exchange: 'binance',
        timeframe: '1h',
        horizonCandles: 1,
        predictedClose: (input.predicted_close as number) ?? 60000,
        predictedDirection: direction,
        confidence,
      };

      const evaluation = evaluatePrediction(predicted, actualClose);
      return { result: { evaluation } };
    }

    case 'accuracy': {
      const model = ((input.model as string) ?? 'kronos_v1') as PredictionModel;
      const symbol = (input.symbol as string) ?? 'BTC/USDT';
      const timeframe = ((input.timeframe as string) ?? '1h') as Timeframe;

      const sampleEvaluations = Array.from({ length: 20 }, () => ({
        directionCorrect: Math.random() > 0.4,
        errorPct: (Math.random() - 0.5) * 5,
        absError: Math.random() * 500,
      }));

      const accuracy = computeAccuracy(sampleEvaluations, model, symbol, timeframe);
      return { result: { accuracy, sampleSize: sampleEvaluations.length } };
    }

    default:
      return { error: `Unknown action "${action}". Use: predict, tokenize, multi_horizon, ensemble, evaluate, accuracy` };
  }
}
