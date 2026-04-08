# Sven Evolution Roadmap

> Master plan for Sven's next-generation features.
> 6 Batches, 70+ tasks, strict dependency ordering.
> Created: 2026-04-08

---

## Dependency Graph

```
Batch 1 (Community 8/8) ──┬──→ Batch 3 (Community Agents)
                           │
Batch 2 (Memory + EQ) ────┼──→ Batch 4 (Calibrated Intelligence)
                           │
                           └──→ Batch 5 (Federation + Homeserver)
                                        │
                                        └──→ Batch 6 (Gemma 4 On-Device)
```

- **Batches 1 & 2 run in parallel** (no mutual dependency).
- Batch 3 requires Batch 1 (community must be live for agents to inhabit).
- Batch 4 requires Batch 2 (memory + EQ must exist for calibration to work).
- Batch 5 requires Batches 1 + 2 (federation needs both community and memory).
- Batch 6 requires Batch 5 (on-device needs federation for community bridge).

---

## Batch 1: Community Completion (3/8 → 8/8)

**Goal:** Bring community readiness from 3/8 to 8/8. Everything else depends on this.

| # | Task | Details | Status |
|---|------|---------|--------|
| 1.1 | Configure Documentation URL | Set `SVEN_COMMUNITY_DOCS_URL` → `https://sven.systems/docs` | [x] |
| 1.2 | Configure Discord URL | Discord server already exists, bot deployed on VM7 via `adapter-discord`. Set `SVEN_COMMUNITY_DISCORD_URL` env var | [x] |
| 1.3 | Configure GitHub Discussions URL | Enable GitHub Discussions on `47network/thesven` repo, set `SVEN_COMMUNITY_GITHUB_DISCUSSIONS_URL` | [x] |
| 1.4 | Configure Marketplace URL | Create marketplace page on suite site, set `SVEN_COMMUNITY_MARKETPLACE_URL` | [x] |
| 1.5 | Configure Verified Persona Provider | Set up SSO-backed persona verification (OIDC provider), set `SVEN_COMMUNITY_PERSONA_PROVIDER` + `SVEN_COMMUNITY_ACCESS_MODE=verified_persona_only` | [x] |
| 1.6 | Seed Persona Allowlist | Populate initial allowlist: admin accounts, bot accounts, first community members. Set `SVEN_COMMUNITY_PERSONA_ALLOWLIST` | [x] |
| 1.7 | Enable Strict Moderation | Set `SVEN_COMMUNITY_MODERATION_MODE=strict` + `SVEN_COMMUNITY_AGENT_POST_POLICY=reviewed_only` | [x] |
| 1.8 | Security Baseline Sign-off | Review community attack surface, document review, set `SVEN_COMMUNITY_SECURITY_BASELINE_SIGNED=true` | [x] |
| 1.9 | Deploy & Verify 8/8 | Run `scripts/community-ecosystem-readiness-check.cjs`, confirm all 8 checks green | [x] |

---

## Batch 2: Memory Evolution + Emotional Intelligence + Brain Visualization

**Goal:** Evolve existing memory system (temporal decay, knowledge graph) into a quantum-inspired
fading memory with emotional intelligence. Build a visual "brain map" for users.

### Quantum Fading Memory

| # | Task | Details | Status |
|---|------|---------|--------|
| 2.1 | Quantum-inspired fading decay curve | Add `quantum_fade` decay type: `decay(t) = e^(-γt) × (1 + A × sin(ωt + φ))`. Smooth predictive information loss with resonance oscillations. Recent data clear, old data fades like an echo. Noise becomes the memory management system. Inspired by Chinese quantum reservoir computing (9-atom weather predictor) | [x] |
| 2.2 | Importance-weighted persistence | Memories referenced more often resist decay (lower γ). Echoed memories get "resonance boost" — like quantum state measured and collapsed into stronger signal | [x] |
| 2.3 | Memory consolidation pipeline | Background job sweeps fading memories, extracts key insights before they fully decay, promotes them to long-term knowledge graph nodes. The echo is captured before it reverberates into oblivion | [x] |

### Brain Visualization

| # | Task | Details | Status |
|---|------|---------|--------|
| 2.4 | Brain visualization API | New endpoint returning user's memory/knowledge graph as structured graph data. Nodes = entities/memories, edges = relations, weights = confidence/recency/decay | [x] |
| 2.5 | Brain visualization UI — Canvas | Interactive 3D/2D brain map in Canvas UI. Memories as neurons, connections as synapses, fading intensity as brightness. User sees real mapping of their brain/decisions | [ ] |
| 2.6 | Brain visualization UI — Flutter | Same brain map adapted for mobile. Touch-navigable, pinch-zoom, tap for memory details | [ ] |
| 2.7 | Memory decay admin controls | Admin settings: half-life, resonance threshold, consolidation frequency, max context window budget | [x] |
| 2.8 | Memory consent layer | GDPR Article 15-17 compliance. User can see, export, delete, control what Sven remembers. "Forget me" button triggers full memory wipe | [x] |

