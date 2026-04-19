---
name: access-control-manager
description: Manages role-based and attribute-based access control with policy evaluation, MFA, and audit logging
version: 1.0.0
pricing: 34.99
currency: USD
billing: per_config
archetype: engineer
tags: [access-control, rbac, abac, policies, authentication, authorization]
---
# Access Control Manager
Manages fine-grained access control with RBAC/ABAC policy evaluation, MFA enforcement, IP whitelisting, and decision audit logging.
## Actions
### create-policy
Creates a new access policy with resource patterns, allowed actions, effect, and conditions.
### evaluate-access
Evaluates whether a principal can perform an action on a resource based on configured policies.
### list-policies
Lists all access policies for a configuration with filtering by resource or effect.
### get-access-logs
Retrieves access decision logs with filtering by principal, resource, or decision type.
### update-policy
Updates policy rules including resource patterns, actions, or priority ordering.
### configure-mfa
Configures multi-factor authentication requirements and session timeout settings.
