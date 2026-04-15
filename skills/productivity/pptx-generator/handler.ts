// ---------------------------------------------------------------------------
// PPTX Generator Skill — Creates Open XML (PPTX) presentations
// ---------------------------------------------------------------------------
// Minimal PresentationML package: [Content_Types].xml, _rels/.rels,
//   ppt/presentation.xml, ppt/_rels/presentation.xml.rels,
//   ppt/slides/slide{N}.xml, ppt/slides/_rels/slide{N}.xml.rels,
//   ppt/slideLayouts/slideLayout1.xml, ppt/slideMasters/slideMaster1.xml
// ---------------------------------------------------------------------------

export default async function handler(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const action = input.action as string;

  switch (action) {
    case 'create': {
      const title = (input.title as string) || 'Untitled Presentation';
      const slides = (input.slides as Slide[]) || [];
      const author = (input.author as string) || 'Sven';

      if (slides.length === 0) {
        return { error: 'At least one slide is required. Each slide needs a title.' };
      }

      const slideFiles: Record<string, string> = {};
      const slideRelFiles: Record<string, string> = {};
      for (let i = 0; i < slides.length; i++) {
        slideFiles[`ppt/slides/slide${i + 1}.xml`] = buildSlideXml(slides[i]);
        slideRelFiles[`ppt/slides/_rels/slide${i + 1}.xml.rels`] = buildSlideRels();
      }

      const files: Record<string, string> = {
        '[Content_Types].xml': buildContentTypes(slides.length),
        '_rels/.rels': buildRootRels(),
        'ppt/presentation.xml': buildPresentationXml(slides.length),
        'ppt/_rels/presentation.xml.rels': buildPresentationRels(slides.length),
        'ppt/slideLayouts/slideLayout1.xml': buildSlideLayout(),
        'ppt/slideLayouts/_rels/slideLayout1.xml.rels': buildSlideLayoutRels(),
        'ppt/slideMasters/slideMaster1.xml': buildSlideMaster(),
        'ppt/slideMasters/_rels/slideMaster1.xml.rels': buildSlideMasterRels(),
        'docProps/core.xml': buildCoreProperties(title, author),
        ...slideFiles,
        ...slideRelFiles,
      };

      return {
        result: {
          format: 'pptx',
          title,
          author,
          slideCount: slides.length,
          files,
          instructions: 'ZIP these files together with .pptx extension to create the presentation.',
        },
      };
    }

    case 'template_list': {
      return {
        result: {
          templates: [
            { name: 'pitch_deck', description: 'Startup pitch deck', slides: ['Title', 'Problem', 'Solution', 'Market', 'Business Model', 'Traction', 'Team', 'Ask'] },
            { name: 'project_update', description: 'Project status update', slides: ['Title', 'Summary', 'Progress', 'Blockers', 'Next Steps', 'Timeline'] },
            { name: 'quarterly_review', description: 'Quarterly business review', slides: ['Title', 'Key Metrics', 'Revenue', 'Product Updates', 'Roadmap', 'Q&A'] },
            { name: 'technical_overview', description: 'Technical architecture overview', slides: ['Title', 'Architecture', 'Components', 'Data Flow', 'Security', 'Performance', 'Next Steps'] },
            { name: 'training', description: 'Training / onboarding deck', slides: ['Title', 'Agenda', 'Overview', 'Step-by-Step', 'Demo', 'Resources', 'Q&A'] },
          ],
        },
      };
    }

    case 'preview': {
      const slides = (input.slides as Slide[]) || [];
      const title = (input.title as string) || 'Untitled';
      const lines: string[] = [`# ${title}`, ''];
      for (let i = 0; i < slides.length; i++) {
        const s = slides[i];
        lines.push(`---`);
        lines.push(`## Slide ${i + 1}: ${s.title || 'Untitled Slide'}`);
        if (s.body) lines.push('', s.body);
        if (s.bullets) for (const b of s.bullets) lines.push(`- ${b}`);
        if (s.notes) lines.push('', `> Speaker notes: ${s.notes}`);
        lines.push('');
      }
      return { result: { markdown: lines.join('\n').trim(), slideCount: slides.length } };
    }

    default:
      return { error: `Unknown action "${action}". Available: create, template_list, preview` };
  }
}

/* -------- Types -------- */

interface Slide {
  title?: string;
  bullets?: string[];
  body?: string;
  notes?: string;
  layout?: string;
}

/* -------- Helpers -------- */

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

