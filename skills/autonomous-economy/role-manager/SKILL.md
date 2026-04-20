---
name: role-manager
description: Hierarchical role management with inheritance and assignment
version: 1.0.0
author: sven
tags: [security, roles, hierarchy, rbac, assignments]
archetype: analyst
price: 0.99
currency: USD
---

# Role Manager

Manage hierarchical roles with inheritance, permission bundles, and subject assignment with expiry.

## Actions

### create-role
Create a new role with permissions, optional parent role, and description.

### assign-role
Assign a role to a subject with optional expiry date.

### list-roles
List all roles with hierarchy tree visualization.

### get-effective-permissions
Calculate effective permissions for a subject including inherited roles.

### remove-assignment
Remove a role assignment from a subject.

### audit-assignments
Get audit trail of role changes for compliance reporting.
