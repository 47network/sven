// Brain visualization data models for mobile companion.
//
// Mirrors the Canvas UI BrainBlock data structures but adapted for Flutter's
// CustomPaint rendering pipeline and touch interaction model.

/// A single node in the brain knowledge graph.
class BrainNode {
  BrainNode({
    required this.id,
    required this.label,
    required this.type,
    required this.state,
    this.strength = 0.5,
  });

  factory BrainNode.fromJson(Map<String, dynamic> json) => BrainNode(
        id: json['id'] as String? ?? '',
        label: json['label'] as String? ?? '',
        type: BrainNodeType.fromString(json['type'] as String? ?? 'memory'),
        state: BrainNodeState.fromString(json['state'] as String? ?? 'active'),
        strength: (json['strength'] as num?)?.toDouble() ?? 0.5,
      );

  final String id;
  final String label;
  final BrainNodeType type;
  final BrainNodeState state;
  final double strength;

  /// Mutable position set by the force-directed layout.
  double x = 0;
  double y = 0;

  /// Velocity for physics simulation.
  double vx = 0;
  double vy = 0;

  Map<String, dynamic> toJson() => {
        'id': id,
        'label': label,
        'type': type.name,
        'state': state.name,
        'strength': strength,
      };
}

/// An edge connecting two brain nodes.
class BrainEdge {
  BrainEdge({
    required this.source,
    required this.target,
    this.weight = 1.0,
    this.label,
  });

  factory BrainEdge.fromJson(Map<String, dynamic> json) => BrainEdge(
        source: json['source'] as String? ?? '',
        target: json['target'] as String? ?? '',
        weight: (json['weight'] as num?)?.toDouble() ?? 1.0,
        label: json['label'] as String?,
      );

  final String source;
  final String target;
  final double weight;
  final String? label;
}

/// Statistics summary for the brain graph.
class BrainStats {
  BrainStats({
    this.totalMemories = 0,
    this.kgEntities = 0,
    this.emotionalSamples = 0,
    this.activeCount = 0,
    this.fadingCount = 0,
    this.consolidatedCount = 0,
  });

  factory BrainStats.fromJson(Map<String, dynamic> json) => BrainStats(
        totalMemories: json['total_memories'] as int? ?? 0,
        kgEntities: json['kg_entities'] as int? ?? 0,
        emotionalSamples: json['emotional_samples'] as int? ?? 0,
        activeCount: json['active_count'] as int? ?? 0,
        fadingCount: json['fading_count'] as int? ?? 0,
        consolidatedCount: json['consolidated_count'] as int? ?? 0,
      );

  final int totalMemories;
  final int kgEntities;
  final int emotionalSamples;
  final int activeCount;
  final int fadingCount;
  final int consolidatedCount;
}

/// The complete brain graph response from the API.
class BrainGraph {
  BrainGraph({
    required this.nodes,
    required this.edges,
    required this.stats,
  });

  factory BrainGraph.fromJson(Map<String, dynamic> json) {
    final nodesRaw = json['nodes'] as List<dynamic>? ?? [];
    final edgesRaw = json['edges'] as List<dynamic>? ?? [];
    return BrainGraph(
      nodes: nodesRaw
          .cast<Map<String, dynamic>>()
          .map(BrainNode.fromJson)
          .toList(),
      edges: edgesRaw
          .cast<Map<String, dynamic>>()
          .map(BrainEdge.fromJson)
          .toList(),
      stats: BrainStats.fromJson(
          json['stats'] as Map<String, dynamic>? ?? {}),
    );
  }

  final List<BrainNode> nodes;
  final List<BrainEdge> edges;
  final BrainStats stats;
}

// ── Enums ────────────────────────────────────────────────────────────────────

enum BrainNodeType {
  memory,
  knowledge,
  emotion,
  reasoning;

  static BrainNodeType fromString(String s) {
    switch (s) {
      case 'knowledge':
        return BrainNodeType.knowledge;
      case 'emotion':
        return BrainNodeType.emotion;
      case 'reasoning':
        return BrainNodeType.reasoning;
      default:
        return BrainNodeType.memory;
    }
  }
}

enum BrainNodeState {
  fresh,
  active,
  resonating,
  fading,
  consolidating,
  consolidated;

  static BrainNodeState fromString(String s) {
    switch (s) {
      case 'fresh':
        return BrainNodeState.fresh;
      case 'resonating':
        return BrainNodeState.resonating;
      case 'fading':
        return BrainNodeState.fading;
      case 'consolidating':
        return BrainNodeState.consolidating;
      case 'consolidated':
        return BrainNodeState.consolidated;
      default:
        return BrainNodeState.active;
    }
  }
}
