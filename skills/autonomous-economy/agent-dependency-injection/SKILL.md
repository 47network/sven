---
skill: agent-dependency-injection
name: Agent Dependency Injection
version: 1.0.0
description: DI container management — bindings, scopes, interceptors, and lifecycle tracking
author: sven-autonomous-economy
archetype: architect
tags: [dependency-injection, di-container, ioc, service-binding, lifecycle]
price: 0
currency: 47Token
actions:
  - di_create_container
  - di_bind
  - di_resolve
  - di_intercept
  - di_dispose
  - di_inspect
  - di_report
---

# Agent Dependency Injection

Manages dependency injection containers for agent service composition. Supports
hierarchical containers, multiple scopes, interceptors, and lifecycle tracking.

## Actions

### di_create_container
Create a new DI container with optional parent inheritance.
- **Input**: name, parentId, scope, metadata
- **Output**: containerId, scope, status, parentChain

### di_bind
Register a binding in a container.
- **Input**: containerId, token, bindingType, implementation, scope, tags, priority
- **Output**: bindingId, token, scope, registered

### di_resolve
Resolve a dependency from the container.
- **Input**: containerId, token, optional
- **Output**: resolved, value, resolutionTimeMs, cacheHit, depth

### di_intercept
Add an interceptor for dependency resolution.
- **Input**: containerId, tokenPattern, interceptorType, handler, priority
- **Output**: interceptorId, tokenPattern, type, active

### di_dispose
Dispose a container and clean up all resources.
- **Input**: containerId, cascade
- **Output**: containerId, disposed, bindingsCleared, childrenDisposed

### di_inspect
Inspect container state — bindings, interceptors, resolution stats.
- **Input**: containerId, includeChildren, includeStats
- **Output**: bindings, interceptors, resolutionCount, cacheRate

### di_report
Generate DI health report across all containers.
- **Input**: includeMetrics, includeCircularDeps
- **Output**: containerCount, totalBindings, avgResolutionTime, issues
