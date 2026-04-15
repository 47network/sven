---
name: xlsx-generator
description: Create Excel-compatible spreadsheets (.xlsx) with data, formulas, formatting, and multiple sheets.
version: 0.1.0
publisher: 47dynamics
handler_language: typescript
handler_file: handler.ts
when-to-use: Use when the user asks to create a spreadsheet, Excel file, CSV export, or tabular data document.
inputs_schema:
  type: object
  properties:
    action:
      type: string
      enum: [create, from_csv, analyze_structure]
    title:
      type: string
    sheets:
      type: array
      items:
        type: object
        properties:
          name:
            type: string
          headers:
            type: array
          rows:
            type: array
          column_widths:
            type: array
    csv_data:
      type: string
    delimiter:
      type: string
  required: [action]
outputs_schema:
  type: object
  properties:
    result:
      type: object
---
# xlsx-generator

Create Excel-compatible spreadsheets with multiple sheets, headers, data rows,
and basic cell formatting. Returns Open XML (XLSX) structure.
