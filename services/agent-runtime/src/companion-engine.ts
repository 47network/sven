// ---------------------------------------------------------------------------
// Companion Engine — Animated Desktop Character State Machine
// ---------------------------------------------------------------------------
// Manages the visual character state that drives the Tauri desktop companion.
// Character forms (ORB, ARIA, REX, ORION, custom) with full state machine:
// idle → listening → thinking → speaking → celebrating → sleeping → error.
// Syncs real-time agent lifecycle events to animation state + emotion.
// Drives Lottie/Rive animation frames via declarative state descriptors.
// ---------------------------------------------------------------------------

import { createLogger } from '@sven/shared';

const logger = createLogger('companion');

/* ------------------------------------------------------------------ types */

export type CharacterState =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'celebrating'
  | 'sleeping'
  | 'working'
  | 'error';

export type CharacterEmotion =
  | 'neutral'
  | 'happy'
  | 'curious'
  | 'focused'
  | 'concerned'
  | 'excited'
  | 'proud'
  | 'sleepy';

export type CharacterForm = 'orb' | 'aria' | 'rex' | 'orion' | 'custom';

export type AnimationLayer = 'base' | 'overlay' | 'particle' | 'thought_bubble' | 'confetti';

export type SoundEffect =
  | 'task_complete'
  | 'error_alert'
  | 'notification'
  | 'wake_up'
  | 'celebration'
  | 'thinking_start'
  | 'none';

export type OverlayPosition = 'dock_left' | 'dock_center' | 'dock_right' | 'taskbar_left' | 'taskbar_right' | 'custom';

export type VolumeLevel = 'mute' | 'low' | 'normal';

/** Descriptor sent to the Tauri overlay for rendering a single animation frame. */
export interface AnimationDescriptor {
  state: CharacterState;
  emotion: CharacterEmotion;
  form: CharacterForm;
  intensity: number; // 0.0–1.0
  layers: AnimationLayerDescriptor[];
  soundEffect: SoundEffect;
  thoughtBubble: ThoughtBubble | null;
  position: OverlayPosition;
  walkCycle: WalkCycleState | null;
  timestamp: string;
}

export interface AnimationLayerDescriptor {
  layer: AnimationLayer;
  animationId: string; // Lottie/Rive animation asset ID
  speed: number; // playback speed multiplier (1.0 = normal)
  opacity: number; // 0.0–1.0
  loop: boolean;
}

export interface ThoughtBubble {
  visible: boolean;
  text: string;
  type: 'thinking' | 'progress' | 'info' | 'error' | 'celebration';
  progress?: number; // 0–100 for progress type
  autoHideMs?: number;
}

export interface WalkCycleState {
  active: boolean;
  direction: 'left' | 'right';
  speed: number; // pixels per second
  positionX: number; // 0.0–1.0 (fraction of screen width)
  boundsLeft: number; // 0.0–1.0
  boundsRight: number; // 0.0–1.0
}

export interface CompanionPreferences {
  form: CharacterForm;
  customFormSpec?: Record<string, unknown>;
  volume: VolumeLevel;
  overlayPosition: OverlayPosition;
  walkEnabled: boolean;
  walkSpeed: number; // 20–200 px/sec
  showThoughtBubbles: boolean;
  celebrateOnComplete: boolean;
  sleepAfterIdleMs: number; // ms of idle before sleeping (0 = never)
  soundPack: string; // 'default' or custom pack name
  dpiScale: number; // 1.0, 1.5, 2.0, etc.
}

/** Agent lifecycle event consumed from NATS/SSE to drive state transitions. */
export interface AgentEvent {
  type:
    | 'agent.thinking.start'
    | 'agent.thinking.end'
    | 'agent.tool.start'
    | 'agent.tool.end'
    | 'agent.speaking.start'
    | 'agent.speaking.end'
    | 'agent.listening.start'
    | 'agent.listening.end'
    | 'task.completed'
    | 'task.failed'
    | 'user.click'
    | 'user.wake';
  channelId: string;
  toolName?: string;
  toolSuccess?: boolean;
  ttsChunkId?: string;
  tokenRate?: number;
  timestamp: string;
}

