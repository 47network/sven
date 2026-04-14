// ═══════════════════════════════════════════════════════════════════════════
// Trading models — data classes for the Sven Trading API surface.
//
// Uses plain Dart classes (no code-gen) to match existing service patterns.
// All JSON factories follow gateway-api response shapes exactly.
// ═══════════════════════════════════════════════════════════════════════════

/// Sven's current trading status.
class TradingStatus {
  final String state;
  final String? activeSymbol;
  final int openPositions;
  final int pendingOrders;
  final double todayPnl;
  final int todayTrades;
  final double uptime;
  final String? lastLoopAt;
  final String? lastDecision;
  final CircuitBreakerState circuitBreaker;
  final String mode;
  final LoopInfo loop;
  final BrainInfo brain;
  final AutoTradeInfo autoTrade;
  final MessagingInfo messaging;
  final GoalInfo? goal;
  final NewsIngestionInfo? newsIngestion;
  final TrendScoutInfo? trendScout;
  final LearningInfo? learning;
  final RiskManagementInfo? riskManagement;

  const TradingStatus({
    required this.state,
    this.activeSymbol,
    required this.openPositions,
    required this.pendingOrders,
    required this.todayPnl,
    required this.todayTrades,
    required this.uptime,
    this.lastLoopAt,
    this.lastDecision,
    required this.circuitBreaker,
    required this.mode,
    required this.loop,
    required this.brain,
    required this.autoTrade,
    required this.messaging,
    this.goal,
    this.newsIngestion,
    this.trendScout,
    this.learning,
    this.riskManagement,
  });

  factory TradingStatus.fromJson(Map<String, dynamic> j) => TradingStatus(
        state: j['state'] as String? ?? 'offline',
        activeSymbol: j['activeSymbol'] as String?,
        openPositions: (j['openPositions'] as num?)?.toInt() ?? 0,
        pendingOrders: (j['pendingOrders'] as num?)?.toInt() ?? 0,
        todayPnl: (j['todayPnl'] as num?)?.toDouble() ?? 0,
        todayTrades: (j['todayTrades'] as num?)?.toInt() ?? 0,
        uptime: (j['uptime'] as num?)?.toDouble() ?? 0,
        lastLoopAt: j['lastLoopAt'] as String?,
        lastDecision: j['lastDecision'] as String?,
        circuitBreaker: CircuitBreakerState.fromJson(
            j['circuitBreaker'] as Map<String, dynamic>? ?? {}),
        mode: j['mode'] as String? ?? 'paper',
        loop: LoopInfo.fromJson(j['loop'] as Map<String, dynamic>? ?? {}),
        brain: BrainInfo.fromJson(j['brain'] as Map<String, dynamic>? ?? {}),
        autoTrade: AutoTradeInfo.fromJson(
            j['autoTrade'] as Map<String, dynamic>? ?? {}),
        messaging: MessagingInfo.fromJson(
            j['messaging'] as Map<String, dynamic>? ?? {}),
        goal: j['goal'] != null
            ? GoalInfo.fromJson(j['goal'] as Map<String, dynamic>)
            : null,
        newsIngestion: j['newsIngestion'] != null
            ? NewsIngestionInfo.fromJson(
                j['newsIngestion'] as Map<String, dynamic>)
            : null,
        trendScout: j['trendScout'] != null
            ? TrendScoutInfo.fromJson(
                j['trendScout'] as Map<String, dynamic>)
            : null,
        learning: j['learning'] != null
            ? LearningInfo.fromJson(j['learning'] as Map<String, dynamic>)
            : null,
        riskManagement: j['riskManagement'] != null
            ? RiskManagementInfo.fromJson(
                j['riskManagement'] as Map<String, dynamic>)
            : null,
      );
}

class CircuitBreakerState {
  final bool tripped;
  final String? reason;
  final double dailyLossPct;
  final double dailyLossLimit;

  const CircuitBreakerState({
    required this.tripped,
    this.reason,
    required this.dailyLossPct,
    required this.dailyLossLimit,
  });

