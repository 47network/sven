---
name: academic-assist
version: 1.0.0
description: >
  Legitimate academic assistance for Romanian university students.
  Provides tutoring, formatting, citation review, bibliography generation,
  research guidance, methodology review, and language editing services.
  Fully compliant with academic integrity policies — assists students
  in improving their own work, never produces work to be submitted as original.
archetype: researcher
pricing:
  base: 4.99
  currency: EUR
  per: session
  discounts:
    - type: volume
      threshold: 5
      percent: 15
    - type: student_verified
      percent: 10
categories:
  - education
  - academic
  - tutoring
  - formatting
languages:
  - ro
  - en
  - fr
  - de
actions:
  - id: format-document
    description: >
      Format an academic document according to university-specific or standard
      templates (APA7, Chicago, IEEE, ISO 690). Fix margins, fonts, headings,
      page numbering, table of contents, and figure/table numbering.
    inputs:
      - name: content
        type: string
        required: true
        description: Raw document text or reference to uploaded file
      - name: template
        type: string
        required: false
        description: "University template name or standard (e.g., 'UBB-licenta', 'apa7')"
      - name: language
        type: string
        required: false
        default: ro
    outputs:
      - name: formattedContent
        type: string
      - name: changesApplied
        type: array
      - name: complianceScore
        type: number

  - id: review-citations
    description: >
      Validate and format citations/bibliography according to the specified
      citation style. Check for missing fields, incorrect formatting,
      broken DOIs/URLs, and suggest corrections.
    inputs:
      - name: citations
        type: array
        required: true
        description: List of raw citation entries
      - name: style
        type: string
        required: true
        description: "Citation style (apa7, chicago, mla9, ieee, harvard, iso690, vancouver)"
      - name: language
        type: string
        required: false
        default: ro
    outputs:
      - name: validatedCitations
        type: array
      - name: errorsFound
        type: number
      - name: correctedEntries
        type: array
      - name: missingFields
        type: array

  - id: structure-review
    description: >
      Review the overall structure of an academic paper. Check chapter
      organization, logical flow, methodology placement, results/discussion
      separation, and conclusion coherence.
    inputs:
      - name: content
        type: string
        required: true
      - name: projectType
        type: string
        required: true
        description: "Type of work (licenta, disertatie, referat, eseu)"
      - name: faculty
        type: string
        required: false
    outputs:
      - name: structureScore
        type: number
      - name: issues
        type: array
      - name: suggestions
        type: array
      - name: recommendedOutline
        type: object

  - id: language-edit
    description: >
      Grammar, style, and clarity editing for academic Romanian or English.
      Fix grammatical errors, improve sentence structure, ensure formal
      academic register, and check for consistency.
    inputs:
      - name: content
        type: string
        required: true
      - name: language
        type: string
        required: true
      - name: formalityLevel
        type: string
        required: false
        default: academic
    outputs:
      - name: editedContent
        type: string
      - name: corrections
        type: array
      - name: readabilityScore
        type: number
      - name: grammarErrorCount
        type: number

  - id: research-guidance
    description: >
      Provide guidance on research methodology, literature search strategies,
      data collection approaches, and analysis techniques. Does NOT write
      the research — guides the student on how to conduct it properly.
    inputs:
      - name: topic
        type: string
        required: true
      - name: projectType
        type: string
        required: true
      - name: currentProgress
        type: string
        required: false
      - name: questions
        type: array
        required: false
    outputs:
      - name: guidance
        type: object
      - name: suggestedSources
        type: array
      - name: methodologyNotes
        type: string
      - name: nextSteps
        type: array

ethics:
  policy: >
    This skill provides ASSISTANCE only. It helps students improve their own
    original work through tutoring, formatting, citation management, and
    guidance. It does NOT produce content to be submitted as original student
    work. All output clearly indicates it is assistance/review material.
  prohibited:
    - Writing essays or papers to be submitted as student's own work
    - Bypassing plagiarism detection systems
    - Generating fake citations or references
    - Impersonating student authorship
  compliance:
    - Romanian Ministry of Education academic integrity guidelines
    - GDPR for student data protection
    - University-specific honour codes
