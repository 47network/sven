// ---------------------------------------------------------------------------
// DB Query Optimizer Skill — SQL analysis and optimization advisor
// ---------------------------------------------------------------------------

export default async function handler(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const action = input.action as string;
  const query = (input.query as string) || '';
  const dialect = (input.dialect as string) || 'postgresql';

  if (!query) return { error: 'query is required.' };

  switch (action) {
    case 'analyze': {
      const issues = analyzeQuery(query);
      const complexity = assessComplexity(query);

      return {
        result: {
          dialect,
          issues,
          issue_count: issues.length,
          complexity,
          tables: extractTables(query),
          joins: countJoins(query),
          subqueries: countSubqueries(query),
          has_aggregation: /\b(COUNT|SUM|AVG|MIN|MAX|GROUP BY)\b/i.test(query),
          has_ordering: /\bORDER BY\b/i.test(query),
          has_limit: /\bLIMIT\b/i.test(query),
        },
      };
    }

    case 'suggest_indexes': {
      const tables = extractTables(query);
      const whereColumns = extractWhereColumns(query);
      const joinColumns = extractJoinColumns(query);
      const orderColumns = extractOrderColumns(query);

      const suggestions: IndexSuggestion[] = [];

      for (const col of whereColumns) {
        suggestions.push({
          type: 'btree',
          table: col.table || tables[0] || 'unknown',
          columns: [col.column],
          reason: `WHERE clause filter on ${col.column}`,
          priority: 'high',
          ddl: `CREATE INDEX idx_${(col.table || tables[0] || 'tbl').toLowerCase()}_${col.column.toLowerCase()} ON ${col.table || tables[0] || 'tbl'} (${col.column});`,
        });
      }

      for (const col of joinColumns) {
        suggestions.push({
          type: 'btree',
          table: col.table || 'unknown',
          columns: [col.column],
          reason: `JOIN condition on ${col.column}`,
          priority: 'high',
          ddl: `CREATE INDEX idx_${(col.table || 'tbl').toLowerCase()}_${col.column.toLowerCase()} ON ${col.table || 'tbl'} (${col.column});`,
        });
      }

      for (const col of orderColumns) {
        suggestions.push({
          type: 'btree',
          table: col.table || tables[0] || 'unknown',
          columns: [col.column],
          reason: `ORDER BY on ${col.column}`,
          priority: 'medium',
          ddl: `CREATE INDEX idx_${(col.table || tables[0] || 'tbl').toLowerCase()}_${col.column.toLowerCase()} ON ${col.table || tables[0] || 'tbl'} (${col.column});`,
        });
      }

      // Composite index suggestion
      if (whereColumns.length > 1) {
        const table = whereColumns[0].table || tables[0] || 'tbl';
        const cols = whereColumns.map((c) => c.column);
        suggestions.push({
          type: 'btree',
          table,
          columns: cols,
          reason: 'Composite index for multi-column WHERE clause',
          priority: 'high',
          ddl: `CREATE INDEX idx_${table.toLowerCase()}_composite ON ${table} (${cols.join(', ')});`,
        });
      }

      return { result: { dialect, suggestions, suggestion_count: suggestions.length } };
    }

    case 'detect_antipatterns': {
      const patterns = detectAntipatterns(query);
      return {
        result: {
          dialect,
          antipatterns: patterns,
          count: patterns.length,
          severity: patterns.some((p) => p.severity === 'critical') ? 'critical'
            : patterns.some((p) => p.severity === 'warning') ? 'warning' : 'info',
        },
      };
    }

    case 'explain_plan': {
      const explainQuery = dialect === 'mysql'
        ? `EXPLAIN ${query}`
        : `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`;

      const tips = [
        'Look for Seq Scan on large tables — add an index on the filter column',
        'Nested Loop joins on large sets → consider Hash Join (add work_mem)',
        'High actual rows vs. estimated → run ANALYZE on the table',
        'Sort operations without index → add index matching ORDER BY',
        'Bitmap Heap Scan → many rows match, consider partial index',
      ];

      return {
        result: {
          dialect,
          explain_command: explainQuery,
          reading_tips: tips,
          recommended_settings: dialect === 'postgresql' ? {
            'work_mem': '256MB (for complex sorts/joins)',
            'random_page_cost': '1.1 (for SSD storage)',
            'effective_cache_size': '75% of available RAM',
            'jit': 'on (for complex analytical queries)',
          } : undefined,
        },
      };
    }

    default:
      return { error: `Unknown action "${action}". Available: analyze, suggest_indexes, detect_antipatterns, explain_plan` };
  }
}

