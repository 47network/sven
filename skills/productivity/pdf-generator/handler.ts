// ---------------------------------------------------------------------------
// PDF Generator Skill — Creates PDF 1.4 documents from pure TypeScript
// ---------------------------------------------------------------------------
// Generates a minimal but valid PDF with text content.
// No external dependencies — builds the PDF binary format directly.
// ---------------------------------------------------------------------------

export default async function handler(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const action = input.action as string;

  switch (action) {
    case 'create': {
      const title = (input.title as string) || 'Untitled';
      const sections = (input.sections as Section[]) || [];
      const author = (input.author as string) || 'Sven';
      const pageSize = (input.page_size as string) || 'letter';

      if (sections.length === 0) {
        return { error: 'At least one section is required.' };
      }

      const dims = pageSize === 'a4' ? { w: 595, h: 842 } : { w: 612, h: 792 };
      const pdf = buildPdf(title, author, sections, dims);

      return {
        result: {
          format: 'pdf',
          title,
          author,
          pageSize,
          sectionCount: sections.length,
          wordCount: countWords(sections),
          byteLength: pdf.length,
          content: pdf,
          contentEncoding: 'raw',
          instructions: 'Save the content field directly as a .pdf file.',
        },
      };
    }

    case 'preview': {
      const sections = (input.sections as Section[]) || [];
      const title = (input.title as string) || 'Untitled';
      let md = `# ${title}\n\n`;
      for (const s of sections) {
        if (s.heading) md += `## ${s.heading}\n\n`;
        if (s.body) md += `${s.body}\n\n`;
        if (s.list_items) {
          for (const item of s.list_items) md += `- ${item}\n`;
          md += '\n';
        }
      }
      return { result: { markdown: md.trim(), wordCount: countWords(sections) } };
    }

    default:
      return { error: `Unknown action "${action}". Available: create, preview` };
  }
}

/* -------- Types -------- */

interface Section {
  heading?: string;
  body?: string;
  list_items?: string[];
}

/* -------- PDF Builder -------- */

function buildPdf(title: string, author: string, sections: Section[], dims: { w: number; h: number }): string {
  // PDF is built as a sequence of objects.
  // We use a simple approach: one page with all content as text operations.
  const margin = 72; // 1 inch
  const lineHeight = 14;
  const headingSize = 16;
  const bodySize = 11;
  const pageWidth = dims.w - 2 * margin;

  // Build content stream with text operations
  const lines: TextLine[] = [];

  // Title
  lines.push({ text: pdfEscape(title), size: 20, bold: true, indent: 0 });
  lines.push({ text: '', size: bodySize, bold: false, indent: 0 }); // blank line

  for (const section of sections) {
    if (section.heading) {
      lines.push({ text: '', size: bodySize, bold: false, indent: 0 });
      lines.push({ text: pdfEscape(section.heading), size: headingSize, bold: true, indent: 0 });
    }
    if (section.body) {
      const wrappedLines = wordWrap(section.body, pageWidth, bodySize * 0.6);
      for (const line of wrappedLines) {
        lines.push({ text: pdfEscape(line), size: bodySize, bold: false, indent: 0 });
      }
    }
    if (section.list_items) {
      for (const item of section.list_items) {
        const wrappedLines = wordWrap(item, pageWidth - 20, bodySize * 0.6);
        for (let i = 0; i < wrappedLines.length; i++) {
          const prefix = i === 0 ? '\\x95  ' : '    '; // bullet char
          lines.push({ text: `${prefix}${pdfEscape(wrappedLines[i])}`, size: bodySize, bold: false, indent: 15 });
        }
      }
    }
  }

  // Split into pages
  const usableHeight = dims.h - 2 * margin;
  const linesPerPage = Math.floor(usableHeight / lineHeight);
  const pages: TextLine[][] = [];
  for (let i = 0; i < lines.length; i += linesPerPage) {
    pages.push(lines.slice(i, i + linesPerPage));
  }
  if (pages.length === 0) pages.push([]);

  // Build PDF objects
  const objects: string[] = [];

  const addObj = (obj: string) => {
    const num = objects.length + 1;
    objects.push(obj);
    return num;
  };

  // 1 — Catalog
  const catalogNum = addObj('<< /Type /Catalog /Pages 2 0 R >>');

  // 2 — Pages (placeholder — we'll fix ref later)
  const pagesObjIndex = objects.length;
  addObj('PLACEHOLDER');

  // 3 — Font (Helvetica)
  const fontNum = addObj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');

  // 4 — Bold Font
  const fontBoldNum = addObj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');

  // Create page objects
  const pageObjNums: number[] = [];
  for (let p = 0; p < pages.length; p++) {
    const pageLines = pages[p];

    // Content stream
    let stream = 'BT\n';
    let y = dims.h - margin;

    for (const line of pageLines) {
      const font = line.bold ? `/F2 ${line.size}` : `/F1 ${line.size}`;
      stream += `${font} Tf\n`;
      stream += `${margin + line.indent} ${y} Td\n`;
      stream += `(${line.text}) Tj\n`;
      y -= lineHeight;
      stream += `0 0 Td\n`; // reset position for next absolute move
    }
    stream += 'ET\n';

    const streamNum = addObj(`<< /Length ${stream.length} >>\nstream\n${stream}endstream`);

    // Page object
    const pageNum = addObj(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${dims.w} ${dims.h}] ` +
      `/Contents ${streamNum} 0 R ` +
      `/Resources << /Font << /F1 ${fontNum} 0 R /F2 ${fontBoldNum} 0 R >> >> >>`,
    );
    pageObjNums.push(pageNum);
  }

  // Fix Pages object
  const kids = pageObjNums.map((n) => `${n} 0 R`).join(' ');
  objects[pagesObjIndex] = `<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`;

  // Final assembly
  let rebuilt = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const newOffsets: number[] = [];
  for (let i = 0; i < objects.length; i++) {
    newOffsets.push(rebuilt.length);
    rebuilt += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }

  // Cross-reference table
  const xrefOffset = rebuilt.length;
  rebuilt += `xref\n0 ${newOffsets.length + 1}\n0000000000 65535 f \n`;
  for (const off of newOffsets) {
    rebuilt += `${String(off).padStart(10, '0')} 00000 n \n`;
  }

  // Trailer
  rebuilt += `trailer\n<< /Size ${newOffsets.length + 1} /Root ${catalogNum} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return rebuilt;
}

/* -------- Text Helpers -------- */

interface TextLine {
  text: string;
  size: number;
  bold: boolean;
  indent: number;
}

function pdfEscape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function wordWrap(text: string, maxWidth: number, charWidth: number): string[] {
  const maxChars = Math.floor(maxWidth / charWidth);
  const result: string[] = [];
  for (const paragraph of text.split('\n')) {
    if (!paragraph.trim()) { result.push(''); continue; }
    const words = paragraph.split(/\s+/);
    let line = '';
    for (const word of words) {
      if (line.length + word.length + 1 > maxChars && line.length > 0) {
        result.push(line);
        line = word;
      } else {
        line = line ? `${line} ${word}` : word;
      }
    }
    if (line) result.push(line);
  }
  return result;
}

function countWords(sections: Section[]): number {
  let count = 0;
  for (const s of sections) {
    if (s.heading) count += s.heading.split(/\s+/).length;
    if (s.body) count += s.body.split(/\s+/).length;
    if (s.list_items) for (const item of s.list_items) count += item.split(/\s+/).length;
  }
  return count;
}
