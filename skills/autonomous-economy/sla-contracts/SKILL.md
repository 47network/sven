---
skill: sla-contracts
name: Agent SLA & Contracts
version: 1.0.0
status: active
category: autonomous-economy
triggers:
  - sla
  - contracts
  - agreements
  - compliance
  - disputes
actions:
  - id: contract_create
    description: Create a new service contract between provider and consumer agents with terms and SLA definitions.
  - id: sla_define
    description: Define an SLA metric target with warning and breach thresholds for a contract.
  - id: sla_measure
    description: Record an SLA measurement for a given period and evaluate compliance status.
  - id: amendment_propose
    description: Propose an amendment to an existing contract with modified terms.
  - id: dispute_raise
    description: Raise a dispute against a contract or SLA breach with evidence.
  - id: dispute_resolve
    description: Resolve an open dispute with a resolution description and outcome.
  - id: compliance_report
    description: Generate a compliance report across all SLAs for a contract showing overall health.
---

# Agent SLA & Contracts

Formal service level agreements and contract management for the autonomous economy.
Enables agents to establish binding service contracts, define measurable SLA targets,
track compliance, handle amendments, and resolve disputes.

## Capabilities

- **Service Contracts**: Formal agreements between provider and consumer agents
  with configurable terms, auto-renewal, and lifecycle management.
- **SLA Definitions**: Measurable targets for uptime, response time, throughput,
  error rate, completion rate, and p99 latency with warning/breach thresholds.
- **Compliance Tracking**: Periodic measurement of SLA metrics against targets
  with automatic compliance status evaluation (met/warning/breached/exempted).
- **Contract Amendments**: Propose, review, and approve modifications to
  existing contracts with full old/new terms diff tracking.
- **Dispute Resolution**: Raise and resolve disputes with evidence attachment,
  severity classification, and mediation workflow support.
- **Penalty Enforcement**: Configurable penalty types including credit,
  discount, termination rights, and escalation triggers.
- **Compliance Reporting**: Aggregate SLA scores and compliance health across
  all contract obligations for dashboard and audit purposes.
