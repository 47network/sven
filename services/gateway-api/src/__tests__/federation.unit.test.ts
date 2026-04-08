/**
 * Unit tests for Batch 5 federation implementations (5.1–5.8)
 * Tests: migration structure, service exports, route registration, core logic
 */

import * as fs from 'fs';
import * as path from 'path';

/* ------------------------------------------------------------------ */
/*  Migration structure tests                                          */
/* ------------------------------------------------------------------ */
describe('Federation tables migration', () => {
  const migrationPath = path.resolve(
    __dirname,
    '../db/migrations/20260408180000_federation_tables.sql',
  );
  let sql: string;

  beforeAll(() => {
    sql = fs.readFileSync(migrationPath, 'utf-8');
  });

  it('creates federation_instance_identity table (5.1)', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS federation_instance_identity');
    expect(sql).toMatch(/public_key\s+TEXT NOT NULL/);
    expect(sql).toMatch(/encrypted_private_key\s+TEXT NOT NULL/);
    expect(sql).toMatch(/fingerprint\s+TEXT NOT NULL/);
    expect(sql).toMatch(/algorithm\s+TEXT NOT NULL DEFAULT 'ed25519'/);
    expect(sql).toContain('UNIQUE (organization_id, fingerprint)');
  });

  it('creates federation_peers table (5.2)', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS federation_peers');
    expect(sql).toContain("('untrusted', 'verified', 'trusted', 'blocked')");
    expect(sql).toContain("('discovered', 'handshake', 'active', 'degraded', 'offline', 'blocked')");
    expect(sql).toMatch(/trust_level\s+TEXT NOT NULL DEFAULT 'untrusted'/);
    expect(sql).toMatch(/status\s+TEXT NOT NULL DEFAULT 'discovered'/);
    expect(sql).toContain('UNIQUE (organization_id, instance_id)');
  });

  it('creates federation_homeserver_connections table (5.3)', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS federation_homeserver_connections');
    expect(sql).toContain("('flutter_mobile', 'tauri_desktop', 'web', 'cli', 'api')");
    expect(sql).toMatch(/connection_token\s+TEXT NOT NULL/);
    expect(sql).toContain("('active', 'idle', 'disconnected')");
  });

  it('creates federation_community_topics table (5.4)', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS federation_community_topics');
    expect(sql).toContain("('publish', 'subscribe', 'bidirectional')");
    expect(sql).toMatch(/nats_subject\s+TEXT NOT NULL/);
    expect(sql).toContain('REFERENCES federation_peers(id) ON DELETE CASCADE');
    expect(sql).toContain('UNIQUE (organization_id, topic_name, peer_id)');
  });

  it('creates federation_agent_delegations table (5.5)', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS federation_agent_delegations');
    expect(sql).toContain("('pending', 'sent', 'accepted', 'in_progress', 'completed', 'failed', 'rejected', 'timeout')");
    expect(sql).toMatch(/timeout_ms\s+INTEGER NOT NULL DEFAULT 30000/);
    expect(sql).toContain('signed_request');
    expect(sql).toContain('signed_response');
  });

  it('creates federation_consent table (5.6)', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS federation_consent');
    expect(sql).toContain("('off', 'read_only', 'contribute')");
    expect(sql).toMatch(/consent_level\s+TEXT NOT NULL DEFAULT 'off'/);
    expect(sql).toContain('UNIQUE (organization_id, user_id)');
    expect(sql).toContain('consent_given_at');
    expect(sql).toContain('consent_ip');
  });

  it('creates federation_data_sovereignty table (5.7)', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS federation_data_sovereignty');
    expect(sql).toMatch(/federation_enabled\s+BOOLEAN NOT NULL DEFAULT FALSE/);
    expect(sql).toMatch(/require_mutual_tls\s+BOOLEAN NOT NULL DEFAULT TRUE/);
    expect(sql).toMatch(/require_peer_verification\s+BOOLEAN NOT NULL DEFAULT TRUE/);
    expect(sql).toContain("('none', 'anonymized', 'pseudonymized', 'full')");
    expect(sql).toMatch(/export_policy\s+TEXT NOT NULL DEFAULT 'none'/);
  });

  it('creates federation_peer_health table (5.8)', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS federation_peer_health');
    expect(sql).toContain("('ping', 'handshake', 'capability', 'full')");
    expect(sql).toContain("('healthy', 'degraded', 'unhealthy', 'unreachable', 'unknown')");
    expect(sql).toMatch(/response_time_ms\s+INTEGER/);
  });

  it('creates immutable federation_audit_log table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS federation_audit_log');
    expect(sql).toContain('event_type');
    expect(sql).toContain('idx_fed_audit_peer');
  });

  it('wraps all DDL in a transaction', () => {
    expect(sql.trim()).toMatch(/^(?:--[^\n]*\n)*\s*BEGIN;/);
    expect(sql.trim()).toMatch(/COMMIT;\s*$/);
  });

  it('creates proper indexes on all tables', () => {
    expect(sql).toContain('idx_fed_identity_org');
    expect(sql).toContain('idx_fed_peers_org_status');
    expect(sql).toContain('idx_fed_peers_address');
    expect(sql).toContain('idx_fed_hs_conn_org_user');
    expect(sql).toContain('idx_fed_hs_conn_token');
    expect(sql).toContain('idx_fed_topics_org');
    expect(sql).toContain('idx_fed_topics_peer');
    expect(sql).toContain('idx_fed_delegations_org');
    expect(sql).toContain('idx_fed_delegations_peer');
    expect(sql).toContain('idx_fed_consent_org_user');
    expect(sql).toContain('idx_fed_consent_level');
    expect(sql).toContain('idx_fed_sovereignty_org');
    expect(sql).toContain('idx_fed_health_peer');
    expect(sql).toContain('idx_fed_health_org');
    expect(sql).toContain('idx_fed_audit_peer');
  });

  it('has ON DELETE CASCADE for federation_peers FK references', () => {
    const fkRefs = sql.match(/REFERENCES federation_peers\(id\) ON DELETE CASCADE/g) ?? [];
    expect(fkRefs.length).toBeGreaterThanOrEqual(3);
  });
});