### Emotional Intelligence

| # | Task | Details | Status |
|---|------|---------|--------|
| 2.9 | Emotional intelligence engine | Detect mood, sentiment, frustration, excitement, confusion from text. Adapt Sven's tone and behavior accordingly. Not just "what the user said" but "how the user feels" | [x] |
| 2.10 | User reasoning capture | When a user proposes a better idea than Sven's suggestion, Sven asks "Why did you choose this? What made you think of that?" — to understand human reasoning patterns | [x] |
| 2.11 | Human understanding loop | Learn WHY users think the way they do, not just WHAT they want. Build a model of each user's decision-making patterns, preferences, expertise areas. So we can understand the human behind the messages | [x] |

### Quantum Fading Memory — Technical Detail

```
decay(t) = e^(-γt) × (1 + A × sin(ωt + φ))
```

Where:
- `e^(-γt)` = smooth exponential fade (the echo dying)
- `A × sin(ωt + φ)` = controlled oscillation (quantum noise). Memories don't monotonically
  decay — they occasionally "resonate" (like an echo bouncing off walls), temporarily
  becoming stronger before continuing to fade
- **Importance-weighted**: frequently referenced memories have lower γ (slower fade)
- **Consolidation trigger**: when `decay(t) < threshold`, the consolidation pipeline
  extracts the core insight and promotes it to a knowledge graph node before the
  memory fully fades

This means: recent data perfectly clear, old data fades smoothly, system never overloads,
and truly important patterns get captured before they're lost.

**Origin**: Inspired by the Chinese quantum reservoir computer at USTC Hefei — a 9-atom
quantum system that predicts weather by using quantum noise as a fading memory management
system instead of fighting it.

---

## Batch 3: Community Agents + Transparency

**Goal:** Intelligent AI agents that inhabit the Sven community as participants.
Agent-to-agent AND agent-to-human conversations. Transparency as default.

### Agent Personas

| # | Task | Details | Status |
|---|------|---------|--------|
| 3.1 | Agent persona identity system | Extend verified-persona with `is_agent: true` flag. Agents get community accounts with clear labeling — never pretending to be human | [x] |
| 3.2 | Guide Agent | Greets newcomers, walks through features, answers FAQs from knowledge graph. First point of contact | [ ] |
| 3.3 | Inspector Agent | Continuously tests Sven capabilities, posts capability reports to community feed | [ ] |
| 3.4 | Curator Agent | Highlights interesting conversations, surfaces patterns from observation (watch before speak) | [ ] |
| 3.5 | Advocate Agent | Explains roadmap items, gathers user feedback, surfaces feature requests to admin | [ ] |
| 3.6 | QA Agent | Files community-visible bug reports from automated testing. Transparent quality assurance | [ ] |
| 3.7 | Librarian Agent | Indexes community knowledge, links related discussions, builds the living wiki | [ ] |
| 3.8 | **Feature Tester Agent** | Actively tries ALL Sven features and usecases end-to-end. Creates test scenarios, runs them, reports results. Dedicated test VM for safe experimentation | [ ] |
| 3.9 | **Feature Imagination Agent** | Friend/helper that invents new usecases, creates scenarios, imagines what Sven could do that nobody has tried yet. Tests its ideas on the dedicated VM. Creative innovation engine | [ ] |

### Infrastructure

| # | Task | Details | Status |
|---|------|---------|--------|
| 3.10 | Agent-to-agent protocol | Agents can mention, reply-to, and delegate to each other via NATS subject routing. Topic-based threaded conversations | [x] |
| 3.11 | Agent rate limiting & cadence | Per-agent posting frequency limits. Natural-feeling intervals to prevent flooding | [x] |
| 3.12 | Transparency changelog | Sven writes own public changelog in first person: "Today I learned to handle..." Community agents are the authors of this story | [x] |
| 3.13 | **Smart Agent Moderator** | AI agent that intelligently filters ALL agent posts. Simple/safe posts → auto-published. Shady/risky/uncertain posts → flagged for admin review with explanation. Not just reviewed_only but intelligent content triage with risk scoring | [x] |
| 3.14 | Dedicated agent test VM | Isolated environment where Feature Tester + Imagination agents can safely experiment without affecting production. Full Sven stack in sandbox mode | [ ] |

---

## Batch 4: Calibrated Intelligence + Self-Improvement

**Goal:** Make Sven honest about uncertainty, and make him learn from mistakes — with verification.

