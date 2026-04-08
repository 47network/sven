import 'dart:convert';
import 'dart:math';

import 'package:flutter/foundation.dart';

import '../../app/authenticated_client.dart';
import 'brain_models.dart';

// ═══════════════════════════════════════════════════════════════════════════
// BrainService — fetches the knowledge graph and runs force-directed layout
// ═══════════════════════════════════════════════════════════════════════════

class BrainService extends ChangeNotifier {
  BrainService({required AuthenticatedClient client}) : _client = client;

  final AuthenticatedClient _client;

  BrainGraph? _graph;
  bool _loading = false;
  String? _error;
  String? _selectedNodeId;
  Set<BrainNodeType> _activeFilters = BrainNodeType.values.toSet();
  double _zoom = 1.0;
  bool _disposed = false;

  // ── Public getters ─────────────────────────────────────────────────────

  BrainGraph? get graph => _graph;
  bool get loading => _loading;
  String? get error => _error;
  String? get selectedNodeId => _selectedNodeId;
  Set<BrainNodeType> get activeFilters => _activeFilters;
  double get zoom => _zoom;

  /// Nodes after applying the active type filter.
  List<BrainNode> get filteredNodes {
    if (_graph == null) return [];
    return _graph!.nodes
        .where((n) => _activeFilters.contains(n.type))
        .toList();
  }

  /// Edges where both endpoints are in the filtered node set.
  List<BrainEdge> get filteredEdges {
    if (_graph == null) return [];
    final ids = filteredNodes.map((n) => n.id).toSet();
    return _graph!.edges
        .where((e) => ids.contains(e.source) && ids.contains(e.target))
        .toList();
  }

  // ── Actions ────────────────────────────────────────────────────────────

  @override
  void dispose() {
    _disposed = true;
    super.dispose();
  }

  /// Fetch the brain graph from the gateway API.
  Future<void> fetchGraph() async {
    _loading = true;
    _error = null;
    _notify();

    try {
      final response = await _client.get(Uri.parse('/v1/admin/brain/graph'));
      if (response.statusCode != 200) {
        _error = 'Failed to load brain graph (${response.statusCode})';
        _loading = false;
        _notify();
        return;
      }

      final body = jsonDecode(response.body) as Map<String, dynamic>;
      final data = body['data'] as Map<String, dynamic>? ?? body;
      _graph = BrainGraph.fromJson(data);
      _runForceLayout();
      _loading = false;
      _notify();
    } catch (e) {
      _error = 'Connection error: $e';
      _loading = false;
      _notify();
    }
  }

  void selectNode(String? nodeId) {
    _selectedNodeId = nodeId;
    _notify();
  }

  void toggleFilter(BrainNodeType type) {
    if (_activeFilters.contains(type)) {
      if (_activeFilters.length > 1) {
        _activeFilters = Set.from(_activeFilters)..remove(type);
      }
    } else {
      _activeFilters = Set.from(_activeFilters)..add(type);
    }
    _notify();
  }

  void setZoom(double z) {
    _zoom = z.clamp(0.3, 3.0);
    _notify();
  }

  void zoomIn() => setZoom(_zoom * 1.25);
  void zoomOut() => setZoom(_zoom / 1.25);
  void resetZoom() => setZoom(1.0);

  /// Find a node by tap position in the layout coordinate space.
  BrainNode? hitTest(double x, double y, {double radius = 24}) {
    final nodes = filteredNodes;
    for (final node in nodes.reversed) {
      final dx = node.x - x;
      final dy = node.y - y;
      if (dx * dx + dy * dy <= radius * radius) {
        return node;
      }
    }
    return null;
  }

  // ── Force-directed layout ─────────────────────────────────────────────

  void _runForceLayout() {
    if (_graph == null || _graph!.nodes.isEmpty) return;

    final nodes = _graph!.nodes;
    final edges = _graph!.edges;
    final rng = Random(42);

    // Initialise random positions.
    for (final n in nodes) {
      n.x = (rng.nextDouble() - 0.5) * 400;
      n.y = (rng.nextDouble() - 0.5) * 400;
      n.vx = 0;
      n.vy = 0;
    }

    // Build lookup for O(1) node access.
    final nodeMap = {for (final n in nodes) n.id: n};

    const iterations = 100;
    const repulsion = 900.0;
    const attraction = 0.005;
    const damping = 0.90;
    const centerPull = 0.003;

    for (var iter = 0; iter < iterations; iter++) {
      // Repulsion: every node pushes every other away.
      for (var i = 0; i < nodes.length; i++) {
        for (var j = i + 1; j < nodes.length; j++) {
          final a = nodes[i];
          final b = nodes[j];
          var dx = b.x - a.x;
          var dy = b.y - a.y;
          var dist = sqrt(dx * dx + dy * dy);
          if (dist < 1) dist = 1;
          final force = repulsion / (dist * dist);
          final fx = (dx / dist) * force;
          final fy = (dy / dist) * force;
          a.vx -= fx;
          a.vy -= fy;
          b.vx += fx;
          b.vy += fy;
        }
      }

      // Attraction along edges.
      for (final edge in edges) {
        final a = nodeMap[edge.source];
        final b = nodeMap[edge.target];
        if (a == null || b == null) continue;
        final dx = b.x - a.x;
        final dy = b.y - a.y;
        final dist = sqrt(dx * dx + dy * dy);
        final force = dist * attraction * edge.weight;
        final fx = (dx / (dist < 1 ? 1 : dist)) * force;
        final fy = (dy / (dist < 1 ? 1 : dist)) * force;
        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      }

      // Center gravity.
      for (final n in nodes) {
        n.vx -= n.x * centerPull;
        n.vy -= n.y * centerPull;
      }

      // Apply velocity with damping.
      for (final n in nodes) {
        n.vx *= damping;
        n.vy *= damping;
        n.x += n.vx;
        n.y += n.vy;
      }
    }
  }

  void _notify() {
    if (!_disposed) notifyListeners();
  }
}
