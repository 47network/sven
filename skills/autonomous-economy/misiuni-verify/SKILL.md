---
name: misiuni-verify
version: 1.0.0
description: Verify proof of work submitted by human workers on the Misiuni.ro platform
archetype: analyst
pricing:
  model: per_call
  amount: 0.00
  currency: EUR
  note: Internal verification — no charge
inputs:
  - name: proofId
    type: string
    required: true
    description: ID of the proof submission to verify
  - name: taskId
    type: string
    required: true
    description: ID of the task the proof belongs to
  - name: proofType
    type: string
    required: true
    enum: [photo, video, gps_checkin, receipt, document, multiple]
    description: Type of proof submitted
  - name: fileUrl
    type: string
    required: false
    description: URL of the uploaded proof file (photo/video/document)
  - name: gpsLat
    type: number
    required: false
    description: GPS latitude of the worker's check-in
  - name: gpsLng
    type: number
    required: false
    description: GPS longitude of the worker's check-in
  - name: expectedLat
    type: number
    required: false
    description: Expected GPS latitude for the task location
  - name: expectedLng
    type: number
    required: false
    description: Expected GPS longitude for the task location
  - name: maxDistanceKm
    type: number
    required: false
    default: 0.5
    description: Maximum allowed distance between GPS check-in and task location
  - name: description
    type: string
    required: false
    description: Worker's text description of what they did
outputs:
  - name: verified
    type: boolean
    description: Whether the proof passes verification
  - name: confidence
    type: number
    description: AI confidence score (0.0 - 1.0)
  - name: reason
    type: string
    description: Explanation of verification decision
  - name: gpsDistanceKm
    type: number
    description: Distance between check-in and expected location (if GPS proof)
  - name: flags
    type: string[]
    description: Any warning flags detected
actions:
  - name: verify-photo
    description: Use vision AI to verify a photo proof matches task requirements
  - name: verify-gps
    description: Verify GPS check-in is within acceptable distance of task location
  - name: verify-receipt
    description: Verify a receipt/document proof using OCR and content analysis
  - name: verify-combined
    description: Verify multiple proof types together for higher confidence
---

# Misiuni Verify Skill

AI-powered verification of proof-of-work submitted by human workers on Misiuni.ro.
Uses computer vision, GPS validation, and document analysis to automatically verify
task completion before releasing payment.

## Verification Methods

### Photo Verification
- Scene recognition: does the photo match the expected location/context?
- Object detection: are required items visible in the photo?
- Metadata check: EXIF data timestamp and GPS (if available)
- Tampering detection: check for obvious photo manipulation

### GPS Verification
- Haversine distance: calculate distance between check-in and task location
- Default threshold: 500m (configurable per task)
- Accuracy check: GPS accuracy reading must be < 50m for reliable verification

### Receipt/Document Verification
- OCR extraction: read text from uploaded document
- Content matching: verify against task requirements
- Date validation: document date must be within task timeframe

### Combined Verification
- Cross-reference multiple proof types for higher confidence
- Example: photo + GPS = higher confidence than either alone

## Confidence Scoring

- **0.95+**: Auto-approve, release payment immediately
- **0.70–0.94**: Approve with note, release payment
- **0.50–0.69**: Flag for human review
- **< 0.50**: Auto-reject, notify task poster

## Safety

- All verifications logged for audit trail
- Workers can dispute rejected proofs
- Human escalation path always available
- No PII stored in verification results

## Integration

Calls: `POST /v1/admin/misiuni/proofs/:proofId/verify`
Events: `sven.misiuni.task_verified`
Uses: haversineKm() from @sven/shared for GPS calculations
