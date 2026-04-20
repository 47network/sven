---
name: book-format
version: 1.0.0
description: |
  Manuscript formatting and typesetting service. Format agents convert
  manuscripts into publication-ready output for various platforms: EPUB for
  general e-readers, Kindle MOBI for Amazon, PDF for print-on-demand,
  paperback and hardcover layout. Handles table of contents generation,
  chapter numbering, page breaks, and metadata embedding.
category: autonomous-economy
archetype: designer

inputs:
  - name: action
    type: string
    required: true
    description: "'format-epub', 'format-kindle', 'format-pdf', 'format-paperback', 'generate-toc'"
  - name: content
    type: string
    required: true
    description: Manuscript content to format (Markdown or HTML).
  - name: targetFormat
    type: string
    required: true
    description: "'epub', 'kindle_mobi', 'pdf', 'paperback', 'hardcover'"
  - name: title
    type: string
    required: true
    description: Book title for metadata embedding.
  - name: author
    type: string
    required: true
    description: Author name for metadata.
  - name: isbn
    type: string
    required: false
    description: ISBN for metadata (optional, can be assigned later).
  - name: styleOptions
    type: object
    required: false
    description: |
      Formatting preferences:
      - fontFamily: 'serif', 'sans-serif', 'garamond', 'palatino'
      - fontSize: point size (default: 12)
      - lineSpacing: multiplier (default: 1.5)
      - margins: { top, bottom, left, right } in inches
      - chapterStyle: 'centered', 'drop-cap', 'ornamental'
      - pageSize: 'a5', '6x9', '5.5x8.5', 'a4'
  - name: coverImageUrl
    type: string
    required: false
    description: Cover image URL to embed in the formatted output.
  - name: metadata
    type: object
    required: false
    description: |
      Additional metadata for format embedding:
      - genre, language, publisher, publicationDate, copyright,
        keywords, description, series, seriesNumber

outputs:
  - name: formattedContent
    type: string
    description: Base64-encoded formatted output (or Markdown for preview).
  - name: format
    type: string
    description: Output format identifier.
  - name: pageCount
    type: number
    description: Estimated page count for the formatted output.
  - name: tocGenerated
    type: boolean
    description: Whether a table of contents was generated.
  - name: toc
    type: array
    description: Table of contents entries with chapter titles and page numbers.
  - name: fileSize
    type: number
    description: Estimated output file size in bytes.
  - name: validationErrors
    type: array
    description: Any formatting warnings or issues encountered.

pricing:
  model: one_time
  unitDescription: per format conversion
  baseRate: 9.99

supported_formats:
  epub:
    description: EPUB 3.0 for general e-readers (Kobo, Apple Books, etc.)
    extension: .epub
  kindle_mobi:
    description: KF8/AZW3 for Amazon Kindle
    extension: .mobi
  pdf:
    description: Print-ready PDF with embedded fonts
    extension: .pdf
  paperback:
    description: PDF with trim marks, bleed, and binding offset
    extension: .pdf
  hardcover:
    description: PDF with dust jacket template and case binding specs
    extension: .pdf

page_sizes:
  a5: { width: 5.83, height: 8.27, unit: inches }
  6x9: { width: 6, height: 9, unit: inches }
  5.5x8.5: { width: 5.5, height: 8.5, unit: inches }
  a4: { width: 8.27, height: 11.69, unit: inches }
