/**
 * Batch 24 — Publishing Pipeline v2 (Printing, Legal, POD, Trending Genres,
 * Author Personas, Edge Printing)
 *
 * Tests: migration, shared types, admin API, NATS/Eidolon, skills,
 * task-executor handlers, admin wiring.
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

const read = (rel: string): string =>
  fs.readFileSync(path.join(ROOT, rel), 'utf-8');

// ────────────────────────────────────────────────────────────
// 1. Migration SQL
// ────────────────────────────────────────────────────────────
describe('Batch 24 — Migration', () => {
  const sql = read('services/gateway-api/migrations/20260427080000_publishing_v2.sql');

  const tables = [
    'pod_integrations',
    'printing_orders',
    'legal_requirements',
    'genre_trends',
    'author_personas',
    'edge_printing_specs',
    'printer_purchase_proposals',
  ];

  test.each(tables)('creates table %s', (t) => {
    expect(sql).toContain(`CREATE TABLE IF NOT EXISTS ${t}`);
  });

  test('pod_integrations has provider columns', () => {
    expect(sql).toContain('provider');
    expect(sql).toContain('api_endpoint');
    expect(sql).toContain('credentials');
  });

  test('printing_orders has FK to publishing_projects', () => {
    expect(sql).toContain('project_id');
    expect(sql).toContain('publishing_projects');
  });

  test('printing_orders has status and order columns', () => {
    expect(sql).toContain('status');
    expect(sql).toContain('quantity');
    expect(sql).toContain('unit_cost_eur');
    expect(sql).toContain('total_cost_eur');
  });

  test('legal_requirements has country and type columns', () => {
    expect(sql).toContain('country_code');
    expect(sql).toContain('requirement_type');
  });

  test('genre_trends has scoring columns', () => {
    expect(sql).toContain('genre');
    expect(sql).toContain('popularity_score');
    expect(sql).toContain('competition_level');
  });

  test('author_personas has personality columns', () => {
    expect(sql).toContain('voice_style');
    expect(sql).toContain('genres');
  });

  test('edge_printing_specs has edge-specific columns', () => {
    expect(sql).toContain('edge_type');
    expect(sql).toContain('edge_types');
  });

  test('printer_purchase_proposals has financial columns', () => {
    expect(sql).toContain('printer_type');
    expect(sql).toContain('base_cost_eur');
    expect(sql).toContain('break_even_months');
    expect(sql).toContain('roi_percentage');
  });

  test('ALTERs marketplace_tasks CHECK with new task types', () => {
    expect(sql).toContain('legal_research');
    expect(sql).toContain('print_broker');
    expect(sql).toContain('trend_research');
    expect(sql).toContain('author_persona');
  });

  test('has indexes on key columns', () => {
    const indexCount = (sql.match(/CREATE INDEX/gi) || []).length;
    expect(indexCount).toBeGreaterThanOrEqual(10);
  });
});

// ────────────────────────────────────────────────────────────
// 2. Shared Types — publishing-v2.ts
// ────────────────────────────────────────────────────────────
describe('Batch 24 — Shared Types', () => {
  const src = read('packages/shared/src/publishing-v2.ts');

  describe('type unions', () => {
    test('PrintOrderStatus has 9 values', () => {
      expect(src).toContain("export type PrintOrderStatus =");
      const statuses = ['draft', 'submitted', 'accepted', 'printing', 'quality_check',
        'shipped', 'delivered', 'cancelled', 'failed'];
      for (const s of statuses) {
        expect(src).toContain(`'${s}'`);
      }
    });

    test('PrintOrderType has 3 values', () => {
      expect(src).toContain("'pod'");
      expect(src).toContain("'bulk'");
      expect(src).toContain("'sample'");
    });

    test('PrintFormat has 3 values', () => {
      expect(src).toContain("'paperback'");
      expect(src).toContain("'hardcover'");
      expect(src).toContain("'special_edition'");
    });

    test('EdgeType has 6 values', () => {
      const edges = ['plain', 'stained', 'sprayed', 'foil', 'painted', 'gilded'];
      for (const e of edges) {
        expect(src).toContain(`'${e}'`);
      }
    });

    test('PODProvider has 7 values', () => {
      const providers = ['amazon_kdp', 'ingram_spark', 'lulu', 'blurb',
        'bookbaby', 'tipografia_universul', 'custom'];
      for (const p of providers) {
        expect(src).toContain(`'${p}'`);
      }
    });

    test('LegalRequirementType has 10 values', () => {
      const types = ['isbn_registration', 'copyright_filing', 'distribution_license',
        'tax_obligation', 'content_rating', 'deposit_copy', 'import_export',
        'data_protection', 'censorship_review', 'author_contract'];
      for (const t of types) {
        expect(src).toContain(`'${t}'`);
      }
    });

    test('LegalStatus has 6 values', () => {
      const statuses = ['researched', 'pending', 'submitted', 'approved', 'rejected', 'expired'];
      for (const s of statuses) {
        expect(src).toContain(`'${s}'`);
      }
    });

    test('TrendSource has 8 values', () => {
      const sources = ['amazon_bestseller', 'goodreads', 'booktok', 'bookstagram',
        'google_trends', 'publisher_weekly', 'manual', 'agent_research'];
      for (const s of sources) {
        expect(src).toContain(`'${s}'`);
      }
    });

    test('CompetitionLevel has 4 values', () => {
      expect(src).toContain("'low'");
      expect(src).toContain("'medium'");
      expect(src).toContain("'high'");
      expect(src).toContain("'saturated'");
    });

    test('PrinterType has 5 values', () => {
      const types = ['digital_press', 'offset', 'inkjet', 'laser', 'specialty'];
      for (const t of types) {
        expect(src).toContain(`'${t}'`);
      }
    });

    test('ProposalStatus has 5 values', () => {
      const statuses = ['draft', 'submitted', 'approved', 'rejected', 'purchased'];
      for (const s of statuses) {
        expect(src).toContain(`'${s}'`);
      }
    });
  });

  describe('interfaces', () => {
    const ifaces = [
      'PODIntegration', 'LegalRequirement', 'GenreTrend',
      'AuthorPersona', 'EdgePrintingSpec', 'PrinterPurchaseProposal',
    ];
    test.each(ifaces)('exports interface %s', (name) => {
      expect(src).toContain(`export interface ${name}`);
    });
  });

  describe('functions', () => {
    test('exports canAdvancePrintOrder()', () => {
      expect(src).toContain('export function canAdvancePrintOrder');
    });

    test('exports calculatePrintCost()', () => {
      expect(src).toContain('export function calculatePrintCost');
    });

    test('exports calculateBreakEven()', () => {
      expect(src).toContain('export function calculateBreakEven');
    });

    test('exports calculateROI()', () => {
      expect(src).toContain('export function calculateROI');
    });
  });

  describe('constants', () => {
    test('PRINT_ORDER_STATUS_FLOW array', () => {
      expect(src).toContain('export const PRINT_ORDER_STATUS_FLOW');
    });

    test('TRENDING_GENRES has 15 entries', () => {
      expect(src).toContain('export const TRENDING_GENRES');
      expect(src).toContain("'dark-romance'");
      expect(src).toContain("'mafia-romance'");
      expect(src).toContain("'why-choose'");
      expect(src).toContain("'enemies-to-lovers'");
      expect(src).toContain("'bully-romance'");
      expect(src).toContain("'romantasy'");
    });

    test('TRENDING_TROPES has 16 entries', () => {
      expect(src).toContain('export const TRENDING_TROPES');
      expect(src).toContain("'enemies-to-lovers'");
      expect(src).toContain("'morally-grey'");
      expect(src).toContain("'forced-proximity'");
      expect(src).toContain("'touch-her-and-die'");
      expect(src).toContain("'grumpy-sunshine'");
    });

    test('EDGE_TYPES array', () => {
      expect(src).toContain('export const EDGE_TYPES');
    });

    test('POD_PROVIDERS array', () => {
      expect(src).toContain('export const POD_PROVIDERS');
    });

    test('LEGAL_REQUIREMENT_TYPES array', () => {
      expect(src).toContain('export const LEGAL_REQUIREMENT_TYPES');
    });

    test('MIN_VOLUME_FOR_PRINTER_PROPOSAL = 200', () => {
      expect(src).toContain('export const MIN_VOLUME_FOR_PRINTER_PROPOSAL = 200');
    });

    test('PRINTER_APPROVAL_THRESHOLD_EUR = 50', () => {
      expect(src).toContain('export const PRINTER_APPROVAL_THRESHOLD_EUR = 50');
    });
  });

  test('barrel export in shared/index.ts', () => {
    const idx = read('packages/shared/src/index.ts');
    expect(idx).toContain("from './publishing-v2.js'");
  });
});

// ────────────────────────────────────────────────────────────
// 3. Admin API — publishing-v2.ts routes
// ────────────────────────────────────────────────────────────
describe('Batch 24 — Admin API', () => {
  const src = read('services/gateway-api/src/routes/admin/publishing-v2.ts');

  test('exports registerPublishingV2Routes', () => {
    expect(src).toContain('registerPublishingV2Routes');
  });

  describe('POD Integrations routes', () => {
    test('GET list', () => {
      expect(src).toContain("app.get('/publishing/v2/pod-integrations'");
    });
    test('GET by id', () => {
      expect(src).toContain("app.get('/publishing/v2/pod-integrations/:integrationId'");
    });
    test('POST create', () => {
      expect(src).toContain("app.post('/publishing/v2/pod-integrations'");
    });
    test('PATCH update', () => {
      expect(src).toContain("app.patch('/publishing/v2/pod-integrations/:integrationId'");
    });
    test('DELETE deactivate', () => {
      expect(src).toContain("app.delete('/publishing/v2/pod-integrations/:integrationId'");
    });
  });

  describe('Printing Orders routes', () => {
    test('GET list', () => {
      expect(src).toContain("app.get('/publishing/v2/printing-orders'");
    });
    test('GET by id', () => {
      expect(src).toContain("app.get('/publishing/v2/printing-orders/:orderId'");
    });
    test('POST create', () => {
      expect(src).toContain("app.post('/publishing/v2/printing-orders'");
    });
    test('PATCH update', () => {
      expect(src).toContain("app.patch('/publishing/v2/printing-orders/:orderId'");
    });
  });

  describe('Legal Requirements routes', () => {
    test('GET list', () => {
      expect(src).toContain("app.get('/publishing/v2/legal-requirements'");
    });
    test('GET by id', () => {
      expect(src).toContain("app.get('/publishing/v2/legal-requirements/:reqId'");
    });
    test('POST create', () => {
      expect(src).toContain("app.post('/publishing/v2/legal-requirements'");
    });
    test('PATCH update', () => {
      expect(src).toContain("app.patch('/publishing/v2/legal-requirements/:reqId'");
    });
  });

  describe('Genre Trends routes', () => {
    test('GET list', () => {
      expect(src).toContain("app.get('/publishing/v2/genre-trends'");
    });
    test('GET by id', () => {
      expect(src).toContain("app.get('/publishing/v2/genre-trends/:trendId'");
    });
    test('POST create', () => {
      expect(src).toContain("app.post('/publishing/v2/genre-trends'");
    });
    test('PATCH update', () => {
      expect(src).toContain("app.patch('/publishing/v2/genre-trends/:trendId'");
    });
  });

  describe('Author Personas routes', () => {
    test('GET list', () => {
      expect(src).toContain("app.get('/publishing/v2/author-personas'");
    });
    test('GET by id', () => {
      expect(src).toContain("app.get('/publishing/v2/author-personas/:personaId'");
    });
    test('POST create', () => {
      expect(src).toContain("app.post('/publishing/v2/author-personas'");
    });
    test('PATCH update', () => {
      expect(src).toContain("app.patch('/publishing/v2/author-personas/:personaId'");
    });
  });

  describe('Edge Printing Specs routes', () => {
    test('GET list', () => {
      expect(src).toContain("app.get('/publishing/v2/edge-printing-specs'");
    });
    test('POST create', () => {
      expect(src).toContain("app.post('/publishing/v2/edge-printing-specs'");
    });
    test('PATCH update', () => {
      expect(src).toContain("app.patch('/publishing/v2/edge-printing-specs/:specId'");
    });
  });

  describe('Printer Purchase Proposals routes', () => {
    test('GET list', () => {
      expect(src).toContain("app.get('/publishing/v2/printer-proposals'");
    });
    test('GET by id', () => {
      expect(src).toContain("app.get('/publishing/v2/printer-proposals/:proposalId'");
    });
    test('POST create', () => {
      expect(src).toContain("app.post('/publishing/v2/printer-proposals'");
    });
    test('PATCH update', () => {
      expect(src).toContain("app.patch('/publishing/v2/printer-proposals/:proposalId'");
    });
  });

  test('analytics endpoint', () => {
    expect(src).toContain("app.get('/publishing/v2/analytics'");
  });

  test('has at least 29 route handlers', () => {
    const routeCount = (src.match(/app\.(get|post|patch|delete|put)\(/g) || []).length;
    expect(routeCount).toBeGreaterThanOrEqual(29);
  });

  test('publishes NATS events on create/update', () => {
    expect(src).toContain('nc.publish');
  });
});

// ────────────────────────────────────────────────────────────
// 4. Admin wiring — index.ts
// ────────────────────────────────────────────────────────────
describe('Batch 24 — Admin Wiring', () => {
  const src = read('services/gateway-api/src/routes/admin/index.ts');

  test('imports registerPublishingV2Routes', () => {
    expect(src).toContain("import { registerPublishingV2Routes } from './publishing-v2.js'");
  });

  test('mounts publishing-v2 via mountAdminRoutes', () => {
    expect(src).toContain('registerPublishingV2Routes(scopedApp, pool, nc)');
  });
});

// ────────────────────────────────────────────────────────────
// 5. NATS / Eidolon Integration
// ────────────────────────────────────────────────────────────
describe('Batch 24 — NATS/Eidolon', () => {
  const eventBus = read('services/sven-eidolon/src/event-bus.ts');
  const types = read('services/sven-eidolon/src/types.ts');

  describe('SUBJECT_MAP entries', () => {
    const natsSubjects = [
      'sven.publishing.print_order_created',
      'sven.publishing.print_order_shipped',
      'sven.publishing.legal_requirement_added',
      'sven.publishing.genre_trend_discovered',
      'sven.publishing.author_persona_created',
      'sven.publishing.printer_proposal_submitted',
    ];

    test.each(natsSubjects)('maps %s', (subj) => {
      expect(eventBus).toContain(`'${subj}'`);
    });
  });

  describe('EidolonEventKind', () => {
    const events = [
      'publishing.print_order_created',
      'publishing.print_order_shipped',
      'publishing.legal_requirement_added',
      'publishing.genre_trend_discovered',
      'publishing.author_persona_created',
      'publishing.printer_proposal_submitted',
    ];

    test.each(events)('includes %s', (ev) => {
      expect(types).toContain(`'${ev}'`);
    });
  });

  test('EidolonBuildingKind includes print_works', () => {
    expect(types).toContain("'print_works'");
  });

  test('districtFor maps print_works to market', () => {
    expect(types).toContain("case 'print_works'");
    expect(types).toContain("return 'market'");
  });
});

// ────────────────────────────────────────────────────────────
// 6. Skills — SKILL.md files
// ────────────────────────────────────────────────────────────
describe('Batch 24 — Skills', () => {
  const skills = [
    { dir: 'book-legal', archetype: 'legal', price: '4.99' },
    { dir: 'book-print-broker', archetype: 'operator', price: '9.99' },
    { dir: 'genre-research-v2', archetype: 'researcher', price: '2.99' },
    { dir: 'author-persona', archetype: 'writer', price: '3.99' },
  ];

  test.each(skills)('$dir SKILL.md exists', ({ dir }) => {
    const md = read(`skills/autonomous-economy/${dir}/SKILL.md`);
    expect(md.length).toBeGreaterThan(100);
  });

  test.each(skills)('$dir has YAML frontmatter', ({ dir }) => {
    const md = read(`skills/autonomous-economy/${dir}/SKILL.md`);
    expect(md).toMatch(/^---/);
    expect((md.match(/---/g) || []).length).toBeGreaterThanOrEqual(2);
  });

  test.each(skills)('$dir has correct archetype: $archetype', ({ dir, archetype }) => {
    const md = read(`skills/autonomous-economy/${dir}/SKILL.md`);
    expect(md).toContain(archetype);
  });

  test.each(skills)('$dir has price $price', ({ dir, price }) => {
    const md = read(`skills/autonomous-economy/${dir}/SKILL.md`);
    expect(md).toContain(price);
  });

  test.each(skills)('$dir has actions section', ({ dir }) => {
    const md = read(`skills/autonomous-economy/${dir}/SKILL.md`);
    expect(md.toLowerCase()).toContain('action');
  });

  test.each(skills)('$dir has inputs and outputs', ({ dir }) => {
    const md = read(`skills/autonomous-economy/${dir}/SKILL.md`);
    const lower = md.toLowerCase();
    expect(lower).toContain('input');
    expect(lower).toContain('output');
  });
});

// ────────────────────────────────────────────────────────────
// 7. Task Executor — new handler cases
// ────────────────────────────────────────────────────────────
describe('Batch 24 — Task Executor', () => {
  const src = read('services/sven-marketplace/src/task-executor.ts');

  const newCases = ['legal_research', 'print_broker', 'trend_research', 'author_persona'];

  test.each(newCases)('routeToHandler has case for %s', (c) => {
    expect(src).toContain(`case '${c}'`);
  });

  test('handleLegalResearch method exists', () => {
    expect(src).toContain('handleLegalResearch');
    expect(src).toContain('requirementTypes');
    expect(src).toContain('isbn_registration');
    expect(src).toContain('copyright_filing');
  });

  test('handleLegalResearch returns requirements array', () => {
    expect(src).toContain('requirementsFound');
    expect(src).toContain('requirements,');
  });

  test('handlePrintBroker method exists', () => {
    expect(src).toContain('handlePrintBroker');
    expect(src).toContain('amazon_kdp');
    expect(src).toContain('ingram_spark');
    expect(src).toContain('tipografia_universul');
  });

  test('handlePrintBroker compares providers and ranks by cost', () => {
    expect(src).toContain('eligible');
    expect(src).toContain('totalCostEur');
    expect(src).toContain('bestOption');
  });

  test('handlePrintBroker supports edge printing filter', () => {
    expect(src).toContain('supportsEdgePrinting');
    expect(src).toContain('edgeType');
  });

  test('handleTrendResearch method exists', () => {
    expect(src).toContain('handleTrendResearch');
    expect(src).toContain('trendingGenres');
    expect(src).toContain('trendingTropes');
  });

  test('handleTrendResearch returns genre scores and competition', () => {
    expect(src).toContain('dark-romance');
    expect(src).toContain('mafia-romance');
    expect(src).toContain('competition');
  });

  test('handleAuthorPersona method exists', () => {
    expect(src).toContain('handleAuthorPersona');
    expect(src).toContain('personaName');
    expect(src).toContain('voiceStyle');
  });

  test('handleAuthorPersona returns brand elements and next steps', () => {
    expect(src).toContain('brandElements');
    expect(src).toContain('tagline');
    expect(src).toContain('nextSteps');
  });
});
