import { describe, expect, it } from '@jest/globals';
import { EntityStateService } from '../services/EntityStateService.js';

describe('entity typing indicator modes', () => {
  it('thinking mode only activates during thinking/tool phases', () => {
    const svc = new EntityStateService();
    const channelId = 'typing-thinking';

    svc.setTypingMode(channelId, 'thinking');
    let state = svc.getState(channelId);
    expect(state?.typingIndicator).toEqual({ active: false, mode: 'thinking', phase: 'idle' });

    svc.handleAgentEvent({ type: 'agent.thinking.start', channelId });
    state = svc.getState(channelId);
    expect(state?.typingIndicator).toEqual({ active: true, mode: 'thinking', phase: 'thinking' });

    svc.handleAgentEvent({ type: 'agent.thinking.end', channelId });
    state = svc.getState(channelId);
    expect(state?.typingIndicator).toEqual({ active: false, mode: 'thinking', phase: 'idle' });
  });

  it('message mode activates while speaking and flips phase to message', () => {
    const svc = new EntityStateService();
    const channelId = 'typing-message';

    svc.setTypingMode(channelId, 'message');
    svc.handleAgentEvent({ type: 'agent.speaking.start', channelId, ttsChunkId: 'tts-1' });

    const speakingState = svc.getState(channelId);
    expect(speakingState?.typingIndicator).toEqual({ active: true, mode: 'message', phase: 'message' });

    svc.handleAgentEvent({ type: 'agent.speaking.end', channelId });
    const idleState = svc.getState(channelId);
    expect(idleState?.typingIndicator).toEqual({ active: false, mode: 'message', phase: 'idle' });
  });

  it('instant mode activates on listening/thinking/speaking and never mode always disables', () => {
    const svc = new EntityStateService();
    const channelId = 'typing-instant-never';

    svc.setTypingMode(channelId, 'instant');
    svc.handleAgentEvent({ type: 'agent.listening.start', channelId });
    let state = svc.getState(channelId);
    expect(state?.typingIndicator).toEqual({ active: true, mode: 'instant', phase: 'thinking' });

    svc.handleAgentEvent({ type: 'agent.listening.end', channelId });
    svc.handleAgentEvent({ type: 'agent.thinking.start', channelId });
    state = svc.getState(channelId);
    expect(state?.typingIndicator).toEqual({ active: true, mode: 'instant', phase: 'thinking' });

    svc.setTypingMode(channelId, 'never');
    state = svc.getState(channelId);
    expect(state?.typingIndicator).toEqual({ active: false, mode: 'never', phase: 'idle' });
  });
});
