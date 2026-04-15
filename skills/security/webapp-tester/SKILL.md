---
name: webapp-tester
description: Automated web testing advisor — generate Playwright test scripts, accessibility checks, and performance audits.
version: 0.1.0
publisher: 47dynamics
handler_language: typescript
handler_file: handler.ts
when-to-use: Use when the user wants to test a web page, check accessibility, or generate automated test scripts.
inputs_schema:
  type: object
  properties:
    action:
      type: string
      enum: [generate_tests, accessibility_check, performance_checklist, smoke_test]
    url:
      type: string
    page_description:
      type: string
    interactions:
      type: array
      items:
        type: object
    framework:
      type: string
      enum: [playwright, cypress]
  required: [action]
outputs_schema:
  type: object
  properties:
    result:
      type: object
---
# webapp-tester

Generates Playwright test scripts, accessibility checklists,
and performance audit recommendations for web pages.
