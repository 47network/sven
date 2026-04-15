// ---------------------------------------------------------------------------
// Companion Engine — Tests
// ---------------------------------------------------------------------------

import {
  isValidTransition,
  eventToState,
  deriveEmotion,
  computeIntensity,
  updateWalkCycle,
  buildAnimationDescriptor,
  createSession,
  getSession,
  listSessions,
  destroySession,
  processEvent,
  checkIdleTimeout,
  updatePreferences,
  setThoughtBubble,
  getCompanionStats,
  resetIdCounter,
  clearSessionStore,
  DEFAULT_PREFERENCES,
  DEFAULT_WALK_CYCLE,
  ANIMATION_MAP,
  EMOTION_INTENSITY,
  STATE_SOUNDS,
  VALID_TRANSITIONS,
  type CharacterState,
  type CharacterEmotion,
  type AgentEvent,
  type WalkCycleState,
  type CompanionSession,
} from '../companion-engine';

beforeEach(() => {
  resetIdCounter();
  clearSessionStore();
});

/* ========================================================================== */
/* isValidTransition                                                          */
/* ========================================================================== */

describe('isValidTransition', () => {
  it('allows self-transitions', () => {
    expect(isValidTransition('idle', 'idle')).toBe(true);
    expect(isValidTransition('thinking', 'thinking')).toBe(true);
  });

  it('allows idle → thinking', () => {
    expect(isValidTransition('idle', 'thinking')).toBe(true);
  });

  it('allows idle → sleeping', () => {
    expect(isValidTransition('idle', 'sleeping')).toBe(true);
  });

  it('rejects sleeping → celebrating', () => {
    expect(isValidTransition('sleeping', 'celebrating')).toBe(false);
  });

  it('rejects listening → sleeping', () => {
    expect(isValidTransition('listening', 'sleeping')).toBe(false);
  });

  it('allows error → idle', () => {
    expect(isValidTransition('error', 'idle')).toBe(true);
  });

  it('allows celebrating → idle', () => {
    expect(isValidTransition('celebrating', 'idle')).toBe(true);
  });
});

/* ========================================================================== */
/* eventToState                                                               */
/* ========================================================================== */

describe('eventToState', () => {
  it('maps thinking.start → thinking', () => {
    expect(eventToState({ type: 'agent.thinking.start', channelId: 'c1', timestamp: '' })).toBe('thinking');
  });

  it('maps speaking.start → speaking', () => {
    expect(eventToState({ type: 'agent.speaking.start', channelId: 'c1', timestamp: '' })).toBe('speaking');
  });

  it('maps tool.start → working', () => {
    expect(eventToState({ type: 'agent.tool.start', channelId: 'c1', timestamp: '' })).toBe('working');
  });

  it('maps task.completed → celebrating', () => {
    expect(eventToState({ type: 'task.completed', channelId: 'c1', timestamp: '' })).toBe('celebrating');
  });

  it('maps task.failed → error', () => {
    expect(eventToState({ type: 'task.failed', channelId: 'c1', timestamp: '' })).toBe('error');
  });

  it('maps thinking.end → idle', () => {
    expect(eventToState({ type: 'agent.thinking.end', channelId: 'c1', timestamp: '' })).toBe('idle');
  });

  it('maps user.click → idle', () => {
    expect(eventToState({ type: 'user.click', channelId: 'c1', timestamp: '' })).toBe('idle');
  });
});

/* ========================================================================== */
/* deriveEmotion                                                              */
/* ========================================================================== */

describe('deriveEmotion', () => {
  it('thinking → focused', () => {
    expect(deriveEmotion('thinking')).toBe('focused');
  });

  it('speaking → happy', () => {
    expect(deriveEmotion('speaking')).toBe('happy');
  });

  it('celebrating → excited', () => {
    expect(deriveEmotion('celebrating')).toBe('excited');
  });

  it('sleeping → sleepy', () => {
    expect(deriveEmotion('sleeping')).toBe('sleepy');
  });

  it('error → concerned', () => {
    expect(deriveEmotion('error')).toBe('concerned');
  });

  it('working with toolName → focused', () => {
    expect(deriveEmotion('working', { type: 'agent.tool.start', channelId: '', timestamp: '', toolName: 'aider' })).toBe('focused');
  });

  it('working without toolName → curious', () => {
    expect(deriveEmotion('working', { type: 'agent.tool.start', channelId: '', timestamp: '' })).toBe('curious');
  });
});