export interface CompanionSession {
  id: string;
  orgId: string;
  userId: string;
  state: CharacterState;
  emotion: CharacterEmotion;
  intensity: number;
  form: CharacterForm;
  preferences: CompanionPreferences;
  walkCycle: WalkCycleState;
  thoughtBubble: ThoughtBubble | null;
  lastActivityAt: string;
  createdAt: string;
  stateHistory: StateTransition[];
}

export interface StateTransition {
  from: CharacterState;
  to: CharacterState;
  trigger: string;
  timestamp: string;
}

export interface CompanionStats {
  activeSessions: number;
  totalTransitions: number;
  stateDistribution: Record<CharacterState, number>;
  averageIdleBeforeSleepMs: number;
  celebrationCount: number;
  errorCount: number;
}

/* -------------------------------------------------------------- constants */

export const DEFAULT_PREFERENCES: CompanionPreferences = {
  form: 'orb',
  volume: 'normal',
  overlayPosition: 'dock_right',
  walkEnabled: true,
  walkSpeed: 60,
  showThoughtBubbles: true,
  celebrateOnComplete: true,
  sleepAfterIdleMs: 5 * 60 * 1000, // 5 minutes
  soundPack: 'default',
  dpiScale: 1.0,
};

export const DEFAULT_WALK_CYCLE: WalkCycleState = {
  active: false,
  direction: 'right',
  speed: 60,
  positionX: 0.8,
  boundsLeft: 0.1,
  boundsRight: 0.9,
};

/** Maps character state → base animation asset ID per form. */
export const ANIMATION_MAP: Record<CharacterForm, Partial<Record<CharacterState, string>>> = {
  orb: {
    idle: 'orb_idle_glow',
    listening: 'orb_listening_pulse',
    thinking: 'orb_thinking_spin',
    speaking: 'orb_speaking_wave',
    celebrating: 'orb_celebrating_burst',
    sleeping: 'orb_sleeping_dim',
    working: 'orb_working_circuit',
    error: 'orb_error_flash',
  },
  aria: {
    idle: 'aria_idle_breathe',
    listening: 'aria_listening_tilt',
    thinking: 'aria_thinking_gesture',
    speaking: 'aria_speaking_lips',
    celebrating: 'aria_celebrating_dance',
    sleeping: 'aria_sleeping_rest',
    working: 'aria_working_type',
    error: 'aria_error_frown',
  },
  rex: {
    idle: 'rex_idle_scan',
    listening: 'rex_listening_antenna',
    thinking: 'rex_thinking_grid',
    speaking: 'rex_speaking_display',
    celebrating: 'rex_celebrating_lights',
    sleeping: 'rex_sleeping_standby',
    working: 'rex_working_process',
    error: 'rex_error_warning',
  },
  orion: {
    idle: 'orion_idle_flow',
    listening: 'orion_listening_ripple',
    thinking: 'orion_thinking_swirl',
    speaking: 'orion_speaking_bloom',
    celebrating: 'orion_celebrating_splash',
    sleeping: 'orion_sleeping_still',
    working: 'orion_working_weave',
    error: 'orion_error_murk',
  },
  custom: {
    idle: 'custom_idle',
    listening: 'custom_listening',
    thinking: 'custom_thinking',
    speaking: 'custom_speaking',
    celebrating: 'custom_celebrating',
    sleeping: 'custom_sleeping',
    working: 'custom_working',
    error: 'custom_error',
  },
};

/** Maps emotion → intensity modifier (additive to base intensity). */
export const EMOTION_INTENSITY: Record<CharacterEmotion, number> = {
  neutral: 0.0,
  happy: 0.1,
  curious: 0.05,
  focused: 0.15,
  concerned: -0.05,
  excited: 0.2,
  proud: 0.1,
  sleepy: -0.3,
};

