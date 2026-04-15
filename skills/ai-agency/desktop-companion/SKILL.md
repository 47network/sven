---
name: desktop-companion
description: >
  Animated desktop character state machine for Sven's Tauri companion app.
  Manages character form (ORB, ARIA, REX, ORION), state transitions
  (idle→thinking→speaking→celebrating), walk cycles, thought bubbles,
  sound effects, and real-time agent event sync.
version: 1.0.0
publisher: 47dynamics
handler_language: typescript
handler_file: handler.ts

inputs_schema:
  action:
    type: string
    required: true
    enum:
      - create_session
      - get_session
      - destroy_session
      - process_event
      - update_preferences
      - set_thought_bubble
      - get_animation
      - check_idle
      - list_sessions
      - get_stats
  session_id:
    type: string
    description: Companion session ID
  org_id:
    type: string
    description: Organisation ID for session scoping
  user_id:
    type: string
    description: User ID for session ownership
  form:
    type: string
    enum: [orb, aria, rex, orion, custom]
    description: Character form for the companion
  preferences:
    type: object
    description: Partial CompanionPreferences override
  event:
    type: object
    description: Agent lifecycle event to process
  thought_bubble:
    type: object
    description: Thought bubble to display

outputs_schema:
  result:
    type: object
    description: Action-specific result (session, animation descriptor, stats)

tags:
  - desktop
  - companion
  - animation
  - character
  - tauri
  - real-time

scope:
  orgs: all
  channels:
    - companion-desktop-tauri
---

# Desktop Companion Skill

Manages Sven's animated desktop character for the Tauri companion app.

## Architecture

```
Agent Runtime Events → NATS → Companion Engine → Animation Descriptors → Tauri Overlay
                                    ↑
                              State Machine
                         (idle/listening/thinking/
                          speaking/working/celebrating/
                          sleeping/error)
```

## Character Forms

| Form   | Style                    | Signature Animation      |
|--------|--------------------------|--------------------------|
| ORB    | Electric-blue sphere     | Glow pulse + spin        |
| ARIA   | Warm humanoid silhouette | Breathing + gestures     |
| REX    | Blocky geometric robot   | HUD grid + circuit       |
| ORION  | Flowing organic shape    | Water ripple + bloom     |
| custom | User-defined             | Custom animation assets  |

## Sound Effects

| Event           | Sound            |
|-----------------|------------------|
| Task complete   | Celebration chime|
| Error           | Subtle alert     |
| Thinking start  | Soft tone        |
| Wake up         | Rising tone      |

Volume levels: `mute`, `low`, `normal`. Custom sound pack support via `soundPack` preference.

## Walk Cycle

The character walks left-right along the screen edge (dock/taskbar).
Walk pauses during `sleeping` and `error` states. Configurable speed (20–200 px/sec)
and bounds (fraction of screen width).
