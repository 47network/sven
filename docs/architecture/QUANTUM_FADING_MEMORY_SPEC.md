# Quantum-Inspired Fading Memory Specification

> Memory management system inspired by quantum reservoir computing.
> Uses noise as a feature, not a bug. Recent data clear, old data fades like an echo.
> Part of Batch 2 of the Sven Evolution Roadmap.
> Created: 2026-04-08

---

## 1. Inspiration

The University of Science and Technology of China (USTC) in Hefei built a quantum AI
using just 9 atoms that outperforms classical AI at weather prediction. The key insight:

**Learning to forget.**

Quantum computing is noisy — environmental disturbances usually destroy calculations.
But for time-series tasks, this noise is a feature:
- You need to remember recent data clearly
- You need to gradually forget old data
- You don't want the system to overload
- But you also don't want to forget too fast and lose important context

Quantum noise creates a **fading memory effect** — the system loses information in a
smooth, predictable way. Like an echo: your voice slowly reverberates into oblivion,
but before it's gone, the important signal can be captured.

**Instead of fighting the mind-bending dynamics of quantum physics, you extract value
from them.**

---

## 2. Current Sven Memory System

Sven already has temporal decay curves in `gateway-api/routes/admin/memory.ts`:

| Decay Type | Behavior | Use Case |
|-----------|----------|----------|
| `linear` | `strength -= constant * time` | Simple, predictable fade |
| `exponential` | `strength *= e^(-λ*time)` | Fast initial fade, slow long-term |
| `step` | Full strength → zero at threshold | All-or-nothing expiry |

Plus: knowledge graph (entity/relation extraction), RAG (BM25 + pgvector),
session indexing, delayed recall, deduplication.

---

## 3. Quantum Fade — The New Decay Type

### 3.1 Formula

```
decay(t) = e^(-γt) × (1 + A × sin(ωt + φ))
```

Where:
- **t** = time since memory creation (normalized)
- **γ** = fade rate (gamma). Lower = slower fade. Adjusted by importance weight
- **A** = oscillation amplitude. How strong the resonance echoes are (0 < A < 1)
- **ω** = oscillation frequency. How often memories "resonate" back
- **φ** = phase offset. Prevents all memories from resonating at the same time

### 3.2 Behavior

```
Strength
  1.0 │●
      │ ●
  0.8 │  ● ╭─╮
      │   ●╯  ╰╮   ← resonance echo (memory temporarily strengthens)
  0.6 │        ╰╮
      │         ╰╮ ╭─╮
  0.4 │          ╰╯  ╰╮  ← smaller echo
      │               ╰╮
  0.2 │                ╰──── ← approaching consolidation threshold
      │  - - - - - - - - - - threshold
  0.0 │                      ╰── memory consolidated → knowledge graph
      └───────────────────────── Time
```

Key properties:
1. **Recent memories are perfectly clear** (strength ≈ 1.0)
2. **Old memories fade smoothly** (exponential envelope)
3. **Memories occasionally resonate** (oscillation brings them back temporarily)
4. **Resonance diminishes over time** (echoes get smaller)
5. **At threshold, consolidation fires** (extract insight before total fade)

### 3.3 Importance-Weighted Persistence

Memories that get referenced more often — like an echo hitting a wall and bouncing
back stronger — resist decay:

```
γ_effective = γ_base × (1 / (1 + reference_count × resonance_factor))
```

- Memory referenced once: γ = γ_base (normal fade rate)
- Memory referenced 5 times: γ ≈ γ_base × 0.5 (fades at half speed)
- Memory referenced 20+ times: γ ≈ γ_base × 0.1 (nearly permanent)

This is the "measured quantum state" metaphor: observing (referencing) a memory
collapses it into a stronger, more persistent signal.

---

## 4. Memory Consolidation Pipeline

When `decay(t) < threshold`, the consolidation pipeline activates:

```
Memory approaching threshold
        │
        ▼
┌───────────────────┐
│  Consolidation    │
│  Pipeline         │
│                   │
│  1. Extract core  │
│     insight       │
│  2. Identify      │
│     patterns      │
│  3. Create KG     │
│     node          │
│  4. Link to       │
│     related nodes │
│  5. Delete        │
│     original      │
│     memory        │
└───────────────────┘
        │
        ▼
Knowledge Graph Node
(permanent, high confidence)
```

