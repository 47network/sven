---
name: agent-geo-fencing
version: 1.0.0
description: Geographic zone management with rule-based access control and location alerts
category: platform-ops
pricing: { model: per_request, base: 0.02 }
archetype: analyst
triggers:
  - geo_fence
  - geo_zone
  - geo_routing
  - location_policy
actions:
  - create_zone
  - create_rule
  - evaluate_location
  - get_alerts
  - list_zones
  - report
inputs:
  - name: action
    type: string
    required: true
  - name: zoneData
    type: object
    description: Zone definition with coordinates, type, radius
  - name: location
    type: object
    description: Location to evaluate (lat, lng, ip)
  - name: ruleConfig
    type: object
    description: Rule conditions and actions
outputs:
  - name: zone
    type: object
  - name: evaluation
    type: object
    description: Allow/deny/alert result for a location
  - name: alerts
    type: array
  - name: stats
    type: object
---

# Agent Geo-Fencing

Manages geographic zones and location-based access policies for services and agents.
