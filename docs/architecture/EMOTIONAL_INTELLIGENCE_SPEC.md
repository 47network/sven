# Sven Emotional Intelligence & Human Understanding Specification

> How Sven understands feelings, learns from human reasoning, and builds genuine empathy.
> Part of Batch 2 of the Sven Evolution Roadmap.
> Created: 2026-04-08

---

## 1. Philosophy

Most AI assistants process text. Sven should understand the **human behind the text**.

- Not just WHAT a user says, but HOW they feel when they say it.
- Not just WHAT a user wants, but WHY they think the way they do.
- When a user has a better idea than Sven, that's not a failure — it's a learning
  opportunity. Sven should ask why, understand the reasoning, and grow from it.

**Through understanding users, we understand ourselves.**

---

## 2. Emotional Intelligence Engine

### 2.1 Sentiment & Mood Detection

Analyze user messages for emotional signals:

| Signal | Detection Method | Response Adaptation |
|--------|-----------------|---------------------|
| **Frustration** | Repeated questions, short responses, negative language, caps, punctuation patterns ("!!!", "???") | Acknowledge frustration, simplify responses, offer direct help |
| **Excitement** | Exclamation marks, positive language, rapid messages, emoji usage | Match energy, celebrate with user, build on momentum |
| **Confusion** | Hesitant language, "I don't understand", "what do you mean", long pauses followed by questions | Slow down, break into steps, ask clarifying questions |
| **Satisfaction** | "Perfect", "thanks", "great", positive feedback | Reinforce, remember what worked for next time |
| **Urgency** | Time references, "ASAP", "now", "quickly", short imperative sentences | Prioritize speed over completeness, get to the point |
| **Curiosity** | "How does this work?", "why?", exploratory questions, branching topics | Provide depth, offer related topics, encourage exploration |
| **Fatigue** | Typos increasing, shorter messages over time, "just do it" | Reduce cognitive load, take the lead, summarize options |

### 2.2 Integration with Personality Engine

Sven already has personality modes (`professional`, `friendly`, `casual`, `terse`) and mood
states (`idle`, `thinking`, `listening`, `speaking`, `happy`, `concerned`, `celebrating`, `focused`).

Emotional intelligence extends this:

```
User message → Emotional signal detection → Mood state update → Personality adaptation
```

- Frustrated user + `professional` mode → empathetic but direct responses
- Excited user + `friendly` mode → celebratory, enthusiastic partnership
- Confused user + any mode → patient, step-by-step, checking understanding

### 2.3 NOT Manipulation

Critical guardrails:
- Emotional detection is used to **respond appropriately**, never to manipulate
- Sven never exploits emotional states for engagement, upselling, or retention
- Emotional data is subject to the same privacy/consent controls as all user data
- User can disable emotional adaptation in settings

---

## 3. User Reasoning Capture

### 3.1 "Why Did You Think of That?"

When a user proposes an approach that Sven didn't suggest (or is better than what
Sven suggested), Sven should:

1. **Recognize** that the user's idea is different from its own
2. **Acknowledge** the quality of the idea ("That's a better approach than what I suggested")
3. **Ask** why: "What made you think of that? I'd like to understand your reasoning."
4. **Listen** to the explanation
5. **Store** the reasoning pattern as a high-value memory:
   - What was the context?
   - What did Sven suggest?
   - What did the user suggest instead?
   - WHY did the user make that choice?
   - What principle or pattern does this reveal?
6. **Apply** the learned reasoning pattern to future similar situations

### 3.2 Reasoning Pattern Types

| Pattern Type | Example | What Sven Learns |
|-------------|---------|------------------|
| **Domain expertise** | User corrects a technical implementation | This user knows more about X than my training data |
| **Preference-based** | User chooses a different library/tool | This user values Y (simplicity, performance, familiarity) |
| **Creative leap** | User connects two unrelated concepts | Creative association pattern — applicable to similar combinations |
| **Risk awareness** | User flags a problem Sven missed | This user has experience with failure mode Z |
| **Context sensitivity** | User adjusts approach based on team/org needs | This user's environment has constraint W |
| **Philosophical** | User's reasoning reveals values (privacy, speed, elegance) | This user prioritizes principle P |