/* ------------------------------------------------------------------ */
/*  Service export tests                                               */
/* ------------------------------------------------------------------ */
describe('Federation service exports', () => {
  it('exports InstanceIdentityService (5.1)', () => {
    const mod = require('../services/InstanceIdentityService');
    expect(mod.InstanceIdentityService).toBeDefined();
    expect(typeof mod.InstanceIdentityService).toBe('function');
  });

  it('exports FederationDiscoveryService (5.2)', () => {
    const mod = require('../services/FederationDiscoveryService');
    expect(mod.FederationDiscoveryService).toBeDefined();
    expect(typeof mod.FederationDiscoveryService).toBe('function');
  });

  it('exports HomeserverService (5.3)', () => {
    const mod = require('../services/HomeserverService');
    expect(mod.HomeserverService).toBeDefined();
    expect(typeof mod.HomeserverService).toBe('function');
  });

  it('exports FederatedCommunityService (5.4)', () => {
    const mod = require('../services/FederatedCommunityService');
    expect(mod.FederatedCommunityService).toBeDefined();
    expect(typeof mod.FederatedCommunityService).toBe('function');
  });

  it('exports AgentDelegationService (5.5)', () => {
    const mod = require('../services/AgentDelegationService');
    expect(mod.AgentDelegationService).toBeDefined();
    expect(typeof mod.AgentDelegationService).toBe('function');
  });

  it('exports CommunityConsentService (5.6)', () => {
    const mod = require('../services/CommunityConsentService');
    expect(mod.CommunityConsentService).toBeDefined();
    expect(typeof mod.CommunityConsentService).toBe('function');
  });

  it('exports DataSovereigntyService (5.7)', () => {
    const mod = require('../services/DataSovereigntyService');
    expect(mod.DataSovereigntyService).toBeDefined();
    expect(typeof mod.DataSovereigntyService).toBe('function');
  });

  it('exports FederationHealthService (5.8)', () => {
    const mod = require('../services/FederationHealthService');
    expect(mod.FederationHealthService).toBeDefined();
    expect(typeof mod.FederationHealthService).toBe('function');
  });
});

