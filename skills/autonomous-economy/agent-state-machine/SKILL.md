---
skill: agent-state-machine
name: Agent State Machine
version: 1.0.0
description: Finite state machines for agent workflow orchestration — states, transitions, guards, and history
author: sven-autonomous-economy
archetype: architect
tags: [state-machine, fsm, workflow, orchestration, transitions]
price: 0
currency: 47Token
actions:
  - sm_create
  - sm_transition
  - sm_pause
  - sm_resume
  - sm_inspect
  - sm_template
  - sm_report
---

# Agent State Machine

Provides finite state machine management for complex agent workflow orchestration.
Define states, transitions with guards, and track full history.

## Actions

### sm_create
Create a new state machine from definition or template.
- **Input**: name, agentId, states, transitions, initialState, templateId
- **Output**: machineId, currentState, status

### sm_transition
Send an event to trigger a state transition.
- **Input**: machineId, eventName, context
- **Output**: result, fromState, toState, guardPassed, actionExecuted

### sm_pause
Pause a running state machine.
- **Input**: machineId, reason
- **Output**: machineId, previousStatus, newStatus

### sm_resume
Resume a paused state machine.
- **Input**: machineId
- **Output**: machineId, currentState, status

### sm_inspect
Inspect current machine state, available transitions, and history.
- **Input**: machineId, includeHistory, historyLimit
- **Output**: currentState, availableEvents, recentHistory, context

### sm_template
Create or instantiate a state machine template.
- **Input**: name, states, transitions, initialState, or templateId
- **Output**: templateId, version, stateCount, transitionCount

### sm_report
Report on all state machines — status distribution, bottlenecks.
- **Input**: agentId, status, includeMetrics
- **Output**: machineCount, statusBreakdown, avgTransitions, stuckMachines