| # | Task | Details | Status |
|---|------|---------|--------|
| 4.1 | Confidence scoring system | Every response includes internal confidence score (0-1). Based on: RAG chunk relevance, memory recency, model uncertainty signals, tool call success history | [x] |
| 4.2 | Uncertainty disclosure | When confidence below threshold, Sven explicitly says so: "I'm not confident about this — here's what I found, but you should verify" | [x] |
| 4.3 | Feedback loop → routing improvement | Existing thumbs up/down feeds into routing table: which models/skills/approaches work best for which task types. Not fine-tuning — retrieval + routing intelligence | [x] |
| 4.4 | Correction pipeline with validation | When user corrects Sven, **verify the user is right first** before accepting. Methods: cross-reference knowledge graph, web search, ask clarifying questions, check against other corrections for same topic. Only THEN promote to high-confidence memory | [x] |
| 4.5 | Correction verification methods | Multi-strategy validation: (a) knowledge graph cross-reference, (b) web search for authoritative sources, (c) ask user for reasoning/source, (d) check if other users gave conflicting corrections, (e) time-bounded — old corrections re-evaluated against new data | [x] |
| 4.6 | Pattern observation system | Before agents speak, they observe: track repeated questions, common struggles, unexpected workflows. Build understanding before participating | [x] |
| 4.7 | Self-improvement metrics dashboard | Dashboard: correction rate over time, confidence calibration curve, most-corrected topics, memory utilization, human understanding score | [x] |

---

## Batch 5: Federation + Homeserver Model

**Goal:** Sven-to-Sven communication. Users connect apps directly to their Sven instance
like Element → Matrix homeserver. Distributed intelligence with privacy controls.