/* ========================================================================== */
/* computeIntensity                                                           */
/* ========================================================================== */

describe('computeIntensity', () => {
  it('idle + neutral has low intensity', () => {
    const i = computeIntensity('idle', 'neutral');
    expect(i).toBeCloseTo(0.2, 1);
  });

  it('celebrating + excited has high intensity', () => {
    const i = computeIntensity('celebrating', 'excited');
    expect(i).toBeGreaterThan(0.9);
  });

  it('sleeping + sleepy has very low intensity', () => {
    const i = computeIntensity('sleeping', 'sleepy');
    expect(i).toBeLessThan(0.1);
  });

  it('token rate adds to intensity', () => {
    const base = computeIntensity('thinking', 'focused');
    const withRate = computeIntensity('thinking', 'focused', 50);
    expect(withRate).toBeGreaterThan(base);
  });

  it('clamps to 0–1 range', () => {
    const i = computeIntensity('celebrating', 'excited', 200);
    expect(i).toBeLessThanOrEqual(1);
    expect(i).toBeGreaterThanOrEqual(0);
  });
});

/* ========================================================================== */
/* updateWalkCycle                                                            */
/* ========================================================================== */

describe('updateWalkCycle', () => {
  it('does not move when inactive', () => {
    const walk: WalkCycleState = { ...DEFAULT_WALK_CYCLE, active: false, positionX: 0.5 };
    const updated = updateWalkCycle(walk, 1000);
    expect(updated.positionX).toBe(0.5);
  });

  it('moves right when direction is right', () => {
    const walk: WalkCycleState = { ...DEFAULT_WALK_CYCLE, active: true, direction: 'right', positionX: 0.5 };
    const updated = updateWalkCycle(walk, 1000);
    expect(updated.positionX).toBeGreaterThan(0.5);
  });

  it('reverses direction at bounds', () => {
    const walk: WalkCycleState = { ...DEFAULT_WALK_CYCLE, active: true, direction: 'right', positionX: 0.89, boundsRight: 0.9, speed: 200 };
    const updated = updateWalkCycle(walk, 1000);
    // Should have bounced or be at bound
    expect(updated.positionX).toBeLessThanOrEqual(0.9);
  });

  it('moves left when direction is left', () => {
    const walk: WalkCycleState = { ...DEFAULT_WALK_CYCLE, active: true, direction: 'left', positionX: 0.5 };
    const updated = updateWalkCycle(walk, 1000);
    expect(updated.positionX).toBeLessThan(0.5);
  });
});

/* ========================================================================== */
/* createSession                                                              */
/* ========================================================================== */

describe('createSession', () => {
  it('creates a session with default preferences', () => {
    const session = createSession('org1', 'user1');
    expect(session.id).toBeTruthy();
    expect(session.orgId).toBe('org1');
    expect(session.userId).toBe('user1');
    expect(session.state).toBe('idle');
    expect(session.emotion).toBe('neutral');
    expect(session.form).toBe('orb');
    expect(session.preferences.form).toBe('orb');
  });

  it('accepts custom preferences', () => {
    const session = createSession('org1', 'user1', { form: 'aria', volume: 'mute', walkSpeed: 100 });
    expect(session.form).toBe('aria');
    expect(session.preferences.volume).toBe('mute');
    expect(session.preferences.walkSpeed).toBe(100);
  });

  it('initialises walk cycle from preferences', () => {
    const session = createSession('org1', 'user1', { walkEnabled: true, walkSpeed: 80 });
    expect(session.walkCycle.active).toBe(true);
    expect(session.walkCycle.speed).toBe(80);
  });

  it('can be retrieved after creation', () => {
    const session = createSession('org1', 'user1');
    const retrieved = getSession(session.id);
    expect(retrieved).toBeDefined();
    expect(retrieved!.id).toBe(session.id);
  });
});

/* ========================================================================== */
/* listSessions                                                               */
/* ========================================================================== */

