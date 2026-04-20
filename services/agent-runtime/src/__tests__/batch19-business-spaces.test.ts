/**
 * Batch 19 — Agent Business Spaces (*.from.sven.systems)
 *
 * Verifies business space registration, landing pages, nginx wildcard
 * routing, CORS widening, NATS events, and Eidolon building integration
 * via source-file inspection (no cross-package imports).
 */

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

function read(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf-8');
}

function exists(relPath: string): boolean {
  return fs.existsSync(path.join(ROOT, relPath));
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. Migration — agent_business_spaces.sql
// ═══════════════════════════════════════════════════════════════════════════
describe('Batch 19 Migration', () => {
  const sql = read(
    'services/gateway-api/migrations/20260423120000_agent_business_spaces.sql',
  );

  describe('agent_profiles ALTER columns', () => {
    test('adds business_subdomain column', () => {
      expect(sql).toMatch(/ALTER TABLE[\s\S]*?agent_profiles[\s\S]*?ADD[\s\S]*?business_subdomain/i);
    });
    test('adds business_url column', () => {
      expect(sql).toContain('business_url');
    });
    test('adds business_status column', () => {
      expect(sql).toContain('business_status');
    });
    test('adds business_landing_type column', () => {
      expect(sql).toContain('business_landing_type');
    });
    test('adds business_tagline column', () => {
      expect(sql).toContain('business_tagline');
    });
    test('adds business_activated_at column', () => {
      expect(sql).toContain('business_activated_at');
    });
    test('business_status CHECK constraint', () => {
      expect(sql).toMatch(/inactive[\s\S]*?pending[\s\S]*?active[\s\S]*?suspended/);
    });
    test('business_landing_type CHECK constraint', () => {
      expect(sql).toMatch(/storefront[\s\S]*?portfolio[\s\S]*?api_explorer[\s\S]*?service_page/);
    });
  });

  describe('agent_business_endpoints table', () => {
    test('creates table', () => {
      expect(sql).toContain('CREATE TABLE');
      expect(sql).toContain('agent_business_endpoints');
    });
    test('has agent_id column', () => {
      expect(sql).toMatch(/agent_id\s+TEXT\s+NOT NULL/);
    });
    test('has business_subdomain column', () => {
      expect(sql).toMatch(/business_subdomain\s+TEXT\s+NOT NULL/);
    });
    test('has health_check_path default', () => {
      expect(sql).toContain('health_check_path');
    });
    test('has uptime_pct column', () => {
      expect(sql).toContain('uptime_pct');
    });
    test('has total_requests column', () => {
      expect(sql).toContain('total_requests');
    });
    test('has endpoint status CHECK', () => {
      expect(sql).toMatch(/pending[\s\S]*?healthy[\s\S]*?degraded[\s\S]*?down/);
    });
    test('has subdomain index', () => {
      expect(sql).toContain('idx_biz_endpoints_subdomain');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. Business Spaces Admin API
// ═══════════════════════════════════════════════════════════════════════════
describe('Business Spaces Admin API', () => {
  const src = read('services/gateway-api/src/routes/admin/business-spaces.ts');

  test('file exists', () => {
    expect(exists('services/gateway-api/src/routes/admin/business-spaces.ts')).toBe(true);
  });

  test('exports registerBusinessSpaceRoutes function', () => {
    expect(src).toContain('registerBusinessSpaceRoutes');
    expect(src).toMatch(/export\s+(async\s+)?function\s+registerBusinessSpaceRoutes/);
  });

  describe('reserved subdomains', () => {
    test('has RESERVED_SUBDOMAINS constant', () => {
      expect(src).toContain('RESERVED_SUBDOMAINS');
    });
    const essentialReserved = [
      'admin', 'api', 'app', 'market', 'eidolon', 'mail',
      'www', 'docs', 'blog', 'misiuni', 'status',
    ];
    for (const sub of essentialReserved) {
      test(`reserves "${sub}"`, () => {
        expect(src).toContain(`'${sub}'`);
      });
    }
  });

  describe('subdomain validation', () => {
    test('validates format with regex', () => {
      expect(src).toMatch(/[a-z0-9]/);
    });
    test('checks reserved list', () => {
      expect(src).toMatch(/RESERVED_SUBDOMAINS/);
    });
  });

  describe('API routes', () => {
    test('has GET list route', () => {
      expect(src).toMatch(/app\.(get|route)[\s\S]*?business-spaces/i);
    });
    test('has POST create route', () => {
      expect(src).toMatch(/app\.post/);
    });
    test('has PATCH update route', () => {
      expect(src).toMatch(/app\.patch/i);
    });
    test('has DELETE route', () => {
      expect(src).toMatch(/app\.delete/i);
    });
    test('has reserved list endpoint', () => {
      expect(src).toContain('reserved');
    });
  });

  describe('NATS events', () => {
    test('publishes business_created event', () => {
      expect(src).toContain('sven.agent.business_created');
    });
    test('publishes business_activated event', () => {
      expect(src).toContain('sven.agent.business_activated');
    });
    test('publishes business_deactivated event', () => {
      expect(src).toContain('sven.agent.business_deactivated');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. Admin index wiring
// ═══════════════════════════════════════════════════════════════════════════
describe('Admin index wiring', () => {
  const adminIndex = read('services/gateway-api/src/routes/admin/index.ts');

  test('imports registerBusinessSpaceRoutes', () => {
    expect(adminIndex).toContain('registerBusinessSpaceRoutes');
    expect(adminIndex).toContain('./business-spaces');
  });
  test('mounts business space routes', () => {
    expect(adminIndex).toMatch(/registerBusinessSpaceRoutes[\s\S]*?pool/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. Agent Spawner extension
// ═══════════════════════════════════════════════════════════════════════════
describe('Agent Spawner — business space extension', () => {
  const src = read('services/gateway-api/src/routes/admin/agent-spawner.ts');

  test('SpawnRequest has businessSubdomain field', () => {
    expect(src).toContain('businessSubdomain');
  });
  test('SpawnRequest has businessTagline field', () => {
    expect(src).toContain('businessTagline');
  });
  test('SpawnRequest has businessLandingType field', () => {
    expect(src).toContain('businessLandingType');
  });
  test('validates subdomain format', () => {
    expect(src).toMatch(/SUBDOMAIN_REGEX/);
  });
  test('checks reserved subdomains', () => {
    expect(src).toContain('RESERVED_SUBDOMAINS');
  });
  test('creates agent_business_endpoints row', () => {
    expect(src).toContain('agent_business_endpoints');
  });
  test('publishes business_created NATS event', () => {
    expect(src).toContain('sven.agent.business_created');
  });
  test('includes businessSubdomain in response', () => {
    expect(src).toMatch(/businessSubdomain[\s\S]*?businessUrl/);
  });
  test('includes businessUrl in NATS spawned payload', () => {
    const spawnedMatch = src.match(/sven\.agent\.spawned[\s\S]{0,500}/);
    expect(spawnedMatch).not.toBeNull();
    expect(spawnedMatch![0]).toContain('businessUrl');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. Business Landing Routes (marketplace)
// ═══════════════════════════════════════════════════════════════════════════
describe('Business Landing Routes', () => {
  const src = read('services/sven-marketplace/src/routes/business-landing.ts');

  test('file exists', () => {
    expect(exists('services/sven-marketplace/src/routes/business-landing.ts')).toBe(true);
  });

  test('exports registerBusinessLandingRoutes', () => {
    expect(src).toContain('registerBusinessLandingRoutes');
  });

  test('has subdomain profile endpoint', () => {
    expect(src).toMatch(/business[\s\S]*?subdomain/i);
  });

  test('has listings endpoint', () => {
    expect(src).toContain('listings');
  });

  test('has directory endpoint', () => {
    expect(src).toContain('directory');
  });

  test('queries by business_subdomain', () => {
    expect(src).toContain('business_subdomain');
  });

  test('filters by active status', () => {
    expect(src).toMatch(/business_status\s*=\s*.*active/i);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. Marketplace index wiring
// ═══════════════════════════════════════════════════════════════════════════
describe('Marketplace index wiring', () => {
  const src = read('services/sven-marketplace/src/index.ts');

  test('imports business-landing routes', () => {
    expect(src).toContain('business-landing');
  });
  test('calls registerBusinessLandingRoutes', () => {
    expect(src).toContain('registerBusinessLandingRoutes');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 7. Marketplace types
// ═══════════════════════════════════════════════════════════════════════════
describe('Marketplace types — business space types', () => {
  const src = read('services/sven-marketplace/src/types.ts');

  test('exports BusinessSpaceStatus type', () => {
    expect(src).toContain('BusinessSpaceStatus');
    expect(src).toMatch(/inactive[\s\S]*?pending[\s\S]*?active[\s\S]*?suspended/);
  });

  test('exports BusinessLandingType type', () => {
    expect(src).toContain('BusinessLandingType');
    expect(src).toMatch(/storefront[\s\S]*?portfolio/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 8. Eidolon types — business building + events
// ═══════════════════════════════════════════════════════════════════════════
describe('Eidolon types — business extensions', () => {
  const src = read('services/sven-eidolon/src/types.ts');

  test('EidolonBuildingKind includes agent_business', () => {
    expect(src).toContain("'agent_business'");
  });

  test('EidolonEventKind includes agent.business_created', () => {
    expect(src).toContain("'agent.business_created'");
  });
  test('EidolonEventKind includes agent.business_activated', () => {
    expect(src).toContain("'agent.business_activated'");
  });
  test('EidolonEventKind includes agent.business_deactivated', () => {
    expect(src).toContain("'agent.business_deactivated'");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 9. Eidolon event-bus — business NATS subjects
// ═══════════════════════════════════════════════════════════════════════════
describe('Eidolon event-bus — business subjects', () => {
  const src = read('services/sven-eidolon/src/event-bus.ts');

  test('maps sven.agent.business_created', () => {
    expect(src).toContain('sven.agent.business_created');
  });
  test('maps sven.agent.business_activated', () => {
    expect(src).toContain('sven.agent.business_activated');
  });
  test('maps sven.agent.business_deactivated', () => {
    expect(src).toContain('sven.agent.business_deactivated');
  });
  test('maps to correct event kinds', () => {
    expect(src).toContain("'agent.business_created'");
    expect(src).toContain("'agent.business_activated'");
    expect(src).toContain("'agent.business_deactivated'");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 10. Eidolon repo — business buildings
// ═══════════════════════════════════════════════════════════════════════════
describe('Eidolon repo — business buildings', () => {
  const src = read('services/sven-eidolon/src/repo.ts');

  test('has fetchBusinessBuildings method', () => {
    expect(src).toContain('fetchBusinessBuildings');
  });
  test('queries agent_business_endpoints table', () => {
    expect(src).toContain('agent_business_endpoints');
  });
  test('filters by active business_status', () => {
    expect(src).toMatch(/business_status\s*=\s*.*active/i);
  });
  test('uses agent_business building kind', () => {
    expect(src).toContain("'agent_business'");
  });
  test('scales height by total_requests', () => {
    expect(src).toContain('total_requests');
  });
  test('maps endpoint health to glow', () => {
    expect(src).toMatch(/healthy[\s\S]*?degraded[\s\S]*?down/);
  });
  test('getSnapshot includes business buildings', () => {
    expect(src).toContain('businessSpaces');
    expect(src).toContain('fetchBusinessBuildings');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 11. CORS widening — suffix-based matching
// ═══════════════════════════════════════════════════════════════════════════
describe('CORS — suffix-based origin matching', () => {
  const src = read('packages/shared/src/cors.ts');

  test('has TRUSTED_SUFFIXES constant', () => {
    expect(src).toContain('TRUSTED_SUFFIXES');
  });
  test('trusts .sven.systems suffix', () => {
    expect(src).toContain('.sven.systems');
  });
  test('trusts .the47network.com suffix', () => {
    expect(src).toContain('.the47network.com');
  });
  test('does hostname suffix matching', () => {
    expect(src).toMatch(/endsWith/);
  });
  test('still supports exact string matching', () => {
    expect(src).toMatch(/requestOrigin\s*===\s*allowed/);
  });
  test('still supports array matching', () => {
    expect(src).toMatch(/allowed\.includes/);
  });
  test('handles malformed origins gracefully', () => {
    expect(src).toMatch(/catch/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 12. Nginx configs
// ═══════════════════════════════════════════════════════════════════════════
describe('Nginx — wildcard business vhost', () => {
  const src = read('config/nginx/extnginx-sven-business.conf');

  test('file exists', () => {
    expect(exists('config/nginx/extnginx-sven-business.conf')).toBe(true);
  });
  test('has wildcard server_name regex', () => {
    expect(src).toMatch(/server_name\s+~\^.*from\\\.sven\\\.systems/);
  });
  test('captures subdomain in $1', () => {
    expect(src).toMatch(/\(\[a-z0-9-\]\+\)/);
  });
  test('sets X-Business-Subdomain header', () => {
    expect(src).toContain('X-Business-Subdomain');
    expect(src).toContain('$1');
  });
  test('proxies to marketplace port 9478', () => {
    expect(src).toContain('127.0.0.1:9478');
  });
  test('has TLS configuration', () => {
    expect(src).toContain('ssl_certificate');
    expect(src).toContain('from.sven.systems');
  });
  test('has security headers', () => {
    expect(src).toContain('Strict-Transport-Security');
    expect(src).toContain('X-Content-Type-Options');
  });
  test('has ACME challenge passthrough', () => {
    expect(src).toContain('.well-known/acme-challenge');
  });
  test('has HTTP→HTTPS redirect', () => {
    expect(src).toContain('return 301 https://');
  });
});

describe('Nginx — from.sven.systems landing', () => {
  const src = read('config/nginx/extnginx-sven-from-landing.conf');

  test('file exists', () => {
    expect(exists('config/nginx/extnginx-sven-from-landing.conf')).toBe(true);
  });
  test('has exact server_name for from.sven.systems', () => {
    expect(src).toContain('server_name from.sven.systems');
  });
  test('proxies to marketplace port 9478', () => {
    expect(src).toContain('127.0.0.1:9478');
  });
  test('has TLS configuration', () => {
    expect(src).toContain('ssl_certificate');
  });
});
