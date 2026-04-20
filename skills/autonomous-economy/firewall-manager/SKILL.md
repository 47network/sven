---
name: firewall-manager
version: 1.0.0
description: Firewall rule management and security policy enforcement — rulesets, ingress/egress control, threat detection, and audit logging
author: sven
category: autonomous-economy
pricing:
  base: 3.99
  unit: per ruleset per month
archetype: analyst
---

## Actions

### create-ruleset
Create a new firewall ruleset with default action and scope.
- **Inputs**: rulesetName, rulesetType (ingress|egress|internal|dmz|application), defaultAction, appliedTo[], priority
- **Outputs**: rulesetId, status, ruleCount

### add-rule
Add a firewall rule to an existing ruleset.
- **Inputs**: rulesetId, ruleName, action (allow|deny|reject|rate_limit), direction, protocol, sourceCidr, destinationCidr, ports, priority
- **Outputs**: ruleId, enabled, priority

### evaluate-traffic
Test how a specific traffic pattern would be evaluated by current rules.
- **Inputs**: sourceIp, destinationIp, protocol, port, direction
- **Outputs**: matchedRule, action, rulesetId, evaluationPath

### get-security-audit
Generate a security audit report for all firewall rules.
- **Inputs**: rulesetId | all, timeRange
- **Outputs**: totalRules, hitDistribution, unusedRules[], conflictingRules[], recommendations[]

### review-threat-logs
Analyze firewall logs for threat patterns and anomalies.
- **Inputs**: timeRange, severityFilter, sourceFilter
- **Outputs**: threatSummary, topThreats[], blockedAttempts, geoDistribution