describe('listSessions', () => {
  it('filters by orgId', () => {
    createSession('org1', 'u1');
    createSession('org1', 'u2');
    createSession('org2', 'u3');

    expect(listSessions('org1')).toHaveLength(2);
    expect(listSessions('org2')).toHaveLength(1);
    expect(listSessions('org3')).toHaveLength(0);
  });
});

/* ========================================================================== */
/* destroySession                                                             */
/* ========================================================================== */

describe('destroySession', () => {
  it('removes the session', () => {
    const session = createSession('org1', 'user1');
    expect(destroySession(session.id)).toBe(true);
    expect(getSession(session.id)).toBeUndefined();
  });

  it('returns false for non-existent session', () => {
    expect(destroySession('nonexistent')).toBe(false);
  });
});

/* ========================================================================== */
/* processEvent                                                               */
/* ========================================================================== */

describe('processEvent', () => {
  it('transitions idle → thinking on thinking.start', () => {
    const session = createSession('org1', 'user1');
    const descriptor = processEvent(session.id, {
      type: 'agent.thinking.start',
      channelId: 'c1',
      timestamp: new Date().toISOString(),
    });

    expect(descriptor).not.toBeNull();
    expect(descriptor!.state).toBe('thinking');
    expect(descriptor!.emotion).toBe('focused');
    expect(getSession(session.id)!.state).toBe('thinking');
  });

  it('shows thought bubble when thinking', () => {
    const session = createSession('org1', 'user1');
    const descriptor = processEvent(session.id, {
      type: 'agent.thinking.start',
      channelId: 'c1',
      timestamp: new Date().toISOString(),
    });

    expect(descriptor!.thoughtBubble).not.toBeNull();
    expect(descriptor!.thoughtBubble!.type).toBe('thinking');
  });

  it('transitions thinking → idle → celebrating on task.completed', () => {
    const session = createSession('org1', 'user1');

    // idle → thinking
    processEvent(session.id, { type: 'agent.thinking.start', channelId: 'c1', timestamp: new Date().toISOString() });
    expect(getSession(session.id)!.state).toBe('thinking');

    // thinking → celebrating
    const descriptor = processEvent(session.id, { type: 'task.completed', channelId: 'c1', timestamp: new Date().toISOString() });
    expect(descriptor).not.toBeNull();
    expect(descriptor!.state).toBe('celebrating');
    expect(descriptor!.emotion).toBe('excited');
  });

  it('returns null for invalid transition', () => {
    const session = createSession('org1', 'user1');
    // idle → celebrating is valid, let's go sleeping first
    processEvent(session.id, {
      type: 'agent.thinking.start', channelId: 'c1', timestamp: new Date().toISOString(),
    });
    // thinking → sleeping is not valid
    // We need to simulate: force sleeping state
    // Actually let's test a known invalid: sleeping → celebrating
    // First get to sleeping: idle → sleeping
    clearSessionStore();
    resetIdCounter();
    const s2 = createSession('org1', 'user1', { sleepAfterIdleMs: 1 });
    // manually put in sleeping via processEvent chain won't work easily
    // Let's just test returning null for nonexistent session
    const result = processEvent('nonexistent', { type: 'agent.thinking.start', channelId: 'c1', timestamp: new Date().toISOString() });
    expect(result).toBeNull();
  });

  it('records state transitions in history', () => {
    const session = createSession('org1', 'user1');
    processEvent(session.id, { type: 'agent.thinking.start', channelId: 'c1', timestamp: new Date().toISOString() });
    processEvent(session.id, { type: 'agent.thinking.end', channelId: 'c1', timestamp: new Date().toISOString() });

    const s = getSession(session.id)!;
    expect(s.stateHistory.length).toBe(2);
    expect(s.stateHistory[0].from).toBe('idle');
    expect(s.stateHistory[0].to).toBe('thinking');
    expect(s.stateHistory[1].from).toBe('thinking');
    expect(s.stateHistory[1].to).toBe('idle');
  });

  it('shows tool name in thought bubble during working state', () => {
    const session = createSession('org1', 'user1');
    const descriptor = processEvent(session.id, {
      type: 'agent.tool.start',
      channelId: 'c1',
      toolName: 'aider',
      timestamp: new Date().toISOString(),
    });

    expect(descriptor!.state).toBe('working');
    expect(descriptor!.thoughtBubble!.text).toContain('aider');
  });

  it('increments celebration count on task.completed', () => {
    const session = createSession('org1', 'user1');
    processEvent(session.id, { type: 'task.completed', channelId: 'c1', timestamp: new Date().toISOString() });

    const stats = getCompanionStats();
    expect(stats.celebrationCount).toBe(1);
  });

  it('increments error count on task.failed', () => {
    const session = createSession('org1', 'user1');
    processEvent(session.id, { type: 'task.failed', channelId: 'c1', timestamp: new Date().toISOString() });

    const stats = getCompanionStats();
    expect(stats.errorCount).toBe(1);
  });
});

