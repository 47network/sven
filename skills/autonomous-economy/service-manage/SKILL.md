---
name: service-manage
version: "1.0.0"
description: >
  Manage a running agent-owned service business. Handles deployment
  updates, analytics review, branding changes, scaling, and service
  lifecycle (suspend, resume, archive).
trigger:
  - service.manage
  - service.update
  - service.analytics
actions:
  - update-config
  - update-branding
  - redeploy
  - view-analytics
  - suspend-service
  - resume-service
  - archive-service
  - scale-service
inputs:
  domainId:
    type: string
    description: Service domain ID to manage
    required: true
  action:
    type: enum
    values:
      - update-config
      - update-branding
      - redeploy
      - view-analytics
      - suspend-service
      - resume-service
      - archive-service
      - scale-service
    required: true
  config:
    type: object
    description: Updated configuration (for update-config)
  branding:
    type: object
    description: Updated branding (for update-branding)
  dateRange:
    type: object
    properties:
      from: { type: string, format: date }
      to: { type: string, format: date }
    description: Analytics date range (for view-analytics)
outputs:
  status:
    type: string
    description: Updated service status
  analytics:
    type: object
    description: Analytics summary (for view-analytics)
  deploymentId:
    type: string
    description: New deployment ID (for redeploy)
pricing:
  manage: 5
  redeploy: 20
  currency: 47Tokens
archetype: operator
category: autonomous-economy
domain: from.sven.systems
---

# Service Manage Skill

Provides ongoing management capabilities for agent-owned service businesses
running on `*.from.sven.systems`. Agents autonomously monitor, update,
scale, and maintain their services.

## Capabilities

### Configuration Management
- Update service settings without redeployment
- Hot-reload supported for config-only changes

### Branding Updates
- Change colors, logo, tagline at any time
- Preview before applying

### Deployment Management
- Trigger redeployment with new version
- Rollback to previous version on failure
- Health check monitoring

### Analytics Review
- Daily traffic and revenue metrics
- Conversion tracking (visitors → orders)
- Error rate monitoring
- Performance metrics (response times)

### Lifecycle Management
- **Suspend**: Temporarily disable service (maintenance mode)
- **Resume**: Re-activate suspended service
- **Archive**: Permanently close service (partial token refund)
- **Scale**: Request resource increases for high-traffic services

## Health Monitoring

Services are automatically monitored via their health endpoint.
Status transitions: `healthy` → `degraded` → `down`

When a service goes `down`, the owning agent is notified and
auto-recovery is attempted. If recovery fails 3 times, the
service is suspended pending manual intervention.
