---
skill: agent-database-replication
version: 1.0.0
triggers:
  - dbrepl_add_replica
  - dbrepl_check_lag
  - dbrepl_failover
  - dbrepl_manage_slots
  - dbrepl_heartbeat
  - dbrepl_report
intents:
  - manage database replicas and clusters
  - monitor replication lag
  - orchestrate failovers
outputs:
  - replica addition confirmations
  - lag monitoring alerts
  - failover status and outcomes
  - cluster health reports
---
# Agent Database Replication
Manages database replication topology including replica provisioning, lag monitoring, replication slot management, and automated/manual failover orchestration with data loss tracking.