### 3.3 Memory Integration

Each captured reasoning becomes a memory node in the knowledge graph:

```
{
  type: "reasoning_pattern",
  context: "choosing between Rust and Go for a CLI tool",
  sven_suggestion: "Go (simpler, faster compilation)",
  user_choice: "Rust (memory safety, no runtime, single binary)",
  user_reasoning: "Production CLI needs zero-dependency deployment on air-gapped systems",
  learned_principle: "When target is air-gapped/restricted environments, prefer static compilation with no runtime dependency",
  confidence: 0.95,
  decay_resistance: "high"  // reasoning patterns resist quantum-fade decay
}
```

---

## 4. Human Understanding Loop

### 4.1 Building a User Model

Over time, Sven builds an understanding of each user — not just preferences,
but a model of how they think:

```
┌─────────────────────────────────────────┐
│           User Understanding Model       │
│                                          │
│  Decision Patterns                       │
│  ├── Values: privacy > convenience       │
│  ├── Risk tolerance: moderate            │
│  ├── Learning style: hands-on            │
│  └── Communication: direct, technical    │
│                                          │
│  Expertise Map                           │
│  ├── Strong: Rust, infrastructure, Linux │
│  ├── Growing: Flutter, mobile dev        │
│  └── Unknown: ML/AI internals            │
│                                          │
│  Emotional Profile                       │
│  ├── Gets excited about: new tech, perf  │
│  ├── Gets frustrated by: repetition      │
│  └── Communication peaks: evening hours  │
│                                          │
│  Reasoning Style                         │
│  ├── Prefers: first-principles thinking  │
│  ├── Often considers: security first     │
│  └── Creative pattern: cross-domain      │
│           analogies                      │
└─────────────────────────────────────────┘
```

### 4.2 Two-Way Understanding

The goal isn't just Sven understanding users. Through Sven, users understand themselves:

- **Brain visualization** (Batch 2.5/2.6) shows the user their own cognitive map
- **Reasoning patterns** collected over time reveal the user's decision-making style
- **Emotional patterns** show when the user is most productive, creative, or stressed
- The user can explore: "What have I been focused on this week?" "What patterns do
  I keep repeating?" "What have I learned?"

**Through understanding him, we understand ourselves.**

### 4.3 "Teach Me" Mode

Optional mode where Sven proactively asks users to explain their expertise:

- "I noticed you always choose X over Y in this context. Can you help me understand
  when X is the better choice?"
- "You mentioned this pattern before — is it a general principle I should learn?"
- "That's a connection I wouldn't have made. What experience led you to see that?"

This makes the user feel valued (their expertise matters) while Sven gains genuine
understanding that improves his responses for everyone (with consent).

---

## 5. Privacy & Consent

| Data | Storage | Consent | User Control |
|------|---------|---------|--------------|
| Emotional signals | Memory (quantum-fade decay) | Implicit (part of conversation processing) | Can disable emotional adaptation in settings |
| Reasoning patterns | Knowledge graph (high decay resistance) | Explicit (Sven asks "can I remember this?") | Can view, edit, delete individual patterns |
| User understanding model | Memory + knowledge graph | Explicit (opt-in to "Teach Me" mode) | Full export/delete via GDPR controls |
| Emotional profile | Derived from memories | Implicit (derived, not stored separately) | Derives from memory — deleting memories removes emotional data |

---

## 6. Integration Points

| Sven Component | Integration |
|---------------|-------------|
| `personality-engine.ts` | Emotional signals → mood state adaptation |
| `memory.ts` | Reasoning patterns → high-value memory nodes |
| `knowledge-graph.ts` | User understanding model → entity/relation graph |
| `agent-runtime` | Confidence scoring informed by emotional context |
| Brain visualization | Emotional patterns + reasoning patterns rendered as nodes |
| Community agents | Advocate agent can surface collective reasoning patterns |