const EMU_INCH = 914400;
const SLIDE_W = 12192000; // 10in * 1219200
const SLIDE_H = 6858000;  // 7.5in * 914400

/* -------- PresentationML Builders -------- */

function buildSlideXml(slide: Slide): string {
  const titleShape = `
    <p:sp><p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>
    <p:spPr><a:xfrm><a:off x="${EMU_INCH}" y="${EMU_INCH / 2}"/><a:ext cx="${SLIDE_W - 2 * EMU_INCH}" cy="${EMU_INCH}"/></a:xfrm></p:spPr>
    <p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US" sz="3600" b="1"/><a:t>${esc(slide.title || '')}</a:t></a:r></a:p></p:txBody></p:sp>`;

  const bodyParts: string[] = [];
  if (slide.body) {
    for (const para of slide.body.split('\n').filter(Boolean)) {
      bodyParts.push(`<a:p><a:r><a:rPr lang="en-US" sz="1800"/><a:t>${esc(para)}</a:t></a:r></a:p>`);
    }
  }
  if (slide.bullets) {
    for (const b of slide.bullets) {
      bodyParts.push(`<a:p><a:pPr marL="342900" indent="-342900"><a:buChar char="•"/></a:pPr><a:r><a:rPr lang="en-US" sz="1800"/><a:t>${esc(b)}</a:t></a:r></a:p>`);
    }
  }
  if (bodyParts.length === 0) bodyParts.push('<a:p><a:endParaRPr lang="en-US"/></a:p>');

  const bodyShape = `
    <p:sp><p:nvSpPr><p:cNvPr id="3" name="Content"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph idx="1"/></p:nvPr></p:nvSpPr>
    <p:spPr><a:xfrm><a:off x="${EMU_INCH}" y="${EMU_INCH * 2}"/><a:ext cx="${SLIDE_W - 2 * EMU_INCH}" cy="${SLIDE_H - EMU_INCH * 3}"/></a:xfrm></p:spPr>
    <p:txBody><a:bodyPr/><a:lstStyle/>${bodyParts.join('')}</p:txBody></p:sp>`;

  let notesXml = '';
  if (slide.notes) {
    notesXml = `<p:notes><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>
    <p:sp><p:nvSpPr><p:cNvPr id="4" name="Notes"/><p:cNvSpPr/><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:spPr/>
    <p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US"/><a:t>${esc(slide.notes)}</a:t></a:r></a:p></p:txBody></p:sp>
    </p:spTree></p:cSld></p:notes>`;
  }

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
       xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
       xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
<p:cSld><p:spTree>
  <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
  <p:grpSpPr/>
  ${titleShape}
  ${bodyShape}
</p:spTree></p:cSld>${notesXml}</p:sld>`;
}

function buildPresentationXml(count: number): string {
  const sldIdList = Array.from({ length: count }, (_, i) =>
    `<p:sldId id="${256 + i}" r:id="rId${i + 1}"/>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
                xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
                xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId${count + 1}"/></p:sldMasterIdLst>
<p:sldIdLst>${sldIdList}</p:sldIdLst>
<p:sldSz cx="${SLIDE_W}" cy="${SLIDE_H}"/></p:presentation>`;
}

function buildPresentationRels(count: number): string {
  const slideRels = Array.from({ length: count }, (_, i) =>
    `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${slideRels}
  <Relationship Id="rId${count + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>
</Relationships>`;
}

function buildSlideRels(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>`;
}

function buildSlideLayout(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
             xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="obj">
<p:cSld name="Title and Content"><p:spTree>
  <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>
</p:spTree></p:cSld></p:sldLayout>`;
}

function buildSlideLayoutRels(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>`;
}

function buildSlideMaster(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
             xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
             xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
<p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>
<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld>
<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst></p:sldMaster>`;
}

function buildSlideMasterRels(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>`;
}

function buildContentTypes(count: number): string {
  const slideOverrides = Array.from({ length: count }, (_, i) =>
    `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
  ${slideOverrides}
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
</Types>`;
}

function buildRootRels(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
</Relationships>`;
}

function buildCoreProperties(title: string, author: string): string {
  const now = new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
                   xmlns:dc="http://purl.org/dc/elements/1.1/"
                   xmlns:dcterms="http://purl.org/dc/terms/">
  <dc:title>${esc(title)}</dc:title>
  <dc:creator>${esc(author)}</dc:creator>
  <dcterms:created>${now}</dcterms:created>
</cp:coreProperties>`;
}
