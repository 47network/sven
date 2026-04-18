---
name: agent-traffic-shaping
triggers:
  - traffic_create_rule
  - traffic_set_bandwidth
  - traffic_set_qos
  - traffic_measure_usage
  - traffic_enforce_limits
  - traffic_report
intents:
  - Define traffic shaping rules for ingress and egress
  - Configure bandwidth limits and burst policies
  - Apply QoS policies with DSCP marking
outputs:
  - Traffic rule confirmations
  - Bandwidth usage reports
  - QoS policy enforcement summaries
---

# Agent Traffic Shaping

Controls network traffic flow with rule-based shaping, bandwidth limiting, and QoS policy enforcement across services.
