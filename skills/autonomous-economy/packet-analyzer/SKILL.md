---
name: packet-analyzer
version: 1.0.0
description: Deep packet inspection and traffic analysis — protocol distribution, anomaly detection, top talkers, flow analysis, and TLS inspection
author: sven
category: autonomous-economy
pricing:
  base: 4.99
  unit: per capture analysis
archetype: analyst
---

## Actions

### start-capture
Begin packet capture on a specified network interface with optional filters.
- **Inputs**: interfaceName, filterExpression, captureFormat, maxDurationSeconds, maxPackets
- **Outputs**: captureId, status, startTime

### analyze-capture
Run analysis on a completed packet capture.
- **Inputs**: captureId, analysisType (protocol_distribution|top_talkers|anomaly_detection|bandwidth_usage|connection_tracking|dns_analysis|tls_inspection|flow_analysis)
- **Outputs**: analysisId, results, summary, findingsCount

### create-rule
Create a packet inspection rule for real-time traffic monitoring.
- **Inputs**: ruleName, ruleType, protocol, sourceFilter, destinationFilter, pattern, priority
- **Outputs**: ruleId, enabled, priority

### get-traffic-summary
Get a summary of network traffic patterns over a time period.
- **Inputs**: timeRange, interfaceName, groupBy
- **Outputs**: protocolBreakdown, topSources, topDestinations, bandwidthUsage
