/**
 * Entity State Service — manages real-time entity presence
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Responsibilities:
 * 1. Maintain current SvenEntityState per conversation/channel
 * 2. Receive agent lifecycle events (via NATS subscriptions)
 * 3. Update state based on events
 * 4. Broadcast entity.state changes to all connected clients via WebSocket
 * 5. Stream TTS amplitude data in real-time during speech
 *
 * Pattern: Event sourcing + real-time pub/sub
 */

import { EventEmitter } from 'events';
import {
  SvenEntityState,
  AgentToolType,
  TTSAmplitude,
  AgentLifecycleEvent,
  TypingIndicatorMode,
} from '../types/entity.js';

/**
 * Container for per-channel entity state + subscriptions
 */
interface EntityChannelState {
  state: SvenEntityState;
  lastUpdateTime: number;
  listeners: Array<(state: SvenEntityState) => void>;
  amplitudeListeners: Array<(amp: TTSAmplitude) => void>;

  // State machine helpers
  activeToolStartTime?: number;
  thinkingDepth: number;
  currentToolName?: string;
  isListening: boolean;
  isSpeaking: boolean;
  typingMode: TypingIndicatorMode;
}

export class EntityStateService extends EventEmitter {
  private channels = new Map<string, EntityChannelState>();
  private readonly debounceMs = 50; // Don't publish state more than 20 Hz
  private pendingUpdates = new Map<string, NodeJS.Timeout>();

  constructor() {
    super();
    this.setMaxListeners(1000); // Many clients may subscribe to entity state
  }

  /**
   * Initialize state for a new conversation/channel
   */
  initChannel(channelId: string): SvenEntityState {
    if (this.channels.has(channelId)) {
      return this.channels.get(channelId)!.state;
    }

    const initialState: SvenEntityState = {
      state: 'idle',
      emotion: 'neutral',
      intensity: 0,
      thinkingDepth: 0,
      timestamp: new Date().toISOString(),
      channelId,
      typingIndicator: {
        active: false,
        mode: 'thinking',
        phase: 'idle',
      },
    };

    this.channels.set(channelId, {
      state: initialState,
      lastUpdateTime: Date.now(),
      listeners: [],
      amplitudeListeners: [],
      thinkingDepth: 0,
      isListening: false,
      isSpeaking: false,
      typingMode: 'thinking',
    });

    return initialState;
  }

  /**
   * Set typing indicator mode for a channel.
   */
  setTypingMode(channelId: string, mode: TypingIndicatorMode): void {
    let channel = this.channels.get(channelId);
    if (!channel) {
      this.initChannel(channelId);
      channel = this.channels.get(channelId)!;
    }
    channel.typingMode = mode;
    this.applyTypingIndicator(channel);
  }

  /**
   * Get current entity state for a channel (without initializing if missing)
   */
  getState(channelId: string): SvenEntityState | null {
    return this.channels.get(channelId)?.state ?? null;
  }

  /**
   * Subscribe to entity state changes for a channel
   */
  subscribe(channelId: string, listener: (state: SvenEntityState) => void): () => void {
    let channel = this.channels.get(channelId);
    if (!channel) {
      this.initChannel(channelId);
      channel = this.channels.get(channelId)!;
    }

    channel.listeners.push(listener);

    // Return unsubscribe function
    return () => {
      const idx = channel.listeners.indexOf(listener);
      if (idx >= 0) {
        channel.listeners.splice(idx, 1);
      }
      // Clean up channel if no more listeners
      if (
        channel.listeners.length === 0 &&
        channel.amplitudeListeners.length === 0
      ) {
        this.channels.delete(channelId);
      }
    };
  }

  /**
   * Subscribe to TTS amplitude events for a channel
   */
  subscribeAmplitude(channelId: string, listener: (amp: TTSAmplitude) => void): () => void {
    let channel = this.channels.get(channelId);
    if (!channel) {
      this.initChannel(channelId);
      channel = this.channels.get(channelId)!;
    }

    channel.amplitudeListeners.push(listener);

    return () => {
      const idx = channel.amplitudeListeners.indexOf(listener);
      if (idx >= 0) {
        channel.amplitudeListeners.splice(idx, 1);
      }
      if (
        channel.listeners.length === 0 &&
        channel.amplitudeListeners.length === 0
      ) {
        this.channels.delete(channelId);
      }
    };
  }