/** Maps character state → sound effect. */
export const STATE_SOUNDS: Record<CharacterState, SoundEffect> = {
  idle: 'none',
  listening: 'none',
  thinking: 'thinking_start',
  speaking: 'none',
  celebrating: 'celebration',
  sleeping: 'none',
  working: 'none',
  error: 'error_alert',
};

/** Valid state transitions. Key = fromState, value = set of valid toStates. */
export const VALID_TRANSITIONS: Record<CharacterState, Set<CharacterState>> = {
  idle: new Set(['listening', 'thinking', 'working', 'sleeping', 'error', 'celebrating']),
  listening: new Set(['idle', 'thinking', 'speaking', 'error']),
  thinking: new Set(['idle', 'speaking', 'working', 'error', 'celebrating']),
  speaking: new Set(['idle', 'listening', 'thinking', 'error', 'celebrating']),
  celebrating: new Set(['idle', 'listening', 'sleeping']),
  sleeping: new Set(['idle', 'listening', 'thinking']),
  working: new Set(['idle', 'thinking', 'speaking', 'error', 'celebrating']),
  error: new Set(['idle', 'listening', 'thinking']),
};

/* ----------------------------------------------------------- session store */

const sessionStore = new Map<string, CompanionSession>();
let globalTransitionCount = 0;
let globalCelebrationCount = 0;
let globalErrorCount = 0;
let idCounter = 0;

function nextId(): string {
  return `comp_${++idCounter}_${Date.now()}`;
}

/* --------------------------------------------------------- state machine */

/**
 * Validates whether a state transition is allowed.
 */
export function isValidTransition(from: CharacterState, to: CharacterState): boolean {
  if (from === to) return true; // self-transition always allowed (no-op)
  const valid = VALID_TRANSITIONS[from];
  return valid ? valid.has(to) : false;
}

/**
 * Derives the target state from an agent event.
 */
export function eventToState(event: AgentEvent): CharacterState {
  switch (event.type) {
    case 'agent.thinking.start':
      return 'thinking';
    case 'agent.thinking.end':
      return 'idle';
    case 'agent.tool.start':
      return 'working';
    case 'agent.tool.end':
      return 'idle';
    case 'agent.speaking.start':
      return 'speaking';
    case 'agent.speaking.end':
      return 'idle';
    case 'agent.listening.start':
      return 'listening';
    case 'agent.listening.end':
      return 'idle';
    case 'task.completed':
      return 'celebrating';
    case 'task.failed':
      return 'error';
    case 'user.click':
    case 'user.wake':
      return 'idle';
    default:
      return 'idle';
  }
}

/**
 * Derives emotion from the current state and event context.
 */
export function deriveEmotion(state: CharacterState, event?: AgentEvent): CharacterEmotion {
  switch (state) {
    case 'thinking':
      return 'focused';
    case 'speaking':
      return 'happy';
    case 'listening':
      return 'curious';
    case 'working':
      return event?.toolName ? 'focused' : 'curious';
    case 'celebrating':
      return 'excited';
    case 'sleeping':
      return 'sleepy';
    case 'error':
      return 'concerned';
    case 'idle':
    default:
      return 'neutral';
  }
}

/**
 * Computes animation intensity from state + emotion + optional token rate.
 */
export function computeIntensity(
  state: CharacterState,
  emotion: CharacterEmotion,
  tokenRate?: number,
): number {
  let base: number;
  switch (state) {
    case 'idle':
      base = 0.2;
      break;
    case 'listening':
      base = 0.4;
      break;
    case 'thinking':
      base = 0.6;
      break;
    case 'speaking':
      base = 0.5;
      break;
    case 'working':
      base = 0.7;
      break;
    case 'celebrating':
      base = 0.9;
      break;
    case 'sleeping':
      base = 0.1;
      break;
    case 'error':
      base = 0.8;
      break;
    default:
      base = 0.3;
  }

  const emotionMod = EMOTION_INTENSITY[emotion] || 0;
  const tokenMod = tokenRate ? Math.min(tokenRate / 100, 0.2) : 0;

  return Math.max(0, Math.min(1, base + emotionMod + tokenMod));
}

/* ------------------------------------------------------ walk cycle logic */

