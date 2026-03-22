type ValidationResult =
  | { ok: true; normalizedQuery: string }
  | { ok: false; error: string };

const MAX_QUERY_LENGTH = 10000;

function stripTrailingSemicolon(query: string): string {
  return query.replace(/;\s*$/, '').trim();
}

function containsInlineOrBlockComments(query: string): boolean {
  return /--|\/\*/.test(query);
}

function hasMultipleStatements(query: string): boolean {
  const withoutTrailing = query.replace(/;\s*$/, '');
  return withoutTrailing.includes(';');
}

function startsWithAllowedReadOnlyForm(query: string): boolean {
  return /^\s*(select|with)\b/i.test(query);
}

function withContainsSelect(query: string): boolean {
  if (!/^\s*with\b/i.test(query)) return true;
  return /\bselect\b/i.test(query);
}

function hasForbiddenReadOnlyBypassKeywords(query: string): boolean {
  if (/\bselect\b[\s\S]*\binto\b/i.test(query)) return true;
  if (/\bfor\s+(update|share|no\s+key\s+update|key\s+share)\b/i.test(query)) return true;

  return /\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|comment|copy|do|call|execute|prepare|deallocate|vacuum|analyze|refresh|set|reset|begin|commit|rollback|savepoint|lock|notify|listen|unlisten)\b/i.test(query);
}

export function validateReadOnlySqlQuery(queryRaw: unknown): ValidationResult {
  const query = String(queryRaw || '').trim();
  if (!query) {
    return { ok: false, error: 'query is required' };
  }
  if (query.length > MAX_QUERY_LENGTH) {
    return { ok: false, error: `query exceeds max length (${MAX_QUERY_LENGTH})` };
  }
  if (containsInlineOrBlockComments(query)) {
    return { ok: false, error: 'SQL comments are not allowed in read-only query mode' };
  }
  if (hasMultipleStatements(query)) {
    return { ok: false, error: 'Only single-statement SELECT queries are allowed in read-only mode' };
  }
  if (!startsWithAllowedReadOnlyForm(query)) {
    return { ok: false, error: 'Only SELECT queries are allowed in read-only mode' };
  }
  if (!withContainsSelect(query)) {
    return { ok: false, error: 'WITH query must include a SELECT statement' };
  }
  if (hasForbiddenReadOnlyBypassKeywords(query)) {
    return { ok: false, error: 'Query contains forbidden keywords for read-only mode' };
  }

  return { ok: true, normalizedQuery: stripTrailingSemicolon(query) };
}
