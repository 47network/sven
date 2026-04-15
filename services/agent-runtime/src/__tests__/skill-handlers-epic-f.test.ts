// ---------------------------------------------------------------------------
// Epic F — Skill Handler Unit Tests
// ---------------------------------------------------------------------------
// Tests all 15 new skill handlers created in Epic F:
//   F.1: docx-generator, xlsx-generator, pptx-generator, pdf-generator
//   F.2: email-composer, email-reply, email-automation
//   F.3: context-engineer, prompt-compressor
//   F.4: webapp-tester
//   F.5: docker-optimizer, db-query-optimizer
//   F.6: seo-optimizer, social-scheduler, ab-copywriter
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */

// Helper to load a handler by relative path from skills/
async function loadHandler(skillPath: string) {
  const fullPath = `../../../../skills/${skillPath}/handler`;
  const mod = await import(fullPath);
  return mod.default as (input: Record<string, unknown>) => Promise<Record<string, unknown>>;
}

// ===== F.1 — Document Creation Skills =====

describe('F.1.1 — docx-generator', () => {
  let handler: (input: Record<string, unknown>) => Promise<Record<string, unknown>>;
  beforeAll(async () => { handler = await loadHandler('productivity/docx-generator'); });

  it('creates a DOCX with title and paragraph', async () => {
    const res = await handler({ action: 'create', title: 'Test Doc', sections: [{ type: 'paragraph', text: 'Hello world' }] });
    expect((res as any).result.format).toBe('docx');
    expect((res as any).result.files).toBeDefined();
    expect((res as any).result.files['[Content_Types].xml']).toContain('wordprocessingml');
  });

  it('includes document.xml with content', async () => {
    const res = await handler({ action: 'create', title: 'T', sections: [{ heading: 'H1', level: 1 }] });
    const doc = (res as any).result.files['word/document.xml'];
    expect(doc).toContain('H1');
  });

  it('returns template list', async () => {
    const res = await handler({ action: 'template_list' });
    expect(Array.isArray((res as any).result.templates)).toBe(true);
  });

  it('generates markdown preview', async () => {
    const res = await handler({ action: 'preview', title: 'Preview', sections: [{ type: 'paragraph', text: 'Body' }] });
    expect((res as any).result.markdown).toContain('Preview');
  });

  it('returns error for unknown action', async () => {
    const res = await handler({ action: 'unknown' });
    expect((res as any).error).toContain('Unknown action');
  });
});

describe('F.1.2 — xlsx-generator', () => {
  let handler: (input: Record<string, unknown>) => Promise<Record<string, unknown>>;
  beforeAll(async () => { handler = await loadHandler('productivity/xlsx-generator'); });

  it('creates XLSX with sheet data', async () => {
    const res = await handler({ action: 'create', title: 'Sheet', sheets: [{ name: 'Data', rows: [['A', 'B'], [1, 2]] }] });
    expect((res as any).result.format).toBe('xlsx');
    expect((res as any).result.files['xl/workbook.xml']).toContain('Data');
  });

  it('parses CSV to spreadsheet', async () => {
    const res = await handler({ action: 'from_csv', csv_data: 'a,b\n1,2\n3,4' });
    expect((res as any).result.format).toBe('xlsx');
    expect((res as any).result.totalRows).toBe(2);
  });

  it('analyzes spreadsheet structure', async () => {
    const res = await handler({ action: 'analyze_structure', sheets: [{ name: 'S1', rows: [['X', 'Y'], [1, 2], [3, 4]] }] });
    expect((res as any).result.sheets[0].columnCount).toBe(2);
  });

  it('returns error for empty sheets', async () => {
    const res = await handler({ action: 'create', sheets: [] });
    expect((res as any).error).toBeDefined();
  });
});