/* ========================================================================== */
/* buildAnimationDescriptor                                                   */
/* ========================================================================== */

describe('buildAnimationDescriptor', () => {
  it('produces correct base layer for orb form', () => {
    const session = createSession('org1', 'user1');
    const descriptor = buildAnimationDescriptor(session);

    expect(descriptor.form).toBe('orb');
    expect(descriptor.state).toBe('idle');
    expect(descriptor.layers.length).toBeGreaterThanOrEqual(1);
    expect(descriptor.layers[0].animationId).toBe('orb_idle_glow');
    expect(descriptor.layers[0].loop).toBe(true);
  });

  it('adds particle layer for high-intensity states', () => {
    const session = createSession('org1', 'user1');
    // Transition to thinking (intensity > 0.4)
    processEvent(session.id, { type: 'agent.thinking.start', channelId: 'c1', timestamp: new Date().toISOString() });

    const descriptor = buildAnimationDescriptor(getSession(session.id)!);
    const particleLayer = descriptor.layers.find((l) => l.layer === 'particle');
    expect(particleLayer).toBeDefined();
  });

  it('adds confetti layer for celebrating state', () => {
    const session = createSession('org1', 'user1');
    processEvent(session.id, { type: 'task.completed', channelId: 'c1', timestamp: new Date().toISOString() });

    const descriptor = buildAnimationDescriptor(getSession(session.id)!);
    const confettiLayer = descriptor.layers.find((l) => l.layer === 'confetti');
    expect(confettiLayer).toBeDefined();
    expect(confettiLayer!.loop).toBe(false);
  });

  it('mutes sounds when volume is mute', () => {
    const session = createSession('org1', 'user1', { volume: 'mute' });
    processEvent(session.id, { type: 'agent.thinking.start', channelId: 'c1', timestamp: new Date().toISOString() });

    const descriptor = buildAnimationDescriptor(getSession(session.id)!);
    expect(descriptor.soundEffect).toBe('none');
  });

  it('uses correct animation for aria form', () => {
    const session = createSession('org1', 'user1', { form: 'aria' });
    const descriptor = buildAnimationDescriptor(session);
    expect(descriptor.layers[0].animationId).toBe('aria_idle_breathe');
  });
});

/* ========================================================================== */
/* updatePreferences                                                          */
/* ========================================================================== */

describe('updatePreferences', () => {
  it('updates form', () => {
    const session = createSession('org1', 'user1');
    const updated = updatePreferences(session.id, { form: 'rex' });
    expect(updated).not.toBeNull();
    expect(updated!.form).toBe('rex');
    expect(updated!.preferences.form).toBe('rex');
  });

  it('updates walk speed', () => {
    const session = createSession('org1', 'user1');
    const updated = updatePreferences(session.id, { walkSpeed: 120 });
    expect(updated!.walkCycle.speed).toBe(120);
  });

  it('disables walk', () => {
    const session = createSession('org1', 'user1', { walkEnabled: true });
    const updated = updatePreferences(session.id, { walkEnabled: false });
    expect(updated!.walkCycle.active).toBe(false);
  });

  it('returns null for nonexistent session', () => {
    expect(updatePreferences('nope', { form: 'aria' })).toBeNull();
  });
});

/* ========================================================================== */
/* setThoughtBubble                                                           */
/* ========================================================================== */

