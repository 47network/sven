---
name: docker-optimizer
description: Analyze and optimize Dockerfiles — reduce image size, improve layer caching, fix security issues.
version: 0.1.0
publisher: 47dynamics
handler_language: typescript
handler_file: handler.ts
when-to-use: Use when the user wants to optimize a Dockerfile, reduce Docker image size, or improve build caching.
inputs_schema:
  type: object
  properties:
    action:
      type: string
      enum: [analyze, optimize, security_scan]
    dockerfile:
      type: string
    base_image:
      type: string
  required: [action]
outputs_schema:
  type: object
  properties:
    result:
      type: object
---
# docker-optimizer

Analyzes Dockerfiles for optimization opportunities — layer caching,
multi-stage builds, image size reduction, and security best practices.