describe('F.1.3 — pptx-generator', () => {
  let handler: (input: Record<string, unknown>) => Promise<Record<string, unknown>>;
  beforeAll(async () => { handler = await loadHandler('productivity/pptx-generator'); });

  it('creates PPTX with slides', async () => {
    const res = await handler({ action: 'create', title: 'Deck', slides: [{ title: 'Slide 1', bullets: ['A', 'B'] }] });
    expect((res as any).result.format).toBe('pptx');
    expect((res as any).result.slideCount).toBe(1);
    expect((res as any).result.files['ppt/slides/slide1.xml']).toContain('Slide 1');
  });

  it('includes presentation.xml with slide references', async () => {
    const res = await handler({ action: 'create', title: 'T', slides: [{ title: 'A' }, { title: 'B' }] });
    const pres = (res as any).result.files['ppt/presentation.xml'];
    expect(pres).toContain('sldId');
  });

  it('returns template list', async () => {
    const res = await handler({ action: 'template_list' });
    expect((res as any).result.templates.length).toBeGreaterThan(0);
  });

  it('generates markdown preview with speaker notes', async () => {
    const res = await handler({ action: 'preview', title: 'P', slides: [{ title: 'S1', notes: 'Speaker notes here' }] });
    expect((res as any).result.markdown).toContain('Speaker notes');
  });

  it('returns error when no slides provided', async () => {
    const res = await handler({ action: 'create', title: 'Empty', slides: [] });
    expect((res as any).error).toContain('least one slide');
  });
});

describe('F.1.4 — pdf-generator', () => {
  let handler: (input: Record<string, unknown>) => Promise<Record<string, unknown>>;
  beforeAll(async () => { handler = await loadHandler('productivity/pdf-generator'); });

  it('creates a PDF document', async () => {
    const res = await handler({ action: 'create', title: 'Test PDF', sections: [{ heading: 'Chapter 1', body: 'Content here' }] });
    expect((res as any).result.format).toBe('pdf');
    expect((res as any).result.content).toContain('%PDF-1.4');
    expect((res as any).result.content).toContain('%%EOF');
  });

  it('supports A4 page size', async () => {
    const res = await handler({ action: 'create', title: 'A4', page_size: 'a4', sections: [{ body: 'Text' }] });
    expect((res as any).result.pageSize).toBe('a4');
    expect((res as any).result.content).toContain('595');
  });

  it('generates preview markdown', async () => {
    const res = await handler({ action: 'preview', title: 'Preview', sections: [{ heading: 'H', body: 'B', list_items: ['L1'] }] });
    expect((res as any).result.markdown).toContain('## H');
    expect((res as any).result.markdown).toContain('- L1');
  });

  it('returns error when no sections', async () => {
    const res = await handler({ action: 'create', sections: [] });
    expect((res as any).error).toContain('least one section');
  });

  it('counts words accurately', async () => {
    const res = await handler({ action: 'create', title: 'W', sections: [{ body: 'one two three' }] });
    expect((res as any).result.wordCount).toBe(3);
  });
});

// ===== F.2 — Email Skills =====

describe('F.2.1 — email-composer', () => {
  let handler: (input: Record<string, unknown>) => Promise<Record<string, unknown>>;
  beforeAll(async () => { handler = await loadHandler('email-generic/email-composer'); });

  it('composes a formal email', async () => {
    const res = await handler({ action: 'compose', context: 'Meeting follow-up', tone: 'formal', recipient_name: 'Alice' });
    expect((res as any).result.body).toContain('Dear Alice');
    expect((res as any).result.subject).toBeDefined();
  });

  it('composes a casual email', async () => {
    const res = await handler({ action: 'compose', context: 'Quick update', tone: 'casual', recipient_name: 'Bob' });
    expect((res as any).result.body).toContain('Hey Bob');
  });

  it('generates HTML format', async () => {
    const res = await handler({ action: 'compose', context: 'Test', format: 'html' });
    expect((res as any).result.body_html).toContain('<div');
    expect((res as any).result.format).toBe('html');
  });

  it('suggests subject lines', async () => {
    const res = await handler({ action: 'suggest_subject', context: 'Quarterly review discussion' });
    expect(Array.isArray((res as any).result.suggestions)).toBe(true);
    expect((res as any).result.suggestions.length).toBeGreaterThan(0);
  });

  it('returns error when no context or key points', async () => {
    const res = await handler({ action: 'compose' });
    expect((res as any).error).toBeDefined();
  });
});