  factory CircuitBreakerState.fromJson(Map<String, dynamic> j) =>
      CircuitBreakerState(
        tripped: j['tripped'] as bool? ?? false,
        reason: j['reason'] as String?,
        dailyLossPct: (j['dailyLossPct'] as num?)?.toDouble() ?? 0,
        dailyLossLimit: (j['dailyLossLimit'] as num?)?.toDouble() ?? 0.05,
      );
}

class LoopInfo {
  final bool running;
  final int intervalMs;
  final int iterations;
  final List<String> trackedSymbols;

  const LoopInfo({
    required this.running,
    required this.intervalMs,
    required this.iterations,
    required this.trackedSymbols,
  });

  factory LoopInfo.fromJson(Map<String, dynamic> j) => LoopInfo(
        running: j['running'] as bool? ?? false,
        intervalMs: (j['intervalMs'] as num?)?.toInt() ?? 60000,
        iterations: (j['iterations'] as num?)?.toInt() ?? 0,
        trackedSymbols: (j['trackedSymbols'] as List<dynamic>?)
                ?.map((e) => e.toString())
                .toList() ??
            [],
      );
}

class BrainInfo {
  final List<GpuNode> fleet;
  final double escalationThreshold;

  const BrainInfo({
    required this.fleet,
    required this.escalationThreshold,
  });

  factory BrainInfo.fromJson(Map<String, dynamic> j) => BrainInfo(
        fleet: (j['fleet'] as List<dynamic>?)
                ?.map((e) => GpuNode.fromJson(e as Map<String, dynamic>))
                .toList() ??
            [],
        escalationThreshold:
            (j['escalationThreshold'] as num?)?.toDouble() ?? 0.55,
      );
}

class GpuNode {
  final String name;
  final String role;
  final String model;
  final bool healthy;

  const GpuNode({
    required this.name,
    required this.role,
    required this.model,
    required this.healthy,
  });

  factory GpuNode.fromJson(Map<String, dynamic> j) => GpuNode(
        name: j['name'] as String? ?? '',
        role: j['role'] as String? ?? '',
        model: j['model'] as String? ?? '',
        healthy: j['healthy'] as bool? ?? false,
      );
}

class AutoTradeInfo {
  final bool enabled;
  final double confidenceThreshold;
  final double maxPositionPct;
  final int totalExecuted;
  final Map<String, dynamic>? lastTrade;

  const AutoTradeInfo({
    required this.enabled,
    required this.confidenceThreshold,
    required this.maxPositionPct,
    required this.totalExecuted,
    this.lastTrade,
  });

  factory AutoTradeInfo.fromJson(Map<String, dynamic> j) => AutoTradeInfo(
        enabled: j['enabled'] as bool? ?? false,
        confidenceThreshold:
            (j['confidenceThreshold'] as num?)?.toDouble() ?? 0.6,
        maxPositionPct: (j['maxPositionPct'] as num?)?.toDouble() ?? 0.05,
        totalExecuted: (j['totalExecuted'] as num?)?.toInt() ?? 0,
        lastTrade: j['lastTrade'] as Map<String, dynamic>?,
      );
}

class MessagingInfo {
  final int unreadCount;
  final int totalMessages;
  final int scheduledPending;

  const MessagingInfo({
    required this.unreadCount,
    required this.totalMessages,
    required this.scheduledPending,
  });

  factory MessagingInfo.fromJson(Map<String, dynamic> j) => MessagingInfo(
        unreadCount: (j['unreadCount'] as num?)?.toInt() ?? 0,
        totalMessages: (j['totalMessages'] as num?)?.toInt() ?? 0,
        scheduledPending: (j['scheduledPending'] as num?)?.toInt() ?? 0,
      );
}

/// A proactive message from Sven.
class SvenMessage {
  final String id;
  final String type; // 'trade_alert' | 'market_insight' | 'scheduled' | 'system'
  final String title;
  final String body;
  final String? symbol;
  final String severity; // 'info' | 'warning' | 'critical'
  final bool read;
  final String createdAt;