/* -------- Types -------- */

interface QueryIssue {
  severity: 'critical' | 'warning' | 'info';
  rule: string;
  message: string;
  fix?: string;
}

interface ColumnRef {
  table?: string;
  column: string;
}

interface IndexSuggestion {
  type: string;
  table: string;
  columns: string[];
  reason: string;
  priority: string;
  ddl: string;
}

/* -------- Query Analysis -------- */

function analyzeQuery(query: string): QueryIssue[] {
  const issues: QueryIssue[] = [];
  const upper = query.toUpperCase();

  if (/SELECT\s+\*/i.test(query)) {
    issues.push({ severity: 'warning', rule: 'SELECT_STAR', message: 'SELECT * fetches all columns — specify needed columns', fix: 'List specific columns' });
  }

  if (!upper.includes('WHERE') && (upper.includes('UPDATE') || upper.includes('DELETE'))) {
    issues.push({ severity: 'critical', rule: 'NO_WHERE', message: 'UPDATE/DELETE without WHERE affects all rows', fix: 'Add a WHERE clause' });
  }

  if (upper.includes('SELECT') && !upper.includes('LIMIT') && !upper.includes('WHERE') && !upper.includes('GROUP BY')) {
    issues.push({ severity: 'warning', rule: 'UNBOUNDED', message: 'Query may return unbounded results', fix: 'Add LIMIT or WHERE clause' });
  }

  if (/\bLIKE\s+'%/.test(query)) {
    issues.push({ severity: 'warning', rule: 'LEADING_WILDCARD', message: 'LIKE with leading wildcard prevents index use', fix: 'Use full-text search or trigram index' });
  }

  if (/\bOR\b/i.test(query) && upper.includes('WHERE')) {
    issues.push({ severity: 'info', rule: 'OR_CLAUSE', message: 'OR in WHERE may prevent index use', fix: 'Consider UNION ALL or IN clause' });
  }

  if (/\b(NOW\(\)|CURRENT_TIMESTAMP)\b/i.test(query) && upper.includes('WHERE')) {
    issues.push({ severity: 'info', rule: 'FUNCTION_IN_WHERE', message: 'Functions in WHERE prevent index usage', fix: 'Pre-compute the value in the application layer' });
  }

  if (upper.includes('ORDER BY') && upper.includes('LIMIT') && !upper.includes('INDEX')) {
    issues.push({ severity: 'info', rule: 'SORT_LIMIT', message: 'ORDER BY + LIMIT without index may sort entire table', fix: 'Add index on ORDER BY columns' });
  }

  if (countSubqueries(query) > 2) {
    issues.push({ severity: 'warning', rule: 'DEEP_SUBQUERY', message: 'Multiple nested subqueries — consider CTEs or JOINs', fix: 'Rewrite using WITH (CTE) or JOIN' });
  }

  return issues;
}