describe('F.2.2 — email-reply', () => {
  let handler: (input: Record<string, unknown>) => Promise<Record<string, unknown>>;
  beforeAll(async () => { handler = await loadHandler('email-generic/email-reply'); });

  it('generates reply with original quoted', async () => {
    const res = await handler({
      action: 'reply',
      original_email: { from: 'alice@example.com', subject: 'Project Update', body: 'How is progress?' },
      intent: 'We are on track for the deadline.',
    });
    expect((res as any).result.subject).toBe('Re: Project Update');
    expect((res as any).result.body).toContain('Original Message');
  });

  it('generates follow-up', async () => {
    const res = await handler({
      action: 'follow_up',
      original_email: { from: 'Bob <bob@co.com>', subject: 'Proposal' },
    });
    expect((res as any).result.subject).toContain('Follow Up');
    expect((res as any).result.body).toContain('Bob');
  });

  it('generates acknowledgement', async () => {
    const res = await handler({
      action: 'acknowledge',
      original_email: { subject: 'Invoice #123' },
    });
    expect((res as any).result.body).toContain('Invoice #123');
    expect((res as any).result.type).toBe('acknowledgement');
  });

  it('returns error when no original email', async () => {
    const res = await handler({ action: 'reply' });
    expect((res as any).error).toBeDefined();
  });
});

describe('F.2.3 — email-automation', () => {
  let handler: (input: Record<string, unknown>) => Promise<Record<string, unknown>>;
  beforeAll(async () => { handler = await loadHandler('email-generic/email-automation'); });

  it('creates a workflow', async () => {
    const res = await handler({
      action: 'create_workflow',
      workflow: { name: 'Welcome', steps: [{ action: 'send', subject: 'Welcome!', delay_hours: 0 }] },
    });
    expect((res as any).result.workflow.name).toBe('Welcome');
    expect((res as any).result.workflow.status).toBe('draft');
    expect((res as any).result.workflow.id).toMatch(/^wf_/);
  });

  it('lists workflow templates', async () => {
    const res = await handler({ action: 'list_templates' });
    expect((res as any).result.templates.length).toBeGreaterThan(0);
    expect((res as any).result.templates[0].steps.length).toBeGreaterThan(0);
  });

  it('validates a schedule', async () => {
    const res = await handler({
      action: 'validate_schedule',
      schedule: { send_at: new Date(Date.now() + 86400000).toISOString(), timezone: 'America/New_York', recurring: 'weekly' },
    });
    expect((res as any).result.valid).toBe(true);
  });

  it('rejects invalid schedule timezone', async () => {
    const res = await handler({
      action: 'validate_schedule',
      schedule: { timezone: 'Invalid/Zone' },
    });
    expect((res as any).result.valid).toBe(false);
    expect((res as any).result.issues.length).toBeGreaterThan(0);
  });

  it('validates workflow step constraints', async () => {
    const res = await handler({
      action: 'create_workflow',
      workflow: { name: 'Bad', steps: [{ action: 'invalid_action' }] },
    });
    expect((res as any).error).toContain('Validation failed');
  });
});

// ===== F.3 — Content Engineering =====

describe('F.3.1 — context-engineer', () => {
  let handler: (input: Record<string, unknown>) => Promise<Record<string, unknown>>;
  beforeAll(async () => { handler = await loadHandler('ai-agency/context-engineer'); });

  it('optimizes text by removing redundancy', async () => {
    const res = await handler({ action: 'optimize', text: 'Hello world. Hello world. Something new.', strategy: 'remove_redundancy' });
    expect((res as any).result.optimized_tokens).toBeLessThan((res as any).result.original_tokens);
    expect((res as any).result.reduction_percent).toBeGreaterThan(0);
  });

  it('analyzes text for density and filler', async () => {
    const res = await handler({ action: 'analyze', text: 'This is basically a very simple test. Basically it actually really works quite well.' });
    expect((res as any).result.filler_word_count).toBeGreaterThan(0);
    expect((res as any).result.recommendations.length).toBeGreaterThan(0);
  });

  it('chunks text by token limit', async () => {
    const longText = Array(20).fill('This is a paragraph with some content in it.').join('\n\n');
    const res = await handler({ action: 'chunk', text: longText, max_tokens: 100 });
    expect((res as any).result.chunk_count).toBeGreaterThan(1);
    expect((res as any).result.chunks[0].tokens).toBeLessThanOrEqual(100);
  });

  it('returns error for empty text', async () => {
    const res = await handler({ action: 'analyze', text: '' });
    expect((res as any).error).toBeDefined();
  });
});

