import pg from 'pg';
import { createLogger } from '@sven/shared';
import { applyQuantumFade, type QuantumFadeConfig } from './MemoryStore.js';

const logger = createLogger('brain-visualization');

export interface BrainNode {
  id: string;
  label: string;
  type: 'memory' | 'knowledge' | 'emotion' | 'reasoning';
  /** 0-1 — mapped to brightness/size in the UI */
  strength: number;
  /** Visual state for the UI renderer */
  state: 'fresh' | 'active' | 'resonating' | 'fading' | 'consolidating' | 'consolidated';
  decay_type: string;
  importance: number;
  access_count: number;
  created_at: string;
  metadata: Record<string, unknown>;
}

export interface BrainEdge {
  source: string;
  target: string;
  relation: string;
  weight: number;
}

export interface BrainGraph {
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

function strengthToState(strength: number, consolidationStatus: string | null): BrainNode['state'] {
  if (consolidationStatus === 'consolidated') return 'consolidated';
  if (consolidationStatus === 'pending') return 'consolidating';
  if (strength > 0.8) return 'fresh';
  if (strength > 0.4) return 'active';
  if (strength > 0.15) return 'fading';
  return 'fading';
}

export class BrainVisualizationService {
  constructor(private pool: pg.Pool) {}

  /**
   * Build the full brain graph for a user. Returns nodes (memories, KG entities,
   * emotional states, reasoning records) and edges (KG relations, memory→KG links).
   */
  async getBrainGraph(params: {
    user_id: string;
    organization_id: string;
    include_archived?: boolean;
    qfConfig?: QuantumFadeConfig;
  }): Promise<BrainGraph> {
    const userId = params.user_id;
    const orgId = params.organization_id;

    // Parallel fetch all data sources
    const [memoriesRes, kgEntitiesRes, kgRelationsRes, emotionalRes, reasoningRes] = await Promise.all([
      this.pool.query(
        `SELECT id, key, value, importance, access_count, created_at, updated_at,
                decay_type, gamma, amplitude, omega, phase_offset,
                resonance_boost_count, consolidation_status, consolidated_kg_node_id
         FROM memories
         WHERE (user_id = $1 OR user_id IS NULL)
           AND (organization_id IS NOT DISTINCT FROM $2)
           AND ($3::boolean OR archived_at IS NULL)
         ORDER BY created_at DESC
         LIMIT 500`,
        [userId, orgId, params.include_archived ?? false],
      ),
      this.pool.query(
        `SELECT id, type, name, description, confidence
         FROM kg_entities
         WHERE created_by = $1
         ORDER BY confidence DESC
         LIMIT 200`,
        [userId],
      ).catch(() => ({ rows: [] })),
      this.pool.query(
        `SELECT r.source_entity_id, r.target_entity_id, r.relation_type, r.confidence
         FROM kg_relations r
         WHERE r.created_by = $1
         ORDER BY r.confidence DESC
         LIMIT 500`,
        [userId],
      ).catch(() => ({ rows: [] })),
      this.pool.query(
        `SELECT COUNT(*)::int AS total
         FROM emotional_states
         WHERE user_id = $1 AND organization_id = $2`,
        [userId, orgId],
      ).catch(() => ({ rows: [{ total: 0 }] })),
      this.pool.query(
        `SELECT id, topic, user_choice, reasoning, created_at
         FROM user_reasoning
         WHERE user_id = $1 AND organization_id = $2
         ORDER BY created_at DESC
         LIMIT 50`,
        [userId, orgId],
      ).catch(() => ({ rows: [] })),
    ]);

    const nodes: BrainNode[] = [];
    const edges: BrainEdge[] = [];
    let activeCount = 0;
    let fadingCount = 0;
    let consolidatedCount = 0;

    // Build memory nodes with live decay calculation
    const qf = params.qfConfig;
    for (const m of memoriesRes.rows as any[]) {
      const daysSinceCreation = Math.max(0, (Date.now() - new Date(m.created_at).getTime()) / 86400000);
      let strength = 1.0;

      if (m.decay_type === 'quantum_fade' && qf) {
        strength = applyQuantumFade(
          1.0,
          daysSinceCreation,
          Number(m.gamma) || qf.gamma_base,
          Number(m.amplitude) || qf.amplitude,
          Number(m.omega) || qf.omega,
          Number(m.phase_offset) || 0,
          Number(m.resonance_boost_count) || 0,
          qf.resonance_factor,
        );
      } else {
        // Exponential decay fallback
        strength = Math.exp(-0.05 * daysSinceCreation);
      }

      const state = strengthToState(strength, m.consolidation_status);
      if (state === 'consolidated') consolidatedCount++;
      else if (state === 'fading' || state === 'consolidating') fadingCount++;
      else activeCount++;

      nodes.push({
        id: m.id,
        label: String(m.key || '').slice(0, 100),
        type: 'memory',
        strength,
        state,
        decay_type: m.decay_type || 'exponential',
        importance: Number(m.importance || 1),
        access_count: Number(m.access_count || 0),
        created_at: m.created_at,
        metadata: {
          value_preview: String(m.value || '').slice(0, 200),
        },
      });

      // Edge: memory → consolidated KG node
      if (m.consolidated_kg_node_id) {
        edges.push({
          source: m.id,
          target: m.consolidated_kg_node_id,
          relation: 'consolidated_to',
          weight: 1.0,
        });
      }
    }

    // Build KG entity nodes
    for (const e of kgEntitiesRes.rows as any[]) {
      nodes.push({
        id: e.id,
        label: String(e.name || '').slice(0, 100),
        type: 'knowledge',
        strength: Number(e.confidence || 0.5),
        state: 'consolidated',
        decay_type: 'none',
        importance: Number(e.confidence || 0.5) * 5,
        access_count: 0,
        created_at: '',
        metadata: {
          entity_type: e.type,
          description: String(e.description || '').slice(0, 200),
        },
      });
    }

    // Build KG relation edges
    for (const r of kgRelationsRes.rows as any[]) {
      edges.push({
        source: r.source_entity_id,
        target: r.target_entity_id,
        relation: r.relation_type,
        weight: Number(r.confidence || 0.5),
      });
    }

    // Build reasoning nodes
    for (const r of reasoningRes.rows as any[]) {
      nodes.push({
        id: r.id,
        label: String(r.topic || '').slice(0, 100),
        type: 'reasoning',
        strength: 0.8,
        state: 'active',
        decay_type: 'none',
        importance: 2,
        access_count: 0,
        created_at: r.created_at,
        metadata: {
          user_choice: String(r.user_choice || '').slice(0, 200),
          reasoning: String(r.reasoning || '').slice(0, 200),
        },
      });
    }

    return {
      nodes,
      edges,
      stats: {
        total_memories: memoriesRes.rows.length,
        active_memories: activeCount,
        fading_memories: fadingCount,
        consolidated: consolidatedCount,
        kg_entities: kgEntitiesRes.rows.length,
        emotional_samples: Number((emotionalRes.rows[0] as any)?.total || 0),
      },
    };
  }

  /**
   * Get a single memory's decay trajectory over time for visualization.
   * Returns an array of (day, strength) points for charting.
   */
  getDecayTrajectory(params: {
    gamma: number;
    amplitude: number;
    omega: number;
    phase_offset: number;
    resonance_boost_count: number;
    resonance_factor: number;
    days: number;
  }): Array<{ day: number; strength: number }> {
    const points: Array<{ day: number; strength: number }> = [];
    const totalDays = Math.max(1, Math.min(365, params.days));
    const step = totalDays <= 30 ? 0.5 : 1;

    for (let day = 0; day <= totalDays; day += step) {
      const strength = applyQuantumFade(
        1.0,
        day,
        params.gamma,
        params.amplitude,
        params.omega,
        params.phase_offset,
        params.resonance_boost_count,
        params.resonance_factor,
      );
      points.push({ day: Math.round(day * 10) / 10, strength: Math.round(strength * 1000) / 1000 });
    }

    return points;
  }
}