  const SvenMessage({
    required this.id,
    required this.type,
    required this.title,
    required this.body,
    this.symbol,
    required this.severity,
    required this.read,
    required this.createdAt,
  });

  factory SvenMessage.fromJson(Map<String, dynamic> j) => SvenMessage(
        id: j['id'] as String? ?? '',
        type: j['type'] as String? ?? 'system',
        title: j['title'] as String? ?? '',
        body: j['body'] as String? ?? '',
        symbol: j['symbol'] as String?,
        severity: j['severity'] as String? ?? 'info',
        read: j['read'] as bool? ?? false,
        createdAt: j['createdAt'] as String? ?? '',
      );
}

/// A trade executed by Sven.
class SvenTrade {
  final String symbol;
  final String side;
  final double quantity;
  final double price;
  final double confidence;
  final String broker;
  final String timestamp;

  const SvenTrade({
    required this.symbol,
    required this.side,
    required this.quantity,
    required this.price,
    required this.confidence,
    required this.broker,
    required this.timestamp,
  });

  factory SvenTrade.fromJson(Map<String, dynamic> j) => SvenTrade(
        symbol: j['symbol'] as String? ?? '',
        side: j['side'] as String? ?? '',
        quantity: (j['quantity'] as num?)?.toDouble() ?? 0,
        price: (j['price'] as num?)?.toDouble() ?? 0,
        confidence: (j['confidence'] as num?)?.toDouble() ?? 0,
        broker: j['broker'] as String? ?? 'paper',
        timestamp: j['timestamp'] as String? ?? '',
      );
}

/// A single goal milestone in Sven's progression.
class GoalMilestone {
  final String id;
  final String name;
  final double targetBalance;
  final String reward;
  final bool achieved;
  final String? achievedAt;
  final double progressPct;

  const GoalMilestone({
    required this.id,
    required this.name,
    required this.targetBalance,
    required this.reward,
    required this.achieved,
    this.achievedAt,
    required this.progressPct,
  });

  factory GoalMilestone.fromJson(Map<String, dynamic> j) => GoalMilestone(
        id: j['id'] as String? ?? '',
        name: j['name'] as String? ?? '',
        targetBalance: (j['targetBalance'] as num?)?.toDouble() ?? 0,
        reward: j['reward'] as String? ?? '',
        achieved: j['achieved'] as bool? ?? false,
        achievedAt: j['achievedAt'] as String?,
        progressPct: (j['progressPct'] as num?)?.toDouble() ?? 0,
      );
}

/// Sven's goal system — earn upgrades by accumulating trading capital.
class GoalInfo {
  final double currentBalance;
  final double startingBalance;
  final double totalPnl;
  final double peakBalance;
  final double dailyPnl;
  final int dailyTrades;
  final List<GoalMilestone> milestones;
  final GoalMilestone? nextMilestone;

  const GoalInfo({
    required this.currentBalance,
    required this.startingBalance,
    required this.totalPnl,
    required this.peakBalance,
    required this.dailyPnl,
    required this.dailyTrades,
    required this.milestones,
    this.nextMilestone,
  });

  int get achieved => milestones.where((m) => m.achieved).length;
  int get total => milestones.length;

  factory GoalInfo.fromJson(Map<String, dynamic> j) => GoalInfo(
        currentBalance: (j['currentBalance'] as num?)?.toDouble() ?? 0,
        startingBalance: (j['startingBalance'] as num?)?.toDouble() ?? 100000,
        totalPnl: (j['totalPnl'] as num?)?.toDouble() ?? 0,
        peakBalance: (j['peakBalance'] as num?)?.toDouble() ?? 0,
        dailyPnl: (j['dailyPnl'] as num?)?.toDouble() ?? 0,
        dailyTrades: (j['dailyTrades'] as num?)?.toInt() ?? 0,
        milestones: (j['milestones'] as List<dynamic>?)
                ?.map((e) => GoalMilestone.fromJson(e as Map<String, dynamic>))
                .toList() ??
            [],
        nextMilestone: j['nextMilestone'] != null
            ? GoalMilestone.fromJson(j['nextMilestone'] as Map<String, dynamic>)
            : null,
      );
}

