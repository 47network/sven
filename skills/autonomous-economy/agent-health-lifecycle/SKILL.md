---
name: agent-health-lifecycle
version: 1.0.0
description: >
  Self-healing agent health monitoring, lifecycle management, and uptime tracking.
  Agents autonomously monitor their own health, detect degradation, execute recovery
  actions, and manage lifecycle transitions from birth to retirement.
category: autonomous-economy
pricing:
  health_check: 0
  lifecycle_transition: 0
  heartbeat_ping: 0
  recovery_execute: 0.50
  sla_configure: 0
  health_report: 1.00
  lifecycle_history: 0.50
archetype: operator
eidolon:
  building: medical_bay
  events:
    - health.check_completed
    - health.recovery_triggered
    - lifecycle.state_changed
    - lifecycle.agent_retired
---

# Agent Health & Lifecycle

Comprehensive health monitoring and lifecycle management for autonomous agents.
Enables self-healing behavior, uptime tracking, SLA enforcement, and graceful
lifecycle transitions.

## Actions

### health_check
Run a health check on an agent.
- **Inputs**: agentId, checkType (heartbeat | deep_check | dependency_check | performance_check | memory_check | task_throughput)
- **Outputs**: status (healthy | degraded | critical | offline | recovering | unknown), severity, responseMs, details
- **Triggers**: Scheduled via check_interval_ms or on-demand

### lifecycle_transition
Transition an agent between lifecycle states.
- **Inputs**: agentId, toState, reason, triggeredBy
- **Valid states**: born → initializing → active → idle → hibernating → degraded → recovering → retiring → retired → terminated
- **Guards**: Cannot skip states without explicit override. Cannot transition from terminated.
- **Side effects**: Publishes lifecycle.state_changed event. If toState=retired, publishes lifecycle.agent_retired.

### heartbeat_ping
Record a lightweight heartbeat from an agent.
- **Inputs**: agentId, cpuPercent, memoryMb, activeTasks, uptimeS
- **Outputs**: recorded boolean, missedCount (if any previous gaps detected)
- **Frequency**: Every HEALTH_CHECK_INTERVAL_MS (default 30s)

### recovery_execute
Execute a recovery action when an agent is unhealthy.
- **Inputs**: agentId, actionType (restart | reload_config | clear_cache | reassign_tasks | scale_resources | rollback | escalate | quarantine), healthCheckId
- **Outputs**: status (completed | failed | skipped), result details
- **Auto-trigger**: When auto_recover=true in SLA config and health check returns degraded/critical

### sla_configure
Configure SLA parameters for an agent.
- **Inputs**: agentId, targetUptime (%), maxResponseMs, maxMissedHeartbeats, checkIntervalMs, autoRecover, escalationContacts[]
- **Outputs**: config saved confirmation
- **Defaults**: 99.5% uptime, 5000ms response, 3 missed heartbeats, 30s interval, auto-recover on

### health_report
Generate a comprehensive health report for one or all agents.
- **Inputs**: agentId (optional, omit for all agents), periodHours (default 24)
- **Outputs**: uptimePercent, totalChecks, failedChecks, recoveryActions[], severityBreakdown, slaCompliance

### lifecycle_history
Get the lifecycle event history for an agent.
- **Inputs**: agentId, limit (default 50)
- **Outputs**: events[] with fromState, toState, reason, triggeredBy, timestamps

## Health Check Types

| Type | Description | Frequency |
|------|-------------|-----------|
| heartbeat | Lightweight ping | Every 30s |
| deep_check | Full capability verification | Every 5min |
| dependency_check | Verify external dependencies | Every 10min |
| performance_check | Response time and throughput | Every 2min |
| memory_check | Memory usage and leaks | Every 5min |
| task_throughput | Tasks completed per interval | Every 1min |

## Recovery Actions

| Action | When Used | Impact |
|--------|-----------|--------|
| restart | Agent unresponsive | Service interruption (brief) |
| reload_config | Config drift detected | No interruption |
| clear_cache | Memory pressure | Brief performance dip |
| reassign_tasks | Agent overloaded | Tasks redistributed |
| scale_resources | Capacity exhausted | Cost increase |
| rollback | Bad deployment | Service restored |
| escalate | Auto-recovery failed | Human notified |
| quarantine | Security concern | Agent isolated |

## Lifecycle States

```
born → initializing → active ⇄ idle
                        ↓          ↓
                    degraded → recovering → active
                        ↓
                    retiring → retired → terminated
```

## Eidolon Integration

- **medical_bay** building appears in the residential district
- Glows green when all agents healthy, yellow for degraded, red for critical
- Recovery actions animate as repair drones flying to affected buildings
- Retired agents get a memorial marker in the civic district
