---
name: fleet-manage
version: 1.0.0
description: >
  Manages the local GPU model fleet — deploy models to GPUs, run benchmarks,
  evict low-priority deployments, and monitor VRAM utilization across the
  compute infrastructure.
archetype: operator
pricing:
  model: per_use
  base_price: 0
category: infrastructure
tags:
  - gpu
  - model-fleet
  - vram
  - deployment
  - benchmark
  - infrastructure
actions:
  - id: deploy
    description: Deploy a model to the best available GPU device
    inputs:
      - modelName (string, required)
      - modelVariant (string, optional)
      - quantization (string, optional — fp16, q4_k_m, q8_0, etc.)
      - vramRequiredMb (number, required)
      - priority (number, optional — 1-10, default 5)
    outputs:
      - deploymentId (string)
      - gpuDeviceId (string)
      - status (DeploymentStatus)
      - loadTimeMs (number)
  - id: benchmark
    description: Run performance benchmarks on a deployed model
    inputs:
      - deploymentId (string, required)
      - benchmarkType (string — latency, throughput, quality, cost, memory)
      - promptTokens (number, optional)
      - contextLength (number, optional)
    outputs:
      - benchmarkId (string)
      - latencyMs (number)
      - tokensPerSecond (number)
      - qualityScore (number)
      - vramPeakMb (number)
  - id: evict
    description: Evict a deployed model to free VRAM
    inputs:
      - deploymentId (string, required)
      - reason (string, optional)
    outputs:
      - freed_vram_mb (number)
      - device_vram_available_mb (number)
  - id: status
    description: Get fleet overview — all GPU devices and deployments
    inputs: []
    outputs:
      - devices (GpuDevice[])
      - deployments (ModelDeployment[])
      - totalVramMb (number)
      - usedVramMb (number)
      - utilizationPct (number)
  - id: hot-swap
    description: Replace one deployed model with another on the same GPU
    inputs:
      - currentDeploymentId (string, required)
      - newModelName (string, required)
      - newQuantization (string, optional)
      - newVramRequiredMb (number, required)
    outputs:
      - evictedDeploymentId (string)
      - newDeploymentId (string)
      - swapTimeMs (number)
---

# Fleet Management Skill

Manages GPU model fleet with VRAM-aware scheduling across Sven's compute
infrastructure. Supports deploying models to the best available GPU,
running continuous benchmarks, evicting low-priority models under VRAM
pressure, and hot-swapping models without service restart.

## VRAM Management

The fleet manager maintains a reservation buffer (default 15%) to prevent
OOM conditions. When deploying a model, it selects the GPU with the most
available VRAM that can fit the model. If no GPU has enough free VRAM,
the eviction policy (LRU/LFU/priority/FIFO) selects candidates to free space.

## Benchmark Tracking

Continuous benchmarks track latency, throughput, quality, cost, and peak
VRAM usage per deployed model. Results inform routing decisions in the
LLM router — prefer local models when quality and latency are competitive.

## Hot-Swap

Models can be replaced in-place: the current model is unloaded and the new
model is loaded on the same GPU, minimizing VRAM fragmentation and keeping
the deployment port stable for routing.
