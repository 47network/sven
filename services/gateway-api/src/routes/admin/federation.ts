import { FastifyInstance } from 'fastify';
import pg from 'pg';
import { InstanceIdentityService } from '../../services/InstanceIdentityService.js';
import { FederationDiscoveryService } from '../../services/FederationDiscoveryService.js';
import { HomeserverService } from '../../services/HomeserverService.js';
import { FederatedCommunityService } from '../../services/FederatedCommunityService.js';
import { AgentDelegationService } from '../../services/AgentDelegationService.js';
import { CommunityConsentService } from '../../services/CommunityConsentService.js';
import { DataSovereigntyService } from '../../services/DataSovereigntyService.js';
import { FederationHealthService } from '../../services/FederationHealthService.js';

/**
 * Federation admin routes (Batch 5: 5.1-5.8)
 * All endpoints scoped to the requesting user's organization.
 */
export async function registerFederationRoutes(app: FastifyInstance) {
  const pool = (app as unknown as { pg: pg.Pool }).pg;

  const identitySvc = new InstanceIdentityService(pool);
  const discoverySvc = new FederationDiscoveryService(pool);
  const homeserverSvc = new HomeserverService(pool);
  const communitySvc = new FederatedCommunityService(pool);
  const delegationSvc = new AgentDelegationService(pool);
  const consentSvc = new CommunityConsentService(pool);
  const sovereigntySvc = new DataSovereigntyService(pool);
  const healthSvc = new FederationHealthService(pool);

  // ============================================================
  // 5.1 Instance Identity
  // ============================================================
  app.post('/federation/identity/generate', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const identity = await identitySvc.generateKeypair(orgId);
    await healthSvc.auditLog(orgId, { event_type: 'identity', action: 'keypair_generated', user_id: req.userId });
    return { success: true, data: identity };
  });

  app.get('/federation/identity', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const identity = await identitySvc.getActiveIdentity(orgId);
    return { success: true, data: identity };
  });

  app.post('/federation/identity/rotate', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const identity = await identitySvc.rotateKeypair(orgId);
    await healthSvc.auditLog(orgId, { event_type: 'identity', action: 'keypair_rotated', user_id: req.userId });
    return { success: true, data: identity };
  });

  app.get('/federation/identity/history', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const identities = await identitySvc.listIdentities(orgId);
    return { success: true, data: identities };
  });

  app.post('/federation/identity/sign', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const { payload } = req.body as { payload: string };
    if (!payload) return reply.status(400).send({ success: false, error: { message: 'Payload is required' } });
    const envelope = await identitySvc.signPayload(orgId, payload);
    return { success: true, data: envelope };
  });

  app.post('/federation/identity/verify', async (req: any, reply) => {
    const { envelope, public_key } = req.body as { envelope: any; public_key: string };
    if (!envelope || !public_key) {
      return reply.status(400).send({ success: false, error: { message: 'Envelope and public_key required' } });
    }
    const valid = await identitySvc.verifySignature(envelope, public_key);
    return { success: true, data: { valid } };
  });

  // ============================================================
  // 5.2 Federation Discovery / Peers
  // ============================================================
  app.post('/federation/peers', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const peer = await discoverySvc.registerPeer(orgId, req.body);
    await healthSvc.auditLog(orgId, {
      event_type: 'discovery', action: 'peer_registered',
      peer_id: peer.id, user_id: req.userId,
    });
    return { success: true, data: peer };
  });

  app.get('/federation/peers', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const q = req.query as Record<string, string>;
    const result = await discoverySvc.listPeers(orgId, {
      status: q.status,
      trust_level: q.trust_level,
      limit: q.limit ? parseInt(q.limit, 10) : undefined,
      offset: q.offset ? parseInt(q.offset, 10) : undefined,
    });
    return { success: true, data: result };
  });

  app.get('/federation/peers/:peerId', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const peer = await discoverySvc.getPeer(orgId, req.params.peerId);
    if (!peer) return reply.status(404).send({ success: false, error: { message: 'Peer not found' } });
    return { success: true, data: peer };
  });

  app.post('/federation/peers/:peerId/handshake', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const peer = await discoverySvc.initiateHandshake(orgId, req.params.peerId);
    await healthSvc.auditLog(orgId, {
      event_type: 'discovery', action: 'handshake_initiated',
      peer_id: peer.id, user_id: req.userId,
    });
    return { success: true, data: peer };
  });

  app.post('/federation/peers/:peerId/handshake/complete', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const { public_key, fingerprint } = req.body as { public_key: string; fingerprint: string };
    if (!public_key || !fingerprint) {
      return reply.status(400).send({ success: false, error: { message: 'public_key and fingerprint required' } });
    }
    const peer = await discoverySvc.completeHandshake(orgId, req.params.peerId, public_key, fingerprint);
    await healthSvc.auditLog(orgId, {
      event_type: 'discovery', action: 'handshake_completed',
      peer_id: peer.id, user_id: req.userId,
    });
    return { success: true, data: peer };
  });

  app.patch('/federation/peers/:peerId/trust', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const { trust_level } = req.body as { trust_level: string };
    const peer = await discoverySvc.updateTrustLevel(orgId, req.params.peerId, trust_level);
    await healthSvc.auditLog(orgId, {
      event_type: 'discovery', action: 'trust_level_changed',
      peer_id: peer.id, user_id: req.userId,
      details: { trust_level },
    });
    return { success: true, data: peer };
  });

  app.get('/federation/well-known', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const data = await discoverySvc.getWellKnownData(orgId);
    return { success: true, data };
  });

  app.post('/federation/peers/prune', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const pruned = await discoverySvc.pruneStale(orgId);
    return { success: true, data: { pruned } };
  });

  // ============================================================
  // 5.3 Homeserver
  // ============================================================
  app.post('/federation/homeserver/connect', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    const userId = String(req.userId || '');
    if (!orgId || !userId) return reply.status(403).send({ success: false, error: { code: 'AUTH_REQUIRED' } });
    const connection = await homeserverSvc.registerConnection(orgId, userId, req.body);
    return { success: true, data: connection };
  });

  app.post('/federation/homeserver/heartbeat', async (req: any, reply) => {
    const { connection_token } = req.body as { connection_token: string };
    if (!connection_token) {
      return reply.status(400).send({ success: false, error: { message: 'connection_token required' } });
    }
    const ok = await homeserverSvc.heartbeat(connection_token);
    return { success: true, data: { active: ok } };
  });

  app.post('/federation/homeserver/:connectionId/disconnect', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    await homeserverSvc.disconnect(orgId, req.params.connectionId);
    return { success: true };
  });

  app.get('/federation/homeserver/connections', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const q = req.query as Record<string, string>;
    const connections = await homeserverSvc.listConnections(orgId, {
      user_id: q.user_id,
      status: q.status,
      client_type: q.client_type,
    });
    return { success: true, data: connections };
  });

  app.get('/federation/homeserver/config', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const config = await homeserverSvc.getConfig(orgId);
    return { success: true, data: config };
  });

  app.get('/federation/homeserver/stats', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const stats = await homeserverSvc.getStats(orgId);
    return { success: true, data: stats };
  });

  // ============================================================
  // 5.4 Cross-Instance Community
  // ============================================================
  app.post('/federation/community/topics', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const topic = await communitySvc.createTopic(orgId, req.body);
    await healthSvc.auditLog(orgId, {
      event_type: 'community', action: 'topic_created',
      peer_id: topic.peer_id ?? undefined, user_id: req.userId,
      details: { topic_name: topic.topic_name },
    });
    return { success: true, data: topic };
  });

  app.get('/federation/community/topics', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const q = req.query as Record<string, string>;
    const topics = await communitySvc.listTopics(orgId, {
      peer_id: q.peer_id,
      active_only: q.active_only !== 'false',
    });
    return { success: true, data: topics };
  });

  app.delete('/federation/community/topics/:topicId', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    await communitySvc.deactivateTopic(orgId, req.params.topicId);
    return { success: true };
  });

  app.get('/federation/community/summary', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const summary = await communitySvc.getSummary(orgId);
    return { success: true, data: summary };
  });

  // ============================================================
  // 5.5 Agent Delegation
  // ============================================================
  app.post('/federation/delegations', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const delegation = await delegationSvc.createDelegation(orgId, req.body);
    await healthSvc.auditLog(orgId, {
      event_type: 'delegation', action: 'delegation_created',
      peer_id: delegation.remote_peer_id, user_id: req.userId,
    });
    return { success: true, data: delegation };
  });

  app.get('/federation/delegations', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const q = req.query as Record<string, string>;
    const delegations = await delegationSvc.listDelegations(orgId, {
      status: q.status,
      peer_id: q.peer_id,
      agent_id: q.agent_id,
      limit: q.limit ? parseInt(q.limit, 10) : undefined,
    });
    return { success: true, data: delegations };
  });

  app.patch('/federation/delegations/:delegationId', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const { status, response_payload } = req.body as { status: string; response_payload?: Record<string, unknown> };
    const delegation = await delegationSvc.updateStatus(orgId, req.params.delegationId, status, response_payload);
    return { success: true, data: delegation };
  });

  app.post('/federation/delegations/expire', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const expired = await delegationSvc.expireTimedOut(orgId);
    return { success: true, data: { expired } };
  });

  app.get('/federation/delegations/summary', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const summary = await delegationSvc.getSummary(orgId);
    return { success: true, data: summary };
  });

  // ============================================================
  // 5.6 Community Consent
  // ============================================================
  app.get('/federation/consent', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    const userId = String(req.userId || '');
    if (!orgId || !userId) return reply.status(403).send({ success: false, error: { code: 'AUTH_REQUIRED' } });
    const consent = await consentSvc.getConsent(orgId, userId);
    return { success: true, data: consent };
  });

  app.put('/federation/consent', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    const userId = String(req.userId || '');
    if (!orgId || !userId) return reply.status(403).send({ success: false, error: { code: 'AUTH_REQUIRED' } });
    const consent = await consentSvc.updateConsent(orgId, userId, {
      ...req.body,
      consent_ip: req.ip,
    });
    await healthSvc.auditLog(orgId, {
      event_type: 'consent', action: 'consent_updated',
      user_id: userId,
      details: { consent_level: consent.consent_level },
      source_ip: req.ip,
    });
    return { success: true, data: consent };
  });

  app.post('/federation/consent/revoke', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    const userId = String(req.userId || '');
    if (!orgId || !userId) return reply.status(403).send({ success: false, error: { code: 'AUTH_REQUIRED' } });
    const consent = await consentSvc.revokeConsent(orgId, userId);
    await healthSvc.auditLog(orgId, {
      event_type: 'consent', action: 'consent_revoked',
      user_id: userId, source_ip: req.ip,
    });
    return { success: true, data: consent };
  });

  app.get('/federation/consent/stats', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const stats = await consentSvc.getStats(orgId);
    return { success: true, data: stats };
  });

  // ============================================================
  // 5.7 Data Sovereignty
  // ============================================================
  app.get('/federation/sovereignty', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const settings = await sovereigntySvc.getSettings(orgId);
    return { success: true, data: settings };
  });

  app.patch('/federation/sovereignty', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const settings = await sovereigntySvc.updateSettings(orgId, req.body);
    await healthSvc.auditLog(orgId, {
      event_type: 'sovereignty', action: 'settings_updated',
      user_id: req.userId,
      details: req.body,
    });
    return { success: true, data: settings };
  });

  app.get('/federation/sovereignty/can-federate/:peerId', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const result = await sovereigntySvc.canFederateWith(orgId, req.params.peerId);
    return { success: true, data: result };
  });

  app.get('/federation/sovereignty/export-policy', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const result = await sovereigntySvc.canExportData(orgId);
    return { success: true, data: result };
  });

  // ============================================================
  // 5.8 Federation Health & Monitoring
  // ============================================================
  app.post('/federation/health/:peerId/check', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const record = await healthSvc.pingPeer(orgId, req.params.peerId);
    return { success: true, data: record };
  });

  app.get('/federation/health/:peerId', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const q = req.query as Record<string, string>;
    const records = await healthSvc.getPeerHealth(orgId, req.params.peerId, {
      limit: q.limit ? parseInt(q.limit, 10) : undefined,
      check_type: q.check_type,
    });
    return { success: true, data: records };
  });

  app.get('/federation/health', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const mesh = await healthSvc.getMeshHealth(orgId);
    return { success: true, data: mesh };
  });

  app.post('/federation/health/prune', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const q = req.body as { retain_days?: number };
    const pruned = await healthSvc.pruneOldRecords(orgId, q.retain_days);
    return { success: true, data: { pruned } };
  });
}