/**
 * Updates the walk cycle position (called on each tick).
 * Returns a new WalkCycleState with updated positionX and direction.
 */
export function updateWalkCycle(walk: WalkCycleState, deltaMs: number): WalkCycleState {
  if (!walk.active) return walk;

  const deltaFraction = (walk.speed * (deltaMs / 1000)) / 1920; // normalise to 1920px width
  let newX = walk.positionX;
  let newDirection = walk.direction;

  if (walk.direction === 'right') {
    newX += deltaFraction;
    if (newX >= walk.boundsRight) {
      newX = walk.boundsRight;
      newDirection = 'left';
    }
  } else {
    newX -= deltaFraction;
    if (newX <= walk.boundsLeft) {
      newX = walk.boundsLeft;
      newDirection = 'right';
    }
  }

  return {
    ...walk,
    positionX: Math.max(walk.boundsLeft, Math.min(walk.boundsRight, newX)),
    direction: newDirection,
  };
}

/* ------------------------------------------------- animation descriptors */

/**
 * Builds the AnimationDescriptor for the current session state.
 * This is the payload sent to the Tauri overlay renderer.
 */
export function buildAnimationDescriptor(session: CompanionSession): AnimationDescriptor {
  const formAnimations = ANIMATION_MAP[session.form] || ANIMATION_MAP.orb;
  const baseAnimId = formAnimations[session.state] || `${session.form}_idle`;

  const layers: AnimationLayerDescriptor[] = [
    {
      layer: 'base',
      animationId: baseAnimId,
      speed: 0.8 + session.intensity * 0.4, // 0.8–1.2x speed
      opacity: 1.0,
      loop: session.state !== 'celebrating',
    },
  ];

  // Particle layer for active states
  if (session.intensity > 0.4) {
    layers.push({
      layer: 'particle',
      animationId: `${session.form}_particles`,
      speed: session.intensity,
      opacity: Math.min(1, session.intensity * 1.5),
      loop: true,
    });
  }

  // Thought bubble overlay
  if (session.thoughtBubble?.visible) {
    layers.push({
      layer: 'thought_bubble',
      animationId: `thought_${session.thoughtBubble.type}`,
      speed: 1.0,
      opacity: 1.0,
      loop: session.thoughtBubble.type === 'thinking',
    });
  }

  // Confetti overlay for celebrating
  if (session.state === 'celebrating' && session.preferences.celebrateOnComplete) {
    layers.push({
      layer: 'confetti',
      animationId: 'confetti_burst',
      speed: 1.0,
      opacity: 1.0,
      loop: false,
    });
  }

  // Determine sound effect, respecting volume preference
  let soundEffect: SoundEffect = STATE_SOUNDS[session.state];
  if (session.preferences.volume === 'mute') {
    soundEffect = 'none';
  }

  return {
    state: session.state,
    emotion: session.emotion,
    form: session.form,
    intensity: session.intensity,
    layers,
    soundEffect,
    thoughtBubble: session.thoughtBubble,
    position: session.preferences.overlayPosition,
    walkCycle: session.preferences.walkEnabled ? session.walkCycle : null,
    timestamp: new Date().toISOString(),
  };
}

/* ----------------------------------------------------------- session CRUD */

/**
 * Creates a new companion session.
 */
export function createSession(
  orgId: string,
  userId: string,
  preferences?: Partial<CompanionPreferences>,
): CompanionSession {
  const id = nextId();
  const now = new Date().toISOString();
  const prefs = { ...DEFAULT_PREFERENCES, ...preferences };

  const session: CompanionSession = {
    id,
    orgId,
    userId,
    state: 'idle',
    emotion: 'neutral',
    intensity: 0.2,
    form: prefs.form,
    preferences: prefs,
    walkCycle: {
      ...DEFAULT_WALK_CYCLE,
      active: prefs.walkEnabled,
      speed: prefs.walkSpeed,
    },
    thoughtBubble: null,
    lastActivityAt: now,
    createdAt: now,
    stateHistory: [],
  };

  // Evict oldest session if at capacity (50 max)
  if (sessionStore.size >= 50) {
    let oldest: string | null = null;
    let oldestTime = Infinity;
    for (const [k, v] of sessionStore) {
      const t = new Date(v.lastActivityAt).getTime();
      if (t < oldestTime) {
        oldestTime = t;
        oldest = k;
      }
    }
    if (oldest) sessionStore.delete(oldest);
  }

  sessionStore.set(id, session);
  logger.info({ sessionId: id, orgId, form: prefs.form }, 'companion session created');
  return session;
}