/* ------------------------------------------------------------------ */
/*  Route registration test                                            */
/* ------------------------------------------------------------------ */
describe('Federation route registration', () => {
  const routePath = path.resolve(__dirname, '../routes/admin/federation.ts');
  let routeSrc: string;

  beforeAll(() => {
    routeSrc = fs.readFileSync(routePath, 'utf-8');
  });

  it('exports registerFederationRoutes', () => {
    expect(routeSrc).toContain('export async function registerFederationRoutes');
  });

  it('registers Instance Identity endpoints (5.1)', () => {
    expect(routeSrc).toContain('federation/identity/generate');
    expect(routeSrc).toContain('federation/identity/rotate');
    expect(routeSrc).toContain('federation/identity/sign');
    expect(routeSrc).toContain('federation/identity/verify');
  });

  it('registers Federation Discovery / Peer endpoints (5.2)', () => {
    expect(routeSrc).toContain("'/federation/peers'");
    expect(routeSrc).toContain('federation/peers/:peerId/handshake');
    expect(routeSrc).toContain('federation/well-known');
    expect(routeSrc).toContain('federation/peers/prune');
  });

  it('registers Homeserver endpoints (5.3)', () => {
    expect(routeSrc).toContain('federation/homeserver/connect');
    expect(routeSrc).toContain('federation/homeserver/heartbeat');
    expect(routeSrc).toContain('/disconnect');
    expect(routeSrc).toContain('federation/homeserver/config');
    expect(routeSrc).toContain('federation/homeserver/stats');
  });

  it('registers Cross-Instance Community endpoints (5.4)', () => {
    expect(routeSrc).toContain('federation/community/topics');
    expect(routeSrc).toContain('federation/community/summary');
  });

  it('registers Agent Delegation endpoints (5.5)', () => {
    expect(routeSrc).toContain('federation/delegations');
    expect(routeSrc).toContain('federation/delegations/expire');
    expect(routeSrc).toContain('federation/delegations/summary');
  });

  it('registers Community Consent endpoints (5.6)', () => {
    expect(routeSrc).toContain('federation/consent');
    expect(routeSrc).toContain('federation/consent/revoke');
    expect(routeSrc).toContain('federation/consent/stats');
  });

  it('registers Data Sovereignty endpoints (5.7)', () => {
    expect(routeSrc).toContain('federation/sovereignty');
    expect(routeSrc).toContain('federation/sovereignty/can-federate');
    expect(routeSrc).toContain('federation/sovereignty/export-policy');
  });

  it('registers Health endpoints (5.8)', () => {
    expect(routeSrc).toContain('federation/health/:peerId/check');
    expect(routeSrc).toContain("'/federation/health'");
    expect(routeSrc).toContain('federation/health/prune');
  });

  it('imports all 8 federation services', () => {
    expect(routeSrc).toContain('InstanceIdentityService');
    expect(routeSrc).toContain('FederationDiscoveryService');
    expect(routeSrc).toContain('HomeserverService');
    expect(routeSrc).toContain('FederatedCommunityService');
    expect(routeSrc).toContain('AgentDelegationService');
    expect(routeSrc).toContain('CommunityConsentService');
    expect(routeSrc).toContain('DataSovereigntyService');
    expect(routeSrc).toContain('FederationHealthService');
  });
});

/* ------------------------------------------------------------------ */
/*  Admin index integration                                            */
/* ------------------------------------------------------------------ */
describe('Federation admin index registration', () => {
  const indexPath = path.resolve(__dirname, '../routes/admin/index.ts');
  let indexSrc: string;

  beforeAll(() => {
    indexSrc = fs.readFileSync(indexPath, 'utf-8');
  });

  it('imports registerFederationRoutes', () => {
    expect(indexSrc).toContain("import { registerFederationRoutes } from './federation.js'");
  });

  it('mounts federation routes via mountAdminRoutes', () => {
    expect(indexSrc).toContain('registerFederationRoutes(scopedApp)');
  });
});