function assessComplexity(query: string): string {
  let score = 0;
  score += countJoins(query) * 2;
  score += countSubqueries(query) * 3;
  if (/GROUP BY/i.test(query)) score += 2;
  if (/HAVING/i.test(query)) score += 2;
  if (/UNION/i.test(query)) score += 3;
  if (/WINDOW|OVER\s*\(/i.test(query)) score += 3;

  if (score <= 2) return 'simple';
  if (score <= 6) return 'moderate';
  if (score <= 10) return 'complex';
  return 'very_complex';
}

/* -------- Extraction Helpers -------- */

function extractTables(query: string): string[] {
  const tables = new Set<string>();
  const fromMatch = query.match(/\bFROM\s+([a-z_][a-z0-9_]*)/gi);
  const joinMatch = query.match(/\bJOIN\s+([a-z_][a-z0-9_]*)/gi);

  for (const m of fromMatch || []) {
    const name = m.replace(/^(FROM|JOIN)\s+/i, '');
    tables.add(name);
  }
  for (const m of joinMatch || []) {
    const name = m.replace(/^(FROM|JOIN)\s+/i, '');
    tables.add(name);
  }
  return Array.from(tables);
}

function extractWhereColumns(query: string): ColumnRef[] {
  const columns: ColumnRef[] = [];
  const whereMatch = query.match(/WHERE\s+(.*?)(?:ORDER|GROUP|LIMIT|HAVING|$)/is);
  if (!whereMatch) return columns;

  const clause = whereMatch[1];
  const colRefs = clause.match(/([a-z_][a-z0-9_]*\.)?([a-z_][a-z0-9_]*)\s*(=|>|<|>=|<=|!=|LIKE|IN|IS)/gi);
  for (const ref of colRefs || []) {
    const parts = ref.split(/\s*(=|>|<|>=|<=|!=|LIKE|IN|IS)/i)[0].trim().split('.');
    if (parts.length === 2) {
      columns.push({ table: parts[0], column: parts[1] });
    } else {
      columns.push({ column: parts[0] });
    }
  }
  return columns;
}

function extractJoinColumns(query: string): ColumnRef[] {
  const columns: ColumnRef[] = [];
  const onClauses = query.match(/\bON\s+([a-z_][a-z0-9_.]*)\s*=\s*([a-z_][a-z0-9_.]*)/gi);
  for (const clause of onClauses || []) {
    const refs = clause.replace(/^ON\s+/i, '').split('=');
    for (const ref of refs) {
      const parts = ref.trim().split('.');
      if (parts.length === 2) {
        columns.push({ table: parts[0], column: parts[1] });
      }
    }
  }
  return columns;
}

function extractOrderColumns(query: string): ColumnRef[] {
  const columns: ColumnRef[] = [];
  const orderMatch = query.match(/ORDER BY\s+(.*?)(?:LIMIT|$)/is);
  if (!orderMatch) return columns;

  const cols = orderMatch[1].split(',');
  for (const col of cols) {
    const name = col.trim().split(/\s+/)[0];
    const parts = name.split('.');
    if (parts.length === 2) {
      columns.push({ table: parts[0], column: parts[1] });
    } else if (parts[0]) {
      columns.push({ column: parts[0] });
    }
  }
  return columns;
}

function countJoins(query: string): number {
  return (query.match(/\bJOIN\b/gi) || []).length;
}

function countSubqueries(query: string): number {
  return (query.match(/\bSELECT\b/gi) || []).length - 1;
}

/* -------- Anti-Pattern Detection -------- */

function detectAntipatterns(query: string): QueryIssue[] {
  const patterns: QueryIssue[] = [];

  if (/SELECT\s+DISTINCT/i.test(query) && /JOIN/i.test(query)) {
    patterns.push({ severity: 'warning', rule: 'DISTINCT_JOIN', message: 'DISTINCT with JOIN often indicates a wrong join — verify cardinality', fix: 'Check if the JOIN produces duplicates and fix the join condition' });
  }

  if (/NOT\s+IN\s*\(\s*SELECT/i.test(query)) {
    patterns.push({ severity: 'warning', rule: 'NOT_IN_SUBQUERY', message: 'NOT IN with subquery has NULL pitfalls and poor performance', fix: 'Use NOT EXISTS or LEFT JOIN ... IS NULL instead' });
  }

  if (/\bCOUNT\(\*\)\b/i.test(query) && extractTables(query).length > 1) {
    patterns.push({ severity: 'info', rule: 'COUNT_STAR_JOIN', message: 'COUNT(*) with JOINs may produce inflated counts', fix: 'Use COUNT(DISTINCT id) or verify join cardinality' });
  }

  if (/OFFSET\s+\d{4,}/i.test(query)) {
    patterns.push({ severity: 'warning', rule: 'LARGE_OFFSET', message: 'Large OFFSET is slow — DB must scan and discard rows', fix: 'Use keyset pagination (WHERE id > last_seen_id)' });
  }

  if (/\bSELECT\b[\s\S]*?\bIN\s*\(\s*SELECT\b/i.test(query)) {
    patterns.push({ severity: 'info', rule: 'IN_SUBQUERY', message: 'IN (SELECT ...) may be slower than EXISTS or JOIN', fix: 'Rewrite with EXISTS or JOIN' });
  }

  if (/\bORDER BY\s+RAND\b/i.test(query) || /\bORDER BY\s+RANDOM\b/i.test(query)) {
    patterns.push({ severity: 'warning', rule: 'ORDER_RANDOM', message: 'ORDER BY RANDOM() is O(n log n) — very slow on large tables', fix: 'Use TABLESAMPLE or application-level random selection' });
  }

  return patterns;
}
