# Wave 1 OpenHands Workflow Matrix (2026-03-16)

This matrix is the strict source of truth for OpenHands parity Wave 1 (OH-W01..OH-W10).

| ID | Capability | Status |
| --- | --- | --- |
| OH-W01 | Task -> plan -> execute tools -> summarize outcome | implemented |
| OH-W02 | Repository issue -> code patch -> tests -> patch summary | implemented |
| OH-W03 | Multi-file refactor with safety checks and rollback path | implemented |
| OH-W04 | Long-running task continuity (resume after interruption) | implemented |
| OH-W05 | Clarification-first behavior on ambiguous requests | implemented |
| OH-W06 | Approval-gated risky operation (write/exec) | implemented |
| OH-W07 | Tool failure recovery with bounded retries | implemented |
| OH-W08 | Session context compaction without losing task intent | implemented |
| OH-W09 | Runtime policy enforcement + auditability for every action | implemented |
| OH-W10 | Operator observability for active run (timeline + diagnostics) | implemented |

## Contract Test Bindings

| Lane | Contract Test ID | Report |
| --- | --- | --- |
| OH-W01 | openhands_parity_w01_task_plan_execute_contract | openhands-w01-task-plan-execute-latest |
| OH-W02 | openhands_parity_w02_issue_to_patch_e2e | openhands-w02-issue-to-patch-latest |
| OH-W03 | openhands_parity_w03_multifile_refactor_recovery | openhands-w03-refactor-recovery-latest |
| OH-W04 | openhands_parity_w04_resume_after_interrupt | openhands-w04-resume-latest |
| OH-W05 | openhands_parity_w05_clarification_gate | openhands-w05-clarification-latest |
| OH-W06 | openhands_parity_w06_approval_gated_risky_exec | openhands-w06-approval-gate-latest |
| OH-W07 | openhands_parity_w07_tool_failure_recovery | openhands-w07-retry-recovery-latest |
| OH-W08 | openhands_parity_w08_compaction_intent_preserve | openhands-w08-compaction-fidelity-latest |
| OH-W09 | openhands_parity_w09_policy_audit_chain | openhands-w09-policy-audit-latest |
| OH-W10 | openhands_parity_w10_runtime_observability | openhands-w10-observability-latest |

strict artifact lane validates runtime prompt-firewall/policy chain