describe('F.3.2 — prompt-compressor', () => {
  let handler: (input: Record<string, unknown>) => Promise<Record<string, unknown>>;
  beforeAll(async () => { handler = await loadHandler('ai-agency/prompt-compressor'); });

  it('compresses text with default ratio', async () => {
    const text = 'I think that basically in order to leverage the synergy we should actually really very carefully consider the essential paradigm. As mentioned earlier, it goes without saying that the approach works well.';
    const res = await handler({ action: 'compress', text });
    expect((res as any).result.compressed_tokens).toBeLessThan((res as any).result.original_tokens);
    expect((res as any).result.savings_percent).toBeGreaterThan(0);
  });

  it('preserves code blocks during compression', async () => {
    const text = 'Some text here for context. ```const x = 1;``` More text basically here for context padding to keep it long enough.';
    const res = await handler({ action: 'compress', text, preserve_code: true, target_ratio: 0.9 });
    expect((res as any).result.compressed_text).toContain('const x = 1');
    expect((res as any).result.code_blocks_preserved).toBe(1);
  });

  it('benchmarks compression techniques', async () => {
    const res = await handler({ action: 'benchmark', text: 'This is a test. It should be noted that the test works well. Basically this is good.' });
    expect((res as any).result.techniques.length).toBeGreaterThan(0);
    expect((res as any).result.recommendation).toBeDefined();
  });

  it('provides decompression plan', async () => {
    const res = await handler({ action: 'decompress_plan', text: 'Short text w/ abbreviations. e.g. this works.\n\nAnother section vs. the old approach.' });
    expect((res as any).result.section_count).toBe(2);
  });
});

// ===== F.4 — Web Testing =====

describe('F.4.1 — webapp-tester', () => {
  let handler: (input: Record<string, unknown>) => Promise<Record<string, unknown>>;
  beforeAll(async () => { handler = await loadHandler('security/webapp-tester'); });

  it('generates Playwright test suite', async () => {
    const res = await handler({
      action: 'generate_tests',
      url: 'https://example.com',
      page_description: 'Home page',
      interactions: [{ action: 'click', selector: '#btn', expected: '.result' }],
    });
    expect((res as any).result.framework).toBe('playwright');
    expect((res as any).result.test_code).toContain("@playwright/test");
    expect((res as any).result.test_count).toBeGreaterThan(0);
  });

  it('generates Cypress tests', async () => {
    const res = await handler({
      action: 'generate_tests',
      url: 'https://example.com',
      page_description: 'Test page',
      framework: 'cypress',
    });
    expect((res as any).result.test_code).toContain('cy.visit');
  });

  it('returns accessibility checklist', async () => {
    const res = await handler({ action: 'accessibility_check', url: 'https://example.com' });
    expect((res as any).result.checks.length).toBeGreaterThan(0);
    expect((res as any).result.standard).toBe('WCAG 2.1 AA');
  });

  it('returns smoke test suite', async () => {
    const res = await handler({ action: 'smoke_test', url: 'https://example.com' });
    expect((res as any).result.test_count).toBe(5);
  });

  it('returns performance checklist', async () => {
    const res = await handler({ action: 'performance_checklist' });
    expect((res as any).result.checklist.length).toBeGreaterThan(0);
  });
});

// ===== F.5 — Infrastructure Skills =====