/// SSE event from the trading stream.
class TradingEvent {
  final String id;
  final String type;
  final DateTime timestamp;
  final Map<String, dynamic> data;

  const TradingEvent({
    required this.id,
    required this.type,
    required this.timestamp,
    required this.data,
  });

  factory TradingEvent.fromJson(Map<String, dynamic> j) => TradingEvent(
        id: j['id'] as String? ?? '',
        type: j['type'] as String? ?? '',
        timestamp: DateTime.tryParse(j['timestamp'] as String? ?? '') ??
            DateTime.now(),
        data: j['data'] as Map<String, dynamic>? ?? {},
      );
}

/// An open market position held by Sven.
class Position {
  final String id;
  final String symbol;
  final String side; // 'long' | 'short'
  final double quantity;
  final double entryPrice;
  final double currentPrice;
  final double unrealizedPnl;
  final String broker;
  final String openedAt;
  final List<double> priceHistory;

  const Position({
    required this.id,
    required this.symbol,
    required this.side,
    required this.quantity,
    required this.entryPrice,
    required this.currentPrice,
    required this.unrealizedPnl,
    required this.broker,
    required this.openedAt,
    this.priceHistory = const [],
  });

  factory Position.fromJson(Map<String, dynamic> j) => Position(
        id: j['id'] as String? ?? '',
        symbol: j['symbol'] as String? ?? '',
        side: j['side'] as String? ?? 'long',
        quantity: (j['quantity'] as num?)?.toDouble() ?? 0,
        entryPrice: (j['entryPrice'] as num?)?.toDouble() ?? 0,
        currentPrice: (j['currentPrice'] as num?)?.toDouble() ?? 0,
        unrealizedPnl: (j['unrealizedPnl'] as num?)?.toDouble() ?? 0,
        broker: j['broker'] as String? ?? '',
        openedAt: j['openedAt'] as String? ?? '',
        priceHistory: (j['priceHistory'] as List<dynamic>?)
                ?.map((e) => (e as num).toDouble())
                .toList() ??
            [],
      );
}

/// A price threshold alert configured by the user.
class PriceAlert {
  final String id;
  final String symbol;
  final double targetPrice;
  final String direction; // 'above' | 'below'
  final String status; // 'active' | 'triggered' | 'expired'
  final String createdAt;

  const PriceAlert({
    required this.id,
    required this.symbol,
    required this.targetPrice,
    required this.direction,
    required this.status,
    required this.createdAt,
  });

  factory PriceAlert.fromJson(Map<String, dynamic> j) => PriceAlert(
        id: j['id'] as String? ?? '',
        symbol: j['symbol'] as String? ?? '',
        targetPrice: (j['targetPrice'] as num?)?.toDouble() ?? 0,
        direction: j['direction'] as String? ?? 'above',
        status: j['status'] as String? ?? 'active',
        createdAt: j['createdAt'] as String? ?? '',
      );
}

/// A news article from the trading news endpoint.
class NewsArticle {
  final String id;
  final String event;
  final String source;
  final int impactLevel;
  final double sentimentScore;
  final String createdAt;

  const NewsArticle({
    required this.id,
    required this.event,
    required this.source,
    required this.impactLevel,
    required this.sentimentScore,
    required this.createdAt,
  });

  factory NewsArticle.fromJson(Map<String, dynamic> j) => NewsArticle(
        id: j['id'] as String? ?? '',
        event: j['event'] as String? ?? '',
        source: j['source'] as String? ?? '',
        impactLevel: (j['impactLevel'] as num?)?.toInt() ?? 1,
        sentimentScore: (j['sentimentScore'] as num?)?.toDouble() ?? 0,
        createdAt: j['createdAt'] as String? ?? '',
      );
}

/// News ingestion status from /sven/status.
class NewsIngestionInfo {
  final int cachedArticles;
  final int rssFeedCount;
  final Map<String, dynamic> sourceHealth;
  final NewsDigestInfo? lastDigest;