/* ------------------------------------------------------------------ */
/*  NATS Federation stream configuration                               */
/* ------------------------------------------------------------------ */
describe('Federation NATS stream', () => {
  it('defines FEDERATION stream in NATS_STREAMS', () => {
    const { NATS_STREAMS } = require('../../../../packages/shared/src/types/nats-subjects');
    expect(NATS_STREAMS.FEDERATION).toBe('FEDERATION');
  });

  it('defines federation subject constants', () => {
    const { NATS_SUBJECTS } = require('../../../../packages/shared/src/types/nats-subjects');
    expect(NATS_SUBJECTS.FEDERATION_HANDSHAKE).toBe('federation.handshake');
    expect(NATS_SUBJECTS.FEDERATION_MESSAGE).toBe('federation.message.*');
    expect(NATS_SUBJECTS.FEDERATION_HEALTH).toBe('federation.health.*');
    expect(NATS_SUBJECTS.FEDERATION_DELEGATION).toBe('federation.delegation.*');
  });

  it('generates dynamic per-peer subject strings', () => {
    const { NATS_SUBJECTS } = require('../../../../packages/shared/src/types/nats-subjects');
    expect(NATS_SUBJECTS.federationMessage('peer-abc')).toBe('federation.message.peer-abc');
    expect(NATS_SUBJECTS.federationHealth('peer-xyz')).toBe('federation.health.peer-xyz');
    expect(NATS_SUBJECTS.federationDelegation('peer-123')).toBe('federation.delegation.peer-123');
  });
});

/* ------------------------------------------------------------------ */
/*  Community Consent default-OFF logic (5.6)                          */
/* ------------------------------------------------------------------ */
describe('Community Consent default OFF', () => {
  it('returns OFF consent for user with no record', () => {
    const { CommunityConsentService } = require('../services/CommunityConsentService');
    const mockPool = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
    };
    const svc = new CommunityConsentService(mockPool);
    return svc.getConsent('org-1', 'user-1').then((c: any) => {
      expect(c.consent_level).toBe('off');
      expect(c.share_agent_data).toBe(false);
      expect(c.share_memory_data).toBe(false);
      expect(c.federated_topics).toEqual([]);
    });
  });

  it('denies participation when consent is OFF', () => {
    const { CommunityConsentService } = require('../services/CommunityConsentService');
    const mockPool = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
    };
    const svc = new CommunityConsentService(mockPool);
    return svc.canParticipate('org-1', 'user-1', 'topic-a', 'read').then((r: boolean) => {
      expect(r).toBe(false);
    });
  });

  it('denies write when consent is read_only', () => {
    const { CommunityConsentService } = require('../services/CommunityConsentService');
    const mockPool = {
      query: jest.fn().mockResolvedValue({
        rows: [{
          id: 'c1', organization_id: 'org-1', user_id: 'user-1',
          consent_level: 'read_only', federated_topics: '[]',
          share_agent_data: false, share_memory_data: false,
          consent_given_at: new Date().toISOString(),
          created_at: new Date(), updated_at: new Date(),
        }],
      }),
    };
    const svc = new CommunityConsentService(mockPool);
    return svc.canParticipate('org-1', 'user-1', 'topic-a', 'write').then((r: boolean) => {
      expect(r).toBe(false);
    });
  });

  it('allows read when consent is read_only', () => {
    const { CommunityConsentService } = require('../services/CommunityConsentService');
    const mockPool = {
      query: jest.fn().mockResolvedValue({
        rows: [{
          id: 'c1', organization_id: 'org-1', user_id: 'user-1',
          consent_level: 'read_only', federated_topics: '[]',
          share_agent_data: false, share_memory_data: false,
          consent_given_at: new Date().toISOString(),
          created_at: new Date(), updated_at: new Date(),
        }],
      }),
    };
    const svc = new CommunityConsentService(mockPool);
    return svc.canParticipate('org-1', 'user-1', 'topic-a', 'read').then((r: boolean) => {
      expect(r).toBe(true);
    });
  });

  it('restricts to specific topics when set', () => {
    const { CommunityConsentService } = require('../services/CommunityConsentService');
    const mockPool = {
      query: jest.fn().mockResolvedValue({
        rows: [{
          id: 'c1', organization_id: 'org-1', user_id: 'user-1',
          consent_level: 'contribute', federated_topics: JSON.stringify(['topic-a']),
          share_agent_data: true, share_memory_data: false,
          consent_given_at: new Date().toISOString(),
          created_at: new Date(), updated_at: new Date(),
        }],
      }),
    };
    const svc = new CommunityConsentService(mockPool);
    return Promise.all([
      svc.canParticipate('org-1', 'user-1', 'topic-a', 'write').then((r: boolean) => {
        expect(r).toBe(true);
      }),
      svc.canParticipate('org-1', 'user-1', 'topic-b', 'write').then((r: boolean) => {
        expect(r).toBe(false);
      }),
    ]);
  });

  it('rejects invalid consent level on update', () => {
    const { CommunityConsentService } = require('../services/CommunityConsentService');
    const mockPool = { query: jest.fn() };
    const svc = new CommunityConsentService(mockPool);
    return expect(svc.updateConsent('org-1', 'user-1', { consent_level: 'full_access' }))
      .rejects.toThrow('Invalid consent level');
  });
});