describe('F.5.1 — docker-optimizer', () => {
  let handler: (input: Record<string, unknown>) => Promise<Record<string, unknown>>;
  beforeAll(async () => { handler = await loadHandler('compute-mesh/docker-optimizer'); });

  const sampleDockerfile = `FROM node:latest
RUN apt-get update && apt-get install -y curl
COPY . .
RUN npm install
ENV API_KEY=secret123
EXPOSE 3000
CMD ["node", "index.js"]`;

  it('analyzes Dockerfile for issues', async () => {
    const res = await handler({ action: 'analyze', dockerfile: sampleDockerfile });
    expect((res as any).result.issue_count).toBeGreaterThan(0);
    // Should catch :latest tag
    expect((res as any).result.issues.some((i: any) => i.rule === 'DL3007')).toBe(true);
  });

  it('detects secrets in ENV', async () => {
    const res = await handler({ action: 'analyze', dockerfile: sampleDockerfile });
    expect((res as any).result.issues.some((i: any) => i.rule === 'SECRET_ENV')).toBe(true);
  });

  it('suggests optimizations', async () => {
    const res = await handler({ action: 'optimize', dockerfile: sampleDockerfile });
    expect((res as any).result.suggestion_count).toBeGreaterThan(0);
  });

  it('runs security scan', async () => {
    const res = await handler({ action: 'security_scan', dockerfile: 'FROM node:20\nRUN chmod 777 /app' });
    expect((res as any).result.findings.some((f: any) => f.rule === 'SEC_CHMOD')).toBe(true);
  });

  it('returns error for empty dockerfile', async () => {
    const res = await handler({ action: 'analyze', dockerfile: '' });
    expect((res as any).error).toBeDefined();
  });
});

describe('F.5.2 — db-query-optimizer', () => {
  let handler: (input: Record<string, unknown>) => Promise<Record<string, unknown>>;
  beforeAll(async () => { handler = await loadHandler('compute-mesh/db-query-optimizer'); });

  it('analyzes a SELECT * query', async () => {
    const res = await handler({ action: 'analyze', query: 'SELECT * FROM users' });
    expect((res as any).result.issues.some((i: any) => i.rule === 'SELECT_STAR')).toBe(true);
    expect((res as any).result.issues.some((i: any) => i.rule === 'UNBOUNDED')).toBe(true);
  });

  it('suggests indexes for WHERE clause', async () => {
    const res = await handler({ action: 'suggest_indexes', query: 'SELECT id, name FROM users WHERE email = $1 AND org_id = $2 ORDER BY created_at DESC LIMIT 10' });
    expect((res as any).result.suggestion_count).toBeGreaterThan(0);
    expect((res as any).result.suggestions.some((s: any) => s.ddl.includes('CREATE INDEX'))).toBe(true);
  });

  it('detects antipatterns', async () => {
    const res = await handler({ action: 'detect_antipatterns', query: 'SELECT * FROM orders WHERE id NOT IN (SELECT order_id FROM returns)' });
    expect((res as any).result.antipatterns.some((p: any) => p.rule === 'NOT_IN_SUBQUERY')).toBe(true);
  });

  it('returns explain plan guidance', async () => {
    const res = await handler({ action: 'explain_plan', query: 'SELECT * FROM logs', dialect: 'postgresql' });
    expect((res as any).result.explain_command).toContain('EXPLAIN');
    expect((res as any).result.reading_tips.length).toBeGreaterThan(0);
  });

  it('assesses query complexity', async () => {
    const res = await handler({ action: 'analyze', query: 'SELECT u.id FROM users u JOIN orders o ON u.id = o.user_id JOIN products p ON o.product_id = p.id WHERE u.active = true GROUP BY u.id HAVING COUNT(*) > 5' });
    expect(['moderate', 'complex', 'very_complex']).toContain((res as any).result.complexity);
  });
});

// ===== F.6 — Marketing Skills =====

