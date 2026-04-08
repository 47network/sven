import 'dart:math';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';

import 'brain_models.dart';
import 'brain_service.dart';

// ═══════════════════════════════════════════════════════════════════════════
// BrainPage — interactive force-directed knowledge graph for mobile
//
// Touch-navigable, pinch-zoom, tap for memory details.
// Mirrors Canvas UI BrainBlock but adapted for mobile interaction.
// ═══════════════════════════════════════════════════════════════════════════

class BrainPage extends StatefulWidget {
  const BrainPage({super.key, required this.brainService});

  final BrainService brainService;

  @override
  State<BrainPage> createState() => _BrainPageState();
}

class _BrainPageState extends State<BrainPage>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulseController;
  Offset _panOffset = Offset.zero;

  BrainService get _service => widget.brainService;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 3),
    )..repeat(reverse: true);

    _service.addListener(_onServiceChanged);
    _service.fetchGraph();
  }

  @override
  void dispose() {
    _pulseController.dispose();
    _service.removeListener(_onServiceChanged);
    super.dispose();
  }

  void _onServiceChanged() {
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF0f172a) : Colors.grey.shade50,
      appBar: AppBar(
        title: const Text('Brain Map'),
        actions: [
          IconButton(
            icon: const Icon(Icons.remove),
            onPressed: _service.zoomOut,
            tooltip: 'Zoom out',
          ),
          IconButton(
            icon: const Icon(Icons.add),
            onPressed: _service.zoomIn,
            tooltip: 'Zoom in',
          ),
          IconButton(
            icon: const Icon(Icons.center_focus_strong),
            onPressed: () {
              _service.resetZoom();
              setState(() => _panOffset = Offset.zero);
            },
            tooltip: 'Reset view',
          ),
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _service.fetchGraph,
            tooltip: 'Refresh',
          ),
        ],
      ),
      body: Column(
        children: [
          _buildFilterBar(isDark),
          Expanded(child: _buildGraphArea(isDark)),
          if (_service.graph != null) _buildStatsBar(isDark),
          if (_service.selectedNodeId != null) _buildDetailSheet(isDark),
        ],
      ),
    );
  }

  // ── Filter chips ───────────────────────────────────────────────────────

  Widget _buildFilterBar(bool isDark) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      child: Row(
        children: BrainNodeType.values.map((type) {
          final active = _service.activeFilters.contains(type);
          return Padding(
            padding: const EdgeInsets.only(right: 6),
            child: FilterChip(
              label: Text(type.name),
              selected: active,
              selectedColor: _nodeColor(type).withValues(alpha: 0.3),
              checkmarkColor: _nodeColor(type),
              onSelected: (_) => _service.toggleFilter(type),
            ),
          );
        }).toList(),
      ),
    );
  }

  // ── Graph canvas ───────────────────────────────────────────────────────

  Widget _buildGraphArea(bool isDark) {
    if (_service.loading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_service.error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.warning_amber, color: Colors.orange.shade400, size: 48),
              const SizedBox(height: 12),
              Text(
                _service.error!,
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: isDark ? Colors.white70 : Colors.black54,
                ),
              ),
              const SizedBox(height: 16),
              ElevatedButton.icon(
                onPressed: _service.fetchGraph,
                icon: const Icon(Icons.refresh, size: 16),
                label: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
    }

    if (_service.graph == null || _service.filteredNodes.isEmpty) {
      return Center(
        child: Text(
          'No brain data yet',
          style: TextStyle(color: isDark ? Colors.white38 : Colors.black38),
        ),
      );
    }

    return GestureDetector(
      onScaleUpdate: (details) {
        setState(() {
          _panOffset += details.focalPointDelta;
          if (details.scale != 1.0) {
            _service.setZoom(_service.zoom * details.scale.clamp(0.95, 1.05));
          }
        });
      },
      onTapUp: (details) {
        final box = context.findRenderObject() as RenderBox;
        final local = box.globalToLocal(details.globalPosition);
        final center = Offset(box.size.width / 2, box.size.height / 2);
        // Translate tap into graph coordinate space.
        final graphX =
            (local.dx - center.dx - _panOffset.dx) / _service.zoom;
        final graphY =
            (local.dy - center.dy - _panOffset.dy) / _service.zoom;
        final hit = _service.hitTest(graphX, graphY, radius: 20);
        _service.selectNode(hit?.id);
      },
      child: AnimatedBuilder(
        animation: _pulseController,
        builder: (context, _) {
          return CustomPaint(
            painter: _BrainGraphPainter(
              nodes: _service.filteredNodes,
              edges: _service.filteredEdges,
              zoom: _service.zoom,
              panOffset: _panOffset,
              selectedNodeId: _service.selectedNodeId,
              pulseValue: _pulseController.value,
              isDark: isDark,
            ),
            size: Size.infinite,
          );
        },
      ),
    );
  }

  // ── Stats bar ──────────────────────────────────────────────────────────

  Widget _buildStatsBar(bool isDark) {
    final stats = _service.graph!.stats;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: isDark
            ? Colors.white.withValues(alpha: 0.05)
            : Colors.black.withValues(alpha: 0.03),
        border: Border(
          top: BorderSide(
            color: isDark ? Colors.white12 : Colors.black12,
          ),
        ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _statItem('Memories', stats.totalMemories, isDark),
          _statItem('Entities', stats.kgEntities, isDark),
          _statItem('Emotions', stats.emotionalSamples, isDark),
          _statItem('Active', stats.activeCount, isDark),
          _statItem('Fading', stats.fadingCount, isDark),
        ],
      ),
    );
  }

  Widget _statItem(String label, int value, bool isDark) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          '$value',
          style: TextStyle(
            fontWeight: FontWeight.bold,
            fontSize: 14,
            color: isDark ? Colors.white : Colors.black87,
          ),
        ),
        Text(
          label,
          style: TextStyle(
            fontSize: 10,
            color: isDark ? Colors.white54 : Colors.black45,
          ),
        ),
      ],
    );
  }

  // ── Detail sheet ───────────────────────────────────────────────────────

  Widget _buildDetailSheet(bool isDark) {
    final node = _service.filteredNodes.cast<BrainNode?>().firstWhere(
          (n) => n?.id == _service.selectedNodeId,
          orElse: () => null,
        );
    if (node == null) return const SizedBox.shrink();

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1e293b) : Colors.white,
        border: Border(
          top: BorderSide(color: _nodeColor(node.type).withValues(alpha: 0.4)),
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 10,
                height: 10,
                decoration: BoxDecoration(
                  color: _nodeColor(node.type),
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  node.label,
                  style: TextStyle(
                    fontWeight: FontWeight.w600,
                    color: isDark ? Colors.white : Colors.black87,
                  ),
                ),
              ),
              GestureDetector(
                onTap: () => _service.selectNode(null),
                child: Icon(
                  Icons.close,
                  size: 18,
                  color: isDark ? Colors.white38 : Colors.black38,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            '${node.type.name} · ${node.state.name} · strength ${(node.strength * 100).toInt()}%',
            style: TextStyle(
              fontSize: 12,
              color: isDark ? Colors.white54 : Colors.black45,
            ),
          ),
        ],
      ),
    );
  }

  // ── Color mapping ─────────────────────────────────────────────────────

  static Color _nodeColor(BrainNodeType type) {
    switch (type) {
      case BrainNodeType.memory:
        return const Color(0xFF3b82f6);
      case BrainNodeType.knowledge:
        return const Color(0xFF10b981);
      case BrainNodeType.emotion:
        return const Color(0xFFf59e0b);
      case BrainNodeType.reasoning:
        return const Color(0xFF8b5cf6);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// _BrainGraphPainter — renders force-directed graph via CustomPaint
// ═══════════════════════════════════════════════════════════════════════════

class _BrainGraphPainter extends CustomPainter {
  _BrainGraphPainter({
    required this.nodes,
    required this.edges,
    required this.zoom,
    required this.panOffset,
    required this.selectedNodeId,
    required this.pulseValue,
    required this.isDark,
  });

  final List<BrainNode> nodes;
  final List<BrainEdge> edges;
  final double zoom;
  final Offset panOffset;
  final String? selectedNodeId;
  final double pulseValue;
  final bool isDark;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);

    canvas.save();
    canvas.translate(center.dx + panOffset.dx, center.dy + panOffset.dy);
    canvas.scale(zoom);

    // Build node lookup.
    final nodeMap = {for (final n in nodes) n.id: n};

    // Draw edges.
    final edgePaint = Paint()
      ..color = (isDark ? Colors.white : Colors.black).withValues(alpha: 0.12)
      ..strokeWidth = 1.0
      ..style = PaintingStyle.stroke;

    for (final edge in edges) {
      final a = nodeMap[edge.source];
      final b = nodeMap[edge.target];
      if (a == null || b == null) continue;
      canvas.drawLine(Offset(a.x, a.y), Offset(b.x, b.y), edgePaint);
    }

    // Draw nodes.
    for (final node in nodes) {
      final isSelected = node.id == selectedNodeId;
      final color = _BrainPageState._nodeColor(node.type);
      final opacity = _stateOpacity(node.state);

      final baseRadius = 6.0 + node.strength * 8.0;
      final radius = isSelected
          ? baseRadius + 3 + pulseValue * 2
          : node.state == BrainNodeState.resonating
              ? baseRadius + pulseValue * 2
              : baseRadius;

      // Glow for resonating / selected nodes.
      if (isSelected || node.state == BrainNodeState.resonating) {
        final glowPaint = Paint()
          ..shader = ui.Gradient.radial(
            Offset(node.x, node.y),
            radius * 2.5,
            [
              color.withValues(alpha: 0.3 * opacity),
              color.withValues(alpha: 0.0),
            ],
          );
        canvas.drawCircle(Offset(node.x, node.y), radius * 2.5, glowPaint);
      }

      // Node fill.
      final fillPaint = Paint()
        ..color = color.withValues(alpha: opacity)
        ..style = PaintingStyle.fill;
      canvas.drawCircle(Offset(node.x, node.y), radius, fillPaint);

      // Stroke for fading / consolidating.
      if (node.state == BrainNodeState.fading ||
          node.state == BrainNodeState.consolidating) {
        final strokePaint = Paint()
          ..color = color.withValues(alpha: 0.5)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.5;
        canvas.drawCircle(Offset(node.x, node.y), radius + 1, strokePaint);
      }

      // Label for selected node.
      if (isSelected) {
        final textPainter = TextPainter(
          text: TextSpan(
            text: node.label,
            style: TextStyle(
              fontSize: 10 / zoom,
              color: isDark ? Colors.white : Colors.black87,
              fontWeight: FontWeight.w500,
            ),
          ),
          textDirection: TextDirection.ltr,
        );
        textPainter.layout(maxWidth: 120 / zoom);
        textPainter.paint(
          canvas,
          Offset(
            node.x - textPainter.width / 2,
            node.y + radius + 4,
          ),
        );
      }
    }

    canvas.restore();
  }

  double _stateOpacity(BrainNodeState state) {
    switch (state) {
      case BrainNodeState.fresh:
        return 1.0;
      case BrainNodeState.active:
        return 0.9;
      case BrainNodeState.resonating:
        return 1.0;
      case BrainNodeState.fading:
        return 0.35;
      case BrainNodeState.consolidating:
        return 0.7;
      case BrainNodeState.consolidated:
        return 0.85;
    }
  }

  @override
  bool shouldRepaint(covariant _BrainGraphPainter old) {
    return old.zoom != zoom ||
        old.panOffset != panOffset ||
        old.selectedNodeId != selectedNodeId ||
        old.pulseValue != pulseValue ||
        old.nodes != nodes;
  }
}