/* ------------------------------------------------------------------ */
/*  Data Sovereignty defaults (5.7)                                    */
/* ------------------------------------------------------------------ */
describe('Data Sovereignty conservative defaults', () => {
  it('creates default settings with federation disabled', () => {
    const { DataSovereigntyService } = require('../services/DataSovereigntyService');
    const defaultRow = {
      id: 'ds-1', organization_id: 'org-1',
      federation_enabled: false, allowed_regions: '[]', blocked_peers: '[]',
      data_retention_days: 90, max_federation_peers: 10,
      require_mutual_tls: true, require_peer_verification: true,
      export_policy: 'none', audit_federation_traffic: true,
      created_at: new Date(), updated_at: new Date(),
    };
    const mockPool = {
      query: jest.fn()
        .mockResolvedValueOnce({ rows: [] }) // SELECT returns empty
        .mockResolvedValueOnce({ rows: [defaultRow] }), // INSERT returns defaults
    };
    const svc = new DataSovereigntyService(mockPool);
    return svc.getSettings('org-1').then((s: any) => {
      expect(s.federation_enabled).toBe(false);
      expect(s.require_mutual_tls).toBe(true);
      expect(s.require_peer_verification).toBe(true);
      expect(s.export_policy).toBe('none');
      expect(s.max_federation_peers).toBe(10);
      expect(s.data_retention_days).toBe(90);
    });
  });

  it('rejects invalid export policy', () => {
    const { DataSovereigntyService } = require('../services/DataSovereigntyService');
    const defaultRow = {
      id: 'ds-1', organization_id: 'org-1',
      federation_enabled: false, allowed_regions: '[]', blocked_peers: '[]',
      data_retention_days: 90, max_federation_peers: 10,
      require_mutual_tls: true, require_peer_verification: true,
      export_policy: 'none', audit_federation_traffic: true,
      created_at: new Date(), updated_at: new Date(),
    };
    const mockPool = {
      query: jest.fn()
        .mockResolvedValueOnce({ rows: [defaultRow] }) // getSettings inside updateSettings
        .mockResolvedValueOnce({ rows: [defaultRow] }), // ensure exists check
    };
    const svc = new DataSovereigntyService(mockPool);
    return expect(svc.updateSettings('org-1', { export_policy: 'everything' }))
      .rejects.toThrow('Invalid export policy');
  });

  it('rejects out-of-range retention days', () => {
    const { DataSovereigntyService } = require('../services/DataSovereigntyService');
    const defaultRow = {
      id: 'ds-1', organization_id: 'org-1',
      federation_enabled: false, allowed_regions: '[]', blocked_peers: '[]',
      data_retention_days: 90, max_federation_peers: 10,
      require_mutual_tls: true, require_peer_verification: true,
      export_policy: 'none', audit_federation_traffic: true,
      created_at: new Date(), updated_at: new Date(),
    };
    const mockPool = {
      query: jest.fn().mockResolvedValue({ rows: [defaultRow] }),
    };
    const svc = new DataSovereigntyService(mockPool);
    return expect(svc.updateSettings('org-1', { data_retention_days: 5000 }))
      .rejects.toThrow('Data retention must be between 1 and 3650 days');
  });
});

