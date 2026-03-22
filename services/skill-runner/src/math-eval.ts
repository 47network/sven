type MathEvalOptions = {
  maxLength?: number;
  maxTokens?: number;
  maxOperations?: number;
  maxMs?: number;
};

type MathEvalResult = { ok: true; value: number } | { ok: false; error: string };

const DEFAULT_MAX_LENGTH = 512;
const DEFAULT_MAX_TOKENS = 256;
const DEFAULT_MAX_OPERATIONS = 256;
const DEFAULT_MAX_MS = 25;

type Token =
  | { kind: 'number'; value: number }
  | { kind: 'op'; value: '+' | '-' | '*' | '/' | '%' | 'u-' }
  | { kind: 'paren'; value: '(' | ')' };

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const normalized = Math.trunc(parsed);
  if (normalized < min) return min;
  if (normalized > max) return max;
  return normalized;
}

function makeBudget(maxMs: number): () => void {
  const started = Date.now();
  return () => {
    if (Date.now() - started > maxMs) {
      throw new Error('math expression evaluation timed out');
    }
  };
}

function tokenize(expr: string, maxTokens: number, budgetCheck: () => void): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  let prevKind: 'start' | 'number' | 'op' | 'paren_open' | 'paren_close' = 'start';

  while (i < expr.length) {
    budgetCheck();
    const ch = expr[i];
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }

    if (/[0-9.]/.test(ch)) {
      let j = i + 1;
      while (j < expr.length && /[0-9.]/.test(expr[j])) j += 1;
      const raw = expr.slice(i, j);
      if ((raw.match(/\./g) || []).length > 1) {
        throw new Error('Invalid math expression');
      }
      const value = Number(raw);
      if (!Number.isFinite(value)) {
        throw new Error('Invalid math expression');
      }
      tokens.push({ kind: 'number', value });
      prevKind = 'number';
      i = j;
    } else if (ch === '(' || ch === ')') {
      tokens.push({ kind: 'paren', value: ch });
      prevKind = ch === '(' ? 'paren_open' : 'paren_close';
      i += 1;
    } else if ('+-*/%'.includes(ch)) {
      let op: '+' | '-' | '*' | '/' | '%' | 'u-' = ch as '+' | '-' | '*' | '/' | '%';
      if (ch === '-' && (prevKind === 'start' || prevKind === 'op' || prevKind === 'paren_open')) {
        op = 'u-';
      }
      tokens.push({ kind: 'op', value: op });
      prevKind = 'op';
      i += 1;
    } else {
      throw new Error('Invalid math expression');
    }

    if (tokens.length > maxTokens) {
      throw new Error('math expression too complex');
    }
  }

  if (tokens.length === 0) throw new Error('Invalid math expression');
  return tokens;
}

function toRpn(tokens: Token[], maxOperations: number, budgetCheck: () => void): Array<{ kind: 'number'; value: number } | { kind: 'op'; value: '+' | '-' | '*' | '/' | '%' | 'u-' }> {
  const output: Array<{ kind: 'number'; value: number } | { kind: 'op'; value: '+' | '-' | '*' | '/' | '%' | 'u-' }> = [];
  const ops: Array<'+' | '-' | '*' | '/' | '%' | 'u-' | '('> = [];
  let opCount = 0;
  const precedence: Record<string, number> = { 'u-': 3, '*': 2, '/': 2, '%': 2, '+': 1, '-': 1 };
  const rightAssoc = new Set(['u-']);

  for (const token of tokens) {
    budgetCheck();
    if (token.kind === 'number') {
      output.push(token);
      continue;
    }
    if (token.kind === 'paren') {
      if (token.value === '(') {
        ops.push('(');
      } else {
        while (ops.length > 0 && ops[ops.length - 1] !== '(') {
          output.push({ kind: 'op', value: ops.pop() as '+' | '-' | '*' | '/' | '%' | 'u-' });
        }
        if (ops.length === 0 || ops[ops.length - 1] !== '(') {
          throw new Error('Invalid math expression');
        }
        ops.pop();
      }
      continue;
    }
    const current = token.value;
    while (
      ops.length > 0
      && ops[ops.length - 1] !== '('
      && (
        precedence[ops[ops.length - 1]] > precedence[current]
        || (precedence[ops[ops.length - 1]] === precedence[current] && !rightAssoc.has(current))
      )
    ) {
      output.push({ kind: 'op', value: ops.pop() as '+' | '-' | '*' | '/' | '%' | 'u-' });
      opCount += 1;
      if (opCount > maxOperations) throw new Error('math expression too complex');
    }
    ops.push(current);
  }

  while (ops.length > 0) {
    const op = ops.pop() as '+' | '-' | '*' | '/' | '%' | 'u-' | '(';
    if (op === '(') throw new Error('Invalid math expression');
    output.push({ kind: 'op', value: op });
    opCount += 1;
    if (opCount > maxOperations) throw new Error('math expression too complex');
  }

  return output;
}

function evalRpn(
  rpn: Array<{ kind: 'number'; value: number } | { kind: 'op'; value: '+' | '-' | '*' | '/' | '%' | 'u-' }>,
  maxOperations: number,
  budgetCheck: () => void,
): number {
  const stack: number[] = [];
  let opCount = 0;

  for (const token of rpn) {
    budgetCheck();
    if (token.kind === 'number') {
      stack.push(token.value);
      continue;
    }
    if (token.value === 'u-') {
      if (stack.length < 1) throw new Error('Invalid math expression');
      const val = stack.pop() as number;
      stack.push(-val);
      opCount += 1;
      if (opCount > maxOperations) throw new Error('math expression too complex');
      continue;
    }
    if (stack.length < 2) throw new Error('Invalid math expression');
    const b = stack.pop() as number;
    const a = stack.pop() as number;
    let value: number;
    switch (token.value) {
      case '+': value = a + b; break;
      case '-': value = a - b; break;
      case '*': value = a * b; break;
      case '/':
        if (b === 0) throw new Error('Division by zero');
        value = a / b;
        break;
      case '%':
        if (b === 0) throw new Error('Division by zero');
        value = a % b;
        break;
      default:
        throw new Error('Invalid math expression');
    }
    if (!Number.isFinite(value)) throw new Error('Invalid math expression');
    stack.push(value);
    opCount += 1;
    if (opCount > maxOperations) throw new Error('math expression too complex');
  }

  if (stack.length !== 1) throw new Error('Invalid math expression');
  return stack[0];
}

export function evaluateBoundedMathExpression(exprRaw: unknown, options: MathEvalOptions = {}): MathEvalResult {
  const expr = String(exprRaw || '').trim();
  const maxLength = clampInt(options.maxLength, DEFAULT_MAX_LENGTH, 16, 10000);
  const maxTokens = clampInt(options.maxTokens, DEFAULT_MAX_TOKENS, 8, 5000);
  const maxOperations = clampInt(options.maxOperations, DEFAULT_MAX_OPERATIONS, 8, 5000);
  const maxMs = clampInt(options.maxMs, DEFAULT_MAX_MS, 1, 5000);
  if (!expr || expr.length > maxLength) {
    return { ok: false, error: `math expression exceeds max length (${maxLength})` };
  }

  try {
    const budgetCheck = makeBudget(maxMs);
    const tokens = tokenize(expr, maxTokens, budgetCheck);
    const rpn = toRpn(tokens, maxOperations, budgetCheck);
    const value = evalRpn(rpn, maxOperations, budgetCheck);
    return { ok: true, value };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message || 'Invalid math expression' };
  }
}