/**
 * Retrieves a companion session by ID.
 */
export function getSession(sessionId: string): CompanionSession | undefined {
  return sessionStore.get(sessionId);
}

/**
 * Lists all sessions for an org.
 */
export function listSessions(orgId: string): CompanionSession[] {
  const results: CompanionSession[] = [];
  for (const session of sessionStore.values()) {
    if (session.orgId === orgId) results.push(session);
  }
  return results;
}

/**
 * Destroys a companion session.
 */
export function destroySession(sessionId: string): boolean {
  const existed = sessionStore.delete(sessionId);
  if (existed) {
    logger.info({ sessionId }, 'companion session destroyed');
  }
  return existed;
}

/* -------------------------------------------------------- state transitions */

/**
 * Processes an agent event and transitions the session state.
 * Returns the new AnimationDescriptor, or null if the event was ignored.
 */
export function processEvent(
  sessionId: string,
  event: AgentEvent,
): AnimationDescriptor | null {
  const session = sessionStore.get(sessionId);
  if (!session) {
    logger.warn({ sessionId }, 'processEvent: session not found');
    return null;
  }

  const targetState = eventToState(event);

  // Skip self-transitions
  if (targetState === session.state) {
    // Still update intensity for token-rate changes
    session.intensity = computeIntensity(session.state, session.emotion, event.tokenRate);
    session.lastActivityAt = event.timestamp || new Date().toISOString();
    return buildAnimationDescriptor(session);
  }

  // Validate transition
  if (!isValidTransition(session.state, targetState)) {
    logger.debug(
      { sessionId, from: session.state, to: targetState, trigger: event.type },
      'invalid state transition, ignored',
    );
    return null;
  }

  // Record transition
  const transition: StateTransition = {
    from: session.state,
    to: targetState,
    trigger: event.type,
    timestamp: event.timestamp || new Date().toISOString(),
  };
  session.stateHistory.push(transition);

  // Cap history length
  if (session.stateHistory.length > 200) {
    session.stateHistory = session.stateHistory.slice(-100);
  }

  // Update state
  const previousState = session.state;
  session.state = targetState;
  session.emotion = deriveEmotion(targetState, event);
  session.intensity = computeIntensity(targetState, session.emotion, event.tokenRate);
  session.lastActivityAt = event.timestamp || new Date().toISOString();

  // Update thought bubble based on state
  if (targetState === 'thinking') {
    session.thoughtBubble = session.preferences.showThoughtBubbles
      ? { visible: true, text: 'Thinking...', type: 'thinking' }
      : null;
  } else if (targetState === 'working') {
    const toolText = event.toolName ? `Using ${event.toolName}...` : 'Working...';
    session.thoughtBubble = session.preferences.showThoughtBubbles
      ? { visible: true, text: toolText, type: 'progress', progress: 50 }
      : null;
  } else if (targetState === 'celebrating') {
    session.thoughtBubble = session.preferences.showThoughtBubbles
      ? { visible: true, text: 'Done!', type: 'celebration', autoHideMs: 3000 }
      : null;
    globalCelebrationCount++;
  } else if (targetState === 'error') {
    session.thoughtBubble = session.preferences.showThoughtBubbles
      ? { visible: true, text: 'Something went wrong', type: 'error', autoHideMs: 5000 }
      : null;
    globalErrorCount++;
  } else {
    session.thoughtBubble = null;
  }

  // Pause walk cycle during active states
  if (targetState === 'sleeping' || targetState === 'error') {
    session.walkCycle.active = false;
  } else if (
    (previousState === 'sleeping' || previousState === 'error') &&
    session.preferences.walkEnabled
  ) {
    session.walkCycle.active = true;
  }

  globalTransitionCount++;
  logger.debug(
    { sessionId, from: previousState, to: targetState, emotion: session.emotion },
    'state transition',
  );

  return buildAnimationDescriptor(session);
}

