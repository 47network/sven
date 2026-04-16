// ---------------------------------------------------------------------------
// Entity Extraction
// ---------------------------------------------------------------------------
// Named-entity recognition and structured data extraction from OCR output.
// Supports PII detection, receipt/invoice fields, ID document fields.
// ---------------------------------------------------------------------------

/* ------------------------------------------------------------------ types */

export type EntityCategory =
  | 'person'
  | 'organization'
  | 'location'
  | 'date'
  | 'currency'
  | 'email'
  | 'phone'
  | 'url'
  | 'id_number'
  | 'address'
  | 'receipt_field'
  | 'invoice_field'
  | 'custom';

export interface Entity {
  id: string;
  category: EntityCategory;
  subcategory: string;
  value: string;
  normalised: string;
  confidence: number;
  sourceText: string;
  position: { start: number; end: number };
  isPii: boolean;
}

export interface ReceiptData {
  vendor: string | null;
  date: string | null;
  items: { name: string; quantity: number; unitPrice: number; total: number }[];
  subtotal: number | null;
  tax: number | null;
  total: number | null;
  paymentMethod: string | null;
  currency: string;
}

export interface IdDocumentData {
  documentType: 'passport' | 'drivers_license' | 'national_id' | 'other';
  fullName: string | null;
  dateOfBirth: string | null;
  documentNumber: string | null;
  expiryDate: string | null;
  issuingCountry: string | null;
  nationality: string | null;
  confidence: number;
}

export interface InvoiceData {
  invoiceNumber: string | null;
  date: string | null;
  dueDate: string | null;
  vendor: { name: string; address: string | null };
  customer: { name: string; address: string | null };
  lineItems: { description: string; quantity: number; unitPrice: number; total: number }[];
  subtotal: number | null;
  tax: number | null;
  total: number | null;
  currency: string;
}

/* --------------------------------------------------- extraction engine */

let entityCounter = 0;
function nextEntityId(): string { return `ent-${++entityCounter}`; }

function extractPersons(text: string): Entity[] {
  const entities: Entity[] = [];
  const namePattern = /\b([A-Z][a-z]+)\s([A-Z][a-z]+(?: [A-Z][a-z]+)?)\b/g;
  let match: RegExpExecArray | null;
  while ((match = namePattern.exec(text)) !== null) {
    entities.push({
      id: nextEntityId(),
      category: 'person',
      subcategory: 'full_name',
      value: match[0],
      normalised: match[0],
      confidence: 0.75,
      sourceText: text.slice(Math.max(0, match.index - 20), match.index + match[0].length + 20),
      position: { start: match.index, end: match.index + match[0].length },
      isPii: true,
    });
  }
  return entities;
}

function extractEmails(text: string): Entity[] {
  const entities: Entity[] = [];
  const emailPattern = /[a-zA-Z0-9._%+-]+@(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}/g;
  let match: RegExpExecArray | null;
  while ((match = emailPattern.exec(text)) !== null) {
    entities.push({
      id: nextEntityId(),
      category: 'email',
      subcategory: 'email_address',
      value: match[0],
      normalised: match[0].toLowerCase(),
      confidence: 0.95,
      sourceText: match[0],
      position: { start: match.index, end: match.index + match[0].length },
      isPii: true,
    });
  }
  return entities;
}

