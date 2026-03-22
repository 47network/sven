type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
const RESERVED_MAP_TEMPLATE_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const SAFE_MAP_TEMPLATE_KEY = /^[a-zA-Z0-9_.-]{1,128}$/;

export type DataShapeOperator =
  | {
      op: 'where';
      field: string;
      equals?: Json;
      notEquals?: Json;
      gt?: number;
      gte?: number;
      lt?: number;
      lte?: number;
      includes?: string;
      in?: Json[];
    }
  | {
      op: 'pick';
      fields: string[];
    }
  | {
      op: 'head' | 'tail';
      count: number;
    }
  | {
      op: 'sort';
      field: string;
      direction?: 'asc' | 'desc';
    }
  | {
      op: 'map';
      template: Record<string, any>;
    }
  | {
      op: 'reduce';
      method: 'count' | 'sum' | 'min' | 'max' | 'concat';
      field?: string;
      initial?: any;
      separator?: string;
    };

export function applyDataShapingPipeline(input: any, operators: DataShapeOperator[]): any {
  let current = input;
  for (const operator of operators) {
    current = applyOperator(current, operator);
  }
  return current;
}

function applyOperator(input: any, operator: DataShapeOperator): any {
  switch (operator.op) {
    case 'where':
      return applyWhere(input, operator);
    case 'pick':
      return applyPick(input, operator.fields);
    case 'head':
      return asArray(input).slice(0, Math.max(0, Number(operator.count || 0)));
    case 'tail': {
      const count = Math.max(0, Number(operator.count || 0));
      const rows = asArray(input);
      return rows.slice(Math.max(0, rows.length - count));
    }
    case 'sort':
      return applySort(input, operator.field, operator.direction || 'asc');
    case 'map':
      return asArray(input).map((row, idx) => renderTemplate(operator.template, row, idx));
    case 'reduce':
      return applyReduce(asArray(input), operator);
    default:
      return input;
  }
}

function applyWhere(input: any, op: Extract<DataShapeOperator, { op: 'where' }>) {
  const rows = asArray(input);
  return rows.filter((row) => {
    const value = getByPath(row, op.field);
    if (op.equals !== undefined && value !== op.equals) return false;
    if (op.notEquals !== undefined && value === op.notEquals) return false;
    if (op.gt !== undefined && !(Number(value) > op.gt)) return false;
    if (op.gte !== undefined && !(Number(value) >= op.gte)) return false;
    if (op.lt !== undefined && !(Number(value) < op.lt)) return false;
    if (op.lte !== undefined && !(Number(value) <= op.lte)) return false;
    if (op.includes !== undefined && !String(value ?? '').includes(op.includes)) return false;
    if (op.in && !op.in.includes(value)) return false;
    return true;
  });
}

function applyPick(input: any, fields: string[]) {
  const items = asArray(input);
  return items.map((item) => {
    const out: Record<string, any> = {};
    for (const field of fields) {
      out[field] = getByPath(item, field);
    }
    return out;
  });
}

function applySort(input: any, field: string, direction: 'asc' | 'desc') {
  const rows = [...asArray(input)];
  const factor = direction === 'desc' ? -1 : 1;
  rows.sort((left, right) => {
    const a = getByPath(left, field);
    const b = getByPath(right, field);
    if (a == null && b == null) return 0;
    if (a == null) return -1 * factor;
    if (b == null) return 1 * factor;
    if (a < b) return -1 * factor;
    if (a > b) return 1 * factor;
    return 0;
  });
  return rows;
}

function applyReduce(rows: any[], op: Extract<DataShapeOperator, { op: 'reduce' }>) {
  switch (op.method) {
    case 'count':
      return rows.length;
    case 'sum':
      return rows.reduce((acc, row) => acc + Number(getByPath(row, op.field || '') || 0), Number(op.initial || 0));
    case 'min':
      return rows.reduce((acc, row) => {
        const n = Number(getByPath(row, op.field || ''));
        if (!Number.isFinite(n)) return acc;
        if (acc == null) return n;
        return Math.min(acc, n);
      }, op.initial ?? null);
    case 'max':
      return rows.reduce((acc, row) => {
        const n = Number(getByPath(row, op.field || ''));
        if (!Number.isFinite(n)) return acc;
        if (acc == null) return n;
        return Math.max(acc, n);
      }, op.initial ?? null);
    case 'concat':
      return rows
        .map((row) => String(getByPath(row, op.field || '') ?? ''))
        .filter(Boolean)
        .join(op.separator || ', ');
    default:
      return rows;
  }
}

function asArray(input: any): any[] {
  if (Array.isArray(input)) return input;
  if (input == null) return [];
  return [input];
}

function getByPath(value: any, path: string): any {
  if (!path) return value;
  return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), value);
}

function renderTemplate(template: Record<string, any>, row: any, index: number) {
  const out: Record<string, any> = Object.create(null);
  for (const [key, value] of Object.entries(template || {})) {
    if (RESERVED_MAP_TEMPLATE_KEYS.has(key)) {
      throw new Error(`map.template contains reserved key: ${key}`);
    }
    if (!SAFE_MAP_TEMPLATE_KEY.test(key)) {
      throw new Error(`map.template key is invalid: ${key}`);
    }
    if (typeof value === 'string' && value.startsWith('$.')) {
      out[key] = getByPath(row, value.slice(2));
    } else if (value === '$index') {
      out[key] = index;
    } else {
      out[key] = value;
    }
  }
  return out;
}