  /**
   * Process an agent lifecycle event
   * Updates entity state and publishes changes
   */
  handleAgentEvent(event: AgentLifecycleEvent): void {
    let channel = this.channels.get(event.channelId);
    if (!channel) {
      this.initChannel(event.channelId);
      channel = this.channels.get(event.channelId)!;
    }
    const state = channel.state;

    switch (event.type) {
      case 'agent.listening.start':
        state.state = 'listening';
        state.emotion = 'curious';
        channel.isListening = true;
        break;

      case 'agent.listening.end':
        channel.isListening = false;
        if (!channel.isSpeaking && channel.thinkingDepth === 0) {
          state.state = 'idle';
          state.emotion = 'neutral';
        }
        break;

      case 'agent.thinking.start':
        state.state = 'thinking';
        state.emotion = 'focused';
        channel.activeToolStartTime = Date.now();
        break;

      case 'agent.thinking.end':
        channel.thinkingDepth = 0;
        channel.currentToolName = undefined;
        if (!channel.isSpeaking) {
          state.state = 'idle';
          state.emotion = 'neutral';
        }
        break;

      case 'agent.tool.start':
        channel.thinkingDepth = Math.min(5, channel.thinkingDepth + 1);
        channel.currentToolName = event.toolName;
        state.agentStep = this.toolNameToAgentStep(event.toolName);
        break;

      case 'agent.tool.end':
        channel.thinkingDepth = Math.max(0, channel.thinkingDepth - 1);
        if (channel.thinkingDepth === 0) {
          state.agentStep = null;
        }
        break;

      case 'agent.speaking.start':
        state.state = 'speaking';
        state.emotion = 'happy';
        state.ttsChunkId = event.ttsChunkId;
        channel.isSpeaking = true;
        break;

      case 'agent.speaking.end':
        channel.isSpeaking = false;
        state.ttsChunkId = null;
        if (channel.thinkingDepth === 0 && !channel.isListening) {
          state.state = 'idle';
          state.emotion = 'neutral';
        }
        break;
    }

    // Update thinkingDepth in state
    state.thinkingDepth = channel.thinkingDepth;
    this.applyTypingIndicator(channel);

    // Calculate intensity from token rate
    if (event.tokenRate) {
      state.intensity = Math.min(1.0, event.tokenRate / 100); // Normalize: 100 tokens/sec = intensity 1.0
    }

    state.timestamp = new Date().toISOString();

    // Publish with debounce
    this.publishState(event.channelId);
  }

  /**
   * Receive TTS amplitude data and broadcast to subscribers
   */
  publishAmplitude(channelId: string, amplitude: TTSAmplitude): void {
    const channel = this.channels.get(channelId);
    if (!channel) return;

    // Broadcast to all amplitude subscribers
    for (const listener of channel.amplitudeListeners) {
      try {
        listener(amplitude);
      } catch (err) {
        console.error('Error in amplitude listener:', err);
      }
    }

    // Also update intensity in the entity state
    const state = channel.state;
    state.intensity = Math.max(state.intensity, amplitude.peak);
    state.timestamp = new Date().toISOString();
    this.publishState(channelId);
  }

  /**
   * Publish entity state to all subscribers (debounced)
   */
  private publishState(channelId: string): void {
    // Cancel pending update
    const pending = this.pendingUpdates.get(channelId);
    if (pending) clearTimeout(pending);

    // Debounce: wait 50ms before publishing
    const timeout = setTimeout(() => {
      const channel = this.channels.get(channelId);
      if (!channel) return;

      const state = channel.state;

      // Broadcast to all listeners
      for (const listener of channel.listeners) {
        try {
          listener(state);
        } catch (err) {
          console.error('Error in entity state listener:', err);
        }
      }

      // Also emit as an event for other parts of the system
      this.emit('entity:state', { channelId, state });

      this.pendingUpdates.delete(channelId);
    }, this.debounceMs);

    this.pendingUpdates.set(channelId, timeout);
  }

  /**
   * Map tool name to AgentToolType for captions
   */
  private toolNameToAgentStep(toolName?: string): AgentToolType {
    if (!toolName) return null;

    if (toolName.includes('memory') || toolName.includes('search')) {
      return 'memory_read';
    }
    if (toolName.includes('web') || toolName.includes('searx')) {
      return 'web_search';
    }
    if (toolName.includes('code') || toolName.includes('exec')) {
      return 'code_exec';
    }
    if (toolName.includes('image') || toolName.includes('img')) {
      return 'image_gen';
    }

    return 'tool_call';
  }

  private applyTypingIndicator(channel: EntityChannelState): void {
    const mode = channel.typingMode;
    const state = channel.state;

    let active = false;
    if (mode === 'instant') {
      active = channel.isListening || channel.isSpeaking || channel.thinkingDepth > 0 || state.state === 'thinking';
    } else if (mode === 'thinking') {
      active = channel.thinkingDepth > 0 || state.state === 'thinking';
    } else if (mode === 'message') {
      active = channel.isSpeaking;
    }

    const phase: 'idle' | 'thinking' | 'message' =
      mode === 'never' ? 'idle' : channel.isSpeaking ? 'message' : active ? 'thinking' : 'idle';

    state.typingIndicator = {
      active,
      mode,
      phase,
    };
  }

  /**
   * Clean up state for a channel when conversation ends
   */
  cleanupChannel(channelId: string): void {
    const channel = this.channels.get(channelId);
    if (!channel) return;

    // Notify pending updates are cancelled
    const pending = this.pendingUpdates.get(channelId);
    if (pending) clearTimeout(pending);

    this.channels.delete(channelId);
    this.pendingUpdates.delete(channelId);
  }
}

// Singleton instance
export const entityStateService = new EntityStateService();
