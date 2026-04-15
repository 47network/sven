---
name: social-scheduler
description: Plan and schedule social media content — multi-platform posting calendar, hashtag suggestions, optimal timing.
version: 0.1.0
publisher: 47dynamics
handler_language: typescript
handler_file: handler.ts
when-to-use: Use when the user wants to plan social media posts, create a content calendar, or schedule content.
inputs_schema:
  type: object
  properties:
    action:
      type: string
      enum: [create_calendar, suggest_hashtags, optimal_times, format_post]
    posts:
      type: array
      items:
        type: object
    platform:
      type: string
      enum: [twitter, linkedin, instagram, facebook, threads]
    content:
      type: string
    timezone:
      type: string
  required: [action]
outputs_schema:
  type: object
  properties:
    result:
      type: object
---
# social-scheduler

Plans and schedules social media content across platforms.
Suggests hashtags, optimal posting times, and formats content
for platform-specific requirements.
