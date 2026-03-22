# workflow-executor

**Workflow Executor / Scheduler**

Manages one-time and recurring tasks (cron expressions). Triggers agent runtime executions on schedule. Used by the Admin UI scheduler and the natural-language scheduling flow in chat.

## Port

$(System.Collections.Hashtable.port)

## Dependencies

NATS, PostgreSQL

## Required Environment Variables

Set these in your .env (see [.env.example](../../.env.example)):

```
WORKFLOW_EXECUTOR_PORT
```

## Running

```bash
# Via Docker Compose
docker compose up -d workflow-executor

# Bare metal
npm --workspace services/workflow-executor run dev
```

## Contributing

See the root [CONTRIBUTING.md](../../CONTRIBUTING.md).