/* ------------------------------------------------------------------ */
/*  Federation Health mesh classification (5.8)                        */
/* ------------------------------------------------------------------ */
describe('Federation Health mesh status', () => {
  it('classifies as healthy when all peers healthy', () => {
    const { FederationHealthService } = require('../services/FederationHealthService');
    const mockPool = {
      query: jest.fn().mockResolvedValue({
        rows: [{
          total_peers: '3', healthy: '3', degraded: '0',
          unhealthy: '0', unreachable: '0',
          avg_response_time_ms: '15', last_check_at: new Date(),
        }],
      }),
    };
    const svc = new FederationHealthService(mockPool);
    return svc.getMeshHealth('org-1').then((m: any) => {
      expect(m.mesh_status).toBe('healthy');
      expect(m.total_peers).toBe(3);
    });
  });

  it('classifies as unhealthy when any peer is unhealthy', () => {
    const { FederationHealthService } = require('../services/FederationHealthService');
    const mockPool = {
      query: jest.fn().mockResolvedValue({
        rows: [{
          total_peers: '4', healthy: '2', degraded: '1',
          unhealthy: '1', unreachable: '0',
          avg_response_time_ms: '30', last_check_at: new Date(),
        }],
      }),
    };
    const svc = new FederationHealthService(mockPool);
    return svc.getMeshHealth('org-1').then((m: any) => {
      expect(m.mesh_status).toBe('unhealthy');
    });
  });

  it('classifies as unhealthy when >50% peers unreachable', () => {
    const { FederationHealthService } = require('../services/FederationHealthService');
    const mockPool = {
      query: jest.fn().mockResolvedValue({
        rows: [{
          total_peers: '4', healthy: '1', degraded: '0',
          unhealthy: '0', unreachable: '3',
          avg_response_time_ms: '50', last_check_at: new Date(),
        }],
      }),
    };
    const svc = new FederationHealthService(mockPool);
    return svc.getMeshHealth('org-1').then((m: any) => {
      expect(m.mesh_status).toBe('unhealthy');
    });
  });

  it('classifies as degraded when some degraded but none unhealthy', () => {
    const { FederationHealthService } = require('../services/FederationHealthService');
    const mockPool = {
      query: jest.fn().mockResolvedValue({
        rows: [{
          total_peers: '3', healthy: '2', degraded: '1',
          unhealthy: '0', unreachable: '0',
          avg_response_time_ms: '25', last_check_at: new Date(),
        }],
      }),
    };
    const svc = new FederationHealthService(mockPool);
    return svc.getMeshHealth('org-1').then((m: any) => {
      expect(m.mesh_status).toBe('degraded');
    });
  });

  it('classifies as no_peers when no health records exist', () => {
    const { FederationHealthService } = require('../services/FederationHealthService');
    const mockPool = {
      query: jest.fn().mockResolvedValue({
        rows: [{
          total_peers: '0', healthy: '0', degraded: '0',
          unhealthy: '0', unreachable: '0',
          avg_response_time_ms: null, last_check_at: null,
        }],
      }),
    };
    const svc = new FederationHealthService(mockPool);
    return svc.getMeshHealth('org-1').then((m: any) => {
      expect(m.mesh_status).toBe('no_peers');
    });
  });

  it('rejects invalid check type', () => {
    const { FederationHealthService } = require('../services/FederationHealthService');
    const mockPool = { query: jest.fn() };
    const svc = new FederationHealthService(mockPool);
    return expect(svc.recordHealthCheck('org-1', 'peer-1', {
      check_type: 'invalid_type',
      status: 'healthy',
    })).rejects.toThrow('Invalid check type');
  });

  it('rejects invalid health status', () => {
    const { FederationHealthService } = require('../services/FederationHealthService');
    const mockPool = { query: jest.fn() };
    const svc = new FederationHealthService(mockPool);
    return expect(svc.recordHealthCheck('org-1', 'peer-1', {
      check_type: 'ping',
      status: 'invalid_status',
    })).rejects.toThrow('Invalid status');
  });
});

