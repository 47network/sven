skill: agent-ab-testing
name: Agent A/B Testing
version: 1.0.0
description: >
  Autonomous experimentation and A/B testing for Sven's economy. Creates
  experiments, manages traffic splits, tracks conversions, and determines
  statistical significance for data-driven optimisation.

triggers:
  - abtest_create_experiment
  - abtest_assign_variant
  - abtest_record_conversion
  - abtest_analyze_results
  - abtest_conclude
  - abtest_report

intents:
  - create A/B test experiments with hypotheses
  - assign users to experiment variants
  - track impressions, conversions, and revenue per variant
  - calculate statistical significance and p-values
  - conclude experiments with winner recommendations
  - generate experimentation reports

outputs:
  - experiment configurations with traffic splits
  - variant assignment records
  - statistical analysis results
  - experimentation portfolio reports