### Example

**Original memory** (fading):
```
"User prefers Rust for CLIs because of air-gapped deployment requirements.
 They mentioned this in context of choosing between Rust and Go on 2026-03-15.
 Referenced 3 times since."
```

**Consolidated knowledge graph node** (permanent):
```
{
  entity: "user_preference",
  relation: "prefers_for",
  target: "Rust → CLI tools",
  reason: "air-gapped deployment (static binary, no runtime dependency)",
  confidence: 0.92,
  source_memories: 3,
  created: "2026-04-08",
  type: "consolidation"
}
```

The full conversational context fades, but the core insight lives on in the knowledge
graph. The echo is captured before it reverberates into oblivion.

---

## 5. Configuration

### 5.1 Default Parameters

```json
{
  "decay_type": "quantum_fade",
  "gamma_base": 0.05,
  "amplitude": 0.3,
  "omega": 0.5,
  "phase_offset": "random",
  "consolidation_threshold": 0.15,
  "resonance_factor": 0.2,
  "consolidation_interval_hours": 6,
  "max_memory_budget_mb": 512
}
```

### 5.2 Admin Controls

| Parameter | Default | Description |
|-----------|---------|-------------|
| `gamma_base` | 0.05 | Base fade rate. Lower = memories last longer |
| `amplitude` | 0.3 | Resonance strength. Higher = more pronounced echoes |
| `omega` | 0.5 | Resonance frequency. Higher = more frequent oscillations |
| `consolidation_threshold` | 0.15 | Below this, consolidation fires |
| `resonance_factor` | 0.2 | How much each reference slows decay |
| `consolidation_interval_hours` | 6 | How often the consolidation pipeline runs |
| `max_memory_budget_mb` | 512 | Maximum memory storage before forced consolidation |

---

## 6. Brain Visualization

### 6.1 Rendering Memory Decay

The brain visualization maps decay state to visual properties:

| Memory State | Visual Representation |
|-------------|----------------------|
| Fresh (> 0.8) | Bright, large node, fully colored |
| Active (0.4 - 0.8) | Medium brightness, standard size |
| Resonating (oscillation peak) | Brief glow/pulse animation |
| Fading (0.15 - 0.4) | Dim, smaller, desaturated |
| Consolidating (at threshold) | Animate: memory → knowledge graph node |
| Consolidated (KG node) | Different shape (diamond vs circle), permanent |

### 6.2 User Experience

The user sees their "brain" — a visual neural map where:
- **Bright neurons** = recent, active memories
- **Pulsing neurons** = memories resonating (being re-activated by context)
- **Dim neurons** = fading memories approaching consolidation
- **Diamond nodes** = consolidated knowledge (permanent insights)
- **Connecting lines** = relationships between memories/knowledge
- **Line thickness** = relationship strength
- **Colors** = memory type (conversation, fact, reasoning, emotion)

The user can:
- Tap any node to see the full memory/knowledge entry
- Watch memories fade and consolidate in real-time
- See which memories are currently influencing Sven's responses
- Explore "What has Sven learned about me?" interactively

---

## 7. Integration with Gemma 4 On-Device

When running locally (Batch 6), quantum-fade decay runs on-device:
- SQLite/Drift stores memories with decay parameters
- Local background job performs consolidation
- Knowledge graph stored locally using SQLite FTS5 + relations table
- Brain visualization renders from local data (no cloud needed)
- When reconnected, local memory syncs with server
- Conflict resolution: server has authority, local has recency

---

## 8. Research References

- **Quantum Reservoir Computing**: USTC Hefei, 2026. 9-atom quantum system for weather
  prediction. Key insight: quantum noise as fading memory management.
- **Echo State Networks**: H. Jaeger, 2001. Classical reservoir computing with
  recurrent neural networks. Inspiration for the echo/resonance metaphor.
- **Temporal Memory Models**: Complementary Learning Systems theory (McClelland et al.).
  Fast learning + slow consolidation — exactly what the quantum-fade + consolidation
  pipeline implements.
