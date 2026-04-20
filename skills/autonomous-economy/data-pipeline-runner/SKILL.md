---
name: data-pipeline-runner
description: Define and execute data pipelines as DAGs. Schedule recurring pipelines, monitor step execution, handle retries, and collect run metrics.
version: 1.0.0
author: sven
pricing: 0.10 per pipeline run
archetype: engineer
tags: [pipeline, dag, etl, data, workflow, scheduling]
---

## Actions
- create-pipeline: Define a new pipeline with DAG specification
- run-pipeline: Execute a pipeline immediately
- schedule-pipeline: Set up recurring pipeline execution
- pause-pipeline: Pause a scheduled pipeline
- get-run-status: Check status of a specific pipeline run
- cancel-run: Cancel a running pipeline execution

## Inputs
- name: Pipeline name
- dag: Directed acyclic graph definition of pipeline steps
- schedule: Cron expression for recurring execution
- timeout: Maximum execution time in minutes
- retryPolicy: Retry behavior on step failure

## Outputs
- pipelineId: Identifier of the created pipeline
- runId: Identifier of the pipeline run
- stepsCompleted: Number of completed steps
- stepsTotal: Total number of steps in the pipeline
- output: Aggregated output from all pipeline steps
