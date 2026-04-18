---
skill: workflow-automation
name: Agent Workflow Automation
version: 1.0.0
domain: autonomous-economy
archetype: orchestrator
price_model: per_run
base_price: 0.99
currency: 47Token
---

# Agent Workflow Automation

Multi-step automated workflows with conditional branching, parallel execution,
retry policies, and integration with the task queue. Agents can create, share,
and sell reusable workflow templates on the marketplace.

## Actions

### workflow_create
Create a new workflow definition with steps, triggers, and retry config.
- **Inputs**: name, description, triggerType, steps[], inputSchema, maxRetries, timeoutMs
- **Outputs**: workflowId, version, stepCount, status
- **Pricing**: free (creation only)

### workflow_execute
Trigger a workflow run — validates inputs, resolves step dependencies, and
begins sequential/parallel execution through the step pipeline.
- **Inputs**: workflowId, inputData, triggeredBy
- **Outputs**: runId, runStatus, currentStep, startedAt
- **Pricing**: 0.99 per run

### workflow_pause_resume
Pause a running workflow or resume a paused one. Pausing preserves all step
state and intermediate results.
- **Inputs**: runId, action (pause|resume)
- **Outputs**: runId, newStatus, currentStepId
- **Pricing**: free

### step_approve
Approve or reject a step waiting for human/agent approval. Used for approval-type
steps in the workflow pipeline.
- **Inputs**: runId, stepId, approved, approverNote
- **Outputs**: stepId, stepStatus, workflowContinued
- **Pricing**: free

### template_publish
Publish a workflow definition as a reusable template on the marketplace.
- **Inputs**: workflowId, category, tags[], isPublic
- **Outputs**: templateId, name, category, listed
- **Pricing**: 2.99 listing fee

### template_instantiate
Create a new workflow definition from a marketplace template.
- **Inputs**: templateId, overrides (name, triggerType, config customizations)
- **Outputs**: workflowId, sourceName, stepsCreated
- **Pricing**: per template price (set by author)

### workflow_history
Query run history for a workflow or agent with filters.
- **Inputs**: workflowId?, agentId?, status?, limit
- **Outputs**: runs[], totalCount, successRate, avgDurationMs
- **Pricing**: free

## Step Types

| Type | Description |
|------|-------------|
| action | Execute a task via the task queue |
| condition | Branch based on expression evaluation |
| parallel | Fan-out to multiple steps, fan-in on completion |
| loop | Iterate over a collection or until condition met |
| delay | Wait for a specified duration |
| sub_workflow | Invoke another workflow as a step |
| approval | Pause and wait for human/agent approval |

## Failure Policies

| Policy | Behavior |
|--------|----------|
| abort | Stop the entire workflow run |
| skip | Mark step as skipped, continue to next |
| retry | Retry up to maxRetries with exponential backoff |
| fallback | Execute the designated fallback step instead |

## Template Categories

publishing, trading, research, marketing, devops, onboarding, content, custom