  const NewsIngestionInfo({
    required this.cachedArticles,
    required this.rssFeedCount,
    required this.sourceHealth,
    this.lastDigest,
  });

  factory NewsIngestionInfo.fromJson(Map<String, dynamic> j) =>
      NewsIngestionInfo(
        cachedArticles: (j['cachedArticles'] as num?)?.toInt() ?? 0,
        rssFeedCount: (j['rssFeedCount'] as num?)?.toInt() ?? 0,
        sourceHealth: j['sourceHealth'] as Map<String, dynamic>? ?? {},
        lastDigest: j['lastDigest'] != null
            ? NewsDigestInfo.fromJson(j['lastDigest'] as Map<String, dynamic>)
            : null,
      );
}

/// A synthesized news digest from Sven's LLM.
class NewsDigestInfo {
  final String timestamp;
  final List<String> keyThemes;
  final String summaryPreview;

  const NewsDigestInfo({
    required this.timestamp,
    required this.keyThemes,
    required this.summaryPreview,
  });

  factory NewsDigestInfo.fromJson(Map<String, dynamic> j) => NewsDigestInfo(
        timestamp: j['timestamp'] as String? ?? '',
        keyThemes: (j['keyThemes'] as List<dynamic>?)
                ?.map((e) => e.toString())
                .toList() ??
            [],
        summaryPreview: j['summaryPreview'] as String? ?? '',
      );
}

/// A dynamically discovered symbol from Trend Scout.
class DynamicWatchlistEntry {
  final String symbol;
  final String discoveredFrom;
  final double newsScore;
  final String addedAt;
  final String expiresAt;
  final int expiresInMin;
  final int trades;

  const DynamicWatchlistEntry({
    required this.symbol,
    required this.discoveredFrom,
    required this.newsScore,
    required this.addedAt,
    required this.expiresAt,
    required this.expiresInMin,
    required this.trades,
  });

  factory DynamicWatchlistEntry.fromJson(Map<String, dynamic> j) =>
      DynamicWatchlistEntry(
        symbol: j['symbol'] as String? ?? '',
        discoveredFrom: j['discoveredFrom'] as String? ?? '',
        newsScore: (j['newsScore'] as num?)?.toDouble() ?? 0,
        addedAt: j['addedAt'] as String? ?? '',
        expiresAt: j['expiresAt'] as String? ?? '',
        expiresInMin: (j['expiresInMin'] as num?)?.toInt() ?? 0,
        trades: (j['trades'] as num?)?.toInt() ?? 0,
      );
}

/// Trend scout info from /sven/status.
class TrendScoutInfo {
  final List<DynamicWatchlistEntry> dynamicWatchlist;
  final int maxDynamic;
  final int scoutIntervalMs;
  final int knownAlts;

  const TrendScoutInfo({
    required this.dynamicWatchlist,
    required this.maxDynamic,
    required this.scoutIntervalMs,
    required this.knownAlts,
  });

  factory TrendScoutInfo.fromJson(Map<String, dynamic> j) => TrendScoutInfo(
        dynamicWatchlist: (j['dynamicWatchlist'] as List<dynamic>?)
                ?.map((e) =>
                    DynamicWatchlistEntry.fromJson(e as Map<String, dynamic>))
                .toList() ??
            [],
        maxDynamic: (j['maxDynamic'] as num?)?.toInt() ?? 10,
        scoutIntervalMs: (j['scoutIntervalMs'] as num?)?.toInt() ?? 600000,
        knownAlts: (j['knownAlts'] as num?)?.toInt() ?? 0,
      );
}

/// Sven's source weight learning and model accuracy info.
class LearningInfo {
  final Map<String, double> sourceWeights;
  final Map<String, ModelAccuracyEntry> modelAccuracy;
  final int learningIterations;
  final int learnedPatterns;

  const LearningInfo({
    required this.sourceWeights,
    required this.modelAccuracy,
    required this.learningIterations,
    required this.learnedPatterns,
  });

