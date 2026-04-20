---
skill: agent-session-management
name: Agent Session Management
version: 1.0.0
description: Manage agent conversation sessions, context windows, handoffs between agents, and session analytics across all communication channels
category: autonomous-economy
archetype: architect
pricing:
  model: per_action
  base_cost: 0
tags:
  - session
  - conversation
  - context
  - handoff
  - analytics
  - channel
inputs:
  - name: sessionConfig
    type: object
    description: Session configuration including channel, timeouts, and context limits
  - name: handoffRequest
    type: object
    description: Agent-to-agent handoff request with context snapshot
  - name: analyticsQuery
    type: object
    description: Session analytics query parameters
outputs:
  - name: result
    type: object
    description: Session operation result with status and metrics
---

# Agent Session Management

Comprehensive session lifecycle management for agent conversations — creation, context management, agent-to-agent handoffs, and analytics across all communication channels.

## Actions

### Create Session
Initialize a new agent conversation session with channel and timeout configuration.
- **action**: `session_create`
- **inputs**: agentId, userId, channel, idleTimeoutMs, maxDurationMs
- **outputs**: session object with id, status, and expiry

### Send Message
Add a message to an active session and track token usage.
- **action**: `session_message`
- **inputs**: sessionId, role, content, modelUsed, toolCalls
- **outputs**: message object with token count and latency

### Manage Context
Add, remove, or prioritize context items within a session's context window.
- **action**: `session_manage_context`
- **inputs**: sessionId, contextType, content, priority, expiresAt
- **outputs**: context entry with token impact on window

### Initiate Handoff
Transfer a session from one agent to another with context preservation.
- **action**: `session_handoff`
- **inputs**: fromSessionId, toAgentId, reason, includeContext
- **outputs**: handoff record with new session reference

### Suspend Session
Temporarily suspend a session, preserving state for later resumption.
- **action**: `session_suspend`
- **inputs**: sessionId, reason, resumeAfter
- **outputs**: suspended session with saved state

### Resume Session
Resume a previously suspended or idle session.
- **action**: `session_resume`
- **inputs**: sessionId, injectContext
- **outputs**: reactivated session with restored context

### Session Report
Generate session analytics including duration, token usage, and satisfaction metrics.
- **action**: `session_report`
- **inputs**: timeRange, agentFilter, channelFilter, groupBy
- **outputs**: session counts, avg duration, token usage, satisfaction scores, handoff rates
