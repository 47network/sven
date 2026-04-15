// ---------------------------------------------------------------------------
// XLSX Generator Skill — Creates Open XML (XLSX) spreadsheets
// ---------------------------------------------------------------------------
// Generates SpreadsheetML XML files that can be zipped into .xlsx.
// Minimal XLSX package: [Content_Types].xml, _rels/.rels, xl/workbook.xml,
//   xl/_rels/workbook.xml.rels, xl/styles.xml, xl/sharedStrings.xml,
//   xl/worksheets/sheet1.xml (per sheet)
// ---------------------------------------------------------------------------

export default async function handler(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const action = input.action as string;

  switch (action) {
    case 'create': {
      const title = (input.title as string) || 'Spreadsheet';
      const sheets = (input.sheets as Sheet[]) || [];

      if (sheets.length === 0) {
        return { error: 'At least one sheet is required. Each sheet needs a name and rows.' };
      }

      const sharedStrings: string[] = [];
      const ssIndex = (s: string): number => {
        const idx = sharedStrings.indexOf(s);
        if (idx >= 0) return idx;
        sharedStrings.push(s);
        return sharedStrings.length - 1;
      };

      const worksheetFiles: Record<string, string> = {};
      for (let i = 0; i < sheets.length; i++) {
        worksheetFiles[`xl/worksheets/sheet${i + 1}.xml`] = buildSheetXml(sheets[i], ssIndex);
      }

      const files: Record<string, string> = {
        '[Content_Types].xml': buildContentTypes(sheets.length),
        '_rels/.rels': buildRootRels(),
        'xl/workbook.xml': buildWorkbookXml(sheets),
        'xl/_rels/workbook.xml.rels': buildWorkbookRels(sheets.length),
        'xl/styles.xml': buildStylesXml(),
        'xl/sharedStrings.xml': buildSharedStringsXml(sharedStrings),
        ...worksheetFiles,
      };

      const totalRows = sheets.reduce((s, sh) => s + (sh.rows?.length || 0), 0);
      const totalCells = sheets.reduce((s, sh) => {
        const cols = sh.headers?.length || (sh.rows?.[0]?.length || 0);
        return s + (sh.rows?.length || 0) * cols + cols;
      }, 0);

      return {
        result: {
          format: 'xlsx',
          title,
          sheetCount: sheets.length,
          totalRows,
          totalCells,
          files,
          instructions: 'ZIP these files together with .xlsx extension to create the spreadsheet.',
        },
      };
    }

    case 'from_csv': {
      const csvData = (input.csv_data as string) || '';
      const delimiter = (input.delimiter as string) || ',';

      if (!csvData.trim()) return { error: 'csv_data is required' };

      const lines = csvData.trim().split('\n');
      const headers = parseCsvLine(lines[0], delimiter);
      const rows = lines.slice(1).map((line) => parseCsvLine(line, delimiter));

      const sheet: Sheet = { name: 'Sheet1', headers, rows };
      const title = (input.title as string) || 'Imported CSV';

      // Delegate to create
      return handler({ action: 'create', title, sheets: [sheet] });
    }

    case 'analyze_structure': {
      const sheets = (input.sheets as Sheet[]) || [];
      return {
        result: {
          sheets: sheets.map((s) => ({
            name: s.name || 'Sheet',
            headerCount: s.headers?.length || 0,
            rowCount: s.rows?.length || 0,
            columnCount: s.headers?.length || (s.rows?.[0]?.length || 0),
            estimatedCells: (s.headers?.length || 0) + (s.rows?.length || 0) * (s.headers?.length || (s.rows?.[0]?.length || 0)),
          })),
        },
      };
    }

    default:
      return { error: `Unknown action "${action}". Available: create, from_csv, analyze_structure` };
  }
}

/* -------- Types -------- */

interface Sheet {
  name?: string;
  headers?: string[];
  rows?: (string | number | boolean | null)[][];
  column_widths?: number[];
}

/* -------- Helpers -------- */

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function colLetter(idx: number): string {
  let result = '';
  let n = idx;
  while (n >= 0) {
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26) - 1;
  }
  return result;
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function cellValue(val: unknown, rowIdx: number, colIdx: number, ssIndex: (s: string) => number): string {
  const ref = `${colLetter(colIdx)}${rowIdx}`;
  if (val === null || val === undefined || val === '') return `<c r="${ref}"/>`;
  if (typeof val === 'number') return `<c r="${ref}"><v>${val}</v></c>`;
  if (typeof val === 'boolean') return `<c r="${ref}" t="b"><v>${val ? 1 : 0}</v></c>`;
  const str = String(val);
  if (/^-?\d+(\.\d+)?$/.test(str)) return `<c r="${ref}"><v>${str}</v></c>`;
  return `<c r="${ref}" t="s"><v>${ssIndex(str)}</v></c>`;
}

/* -------- XML Builders -------- */

function buildSheetXml(sheet: Sheet, ssIndex: (s: string) => number): string {
  const rows: string[] = [];
  let rowNum = 1;

  // Column widths
  let colsXml = '';
  const colCount = sheet.headers?.length || (sheet.rows?.[0]?.length || 0);
  if (sheet.column_widths && sheet.column_widths.length > 0) {
    const cols = sheet.column_widths.map((w, i) =>
      `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('');
    colsXml = `<cols>${cols}</cols>`;
  }

  // Header row
  if (sheet.headers) {
    const cells = sheet.headers.map((h, ci) => cellValue(h, rowNum, ci, ssIndex)).join('');
    rows.push(`<row r="${rowNum}">${cells}</row>`);
    rowNum++;
  }

  // Data rows
  if (sheet.rows) {
    for (const row of sheet.rows) {
      const cells = row.map((v, ci) => cellValue(v, rowNum, ci, ssIndex)).join('');
      rows.push(`<row r="${rowNum}">${cells}</row>`);
      rowNum++;
    }
  }

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
${colsXml}<sheetData>${rows.join('')}</sheetData></worksheet>`;
}

function buildWorkbookXml(sheets: Sheet[]): string {
  const sheetRefs = sheets.map((s, i) =>
    `<sheet name="${escapeXml(s.name || `Sheet${i + 1}`)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${sheetRefs}</sheets></workbook>`;
}

function buildSharedStringsXml(strings: string[]): string {
  const items = strings.map((s) => `<si><t>${escapeXml(s)}</t></si>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${strings.length}" uniqueCount="${strings.length}">
${items}</sst>`;
}

function buildStylesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><sz val="11"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><name val="Calibri"/></font>
  </fonts>
  <fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
  <borders count="1"><border><left/><right/><top/><bottom/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="2">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
  </cellXfs>
</styleSheet>`;
}

function buildContentTypes(sheetCount: number): string {
  const sheetOverrides = Array.from({ length: sheetCount }, (_, i) =>
    `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
  ${sheetOverrides}
</Types>`;
}

function buildRootRels(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
}

function buildWorkbookRels(sheetCount: number): string {
  const rels = Array.from({ length: sheetCount }, (_, i) =>
    `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${rels}
  <Relationship Id="rId${sheetCount + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId${sheetCount + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
</Relationships>`;
}
