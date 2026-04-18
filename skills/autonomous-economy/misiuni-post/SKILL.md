---
name: misiuni-post
version: 1.0.0
description: Post a task (misiune) to the Misiuni.ro platform for human workers to complete
archetype: recruiter
pricing:
  model: per_call
  amount: 0.00
  currency: EUR
  note: Free to post — platform takes 10% fee on completion
inputs:
  - name: title
    type: string
    required: true
    description: Short descriptive title for the task
  - name: description
    type: string
    required: true
    description: Detailed instructions for the human worker
  - name: category
    type: string
    required: true
    enum: [verification, delivery, photography, data_collection, event_attendance, physical_inspection, mystery_shopping, sampling, surveying, manual_labor, tech_support, other]
    description: Task category
  - name: locationCity
    type: string
    required: false
    description: City where the task must be performed
  - name: locationCounty
    type: string
    required: false
    description: Romanian county (județ) for the task
  - name: budgetEur
    type: number
    required: true
    description: Budget in EUR (min 5, max 500)
  - name: deadline
    type: string
    required: false
    description: ISO 8601 deadline for task completion
  - name: requiredProof
    type: string
    required: false
    enum: [photo, video, gps_checkin, receipt, document, multiple]
    default: photo
    description: Type of proof required from the worker
  - name: proofInstructions
    type: string
    required: false
    description: Specific instructions on what the proof should show
  - name: priority
    type: string
    required: false
    enum: [low, normal, high, urgent]
    default: normal
  - name: requiredSkills
    type: string[]
    required: false
    description: Skills the worker should have
outputs:
  - name: taskId
    type: string
    description: Unique ID of the created task
  - name: status
    type: string
    description: Initial task status (draft)
  - name: estimatedMatchCount
    type: number
    description: Estimated number of available workers matching criteria
actions:
  - name: post-task
    description: Create and publish a new task on the Misiuni platform
  - name: post-draft
    description: Create a draft task (not yet visible to workers)
  - name: estimate-workers
    description: Check how many workers match the task criteria without posting
---

# Misiuni Post Skill

Allows Sven agents to autonomously create tasks ("misiuni") on the Misiuni.ro platform
that require physical-world actions by human workers. The agent describes what needs
to be done, sets a budget and location, and the platform matches available workers.

## Use Cases

- **Verification**: "Go to this address and confirm the business is open"
- **Photography**: "Take 10 photos of this location from different angles"
- **Data collection**: "Count customers entering this store between 2-4 PM"
- **Delivery**: "Pick up a package from point A and deliver to point B"
- **Mystery shopping**: "Visit this restaurant, order, and report on quality"
- **Physical inspection**: "Check if this billboard is properly displayed"

## Safety

- All tasks go through safety screening before being published
- Workers must be KYC-verified before accepting tasks
- Budget limits: minimum €5, maximum €500 per task
- Approval tiers apply: auto ≤ €5, notify €5–€50, human approve > €50
- Tasks requiring night work, hazardous locations, or illegal activities are rejected
- Two-way rating system protects both workers and task posters

## Integration

Posts to: `POST /v1/admin/misiuni/tasks`
Events: `sven.misiuni.task_created`
Platform: misiuni.ro / misiuni.from.sven.systems
