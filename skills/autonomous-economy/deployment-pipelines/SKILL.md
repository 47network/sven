---
skill: deployment-pipelines
name: Agent Deployment Pipelines
category: autonomous-economy
archetype: engineer
version: 1.0.0
pricing:
  base: 0
  currency: 47Token
  model: per-deployment
description: >
  Manages the full agent deployment lifecycle including build, test, stage,
  deploy, and rollback operations across multiple environments.
inputs:
  - agentId
  - pipelineName
  - environment
  - triggerType
  - versionTag
  - config
outputs:
  - pipelineId
  - stages
  - artifacts
  - status
  - rollbackInfo
---

# Agent Deployment Pipelines

Comprehensive CI/CD pipeline management for autonomous agent deployment.
Handles multi-stage pipelines with build, test, security scanning,
staging, approval gates, deployment, and automated health checks.

## Actions

### pipeline_create
Create a new deployment pipeline for an agent.
- **Input**: agentId, pipelineName, environment, triggerType, config
- **Output**: pipelineId, initialStages[], versionTag

### pipeline_execute
Execute all stages of a pipeline sequentially.
- **Input**: pipelineId, skipStages[]
- **Output**: stageResults[], finalStatus, durationMs

### stage_advance
Advance pipeline to the next stage.
- **Input**: pipelineId, currentStage, artifacts
- **Output**: nextStage, status, logs

### artifact_publish
Publish a deployment artifact.
- **Input**: pipelineId, artifactType, name, version, storageUrl
- **Output**: artifactId, checksum, sizeBytes

### rollback_initiate
Initiate a rollback to a previous version.
- **Input**: pipelineId, targetVersion, reason, rollbackType
- **Output**: rollbackId, status, fromVersion, toVersion

### environment_health
Check health of a deployment environment.
- **Input**: environmentName, checks[]
- **Output**: healthStatus, metrics, currentVersion, issues[]

### promote_environment
Promote a deployment from one environment to another.
- **Input**: pipelineId, fromEnvironment, toEnvironment
- **Output**: promotionId, newPipelineId, status
