---
name: state-machine-engine
version: 1.0.0
description: Manages finite state machines for complex agent behavior with guard conditions and actions
author: sven-autonomous-economy
price: 0
currency: 47Token
archetype: analyst
tags: [state-machine, fsm, transitions, guards, behavior, workflow]
---

# State Machine Engine

Manages finite state machines for modeling complex agent behaviors. Supports guard
conditions, transition actions, context accumulation, and full transition history.

## Actions

- **create-machine**: Define a new state machine with states and transitions
- **send-event**: Trigger a state transition via event
- **get-state**: Get current machine state and context
- **get-history**: Get transition history for a machine
- **pause-machine**: Pause machine event processing
- **reset-machine**: Reset machine to initial state

## Inputs

- `machineName` — Human-readable machine name
- `definition` — States, transitions, guards, actions (JSON)
- `initialState` — Starting state name
- `event` — Event name to trigger transition
- `context` — Initial or updated context data

## Outputs

- `machineId` — Created machine identifier
- `currentState` — Current state name
- `previousState` — State before last transition
- `context` — Accumulated context data
- `transitionHistory` — Array of past transitions
