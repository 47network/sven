---
name: pipeline-runner
description: CI/CD pipeline orchestration and execution
version: 1.0.0
price: 16.99
currency: USD
archetype: engineer
tags: [ci-cd, pipeline, automation, devops]
---
# Pipeline Runner
Automated CI/CD pipeline execution with stage management and parallel jobs.
## Actions
### trigger-pipeline
Trigger a pipeline run from source event.
- **inputs**: sourceRepo, branch, commitSha, trigger
- **outputs**: runId, runNumber, state, stages
### cancel-run
Cancel a running pipeline.
- **inputs**: runId, reason
- **outputs**: cancelled, stagesAborted
### retry-stage
Retry a failed pipeline stage.
- **inputs**: runId, stageName
- **outputs**: retried, newState
### get-logs
Get logs for a pipeline stage.
- **inputs**: runId, stageName, tail
- **outputs**: logs, lineCount
### configure-pipeline
Set up pipeline configuration.
- **inputs**: sourceRepo, triggerEvents, stages, timeoutMinutes
- **outputs**: configId, pipelineType
### export-metrics
Export pipeline performance metrics.
- **inputs**: configId, since, format
- **outputs**: runs[], successRate, avgDuration
