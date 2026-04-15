---
name: micrograd
description: Interactive educational autograd engine — port of Karpathy's micrograd. Build, train, and visualise tiny neural networks step-by-step to learn how backpropagation works.
version: 0.1.0
publisher: 47dynamics
handler_language: typescript
handler_file: handler.ts
inputs_schema:
  type: object
  properties:
    action:
      type: string
      enum: [create_session, destroy_session, list_sessions, get_walkthrough_step, advance_walkthrough, create_model, train_model, train_with_snapshots, get_decision_boundary, generate_moon_dataset, get_stats]
    session_id:
      type: string
    org_id:
      type: string
    step_index:
      type: number
    architecture:
      type: array
      items:
        type: number
    dataset_type:
      type: string
      enum: [xor, moon, custom]
    learning_rate:
      type: number
    epochs:
      type: number
    loss_function:
      type: string
      enum: [mse, hinge, bce]
    seed:
      type: number
    snapshot_every:
      type: number
    custom_data:
      type: object
      properties:
        xs:
          type: array
        ys:
          type: array
  required: [action]
outputs_schema:
  type: object
  properties:
    result:
      type: object
tags:
  - education
  - neural-networks
  - autograd
  - visualization
---
# micrograd

Interactive educational autograd engine — a TypeScript port of Andrej Karpathy's micrograd.

## Features

- **Value**: scalar autograd node with +, ×, ÷, pow, tanh, relu, exp, and full backpropagation
- **Neuron / Layer / MLP**: build tiny neural networks from scratch
- **Training loop**: SGD with MSE, hinge, and binary cross-entropy loss functions
- **Interactive walkthrough**: 10-step guided tour from "what is a Value?" to "train a moon classifier"
- **Canvas visualization**: decision boundary grids, parameter snapshots, and training curves for the Canvas UI

## Actions

| Action | Description |
|---|---|
| `create_session` | Start a new micrograd learning session |
| `destroy_session` | Clean up a session |
| `list_sessions` | List active sessions (optionally filtered by org) |
| `get_walkthrough_step` | Get a specific walkthrough step by index |
| `advance_walkthrough` | Get the next walkthrough step in sequence |
| `create_model` | Create an MLP with a given architecture |
| `train_model` | Train a model on XOR, moon, or custom data |
| `train_with_snapshots` | Train with periodic snapshots for Canvas animation |
| `get_decision_boundary` | Generate a 2D decision boundary grid |
| `generate_moon_dataset` | Generate a moons classification dataset |
| `get_stats` | Engine statistics |