  factory LearningInfo.fromJson(Map<String, dynamic> j) => LearningInfo(
        sourceWeights: (j['sourceWeights'] as Map<String, dynamic>?)
                ?.map((k, v) => MapEntry(k, (v as num).toDouble())) ??
            {},
        modelAccuracy: (j['modelAccuracy'] as Map<String, dynamic>?)?.map(
                (k, v) => MapEntry(
                    k,
                    ModelAccuracyEntry.fromJson(
                        v as Map<String, dynamic>))) ??
            {},
        learningIterations:
            (j['learningIterations'] as num?)?.toInt() ?? 0,
        learnedPatterns: (j['learnedPatterns'] as num?)?.toInt() ?? 0,
      );
}

class ModelAccuracyEntry {
  final int correct;
  final int total;

  const ModelAccuracyEntry({required this.correct, required this.total});

  double get accuracy => total > 0 ? correct / total : 0;

  factory ModelAccuracyEntry.fromJson(Map<String, dynamic> j) =>
      ModelAccuracyEntry(
        correct: (j['correct'] as num?)?.toInt() ?? 0,
        total: (j['total'] as num?)?.toInt() ?? 0,
      );
}

/// Risk management configuration (trailing stop, trend filter, dedup).
class RiskManagementInfo {
  final TrailingStopInfo trailingStop;
  final TrendFilterInfo trendFilter;
  final DedupGuardInfo dedupGuard;

  const RiskManagementInfo({
    required this.trailingStop,
    required this.trendFilter,
    required this.dedupGuard,
  });

  factory RiskManagementInfo.fromJson(Map<String, dynamic> j) =>
      RiskManagementInfo(
        trailingStop: TrailingStopInfo.fromJson(
            j['trailingStop'] as Map<String, dynamic>? ?? {}),
        trendFilter: TrendFilterInfo.fromJson(
            j['trendFilter'] as Map<String, dynamic>? ?? {}),
        dedupGuard: DedupGuardInfo.fromJson(
            j['dedupGuard'] as Map<String, dynamic>? ?? {}),
      );
}

class TrailingStopInfo {
  final double activationPct;
  final double trailDistancePct;
  final double hardTpPct;
  final double hardSlPct;
  final int activeTrails;

  const TrailingStopInfo({
    required this.activationPct,
    required this.trailDistancePct,
    required this.hardTpPct,
    required this.hardSlPct,
    required this.activeTrails,
  });

  factory TrailingStopInfo.fromJson(Map<String, dynamic> j) =>
      TrailingStopInfo(
        activationPct: (j['activationPct'] as num?)?.toDouble() ?? 0.5,
        trailDistancePct:
            (j['trailDistancePct'] as num?)?.toDouble() ?? 40,
        hardTpPct: (j['hardTpPct'] as num?)?.toDouble() ?? 3,
        hardSlPct: (j['hardSlPct'] as num?)?.toDouble() ?? 1,
        activeTrails: (j['activeTrails'] as num?)?.toInt() ?? 0,
      );
}

class TrendFilterInfo {
  final bool enabled;
  final int smaPeriod;
  final double strengthThreshold;

  const TrendFilterInfo({
    required this.enabled,
    required this.smaPeriod,
    required this.strengthThreshold,
  });

  factory TrendFilterInfo.fromJson(Map<String, dynamic> j) =>
      TrendFilterInfo(
        enabled: j['enabled'] as bool? ?? true,
        smaPeriod: (j['smaPeriod'] as num?)?.toInt() ?? 50,
        strengthThreshold:
            (j['strengthThreshold'] as num?)?.toDouble() ?? 0.15,
      );
}

class DedupGuardInfo {
  final bool enabled;
  final int maxPerSymbol;

  const DedupGuardInfo({
    required this.enabled,
    required this.maxPerSymbol,
  });

  factory DedupGuardInfo.fromJson(Map<String, dynamic> j) => DedupGuardInfo(
        enabled: j['enabled'] as bool? ?? true,
        maxPerSymbol: (j['maxPerSymbol'] as num?)?.toInt() ?? 1,
      );
}