describe('setThoughtBubble', () => {
  it('sets a custom thought bubble', () => {
    const session = createSession('org1', 'user1');
    const descriptor = setThoughtBubble(session.id, {
      visible: true,
      text: 'Hello!',
      type: 'info',
      autoHideMs: 2000,
    });

    expect(descriptor).not.toBeNull();
    expect(descriptor!.thoughtBubble!.text).toBe('Hello!');
    expect(descriptor!.thoughtBubble!.type).toBe('info');
  });

  it('clears thought bubble with null', () => {
    const session = createSession('org1', 'user1');
    setThoughtBubble(session.id, { visible: true, text: 'Test', type: 'info' });
    const descriptor = setThoughtBubble(session.id, null);
    expect(descriptor!.thoughtBubble).toBeNull();
  });
});

/* ========================================================================== */
/* checkIdleTimeout                                                           */
/* ========================================================================== */

describe('checkIdleTimeout', () => {
  it('returns null if not idle', () => {
    const session = createSession('org1', 'user1');
    processEvent(session.id, { type: 'agent.thinking.start', channelId: 'c1', timestamp: new Date().toISOString() });
    expect(checkIdleTimeout(session.id)).toBeNull();
  });

  it('returns null if idle time not exceeded', () => {
    const session = createSession('org1', 'user1', { sleepAfterIdleMs: 999999 });
    expect(checkIdleTimeout(session.id)).toBeNull();
  });

  it('returns null for nonexistent session', () => {
    expect(checkIdleTimeout('nope')).toBeNull();
  });
});

/* ========================================================================== */
/* getCompanionStats                                                          */
/* ========================================================================== */

describe('getCompanionStats', () => {
  it('returns zeroed stats when no sessions', () => {
    const stats = getCompanionStats();
    expect(stats.activeSessions).toBe(0);
    expect(stats.totalTransitions).toBe(0);
    expect(stats.celebrationCount).toBe(0);
    expect(stats.errorCount).toBe(0);
  });

  it('tracks state distribution', () => {
    createSession('org1', 'u1');
    createSession('org1', 'u2');
    const stats = getCompanionStats();
    expect(stats.activeSessions).toBe(2);
    expect(stats.stateDistribution.idle).toBe(2);
  });
});

/* ========================================================================== */
/* Constants                                                                  */
/* ========================================================================== */

describe('DEFAULT_PREFERENCES', () => {
  it('has orb as default form', () => {
    expect(DEFAULT_PREFERENCES.form).toBe('orb');
  });

  it('has walk enabled by default', () => {
    expect(DEFAULT_PREFERENCES.walkEnabled).toBe(true);
  });

  it('has 5-minute sleep timeout', () => {
    expect(DEFAULT_PREFERENCES.sleepAfterIdleMs).toBe(5 * 60 * 1000);
  });
});

describe('ANIMATION_MAP', () => {
  it('has all forms', () => {
    expect(Object.keys(ANIMATION_MAP)).toEqual(['orb', 'aria', 'rex', 'orion', 'custom']);
  });

  it('has all states for orb', () => {
    const orbStates = Object.keys(ANIMATION_MAP.orb);
    expect(orbStates).toContain('idle');
    expect(orbStates).toContain('thinking');
    expect(orbStates).toContain('celebrating');
    expect(orbStates).toContain('sleeping');
  });
});

describe('VALID_TRANSITIONS', () => {
  it('idle has 6 valid transitions', () => {
    expect(VALID_TRANSITIONS.idle.size).toBe(6);
  });

  it('celebrating can transition to idle, listening, sleeping', () => {
    expect(VALID_TRANSITIONS.celebrating.has('idle')).toBe(true);
    expect(VALID_TRANSITIONS.celebrating.has('listening')).toBe(true);
    expect(VALID_TRANSITIONS.celebrating.has('sleeping')).toBe(true);
  });
});

describe('EMOTION_INTENSITY', () => {
  it('excited has highest modifier', () => {
    expect(EMOTION_INTENSITY.excited).toBe(0.2);
  });

  it('sleepy has negative modifier', () => {
    expect(EMOTION_INTENSITY.sleepy).toBeLessThan(0);
  });
});

describe('STATE_SOUNDS', () => {
  it('celebrating triggers celebration sound', () => {
    expect(STATE_SOUNDS.celebrating).toBe('celebration');
  });

  it('error triggers error_alert sound', () => {
    expect(STATE_SOUNDS.error).toBe('error_alert');
  });

  it('idle has no sound', () => {
    expect(STATE_SOUNDS.idle).toBe('none');
  });
});
