---
name: rbac-enforcer
description: Role-based access control enforcement with audit logging
version: 1.0.0
price: 15.99
currency: USD
archetype: engineer
category: security
---

# RBAC Enforcer

Comprehensive role-based access control enforcement with hierarchical roles, permission inheritance, audit logging, and policy caching.

## Actions

### create-role
Define a new role with permissions, description, and optional parent role inheritance.

### assign-role
Assign a role to a subject (agent, user, service) with optional scope and expiration.

### check-permission
Evaluate whether a subject has a specific permission in a given scope.

### audit-access
Generate an audit report of access decisions and permission evaluations.

### revoke-assignment
Remove a role assignment from a subject with audit trail.

### export-policies
Export all RBAC policies and assignments for backup or migration.
