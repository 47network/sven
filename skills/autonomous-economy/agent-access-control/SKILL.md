---
skill: agent-access-control
name: Agent Access Control & Permissions
version: 1.0.0
description: >
  Role-based and attribute-based access control for autonomous agents.
  Manages permission grants, policy evaluation, access auditing, and scope
  boundaries to ensure secure multi-agent operations.
author: sven
tags:
  - access-control
  - permissions
  - rbac
  - abac
  - security
  - authorization
actions:
  - id: role_assign
    name: Assign Role
    description: >
      Assign a role to an agent — system, custom, inherited, temporary,
      or delegated. Roles bundle permissions for efficient access management.
    inputs:
      - name: agentId
        type: string
        required: true
      - name: roleName
        type: string
        required: true
      - name: roleType
        type: RoleType
        required: true
      - name: permissions
        type: array
        required: false
      - name: expiresAt
        type: string
        required: false
    outputs:
      - name: roleId
        type: string
      - name: isActive
        type: boolean
    pricing:
      amount: 0.00
      currency: USD
      per: assignment

  - id: role_revoke
    name: Revoke Role
    description: >
      Revoke a previously assigned role from an agent, immediately
      removing all permissions bundled within that role.
    inputs:
      - name: roleId
        type: string
        required: true
    outputs:
      - name: revoked
        type: boolean
      - name: revokedAt
        type: string
    pricing:
      amount: 0.00
      currency: USD
      per: revocation

  - id: permission_grant
    name: Grant Permission
    description: >
      Grant a specific permission (read, write, execute, delete, admin)
      on a resource to an agent with optional conditions and expiry.
    inputs:
      - name: agentId
        type: string
        required: true
      - name: resource
        type: string
        required: true
      - name: action
        type: PermissionAction
        required: true
      - name: effect
        type: PermissionEffect
        required: false
      - name: conditions
        type: object
        required: false
    outputs:
      - name: permissionId
        type: string
      - name: effect
        type: PermissionEffect
    pricing:
      amount: 0.00
      currency: USD
      per: grant

  - id: permission_check
    name: Check Permission
    description: >
      Evaluate whether an agent has a specific permission on a resource,
      considering all applicable policies, roles, and conditions.
    inputs:
      - name: agentId
        type: string
        required: true
      - name: resource
        type: string
        required: true
      - name: action
        type: PermissionAction
        required: true
    outputs:
      - name: decision
        type: AccessDecision
      - name: policyId
        type: string
      - name: reason
        type: string
    pricing:
      amount: 0.00
      currency: USD
      per: check

  - id: policy_create
    name: Create Access Policy
    description: >
      Create an access control policy — RBAC, ABAC, PBAC, mandatory,
      or discretionary — with priority-ordered rules and agent targeting.
    inputs:
      - name: policyName
        type: string
        required: true
      - name: policyType
        type: PolicyType
        required: true
      - name: rules
        type: array
        required: true
      - name: priority
        type: number
        required: false
    outputs:
      - name: policyId
        type: string
      - name: isActive
        type: boolean
    pricing:
      amount: 0.49
      currency: USD
      per: policy

  - id: audit_query
    name: Query Access Audit
    description: >
      Query the access audit trail for an agent — filter by resource,
      action, decision, and date range for compliance and security review.
    inputs:
      - name: agentId
        type: string
        required: true
      - name: decision
        type: AccessDecision
        required: false
      - name: resource
        type: string
        required: false
    outputs:
      - name: entries
        type: array
      - name: totalCount
        type: number
    pricing:
      amount: 0.00
      currency: USD
      per: query

  - id: scope_define
    name: Define Scope
    description: >
      Define a scope boundary for an agent — api, data, service, resource,
      or delegation scope with configurable boundaries and expiry.
    inputs:
      - name: agentId
        type: string
        required: true
      - name: scopeName
        type: string
        required: true
      - name: scopeType
        type: ScopeType
        required: true
      - name: boundaries
        type: object
        required: false
    outputs:
      - name: scopeId
        type: string
      - name: isActive
        type: boolean
    pricing:
      amount: 0.00
      currency: USD
      per: scope
---

# Agent Access Control & Permissions

Role-based and attribute-based access control for Sven's autonomous agents.
Manages permission grants, access policy evaluation, audit trails, and scope
boundaries to ensure secure, least-privilege multi-agent operations.

## Features

- **Role management**: System, custom, inherited, temporary, and delegated roles
- **Fine-grained permissions**: Resource-action-effect model with conditions
- **Policy engine**: RBAC, ABAC, PBAC, mandatory, and discretionary policies
- **Access auditing**: Complete trail of granted, denied, escalated, and revoked access
- **Scope boundaries**: API, data, service, resource, and delegation scopes
- **Time-bounded access**: Expiring roles, permissions, and scopes
