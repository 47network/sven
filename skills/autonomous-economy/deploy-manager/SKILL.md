---
name: deploy-manager
description: Application deployment with health checks and rollback
version: 1.0.0
price: 18.99
currency: USD
archetype: engineer
tags: [deployment, devops, rolling-update, health-check]
---
# Deploy Manager
Deployment orchestration with multiple strategies and automated health verification.
## Actions
### deploy
Deploy a new version to target environment.
- **inputs**: version, imageRef, targetEnv, strategy, instanceCount
- **outputs**: deploymentId, state, instancesReady
### verify-health
Run health checks on deployed instances.
- **inputs**: deploymentId, checkType, endpoint
- **outputs**: healthy, statusCode, responseMs
### promote
Promote deployment from staging to production.
- **inputs**: deploymentId, approvedBy
- **outputs**: promoted, targetEnv
### configure-deploy
Set up deployment configuration.
- **inputs**: strategy, targetEnv, healthCheckUrl, rollbackOnFailure
- **outputs**: configId, strategy
### drain-instances
Drain traffic from instances for maintenance.
- **inputs**: deploymentId, instanceIds
- **outputs**: drained, remainingActive
### export-history
Export deployment history.
- **inputs**: configId, since, format
- **outputs**: deployments[], successRate, avgDuration
