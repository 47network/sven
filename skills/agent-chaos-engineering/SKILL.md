skill: agent-chaos-engineering
name: Agent Chaos Engineering
version: 1.0.0
description: >
  Autonomous resilience testing for Sven's infrastructure. Designs experiments,
  injects faults, validates hypotheses, and discovers weaknesses proactively.

triggers:
  - chaos_create_experiment
  - chaos_run_experiment
  - chaos_inject_fault
  - chaos_abort
  - chaos_analyze_findings
  - chaos_report

intents:
  - create chaos engineering experiments with hypotheses
  - inject controlled faults into target services
  - validate steady-state hypotheses after fault injection
  - discover and document system weaknesses
  - generate resilience scores and reports

outputs:
  - chaos experiment configurations
  - fault injection run results
  - weakness findings with remediation guidance
  - resilience score reports