describe('F.6.1 — seo-optimizer', () => {
  let handler: (input: Record<string, unknown>) => Promise<Record<string, unknown>>;
  beforeAll(async () => { handler = await loadHandler('marketing/seo-optimizer'); });

  it('analyzes content with keyword', async () => {
    const content = '# Getting Started\n\nGetting started with our platform is easy. Our platform helps you build faster.\n\n## Features\n\nThe platform offers many features for developers.';
    const res = await handler({ action: 'analyze', content, target_keyword: 'platform' });
    expect((res as any).result.score).toBeGreaterThan(0);
    expect((res as any).result.checks.keyword_density).toBeDefined();
  });

  it('checks meta tag quality', async () => {
    const res = await handler({
      action: 'optimize_meta',
      meta: { title: 'My Page' },
      target_keyword: 'test keyword',
    });
    expect((res as any).result.issues.length).toBeGreaterThan(0);
    // Missing description, OG tags, canonical
  });

  it('performs keyword analysis', async () => {
    const res = await handler({
      action: 'keyword_analysis',
      content: 'The best coffee shop in town. Our coffee is organic coffee from the best farms.',
      target_keyword: 'coffee',
    });
    expect((res as any).result.exact_matches).toBe(3);
    expect((res as any).result.density_percent).toBeGreaterThan(0);
  });

  it('returns technical SEO checklist', async () => {
    const res = await handler({ action: 'technical_check' });
    expect((res as any).result.checklist.length).toBeGreaterThan(0);
  });
});

describe('F.6.2 — social-scheduler', () => {
  let handler: (input: Record<string, unknown>) => Promise<Record<string, unknown>>;
  beforeAll(async () => { handler = await loadHandler('marketing/social-scheduler'); });

  it('creates content calendar', async () => {
    const res = await handler({
      action: 'create_calendar',
      posts: [
        { content: 'Launch day!', platform: 'twitter' },
        { content: 'New feature drop', platform: 'linkedin' },
      ],
    });
    expect((res as any).result.total_posts).toBe(2);
    expect((res as any).result.platforms).toContain('twitter');
  });

  it('truncates content exceeding platform limit', async () => {
    const longContent = 'A'.repeat(300);
    const res = await handler({
      action: 'create_calendar',
      posts: [{ content: longContent, platform: 'twitter' }],
    });
    expect((res as any).result.calendar[0].content.length).toBeLessThanOrEqual(280);
    expect((res as any).result.calendar[0].warnings.length).toBeGreaterThan(0);
  });

  it('suggests hashtags', async () => {
    const res = await handler({ action: 'suggest_hashtags', content: 'New product launch marketing campaign', platform: 'instagram' });
    expect((res as any).result.suggested.length).toBeGreaterThan(0);
  });

  it('returns optimal posting times', async () => {
    const res = await handler({ action: 'optimal_times', platform: 'linkedin' });
    expect((res as any).result.best_days.length).toBeGreaterThan(0);
    expect((res as any).result.best_hours.length).toBeGreaterThan(0);
  });

  it('formats post for platform', async () => {
    const res = await handler({ action: 'format_post', content: 'Test post', platform: 'twitter' });
    expect((res as any).result.within_limit).toBe(true);
  });
});

describe('F.6.3 — ab-copywriter', () => {
  let handler: (input: Record<string, unknown>) => Promise<Record<string, unknown>>;
  beforeAll(async () => { handler = await loadHandler('marketing/ab-copywriter'); });

  it('generates headline variants', async () => {
    const res = await handler({ action: 'generate_variants', original: 'Boost Your Productivity Today', type: 'headline', count: 3 });
    expect((res as any).result.variants.length).toBeGreaterThanOrEqual(2);
    expect((res as any).result.original.total_score).toBeGreaterThan(0);
  });

  it('scores copy quality', async () => {
    const res = await handler({ action: 'score', original: 'Free proven way to save money now', type: 'headline' });
    expect((res as any).result.total_score).toBeGreaterThan(0);
    expect((res as any).result.emotional_impact).toBeGreaterThan(0); // Has power words
    expect(['A', 'B', 'C', 'D']).toContain((res as any).result.grade);
  });

  it('suggests CTAs', async () => {
    const res = await handler({ action: 'suggest_cta', type: 'button' });
    expect((res as any).result.suggestions.length).toBeGreaterThan(0);
    expect((res as any).result.best_practices.length).toBeGreaterThan(0);
  });

  it('returns error for empty original', async () => {
    const res = await handler({ action: 'score', original: '' });
    expect((res as any).error).toBeDefined();
  });

  it('ranks variants by score', async () => {
    const res = await handler({ action: 'generate_variants', original: 'Improve Your Sales Pipeline', type: 'headline' });
    const scores = (res as any).result.variants.map((v: any) => v.total_score);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i - 1]).toBeGreaterThanOrEqual(scores[i]);
    }
  });
});
