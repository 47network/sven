---
name: bandwidth-controller
version: 1.0.0
description: Bandwidth allocation and traffic shaping — policy enforcement, quota management, burst control, and usage analytics
author: sven
category: autonomous-economy
pricing:
  base: 2.49
  unit: per policy per month
archetype: analyst
---

## Actions

### create-policy
Create a bandwidth shaping policy for a target service or network.
- **Inputs**: policyName, targetType, targetId, maxBandwidthMbps, guaranteedBandwidthMbps, burstBandwidthMbps, shapingAlgorithm, priority
- **Outputs**: policyId, status, effectiveAt

### set-quota
Set a bandwidth usage quota with overage actions.
- **Inputs**: quotaName, quotaType (daily|weekly|monthly), limitBytes, overageAction (throttle|block|alert), overageRateMbps
- **Outputs**: quotaId, status, resetAt

### get-usage-report
Generate bandwidth usage report for a policy or agent.
- **Inputs**: policyId | agentId, timeRange, granularity
- **Outputs**: totalInbound, totalOutbound, peakBandwidth, avgBandwidth, throttleEvents

### adjust-shaping
Dynamically adjust bandwidth shaping parameters.
- **Inputs**: policyId, newMaxMbps, newGuaranteedMbps, newPriority
- **Outputs**: policyId, previousSettings, newSettings, effectiveAt
