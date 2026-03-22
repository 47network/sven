/**
 * Entity Presence System — Real-time state broadcast to all surfaces
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The entity is Sven's physical presence across all surfaces (phone, mirror,
 * desktop, webchat). This module defines the state schema and event types
 * that drive all animations and visual feedback.
 */

/**
 * Sven's agent state — what is the agent doing right now?
 */
export type AgentState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';

/**
 * Emotional tone — affects color, intensity, particle behavior
 */
export type Emotion = 'neutral' | 'happy' | 'curious' | 'focused' | 'concerned' | 'excited';

/**
 * Which tool is the agent actively using?
 * Helps surfaces show contextual captions and distinguish tool-specific animations.
 */
export type AgentToolType =
  | 'tool_call' // Generic tool invocation
  | 'memory_read' // Reading from memory/knowledge base
  | 'web_search' // Searching the web
  | 'code_exec' // Running code (aider skill, etc.)
  | 'image_gen' // Generating/editing images
  | null; // Not actively using a tool

export type TypingIndicatorMode = 'never' | 'instant' | 'thinking' | 'message';

/**
 * Real-time entity state — published to all connected surfaces via WebSocket
 *
 * This is the source of truth for:
 * - Entity animation state (idle, thinking, speaking, listening, error)
 * - Emotional expression (affects glow color, particle effects)
 * - Animation intensity (0.0–1.0, drives pulse rate, particle speed)
 * - Current tool being used (for captions and contextual UI)
 * - TTS audio sync (chunk ID for lip-sync)
 * - Thinking depth (for nested tool call visualization)
 */
export interface SvenEntityState {
  // ── State ─────────────────────────────────────────────────────────────
  /** Current agent state: idle | listening | thinking | speaking | error */
  state: AgentState;

  // ── Emotion ───────────────────────────────────────────────────────────
  /** Emotional tone affecting visual presentation */
  emotion: Emotion;

  // ── Animation Intensity ───────────────────────────────────────────────
  /**
   * Animation energy level (0.0–1.0).
   * Derived from:
   * - Token delivery rate during LLM streaming (higher speed = higher intensity)
   * - TTS RMS amplitude during speech (louder = higher intensity)
   * - Tool call depth (deeper nesting = higher intensity)
   *
   * Drives:
   * - Particle orbit speed (faster at higher intensity)
   * - Glow pulse rate (faster at higher intensity)
   * - Breathing rate (faster at higher intensity)
   */
  intensity: number;

  // ── TTS Sync ──────────────────────────────────────────────────────────
  /** TTS chunk ID for lip-sync alignment (null if not speaking) */
  ttsChunkId?: string | null;

  // ── Tool Context ──────────────────────────────────────────────────────
  /** Which tool the agent is currently using (for captions) */
  agentStep?: AgentToolType;

  /**
   * How many levels deep of nested tool calls (0–5).
   * Used to visualize tool call complexity.
   * - 0: no tool call
   * - 1: first-level tool (direct agent call to single tool)
   * - 2: tool that calls another tool
   * - 3+: deeply nested tool chains (e.g., aider → bash → test runner)
   *
   * Drives particle orbit count and speed.
   */
  thinkingDepth?: number;

  // ── Metadata ──────────────────────────────────────────────────────────
  /** ISO timestamp when this state was generated */
  timestamp: string;

  /** Which conversation/session this state belongs to (for multi-session apps) */
  channelId: string;

  /** Runtime typing indicator projection for clients. */
  typingIndicator?: {
    active: boolean;
    mode: TypingIndicatorMode;
    phase: 'idle' | 'thinking' | 'message';
  };
}

/**
 * TTS Amplitude feed — streamed alongside audio chunks for real-time mouth sync
 * Published at ~20 Hz (every 50ms) during speech.
 */
export interface TTSAmplitude {
  /** RMS (root mean square) amplitude of this audio chunk (0.0–1.0) */
  rms: number;

  /** Peak amplitude in this chunk (0.0–1.0) */
  peak: number;

  /** Which TTS chunk this amplitude corresponds to */
  chunkId: string;

  /** ISO timestamp */
  timestamp: string;

  /** Conversation channel */
  channelId: string;

}

/**
 * Agent lifecycle event — emitted by agent runtime, mapped to entity.state
 * These events flow through NATS and are aggregated at the gateway.
 */
export interface AgentLifecycleEvent {
  type:
  | 'agent.thinking.start'
  | 'agent.thinking.end'
  | 'agent.tool.start'
  | 'agent.tool.end'
  | 'agent.speaking.start'
  | 'agent.speaking.end'
  | 'agent.listening.start'
  | 'agent.listening.end';

  /** Conversation ID */
  channelId: string;

  // Tool metadata (if type = 'agent.tool.start' | 'agent.tool.end')
  toolName?: string;
  toolSuccess?: boolean;

  // TTS metadata (if type = 'agent.speaking.start' | 'agent.speaking.end')
  ttsChunkId?: string;

  /** ISO timestamp */
  timestamp: string;

  /** Token delivery rate (tokens/sec) — used to calculate intensity */
  tokenRate?: number;
}

/**
 * Predefined entity forms — Sven's built-in avatars
 */
export enum PredefinedForm {
  /** Perfect sphere, electric-blue glow, angular particle orbits */
  ORB = 'orb',

  /** Humanoid silhouette, warm amber glow, breathing chest */
  ARIA = 'aria',

  /** Blocky geometric, green HUD grid, circuit patterns */
  REX = 'rex',

  /** Flowing organic, emerald-green, water ripples */
  ORION = 'orion',
}

/**
 * Entity form variant — either predefined or user-generated
 */
export interface EntityForm {
  id: string; // UUID or `orb` / `aria` / `rex` / `orion`
  name: string; // Display name
  form: PredefinedForm | 'custom';
  spec?: unknown; // CustomShapeSpec JSON if form='custom'
  createdAt?: string; // ISO timestamp
}
