// ---------------------------------------------------------------------------
// DOCX Generator Skill — Creates Open XML (DOCX) documents
// ---------------------------------------------------------------------------
// Returns document as a structured Open XML package.
// The DOCX format is a ZIP of XML files — we generate the minimal set:
//   [Content_Types].xml, _rels/.rels, word/document.xml, word/styles.xml
// ---------------------------------------------------------------------------

export default async function handler(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const action = input.action as string;

  switch (action) {
    case 'create': {
      const title = (input.title as string) || 'Untitled Document';
      const sections = (input.sections as Section[]) || [];
      const author = (input.author as string) || 'Sven';

      if (sections.length === 0) {
        return { error: 'At least one section is required. Each section needs a heading and/or body.' };
      }

      const documentXml = buildDocumentXml(title, sections);
      const stylesXml = buildStylesXml();
      const contentTypes = buildContentTypes();
      const rels = buildRelationships();
      const coreProps = buildCoreProperties(title, author);

      return {
        result: {
          format: 'docx',
          title,
          author,
          sectionCount: sections.length,
          wordCount: countWords(sections),
          files: {
            '[Content_Types].xml': contentTypes,
            '_rels/.rels': rels,
            'word/document.xml': documentXml,
            'word/styles.xml': stylesXml,
            'docProps/core.xml': coreProps,
          },
          instructions: 'ZIP these files together with .docx extension to create the document.',
        },
      };
    }

    case 'template_list': {
      return {
        result: {
          templates: [
            { name: 'report', description: 'Business report with executive summary, sections, and conclusion', sections: ['Executive Summary', 'Background', 'Analysis', 'Recommendations', 'Conclusion'] },
            { name: 'memo', description: 'Internal memo with to/from/subject/body', sections: ['To', 'From', 'Subject', 'Body'] },
            { name: 'proposal', description: 'Project proposal with objectives, scope, timeline, budget', sections: ['Objectives', 'Scope', 'Timeline', 'Budget', 'Team', 'Risks'] },
            { name: 'meeting_notes', description: 'Meeting notes with attendees, agenda, discussion, action items', sections: ['Attendees', 'Agenda', 'Discussion', 'Action Items', 'Next Steps'] },
            { name: 'sop', description: 'Standard operating procedure', sections: ['Purpose', 'Scope', 'Responsibilities', 'Procedure', 'References'] },
          ],
        },
      };
    }

    case 'preview': {
      const sections = (input.sections as Section[]) || [];
      const title = (input.title as string) || 'Untitled';
      let preview = `# ${title}\n\n`;
      for (const section of sections) {
        const level = section.level || 1;
        const prefix = '#'.repeat(Math.min(level + 1, 6));
        if (section.heading) preview += `${prefix} ${section.heading}\n\n`;
        if (section.body) preview += `${section.body}\n\n`;
        if (section.list_items) {
          for (const item of section.list_items) preview += `- ${item}\n`;
          preview += '\n';
        }
        if (section.table) {
          const t = section.table;
          if (t.headers) preview += `| ${t.headers.join(' | ')} |\n| ${t.headers.map(() => '---').join(' | ')} |\n`;
          if (t.rows) for (const row of t.rows) preview += `| ${row.join(' | ')} |\n`;
          preview += '\n';
        }
      }
      return { result: { markdown: preview.trim(), wordCount: countWords(sections) } };
    }

    default:
      return { error: `Unknown action "${action}". Available: create, template_list, preview` };
  }
}

/* -------- Types -------- */

interface Section {
  heading?: string;
  body?: string;
  level?: number;
  list_items?: string[];
  table?: { headers?: string[]; rows?: string[][] };
}

/* -------- Open XML Builders -------- */

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function buildDocumentXml(title: string, sections: Section[]): string {
  const body: string[] = [];

  // Title paragraph
  body.push(`<w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:t>${escapeXml(title)}</w:t></w:r></w:p>`);

  for (const section of sections) {
    const level = section.level || 1;

    if (section.heading) {
      body.push(`<w:p><w:pPr><w:pStyle w:val="Heading${Math.min(level, 3)}"/></w:pPr><w:r><w:t>${escapeXml(section.heading)}</w:t></w:r></w:p>`);
    }

    if (section.body) {
      for (const para of section.body.split('\n').filter(Boolean)) {
        body.push(`<w:p><w:r><w:t xml:space="preserve">${escapeXml(para)}</w:t></w:r></w:p>`);
      }
    }

    if (section.list_items) {
      for (const item of section.list_items) {
        body.push(`<w:p><w:pPr><w:pStyle w:val="ListBullet"/></w:pPr><w:r><w:t>${escapeXml(item)}</w:t></w:r></w:p>`);
      }
    }

    if (section.table && section.table.headers) {
      const tbl: string[] = ['<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="0" w:type="auto"/></w:tblPr>'];
      // Header row
      tbl.push('<w:tr>');
      for (const h of section.table.headers) {
        tbl.push(`<w:tc><w:p><w:pPr><w:b/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>${escapeXml(h)}</w:t></w:r></w:p></w:tc>`);
      }
      tbl.push('</w:tr>');
      // Data rows
      if (section.table.rows) {
        for (const row of section.table.rows) {
          tbl.push('<w:tr>');
          for (const cell of row) {
            tbl.push(`<w:tc><w:p><w:r><w:t>${escapeXml(cell)}</w:t></w:r></w:p></w:tc>`);
          }
          tbl.push('</w:tr>');
        }
      }
      tbl.push('</w:tbl>');
      body.push(tbl.join(''));
    }
  }

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<w:body>${body.join('')}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>`;
}

function buildStylesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:rPr><w:sz w:val="56"/><w:b/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="Heading 1"/><w:rPr><w:sz w:val="36"/><w:b/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="Heading 2"/><w:rPr><w:sz w:val="30"/><w:b/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="Heading 3"/><w:rPr><w:sz w:val="26"/><w:b/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="ListBullet"><w:name w:val="List Bullet"/><w:pPr><w:ind w:left="720"/></w:pPr></w:style>
  <w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/><w:tblPr><w:tblBorders>
    <w:top w:val="single" w:sz="4" w:space="0"/><w:left w:val="single" w:sz="4" w:space="0"/>
    <w:bottom w:val="single" w:sz="4" w:space="0"/><w:right w:val="single" w:sz="4" w:space="0"/>
    <w:insideH w:val="single" w:sz="4" w:space="0"/><w:insideV w:val="single" w:sz="4" w:space="0"/>
  </w:tblBorders></w:tblPr></w:style>
</w:styles>`;
}

function buildContentTypes(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
</Types>`;
}

function buildRelationships(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
</Relationships>`;
}

function buildCoreProperties(title: string, author: string): string {
  const now = new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
                   xmlns:dc="http://purl.org/dc/elements/1.1/"
                   xmlns:dcterms="http://purl.org/dc/terms/">
  <dc:title>${escapeXml(title)}</dc:title>
  <dc:creator>${escapeXml(author)}</dc:creator>
  <dcterms:created>${now}</dcterms:created>
  <dcterms:modified>${now}</dcterms:modified>
</cp:coreProperties>`;
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
