// ---------------------------------------------------------------------------
// Desktop Companion Skill Handler
// ---------------------------------------------------------------------------
// Dispatches to the companion engine for animated desktop character management.
// ---------------------------------------------------------------------------

import {
  createSession,
  getSession,
  destroySession,
  processEvent,
  updatePreferences,
  setThoughtBubble,
  buildAnimationDescriptor,
  checkIdleTimeout,
  listSessions,
  getCompanionStats,
  type CompanionPreferences,
  type AgentEvent,
  type ThoughtBubble,
  type CharacterForm,
} from '../../../services/agent-runtime/src/companion-engine';

export default async function handler(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const action = input.action as string;

  switch (action) {
    case 'create_session': {
      const orgId = (input.org_id as string) || 'default';
      const userId = input.user_id as string;
      if (!userId) return { error: 'user_id is required.' };

      const form = input.form as CharacterForm | undefined;
      const prefs = input.preferences as Partial<CompanionPreferences> | undefined;
      const mergedPrefs = form ? { ...prefs, form } : prefs;

      const session = createSession(orgId, userId, mergedPrefs);
      return {
        result: {
          session_id: session.id,
          state: session.state,
          form: session.form,
          emotion: session.emotion,
          preferences: session.preferences,
          message: `Companion session ${session.id} created with ${session.form} form.`,
        },
      };
    }

    case 'get_session': {
      const sessionId = input.session_id as string;
      if (!sessionId) return { error: 'session_id is required.' };

      const session = getSession(sessionId);
      if (!session) return { error: `Session ${sessionId} not found.` };

      return {
        result: {
          id: session.id,
          state: session.state,
          emotion: session.emotion,
          form: session.form,
          intensity: session.intensity,
          thought_bubble: session.thoughtBubble,
          walk_cycle: session.walkCycle,
          last_activity: session.lastActivityAt,
          transition_count: session.stateHistory.length,
        },
      };
    }

    case 'destroy_session': {
      const sessionId = input.session_id as string;
      if (!sessionId) return { error: 'session_id is required.' };

      const destroyed = destroySession(sessionId);
      if (!destroyed) return { error: `Session ${sessionId} not found.` };

      return { result: { session_id: sessionId, destroyed: true } };
    }

    case 'process_event': {
      const sessionId = input.session_id as string;
      if (!sessionId) return { error: 'session_id is required.' };

      const event = input.event as AgentEvent | undefined;
      if (!event || !event.type) return { error: 'event with type is required.' };

      // Ensure timestamp
      if (!event.timestamp) event.timestamp = new Date().toISOString();

      const descriptor = processEvent(sessionId, event);
      if (!descriptor) {
        return { error: 'Event could not be processed (session not found or invalid transition).' };
      }

      return {
        result: {
          state: descriptor.state,
          emotion: descriptor.emotion,
          intensity: descriptor.intensity,
          layers: descriptor.layers.length,
          sound_effect: descriptor.soundEffect,
          thought_bubble: descriptor.thoughtBubble,
          walk_cycle: descriptor.walkCycle,
        },
      };
    }

    case 'update_preferences': {
      const sessionId = input.session_id as string;
      if (!sessionId) return { error: 'session_id is required.' };

      const prefs = input.preferences as Partial<CompanionPreferences> | undefined;
      if (!prefs) return { error: 'preferences object is required.' };

      const session = updatePreferences(sessionId, prefs);
      if (!session) return { error: `Session ${sessionId} not found.` };

      return {
        result: {
          session_id: session.id,
          form: session.form,
          preferences: session.preferences,
          message: 'Preferences updated.',
        },
      };
    }

    case 'set_thought_bubble': {
      const sessionId = input.session_id as string;
      if (!sessionId) return { error: 'session_id is required.' };

      const bubble = input.thought_bubble as ThoughtBubble | null | undefined;
      const descriptor = setThoughtBubble(sessionId, bubble ?? null);
      if (!descriptor) return { error: `Session ${sessionId} not found.` };

      return {
        result: {
          state: descriptor.state,
          thought_bubble: descriptor.thoughtBubble,
        },
      };
    }

    case 'get_animation': {
      const sessionId = input.session_id as string;
      if (!sessionId) return { error: 'session_id is required.' };

      const session = getSession(sessionId);
      if (!session) return { error: `Session ${sessionId} not found.` };

      const descriptor = buildAnimationDescriptor(session);
      return { result: descriptor };
    }

    case 'check_idle': {
      const sessionId = input.session_id as string;
      if (!sessionId) return { error: 'session_id is required.' };

      const descriptor = checkIdleTimeout(sessionId);
      return {
        result: descriptor
          ? { transitioned: true, state: descriptor.state, emotion: descriptor.emotion }
          : { transitioned: false },
      };
    }

    case 'list_sessions': {
      const orgId = (input.org_id as string) || 'default';
      const sessions = listSessions(orgId);
      return {
        result: {
          count: sessions.length,
          sessions: sessions.map((s) => ({
            id: s.id,
            user_id: s.userId,
            state: s.state,
            form: s.form,
            emotion: s.emotion,
            last_activity: s.lastActivityAt,
          })),
        },
      };
    }

    case 'get_stats': {
      const stats = getCompanionStats();
      return { result: stats };
    }

    default:
      return {
        error: `Unknown action "${action}". Valid: create_session, get_session, destroy_session, process_event, update_preferences, set_thought_bubble, get_animation, check_idle, list_sessions, get_stats`,
      };
  }
}