function extractUrls(text: string): Entity[] {
  const entities: Entity[] = [];
  const urlPattern = /https?:\/\/[^\s<>"']+/g;
  let match: RegExpExecArray | null;
  while ((match = urlPattern.exec(text)) !== null) {
    entities.push({
      id: nextEntityId(),
      category: 'url',
      subcategory: 'web_url',
      value: match[0],
      normalised: match[0],
      confidence: 0.95,
      sourceText: match[0],
      position: { start: match.index, end: match.index + match[0].length },
      isPii: false,
    });
  }
  return entities;
}

function extractCurrencies(text: string): Entity[] {
  const entities: Entity[] = [];
  const currencyPattern = /(?:[$€£¥])\s?\d[\d,]*\.?\d*/g;
  let match: RegExpExecArray | null;
  while ((match = currencyPattern.exec(text)) !== null) {
    entities.push({
      id: nextEntityId(),
      category: 'currency',
      subcategory: 'amount',
      value: match[0],
      normalised: match[0].replace(/[,\s]/g, ''),
      confidence: 0.9,
      sourceText: match[0],
      position: { start: match.index, end: match.index + match[0].length },
      isPii: false,
    });
  }
  return entities;
}

export function extractNamedEntities(text: string): Entity[] {
  return [
    ...extractPersons(text),
    ...extractEmails(text),
    ...extractUrls(text),
    ...extractCurrencies(text),
  ];
}

export function extractReceiptData(text: string): ReceiptData {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  const vendor = lines[0] ?? null;
  const dateMatch = text.match(/\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b/);
  const totalMatch = text.match(/total[:\s]*[$€£¥]?\s?(\d[\d,.]*)/i);
  const taxMatch = text.match(/tax[:\s]*[$€£¥]?\s?(\d[\d,.]*)/i);
  const subtotalMatch = text.match(/subtotal[:\s]*[$€£¥]?\s?(\d[\d,.]*)/i);

  return {
    vendor,
    date: dateMatch?.[1] ?? null,
    items: [],
    subtotal: subtotalMatch ? parseFloat(subtotalMatch[1].replace(',', '')) : null,
    tax: taxMatch ? parseFloat(taxMatch[1].replace(',', '')) : null,
    total: totalMatch ? parseFloat(totalMatch[1].replace(',', '')) : null,
    paymentMethod: null,
    currency: 'USD',
  };
}

export function extractIdDocument(text: string): IdDocumentData {
  const nameMatch = text.match(/(?:name|nom|nombre)[:\s]*([A-Za-z\s]+)/i);
  const dobMatch = text.match(/(?:date of birth|dob|born|née?)[:\s]*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i);
  const docNumMatch = text.match(/(?:no|number|passport|document)[:\s]*([A-Z0-9]{5,15})/i);
  const expiryMatch = text.match(/(?:expiry|expires|exp|valid until)[:\s]*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i);

  let docType: IdDocumentData['documentType'] = 'other';
  const lower = text.toLowerCase();
  if (lower.includes('passport')) docType = 'passport';
  else if (lower.includes('driver') || lower.includes('license') || lower.includes('licence')) docType = 'drivers_license';
  else if (lower.includes('national') || lower.includes('identity')) docType = 'national_id';

  return {
    documentType: docType,
    fullName: nameMatch?.[1]?.trim() ?? null,
    dateOfBirth: dobMatch?.[1] ?? null,
    documentNumber: docNumMatch?.[1] ?? null,
    expiryDate: expiryMatch?.[1] ?? null,
    issuingCountry: null,
    nationality: null,
    confidence: 0.8,
  };
}

export function extractInvoiceData(text: string): InvoiceData {
  const invNumMatch = text.match(/(?:invoice|inv)[#:\s]*([A-Z0-9-]+)/i);
  const dateMatch = text.match(/(?:date|issued)[:\s]*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i);
  const dueMatch = text.match(/(?:due|payment due)[:\s]*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i);
  const totalMatch = text.match(/(?:total|amount due)[:\s]*[$€£¥]?\s?(\d[\d,.]*)/i);

  return {
    invoiceNumber: invNumMatch?.[1] ?? null,
    date: dateMatch?.[1] ?? null,
    dueDate: dueMatch?.[1] ?? null,
    vendor: { name: '', address: null },
    customer: { name: '', address: null },
    lineItems: [],
    subtotal: null,
    tax: null,
    total: totalMatch ? parseFloat(totalMatch[1].replace(',', '')) : null,
    currency: 'USD',
  };
}

export function redactPii(entities: Entity[]): Entity[] {
  return entities.map((e) => {
    if (!e.isPii) return e;
    return {
      ...e,
      value: maskValue(e.value, e.category),
      normalised: maskValue(e.normalised, e.category),
    };
  });
}

function maskValue(value: string, category: EntityCategory): string {
  switch (category) {
    case 'email': {
      const [local, domain] = value.split('@');
      return `${local[0]}***@${domain}`;
    }
    case 'phone':
      return value.slice(0, -4).replace(/\d/g, '*') + value.slice(-4);
    case 'id_number':
      return '***' + value.slice(-3);
    case 'person':
      return value.split(' ').map((w) => w[0] + '***').join(' ');
    default:
      return '***REDACTED***';
  }
}