/**
 * Triggers the sleep state after idle timeout.
 */
export function checkIdleTimeout(sessionId: string): AnimationDescriptor | null {
  const session = sessionStore.get(sessionId);
  if (!session) return null;
  if (session.state !== 'idle') return null;
  if (session.preferences.sleepAfterIdleMs <= 0) return null;

  const idleMs = Date.now() - new Date(session.lastActivityAt).getTime();
  if (idleMs < session.preferences.sleepAfterIdleMs) return null;

  return processEvent(sessionId, {
    type: 'agent.listening.end', // This resolves to idle, but we override below
    channelId: '',
    timestamp: new Date().toISOString(),
  }) || (() => {
    // Force sleep transition directly
    if (isValidTransition(session.state, 'sleeping')) {
      session.stateHistory.push({
        from: session.state,
        to: 'sleeping',
        trigger: 'idle_timeout',
        timestamp: new Date().toISOString(),
      });
      session.state = 'sleeping';
      session.emotion = 'sleepy';
      session.intensity = computeIntensity('sleeping', 'sleepy');
      session.walkCycle.active = false;
      globalTransitionCount++;
      return buildAnimationDescriptor(session);
    }
    return null;
  })();
}

/**
 * Manually updates session preferences.
 */
export function updatePreferences(
  sessionId: string,
  updates: Partial<CompanionPreferences>,
): CompanionSession | null {
  const session = sessionStore.get(sessionId);
  if (!session) return null;

  session.preferences = { ...session.preferences, ...updates };

  // Apply walk preference changes
  if (updates.walkEnabled !== undefined) {
    session.walkCycle.active = updates.walkEnabled && session.state !== 'sleeping' && session.state !== 'error';
  }
  if (updates.walkSpeed !== undefined) {
    session.walkCycle.speed = updates.walkSpeed;
  }
  if (updates.form !== undefined) {
    session.form = updates.form;
  }

  logger.info({ sessionId, updates: Object.keys(updates) }, 'preferences updated');
  return session;
}

/**
 * Sets a custom thought bubble on a session (for manual messages from agent).
 */
export function setThoughtBubble(
  sessionId: string,
  bubble: ThoughtBubble | null,
): AnimationDescriptor | null {
  const session = sessionStore.get(sessionId);
  if (!session) return null;

  session.thoughtBubble = bubble;
  return buildAnimationDescriptor(session);
}

/* ------------------------------------------------------------------ stats */

/**
 * Returns aggregate statistics across all sessions.
 */
export function getCompanionStats(): CompanionStats {
  const stateDistribution: Record<CharacterState, number> = {
    idle: 0,
    listening: 0,
    thinking: 0,
    speaking: 0,
    celebrating: 0,
    sleeping: 0,
    working: 0,
    error: 0,
  };

  let totalIdleMs = 0;
  let idleCount = 0;

  for (const session of sessionStore.values()) {
    stateDistribution[session.state]++;
    if (session.state === 'idle') {
      totalIdleMs += Date.now() - new Date(session.lastActivityAt).getTime();
      idleCount++;
    }
  }

  return {
    activeSessions: sessionStore.size,
    totalTransitions: globalTransitionCount,
    stateDistribution,
    averageIdleBeforeSleepMs: idleCount > 0 ? Math.round(totalIdleMs / idleCount) : 0,
    celebrationCount: globalCelebrationCount,
    errorCount: globalErrorCount,
  };
}

/* ----------------------------------------------------------- test helpers */

export function resetIdCounter(): void {
  idCounter = 0;
}

export function clearSessionStore(): void {
  sessionStore.clear();
  globalTransitionCount = 0;
  globalCelebrationCount = 0;
  globalErrorCount = 0;
}
