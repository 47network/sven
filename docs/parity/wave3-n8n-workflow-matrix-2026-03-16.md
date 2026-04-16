# Wave 3 n8n Workflow Matrix (2026-03-16)

This matrix is the strict source of truth for n8n parity Wave 3 (NN-W01..NN-W10).

| ID | Capability | Status |
| --- | --- | --- |
| NN-W01 | Workflow graph execution pipeline (create/update/execute + run visibility) | implemented |
| NN-W02 | Trigger and schedule automation (cron/scheduler + guarded run targets) | implemented |
| NN-W03 | Webhook trigger to workflow execution (signed ingress + replay defense) | implemented |
| NN-W04 | Retry and backoff policy per step/run | implemented |
| NN-W05 | Failure path and dead-letter style observability | implemented |
| NN-W06 | Template-driven workflow catalog | implemented |
| NN-W07 | Multi-step data mapping and conditional branching | implemented |
| NN-W08 | Human-in-the-loop approval nodes in automation chains | implemented |
| NN-W09 | External integration runtime orchestration reliability | implemented |
| NN-W10 | Workflow operations dashboard (runs, stale runs, controls) | implemented |

## Contract Test Bindings

| Lane | Contract Test ID |
| --- | --- |
| NN-W01 | n8n_parity_w01_workflow_orchestration_contract |
| NN-W02 | n8n_parity_w02_trigger_scheduling_contract |
| NN-W03 | n8n_parity_w03_webhook_to_workflow_contract |
| NN-W04 | n8n_parity_w04_retry_backoff_contract |
| NN-W05 | n8n_parity_w05_failure_observability_contract |
| NN-W06 | n8n_parity_w06_template_catalog_contract |
| NN-W07 | n8n_parity_w07_mapping_branching_contract |
| NN-W08 | n8n_parity_w08_approval_nodes_contract |
| NN-W09 | n8n_parity_w09_integration_runtime_contract |
| NN-W10 | n8n_parity_w10_workflow_ops_contract |
