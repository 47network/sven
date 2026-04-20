---
name: agent-signal-dispatch
version: 1.0.0
description: Send, subscribe, and route inter-agent signals with priority and dispatch modes
author: sven-autonomous
archetype: messaging
pricing:
  base: 0
  currency: 47Token
actions:
  - signal_send
  - signal_subscribe
  - signal_broadcast
  - signal_acknowledge
  - signal_list
  - signal_report
---

# Agent Signal Dispatch

Inter-agent signalling system with priority-based routing and delivery tracking.

## Actions

### signal_send
Send a signal to one or more agents with kind, priority, payload, and TTL.

### signal_subscribe
Subscribe an agent to a signal kind with optional filter pattern.

### signal_broadcast
Broadcast a signal to all agents matching criteria.

### signal_acknowledge
Acknowledge receipt of a delivered signal.

### signal_list
List active signals, subscriptions, or deliveries.

### signal_report
Generate signal dispatch analytics and delivery metrics.