| # | Task | Details | Status |
|---|------|---------|--------|
| 5.1 | Instance identity | Each Sven instance gets unique Ed25519 keypair for signing messages across instances | [ ] |
| 5.2 | Instance discovery | NATS leaf-node mesh extended with Sven metadata: capabilities, public topics, health. DNS-SD or `.well-known` for public discovery | [ ] |
| 5.3 | Homeserver model | Users connect companion apps directly to their Sven instance. The Sven instance IS the server — like Element → Matrix homeserver. No third-party dependency | [ ] |
| 5.4 | Cross-instance community | Public community topics federated: posts from one instance visible on another (opt-in). Like Matrix rooms spanning homeservers | [ ] |
| 5.5 | Cross-instance agent delegation | One user's Sven agent can consult another user's Sven agent (with permission) to solve problems neither could alone. Distributed intelligence | [ ] |
| 5.6 | Community consent toggles | Per-user setting: OFF (local only) / READ-ONLY (consume community, don't post) / CONTRIBUTE (full participation). **Default: OFF.** GDPR Article 7 compliant | [ ] |
| 5.7 | Data sovereignty controls | User controls where data lives. Instance admin controls federation scope. No data leaves instance without explicit consent | [ ] |
| 5.8 | Instance health & monitoring | Federated health checks. Automatic graceful degradation if peer goes offline | [ ] |

---

## Batch 6: Gemma 4 On-Device

**Goal:** AI that lives with the user, not just in the cloud. Complete offline capability.
Every Sven installation becomes intelligent on its own.

See: [GEMMA4_INTEGRATION_SPEC.md](./GEMMA4_INTEGRATION_SPEC.md) for full technical specification.

### Core Integration

| # | Task | Details | Status |
|---|------|---------|--------|
| 6.1 | Model selection | E2B (effective 2B) for Flutter mobile, E4B (effective 4B) for Tauri desktop. 26B MoE / 31B Dense for server-side. All Apache 2.0 | [ ] |
| 6.2 | Flutter on-device inference | Google AI Edge SDK / LiteRT-LM integration. 128K context window. Audio + vision native | [ ] |
| 6.3 | Tauri on-device inference | llama.cpp Rust bindings or local Ollama sidecar. 128K context. Multimodal | [ ] |
| 6.4 | Local ↔ Cloud smart routing | Simple tasks → local. Complex tasks → cloud. Offline → local handles everything. Seamless fallback | [ ] |
| 6.5 | On-device memory | Local SQLite/Drift memory store, quantum-fade decay runs locally, syncs with server when connected | [ ] |
| 6.6 | Community bridge | Local agent participates in community (if user consents via Batch 5 toggles). Files bugs, requests features, shares insights | [ ] |

### Module System (Auto-Download)

| # | Task | Details | Status |
|---|------|---------|--------|
| 6.7 | Auto-download module system | Like Google AI Edge Gallery but automated through Sven. Auto-detect platform capabilities, recommend modules, permission-gated download. Works on all platforms (Android, iOS, macOS, Windows, Linux) | [ ] |
| 6.8 | Manual module picker UI | User chooses which capabilities to install locally. Per-module storage/performance info shown | [ ] |

**Available Modules:**

| Module | Description | Gemma 4 Feature |
|--------|-------------|-----------------|
| Agentic Workflow | Function calling, tool use, task planning, autonomous agents | Native function calling + structured JSON |
| Multimodal Reasoning | Image understanding, OCR, chart reading, visual Q&A | Vision processing (variable resolution) |
| Language | 140+ languages, translation, multilingual chat | Native multilingual training |
| Fine-tuning | Custom model adaptation for user-specific tasks | Local fine-tuning on device |
| Audio Scribe | Local speech-to-text, ~30 second local processing | Native audio input (E2B/E4B) |
| Agent Skills | Autonomous task execution, app navigation | Agentic workflows |
| Prompt Lab | Prompt engineering, structured output, JSON generation | System instructions + structured JSON |
| Mobile Actions | Device control — the thing Sven should do flawlessly | App navigation + function calling |

### Settings & Privacy

| # | Task | Details | Status |
|---|------|---------|--------|
| 6.9 | Settings UI — model management | Toggle on/off, model download/update, disk usage, inference speed stats, module management | [ ] |
| 6.10 | Model agnosticism | On-device slot not locked to Gemma 4. Architecture allows any GGUF model. Gemma 4 is default, user brings their own | [ ] |
| 6.11 | Privacy guarantees | On-device inference NEVER sends prompts/responses to Google or any third party. Model runs in full isolation. All local processing stays local | [ ] |

### Advanced Capabilities

| # | Task | Details | Status |
|---|------|---------|--------|
| 6.12 | Image processing pipeline | Local-first: Gemma 4 vision processes locally, escalates to server if deeper analysis needed. Photos, screenshots, documents, handwriting | [ ] |
| 6.13 | Full offline mode | All capable models available locally. No data connection needed. Travel/new country with no data — Sven still fully functional | [ ] |
| 6.14 | Audio scribe local processing | ~30 seconds local speech-to-text. No cloud dependency. Process meetings, voice notes, lectures locally | [ ] |
| 6.15 | Mobile actions / device control | Gemma 4 native capability for controlling device through Sven. Navigate apps, complete tasks, automate workflows | [ ] |
| 6.16 | Website + documentation | Suite page for Gemma 4 integration, setup guides, module descriptions, platform compatibility matrix | [ ] |
| 6.17 | Full Gemma 4 capabilities | Function calling, audio, vision, 140+ languages, structured JSON, system instructions, agentic workflows — all wired into Sven's agent runtime | [ ] |

---

## Key Design Principles

1. **Privacy by default** — Community participation is OFF by default. On-device processing never leaves the device. GDPR/CCPA compliant throughout.

2. **Emotional intelligence** — Sven doesn't just process requests, he understands how users feel and WHY they think the way they do. He learns from humans, and through that, we learn about ourselves.

3. **Trust through honesty** — When Sven doesn't know, he says so. Corrections are verified before accepted. Confidence is calibrated, not faked.

4. **Memory like nature** — Quantum-fading decay: recent memories clear, old ones fade like echoes, important patterns are captured before they're lost. The brain visualization lets users see their own cognitive map.

5. **Federation for freedom** — Sven-to-Sven communication without central authority. Like Matrix homeservers. Your data, your instance, your rules.

6. **Agents as citizens** — Community agents are transparent participants, not hidden bots. They test, create, moderate, and write Sven's own story. Smart moderation triages content intelligently.

7. **Offline is first-class** — With Gemma 4 on-device, Sven works without internet. Travel, privacy, speed — local processing is always available.

8. **Model agnostic** — Gemma 4 is the default, not a lock-in. Any GGUF model fits. LiteLLM abstracts cloud providers. No single dependency.

---

## Gemma 4 Research Summary

- **Released**: April 2, 2026
- **License**: Apache 2.0 (commercially permissive — full flexibility)
- **Sizes**:
  - E2B (effective 2B params) — phones, Raspberry Pi, Jetson Nano
  - E4B (effective 4B params) — phones, IoT, edge devices
  - 26B MoE (3.8B active during inference) — consumer GPUs, fast latency
  - 31B Dense — consumer GPUs, max quality, #3 open model globally on Arena AI
- **Context**: 128K (E2B/E4B), 256K (26B/31B)
- **Multimodal**: video, images, audio (E2B/E4B native), OCR, charts
- **Languages**: 140+ native
- **Agentic**: function calling, structured JSON, system instructions, tool use
- **Integrations**: Ollama, llama.cpp, vLLM, Hugging Face, LM Studio, GGUF, LiteRT-LM
- **Security**: same rigor as Google proprietary models
- **Key insight**: E2B/E4B run completely offline with near-zero latency on edge devices
