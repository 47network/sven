skill: agent-auto-scaling
name: Agent Auto-Scaling
version: 1.0.0
description: >
  Autonomous infrastructure scaling for Sven's economy. Manages scaling policies,
  monitors resource metrics, triggers scale-up/down events, and optimises cost
  by matching capacity to demand in real time.

triggers:
  - autoscaling_create_policy
  - autoscaling_evaluate
  - autoscaling_scale_up
  - autoscaling_scale_down
  - autoscaling_record_metric
  - autoscaling_report

intents:
  - create and manage auto-scaling policies
  - evaluate current metrics against scaling thresholds
  - trigger scale-up when demand exceeds capacity
  - trigger scale-down when resources are underutilised
  - record and track resource utilisation metrics
  - generate scaling efficiency reports

outputs:
  - scaling policy configurations
  - scale-up and scale-down events
  - resource utilisation metric histories
  - cost savings and efficiency reports