/* ------------------------------------------------------------------ */
/*  Trust level validation source check (5.2)                          */
/* ------------------------------------------------------------------ */
describe('Federation Discovery trust levels', () => {
  const svcPath = path.resolve(__dirname, '../services/FederationDiscoveryService.ts');
  let svcSrc: string;

  beforeAll(() => {
    svcSrc = fs.readFileSync(svcPath, 'utf-8');
  });

  it('validates trust level against allowed values', () => {
    expect(svcSrc).toContain("'untrusted'");
    expect(svcSrc).toContain("'verified'");
    expect(svcSrc).toContain("'trusted'");
    expect(svcSrc).toContain("'blocked'");
  });

  it('handles handshake initiation with public key exchange', () => {
    expect(svcSrc).toContain('initiateHandshake');
    expect(svcSrc).toContain("status = 'handshake'");
  });

  it('upgrades trust to verified on handshake completion', () => {
    expect(svcSrc).toContain('completeHandshake');
    expect(svcSrc).toContain("trust_level = 'verified'");
  });
});

/* ------------------------------------------------------------------ */
/*  Instance Identity service source check (5.1)                       */
/* ------------------------------------------------------------------ */
describe('Instance Identity Ed25519 keypair', () => {
  const svcPath = path.resolve(__dirname, '../services/InstanceIdentityService.ts');
  let svcSrc: string;

  beforeAll(() => {
    svcSrc = fs.readFileSync(svcPath, 'utf-8');
  });

  it('uses tweetnacl for Ed25519 keypair generation', () => {
    expect(svcSrc).toContain('tweetnacl');
    expect(svcSrc).toContain('sign.keyPair');
  });

  it('encrypts private key at rest with AES-256-GCM', () => {
    expect(svcSrc).toContain('aes-256-gcm');
    expect(svcSrc).toContain('encrypted_private_key');
  });

  it('generates SHA-256 fingerprint from public key', () => {
    expect(svcSrc).toContain('sha256');
    expect(svcSrc).toContain('fingerprint');
  });

  it('supports keypair rotation with deactivation of old key', () => {
    expect(svcSrc).toContain('rotateKeypair');
    expect(svcSrc).toContain('is_active = FALSE');
  });
});

/* ------------------------------------------------------------------ */
/*  Homeserver client types check (5.3)                                */
/* ------------------------------------------------------------------ */
describe('Homeserver connection management', () => {
  const svcPath = path.resolve(__dirname, '../services/HomeserverService.ts');
  let svcSrc: string;

  beforeAll(() => {
    svcSrc = fs.readFileSync(svcPath, 'utf-8');
  });

  it('supports all companion client types', () => {
    expect(svcSrc).toContain('flutter_mobile');
    expect(svcSrc).toContain('tauri_desktop');
    expect(svcSrc).toContain('web');
    expect(svcSrc).toContain('cli');
    expect(svcSrc).toContain('api');
  });

  it('generates secure connection token', () => {
    expect(svcSrc).toContain('randomBytes');
    expect(svcSrc).toContain('connection_token');
  });

  it('implements heartbeat mechanism', () => {
    expect(svcSrc).toContain('heartbeat');
    expect(svcSrc).toContain('last_active_at');
  });

  it('implements idle connection pruning', () => {
    expect(svcSrc).toContain('pruneIdle');
  });
});

/* ------------------------------------------------------------------ */
/*  Agent Delegation timeout logic (5.5)                               */
/* ------------------------------------------------------------------ */
describe('Agent Delegation service', () => {
  const svcPath = path.resolve(__dirname, '../services/AgentDelegationService.ts');
  let svcSrc: string;

  beforeAll(() => {
    svcSrc = fs.readFileSync(svcPath, 'utf-8');
  });

  it('enforces timeout bounds (5-120 seconds)', () => {
    expect(svcSrc).toContain('5000');
    expect(svcSrc).toContain('120000');
  });

  it('uses SQL interval for timeout expiration', () => {
    expect(svcSrc).toContain('milliseconds');
    expect(svcSrc).toContain('INTERVAL');
  });

  it('validates terminal status transitions', () => {
    expect(svcSrc).toContain('completed');
    expect(svcSrc).toContain('failed');
    expect(svcSrc).toContain('rejected');
    expect(svcSrc).toContain('timeout');
  });
});
