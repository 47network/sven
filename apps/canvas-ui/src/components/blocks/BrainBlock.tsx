'use client';

import { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { Brain, ZoomIn, ZoomOut, Maximize2, Filter } from 'lucide-react';

/**
 * 2.5 Brain Visualization — Canvas UI
 * Force-directed graph rendering of Sven's cognitive map.
 * Node types: memory, knowledge, emotion, reasoning
 * States: fresh, active, resonating, fading, consolidating, consolidated
 * Pure inline SVG — no external graph libraries.
 */

interface BrainNode {
  id: string;
  label: string;
  type: 'memory' | 'knowledge' | 'emotion' | 'reasoning';
  strength: number;
  state: 'fresh' | 'active' | 'resonating' | 'fading' | 'consolidating' | 'consolidated';
  importance: number;
  access_count: number;
}

interface BrainEdge {
  source: string;
  target: string;
  relation: string;
  weight: number;
}

interface BrainGraph {
  nodes: BrainNode[];
  edges: BrainEdge[];
  stats: {
    total_memories: number;
    active_memories: number;
    fading_memories: number;
    consolidated: number;
    kg_entities: number;
    emotional_samples: number;
  };
}

interface BrainBlockProps {
  content: BrainGraph | string;
  metadata?: Record<string, unknown>;
}

/** Map node type → fill color */
const TYPE_COLORS: Record<string, string> = {
  memory: '#3b82f6',     // blue
  knowledge: '#10b981',  // emerald
  emotion: '#f59e0b',    // amber
  reasoning: '#8b5cf6',  // violet
};

/** Map state → opacity multiplier */
const STATE_OPACITY: Record<string, number> = {
  fresh: 1.0,
  active: 0.9,
  resonating: 1.0,
  fading: 0.35,
  consolidating: 0.7,
  consolidated: 0.85,
};

/** Map state → stroke dash */
const STATE_STROKE: Record<string, string> = {
  fresh: 'none',
  active: 'none',
  resonating: '3 1',
  fading: '2 3',
  consolidating: '4 2',
  consolidated: 'none',
};

interface SimNode extends BrainNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

function parseGraph(content: BrainBlockProps['content']): BrainGraph | null {
  if (typeof content === 'string') {
    try { return JSON.parse(content); } catch { return null; }
  }
  if (content && typeof content === 'object' && Array.isArray((content as BrainGraph).nodes)) {
    return content as BrainGraph;
  }
  return null;
}

/** Simple force-directed layout (runs a fixed number of iterations) */
function layoutGraph(nodes: BrainNode[], edges: BrainEdge[], width: number, height: number): SimNode[] {
  const cx = width / 2;
  const cy = height / 2;

  const simNodes: SimNode[] = nodes.map((n, i) => ({
    ...n,
    x: cx + (Math.cos((i / nodes.length) * Math.PI * 2) * Math.min(width, height) * 0.35),
    y: cy + (Math.sin((i / nodes.length) * Math.PI * 2) * Math.min(width, height) * 0.35),
    vx: 0,
    vy: 0,
  }));

  const nodeMap = new Map(simNodes.map((n) => [n.id, n]));
  const iterations = 80;
  const repulsion = 800;
  const attraction = 0.004;
  const damping = 0.92;
  const centerPull = 0.002;

  for (let iter = 0; iter < iterations; iter++) {
    const alpha = 1 - iter / iterations;

    // Repulsion between all pairs
    for (let i = 0; i < simNodes.length; i++) {
      for (let j = i + 1; j < simNodes.length; j++) {
        const a = simNodes[i];
        const b = simNodes[j];
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (repulsion * alpha) / (dist * dist);
        dx = (dx / dist) * force;
        dy = (dy / dist) * force;
        a.vx += dx;
        a.vy += dy;
        b.vx -= dx;
        b.vy -= dy;
      }
    }

    // Attraction along edges
    for (const edge of edges) {
      const a = nodeMap.get(edge.source);
      const b = nodeMap.get(edge.target);
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const force = attraction * alpha * (edge.weight || 1);
      a.vx += dx * force;
      a.vy += dy * force;
      b.vx -= dx * force;
      b.vy -= dy * force;
    }

    // Center pull
    for (const n of simNodes) {
      n.vx += (cx - n.x) * centerPull * alpha;
      n.vy += (cy - n.y) * centerPull * alpha;
    }

    // Apply velocities with damping
    for (const n of simNodes) {
      n.vx *= damping;
      n.vy *= damping;
      n.x += n.vx;
      n.y += n.vy;
      // Clamp to bounds
      n.x = Math.max(20, Math.min(width - 20, n.x));
      n.y = Math.max(20, Math.min(height - 20, n.y));
    }
  }

  return simNodes;
}

export function BrainBlock({ content }: BrainBlockProps) {
  const graph = useMemo(() => parseGraph(content), [content]);
  const svgRef = useRef<SVGSVGElement>(null);
  const [zoom, setZoom] = useState(1);
  const [filterType, setFilterType] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [dimensions] = useState({ width: 800, height: 500 });

  const handleZoomIn = useCallback(() => setZoom((z) => Math.min(z + 0.2, 3)), []);
  const handleZoomOut = useCallback(() => setZoom((z) => Math.max(z - 0.2, 0.3)), []);
  const handleReset = useCallback(() => { setZoom(1); setFilterType(null); }, []);

  const filteredNodes = useMemo(() => {
    if (!graph) return [];
    return filterType ? graph.nodes.filter((n) => n.type === filterType) : graph.nodes;
  }, [graph, filterType]);

  const filteredNodeIds = useMemo(() => new Set(filteredNodes.map((n) => n.id)), [filteredNodes]);

  const filteredEdges = useMemo(() => {
    if (!graph) return [];
    return graph.edges.filter((e) => filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target));
  }, [graph, filteredNodeIds]);

  const simNodes = useMemo(
    () => layoutGraph(filteredNodes, filteredEdges, dimensions.width, dimensions.height),
    [filteredNodes, filteredEdges, dimensions],
  );

  const nodeMap = useMemo(() => new Map(simNodes.map((n) => [n.id, n])), [simNodes]);

  // Keyboard zoom
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '+' || e.key === '=') handleZoomIn();
      if (e.key === '-') handleZoomOut();
    };
    const svg = svgRef.current;
    svg?.addEventListener('keydown', handler as EventListener);
    return () => svg?.removeEventListener('keydown', handler as EventListener);
  }, [handleZoomIn, handleZoomOut]);

  if (!graph || !graph.nodes?.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-[var(--border)] p-8 text-center">
        <Brain className="mb-2 h-8 w-8 text-[var(--fg-muted)]" />
        <p className="text-sm text-[var(--fg-muted)]">No brain data available</p>
      </div>
    );
  }

  const { stats } = graph;

  return (
    <div className="rounded-lg border border-[var(--border)] overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-2">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-[var(--accent)]" />
          <span className="text-sm font-medium">Brain Map</span>
          <span className="text-xs text-[var(--fg-muted)]">
            {filteredNodes.length} nodes · {filteredEdges.length} connections
          </span>
        </div>
        <div className="flex items-center gap-1">
          {/* Type filters */}
          {(['memory', 'knowledge', 'emotion', 'reasoning'] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setFilterType(filterType === type ? null : type)}
              className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
                filterType === type
                  ? 'text-white'
                  : 'text-[var(--fg-muted)] hover:bg-[var(--bg-hover)]'
              }`}
              style={filterType === type ? { backgroundColor: TYPE_COLORS[type] } : undefined}
              title={`Filter: ${type}`}
            >
              {type}
            </button>
          ))}
          <div className="mx-1 h-4 w-px bg-[var(--border)]" />
          <button type="button" onClick={handleZoomOut} className="rounded p-1 hover:bg-[var(--bg-hover)]" title="Zoom out">
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <span className="text-[10px] text-[var(--fg-muted)] min-w-[2.5rem] text-center">{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={handleZoomIn} className="rounded p-1 hover:bg-[var(--bg-hover)]" title="Zoom in">
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={handleReset} className="rounded p-1 hover:bg-[var(--bg-hover)]" title="Reset view">
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Graph */}
      <div className="relative overflow-hidden bg-slate-950" style={{ height: dimensions.height }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
          className="w-full h-full"
          style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
          tabIndex={0}
          role="img"
          aria-label="Brain visualization graph showing memory nodes and connections"
        >
          <defs>
            <radialGradient id="brain-glow-memory" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="brain-glow-knowledge" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="brain-glow-emotion" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="brain-glow-reasoning" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Edges */}
          {filteredEdges.map((edge, i) => {
            const a = nodeMap.get(edge.source);
            const b = nodeMap.get(edge.target);
            if (!a || !b) return null;
            const isHighlighted = hoveredNode === edge.source || hoveredNode === edge.target;
            return (
              <line
                key={`edge-${i}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={isHighlighted ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.1)'}
                strokeWidth={Math.max(0.5, edge.weight * 2)}
                strokeDasharray={isHighlighted ? 'none' : undefined}
              />
            );
          })}

          {/* Nodes */}
          {simNodes.map((node) => {
            const radius = 4 + node.strength * 8 + (node.importance || 0) * 3;
            const color = TYPE_COLORS[node.type] || '#6b7280';
            const opacity = STATE_OPACITY[node.state] || 0.6;
            const dashArray = STATE_STROKE[node.state] || 'none';
            const isHovered = hoveredNode === node.id;
            const glowRadius = radius * 3;

            return (
              <g
                key={node.id}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                style={{ cursor: 'pointer' }}
              >
                {/* Glow for resonating or hovered */}
                {(node.state === 'resonating' || isHovered) && (
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={glowRadius}
                    fill={`url(#brain-glow-${node.type})`}
                    opacity={0.5}
                  />
                )}
                {/* Main circle */}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={isHovered ? radius * 1.3 : radius}
                  fill={color}
                  fillOpacity={opacity}
                  stroke={color}
                  strokeWidth={isHovered ? 2 : 1}
                  strokeOpacity={opacity * 0.8}
                  strokeDasharray={dashArray}
                />
                {/* Label on hover */}
                {isHovered && (
                  <>
                    <rect
                      x={node.x - 50}
                      y={node.y - radius - 22}
                      width={100}
                      height={18}
                      rx={4}
                      fill="rgba(0,0,0,0.8)"
                    />
                    <text
                      x={node.x}
                      y={node.y - radius - 10}
                      textAnchor="middle"
                      fill="white"
                      fontSize={10}
                      fontFamily="system-ui, sans-serif"
                    >
                      {node.label.length > 16 ? `${node.label.slice(0, 14)}...` : node.label}
                    </text>
                  </>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Stats bar */}
      <div className="flex flex-wrap items-center gap-4 border-t border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-2 text-[11px]">
        <div className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: TYPE_COLORS.memory }} />
          <span className="text-[var(--fg-muted)]">Memories</span>
          <span className="font-medium">{stats.total_memories}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: TYPE_COLORS.knowledge }} />
          <span className="text-[var(--fg-muted)]">Knowledge</span>
          <span className="font-medium">{stats.kg_entities}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: TYPE_COLORS.emotion }} />
          <span className="text-[var(--fg-muted)]">Emotions</span>
          <span className="font-medium">{stats.emotional_samples}</span>
        </div>
        <div className="flex items-center gap-1 ml-auto text-[var(--fg-muted)]">
          <span>Active: {stats.active_memories}</span>
          <span className="mx-1">·</span>
          <span>Fading: {stats.fading_memories}</span>
          <span className="mx-1">·</span>
          <span>Consolidated: {stats.consolidated}</span>
        </div>
      </div>
    </div>
  );
}
