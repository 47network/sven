# Pillar 3 — OCR & Document Intelligence

> Source: Video 4 (GLM OCR)
> User directive: "From this I want it implemented in Sven if possible or available if it seems so good"
> Key stat: "0.9B parameter vision language model, 16,000x cheaper than alternatives"

---

## Goal

Sven gains the ability to read, extract, and understand any document — PDFs, images of text, handwritten notes, receipts, code screenshots, whiteboards, and scanned documents. Using GLM-OCR (0.9B parameters), this runs locally at negligible cost compared to cloud OCR services.

---

## Feature Breakdown

### 3.1 GLM-OCR Integration

**What**: Deploy the 0.9B parameter GLM-OCR model locally for high-accuracy OCR.

**Capabilities**:
- [ ] Model download and local deployment (0.9B params ≈ 2GB VRAM at FP16, <1GB quantized)
- [ ] Image → text extraction (printed text, any font, any language)
- [ ] Multi-language OCR (Latin, Cyrillic, CJK, Arabic, Devanagari)
- [ ] Document structure preservation (headings, paragraphs, lists, tables)
- [ ] Table extraction (row/column structure → structured data)
- [ ] Handwriting recognition (legible handwriting → text)
- [ ] Mathematical formula recognition (LaTeX output)
- [ ] Code screenshot → syntax-highlighted text
- [ ] Confidence scoring per extracted segment
- [ ] Batch processing (multiple pages/images in queue)

**Implementation**:
- Model stored at: `models/glm-ocr/`
- Inference wrapper: `packages/ml-inference/src/glm-ocr.ts`
- Skill: `skills/ocr/document-reader.ts`
- API endpoint on model-router or skill-runner

### 3.2 Document Processing Pipeline

**What**: End-to-end pipeline from document input to structured, searchable, actionable output.

**Pipeline Stages**:
- [ ] Input normalization (PDF → images, rotation correction, deskew, contrast enhancement)
- [ ] Page segmentation (detect text regions, images, tables, headers, footers)
- [ ] OCR extraction (GLM-OCR per region)
- [ ] Structure assembly (combine regions into document flow)
- [ ] Entity extraction (names, dates, amounts, addresses from extracted text)
- [ ] Summarization (optional — route to reasoning model for summary)
- [ ] Storage (full text indexed in search, original preserved)
- [ ] Metadata extraction (author, creation date, document type classification)

**Implementation**:
- Pipeline orchestrator: `services/skill-runner/src/pipelines/document-pipeline.ts`
- Sharp/Jimp for image preprocessing
- PDF.js for PDF → image conversion

### 3.3 Document Skills

**What**: Natural language commands for document processing.

**Skills**:
- [ ] `ocr:read <image/pdf>` — Extract all text from document
- [ ] `ocr:table <image/pdf>` — Extract tables as CSV/JSON
- [ ] `ocr:summarize <image/pdf>` — OCR + summarize in one step
- [ ] `ocr:translate <image/pdf> <target-lang>` — OCR + translate
- [ ] `ocr:code <screenshot>` — Extract code from screenshot with syntax
- [ ] `ocr:compare <doc1> <doc2>` — OCR both, diff the content
- [ ] `ocr:search <query> <documents>` — Full-text search across OCR'd documents
- [ ] `ocr:batch <directory>` — Process all documents in a folder
- [ ] `ocr:receipt <image>` — Extract receipt data (merchant, items, total, date)
- [ ] `ocr:id-document <image>` — Extract ID data (with PII handling per compliance)

### 3.4 Integration with Other Pillars

- [ ] **Security** (Pillar 5): OCR security advisories, vulnerability reports
- [ ] **Marketing** (Pillar 7): OCR competitor marketing materials for analysis
- [ ] **Design** (Pillar 1): OCR design specs, wireframes, mockup annotations

---

## Technical Dependencies

| Dependency | Purpose | Status |
|-----------|---------|--------|
| GLM-OCR model weights | Core OCR model | Download from HuggingFace |
| Sharp or Jimp | Image preprocessing | npm package |
| PDF.js | PDF → image conversion | npm package |
| Model router (Pillar 2) | Inference routing | Co-developed |

---

## Compliance Notes

- **PII in OCR'd documents**: ID documents, medical records, financial documents contain PII
- [ ] OCR output containing PII must be encrypted at rest
- [ ] Access to OCR'd PII data logged in audit trail
- [ ] `ocr:id-document` skill requires admin (47) authorization
- [ ] Retention policy: OCR'd text follows same retention as source document
- [ ] No OCR'd PII in application logs

---

## Checklist

### Model Setup
- [ ] Download GLM-OCR weights from HuggingFace
- [ ] Verify model license permits commercial/internal use
- [ ] Configure quantization (INT8 recommended for edge, FP16 for VM5)
- [ ] Deploy inference server (via model-router or standalone)
- [ ] Health check: inference test with known image → expected text
- [ ] Benchmark: throughput (images/sec), latency (ms/image), accuracy vs ground truth

### Pipeline
- [ ] Implement image preprocessing (deskew, contrast, rotation detection)
- [ ] Implement PDF → image conversion
- [ ] Implement page segmentation
- [ ] Implement OCR extraction via GLM-OCR
- [ ] Implement structure assembly
- [ ] Implement entity extraction from OCR'd text
- [ ] Implement metadata extraction
- [ ] Unit tests for each pipeline stage
- [ ] Integration test: PDF → structured JSON output
- [ ] Performance test: 100-page PDF processing time

### Skills
- [ ] Register all 10 OCR skills in skill-runner
- [ ] Implement each skill handler
- [ ] Wire through agent-runtime command router
- [ ] End-to-end test per skill
- [ ] PII handling compliance for `ocr:id-document` and `ocr:receipt`

### Storage & Search
- [ ] Index OCR'd full text for search
- [ ] Encrypt PII-containing OCR output at rest
- [ ] Audit logging for PII document access
- [ ] Retention policy enforcement

---

## Success Criteria

1. GLM-OCR runs locally with <1 second latency per page
2. Accuracy ≥95% on printed text, ≥85% on handwriting
3. Table extraction preserves row/column structure correctly
4. Multi-language support works without model switching
5. PII documents handled per GDPR/SOC2 compliance
6. Cost: $0 per OCR operation (fully local, no cloud API calls)
7. Batch processing handles 100+ pages without memory issues
