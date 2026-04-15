---
name: model-trainer
description: >
  Fine-tuning pipeline for small open models using LoRA/QLoRA.
  Trains domain-specific adapters from conversation logs, codebase files,
  or custom datasets. Pre-built recipes for writing style, codebase conventions,
  and domain vocabulary. Exports to LiteLLM for immediate use.
version: 1.0.0
publisher: 47dynamics
handler_language: typescript
handler_file: handler.ts

inputs_schema:
  action:
    type: string
    required: true
    enum:
      - create_job
      - get_job
      - list_jobs
      - cancel_job
      - list_recipes
      - list_exports
      - get_stats
  job_id:
    type: string
    description: Training job ID
  org_id:
    type: string
    description: Organisation ID
  user_id:
    type: string
    description: User ID
  recipe:
    type: string
    enum: [writing_style, codebase_conventions, domain_vocabulary, task_specific, custom]
    description: Pre-built fine-tuning recipe domain
  config:
    type: object
    description: Partial training configuration override
  data_sources:
    type: array
    description: Array of data source configurations
  samples:
    type: array
    description: Inline training samples (input/output pairs)
  status_filter:
    type: string
    description: Filter jobs by status

outputs_schema:
  result:
    type: object
    description: Action-specific result (job, recipes, stats)

tags:
  - ai-agency
  - fine-tuning
  - lora
  - qlora
  - training
  - model

scope:
  orgs: all
  channels:
    - admin-ui
    - canvas-ui
---

# Model Trainer Skill

Fine-tunes small open models (Qwen3-4B, Gemma-2B, etc.) on domain-specific data
using LoRA/QLoRA adapters.

## Architecture

```
Training Data Sources → Data Prep → LoRA Fine-Tune → Evaluation → Export to LiteLLM
     ↓                                    ↓                          ↓
Conversation Logs            HuggingFace PEFT             LiteLLM Model Registry
RAG Documents                bitsandbytes QLoRA            Local Model Fleet
File Uploads                 Transformers Trainer
Inline Samples
```

## Pre-Built Recipes

| Recipe                | Base Model      | Purpose                                    | Epochs |
|-----------------------|-----------------|--------------------------------------------|--------|
| writing_style         | Qwen2.5-4B     | Match user's tone, vocabulary, structure   | 3      |
| codebase_conventions  | Qwen2.5-4B     | Learn project patterns and naming          | 2      |
| domain_vocabulary     | Qwen2.5-4B     | Domain-specific terms and knowledge        | 5      |

## Data Formats

- **conversation**: Chat messages `[{role, content}]`
- **instruction**: Alpaca-style `{instruction, output}`
- **completion**: Raw text continuation
- **preference**: DPO-style `{prompt, chosen, rejected}`
