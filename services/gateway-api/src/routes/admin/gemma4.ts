import { FastifyInstance } from 'fastify';
import pg from 'pg';
import { ModelSelectionService } from '../../services/ModelSelectionService.js';
import { SmartRoutingService } from '../../services/SmartRoutingService.js';
import { OnDeviceMemoryService } from '../../services/OnDeviceMemoryService.js';
import { CommunityBridgeService } from '../../services/CommunityBridgeService.js';
import { ModuleSystemService } from '../../services/ModuleSystemService.js';
import { PrivacyIsolationService } from '../../services/PrivacyIsolationService.js';
import { GemmaCapabilitiesService } from '../../services/GemmaCapabilitiesService.js';

/**
 * Gemma 4 Integration admin routes (Batch 6: 6.1-6.17)
 * Model selection, smart routing, on-device memory, community bridge,
 * module system, privacy isolation, and capability maps.
 */
export async function registerGemma4Routes(app: FastifyInstance) {
  const pool = (app as unknown as { pg: pg.Pool }).pg;

  const modelSvc = new ModelSelectionService(pool);
  const routingSvc = new SmartRoutingService(pool);
  const memorySvc = new OnDeviceMemoryService(pool);
  const bridgeSvc = new CommunityBridgeService(pool);
  const moduleSvc = new ModuleSystemService(pool);
  const privacySvc = new PrivacyIsolationService(pool);
  const capsSvc = new GemmaCapabilitiesService(pool);

  // ============================================================
  // 6.1 Model Selection
  // ============================================================
  app.post('/gemma4/models/seed', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const profiles = await modelSvc.seedDefaults(orgId);
    return { success: true, data: profiles };
  });

  app.get('/gemma4/models/defaults', async (_req: any) => {
    return { success: true, data: ModelSelectionService.getDefaults() };
  });

  app.get('/gemma4/models', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const q = req.query as Record<string, string>;
    const profiles = await modelSvc.listProfiles(orgId, {
      platform: q.platform,
      active_only: q.active_only !== 'false',
    });
    return { success: true, data: profiles };
  });

  app.get('/gemma4/models/select/:platform', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const profile = await modelSvc.selectForPlatform(orgId, req.params.platform);
    return { success: true, data: profile };
  });

  app.post('/gemma4/models', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const profile = await modelSvc.registerProfile(orgId, req.body);
    return { success: true, data: profile };
  });

  app.delete('/gemma4/models/:profileId', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    await modelSvc.deactivateProfile(orgId, req.params.profileId);
    return { success: true };
  });

  // ============================================================
  // 6.4 Smart Routing
  // ============================================================
  app.get('/gemma4/routing/policy', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const policy = await routingSvc.getPolicy(orgId);
    return { success: true, data: policy };
  });

  app.put('/gemma4/routing/policy', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const policy = await routingSvc.updatePolicy(orgId, req.body);
    return { success: true, data: policy };
  });

  app.post('/gemma4/routing/route', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const userId = String(req.userId || '');
    const decision = await routingSvc.routeRequest(orgId, userId, req.body);
    return { success: true, data: decision };
  });

  app.get('/gemma4/routing/stats', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const stats = await routingSvc.getRoutingStats(orgId);
    return { success: true, data: stats };
  });

  // ============================================================
  // 6.5 On-Device Memory Sync
  // ============================================================
  app.post('/gemma4/memory/devices', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const userId = String(req.userId || '');
    const manifest = await memorySvc.registerDevice(orgId, userId, req.body);
    return { success: true, data: manifest };
  });

  app.get('/gemma4/memory/devices', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const userId = String(req.userId || '');
    const devices = await memorySvc.listDevices(orgId, userId);
    return { success: true, data: devices };
  });

  app.get('/gemma4/memory/devices/:deviceId/manifest', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const userId = String(req.userId || '');
    const manifest = await memorySvc.getManifest(orgId, userId, req.params.deviceId);
    return { success: true, data: manifest };
  });

  app.get('/gemma4/memory/devices/:deviceId/delta', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const userId = String(req.userId || '');
    const delta = await memorySvc.calculateDownloadDelta(orgId, userId, req.params.deviceId);
    return { success: true, data: delta };
  });

  app.post('/gemma4/memory/devices/:deviceId/upload', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const userId = String(req.userId || '');
    const batch = await memorySvc.recordUploadBatch(orgId, userId, req.params.deviceId, req.body);
    return { success: true, data: batch };
  });

  app.post('/gemma4/memory/devices/:deviceId/ack', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const userId = String(req.userId || '');
    const { batch_id } = req.body as { batch_id: string };
    await memorySvc.acknowledgeDownload(orgId, userId, req.params.deviceId, batch_id);
    return { success: true };
  });

  app.get('/gemma4/memory/sync-history', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const userId = String(req.userId || '');
    const q = req.query as Record<string, string>;
    const history = await memorySvc.getSyncHistory(orgId, userId, {
      device_id: q.device_id,
      limit: q.limit ? parseInt(q.limit, 10) : undefined,
    });
    return { success: true, data: history };
  });

  app.get('/gemma4/memory/sync-stats', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const userId = String(req.userId || '');
    const stats = await memorySvc.getSyncStats(orgId, userId);
    return { success: true, data: stats };
  });

  // ============================================================
  // 6.6 Community Bridge
  // ============================================================
  app.get('/gemma4/bridge/config', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const userId = String(req.userId || '');
    const config = await bridgeSvc.getConfig(orgId, userId);
    return { success: true, data: config };
  });

  app.put('/gemma4/bridge/config', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const userId = String(req.userId || '');
    const config = await bridgeSvc.updateConfig(orgId, userId, req.body);
    return { success: true, data: config };
  });

  app.post('/gemma4/bridge/actions', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const userId = String(req.userId || '');
    const event = await bridgeSvc.submitAction(orgId, userId, req.body);
    return { success: true, data: event };
  });

  app.get('/gemma4/bridge/events', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const userId = String(req.userId || '');
    const q = req.query as Record<string, string>;
    const events = await bridgeSvc.listEvents(orgId, userId, {
      action: q.action,
      limit: q.limit ? parseInt(q.limit, 10) : undefined,
      offset: q.offset ? parseInt(q.offset, 10) : undefined,
    });
    return { success: true, data: events };
  });

  app.get('/gemma4/bridge/stats', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const userId = String(req.userId || '');
    const stats = await bridgeSvc.getStats(orgId, userId);
    return { success: true, data: stats };
  });

  // ============================================================
  // 6.7+6.8 Module System
  // ============================================================
  app.post('/gemma4/modules', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const mod = await moduleSvc.registerModule(req.body);
    return { success: true, data: mod };
  });

  app.get('/gemma4/modules', async (req: any, reply) => {
    const q = req.query as Record<string, string>;
    const modules = await moduleSvc.listModules({
      category: q.category,
      platform: q.platform,
      active_only: q.active_only !== 'false',
    });
    return { success: true, data: modules };
  });

  app.post('/gemma4/modules/recommend', async (req: any, reply) => {
    const modules = await moduleSvc.recommendModules(req.body);
    return { success: true, data: modules };
  });

  app.post('/gemma4/modules/:moduleId/install', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const userId = String(req.userId || '');
    const install = await moduleSvc.installModule(orgId, userId, req.body.device_id, req.params.moduleId);
    return { success: true, data: install };
  });

  app.put('/gemma4/modules/:moduleId/progress', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const userId = String(req.userId || '');
    const { device_id, progress } = req.body as { device_id: string; progress: number };
    await moduleSvc.updateProgress(orgId, userId, device_id, req.params.moduleId, progress);
    return { success: true };
  });

  app.delete('/gemma4/modules/:moduleId/install', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const userId = String(req.userId || '');
    const { device_id } = req.query as { device_id: string };
    await moduleSvc.uninstallModule(orgId, userId, device_id, req.params.moduleId);
    return { success: true };
  });

  app.get('/gemma4/modules/installed', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const userId = String(req.userId || '');
    const q = req.query as Record<string, string>;
    const installs = await moduleSvc.listInstalled(orgId, userId, q.device_id);
    return { success: true, data: installs };
  });

  app.get('/gemma4/modules/stats', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const userId = String(req.userId || '');
    const stats = await moduleSvc.getStats(orgId, userId);
    return { success: true, data: stats };
  });

  // ============================================================
  // 6.11+6.13 Privacy Isolation
  // ============================================================
  app.get('/gemma4/privacy/policy', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const userId = String(req.userId || '');
    const policy = await privacySvc.getPolicy(orgId, userId);
    return { success: true, data: policy };
  });

  app.put('/gemma4/privacy/policy', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const userId = String(req.userId || '');
    const policy = await privacySvc.updatePolicy(orgId, userId, req.body);
    return { success: true, data: policy };
  });

  app.post('/gemma4/privacy/check-outbound', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const userId = String(req.userId || '');
    const { domain } = req.body as { domain: string };
    if (!domain) return reply.status(400).send({ success: false, error: { message: 'Domain is required' } });
    const result = await privacySvc.checkOutboundRequest(orgId, userId, domain);
    return { success: true, data: result };
  });

  app.get('/gemma4/privacy/verify', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const userId = String(req.userId || '');
    const report = await privacySvc.verifyIsolation(orgId, userId);
    return { success: true, data: report };
  });

  app.get('/gemma4/privacy/blocked-domains', async (_req: any) => {
    return { success: true, data: privacySvc.getBlockedDomains() };
  });

  app.get('/gemma4/privacy/audit-stats', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const userId = String(req.userId || '');
    const stats = await privacySvc.getAuditStats(orgId, userId);
    return { success: true, data: stats };
  });

  // ============================================================
  // 6.10+6.17 Capabilities & Custom Models
  // ============================================================
  app.post('/gemma4/capabilities/seed', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const { profile_id } = req.body as { profile_id: string };
    if (!profile_id) return reply.status(400).send({ success: false, error: { message: 'profile_id is required' } });
    const caps = await capsSvc.seedCapabilities(orgId, profile_id);
    return { success: true, data: caps };
  });

  app.get('/gemma4/capabilities', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const q = req.query as Record<string, string>;
    if (!q.profile_id) return reply.status(400).send({ success: false, error: { message: 'profile_id is required' } });
    const caps = await capsSvc.listCapabilities(orgId, q.profile_id);
    return { success: true, data: caps };
  });

  app.put('/gemma4/capabilities/:capabilityId/toggle', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const { enabled } = req.body as { enabled: boolean };
    const cap = await capsSvc.toggleCapability(orgId, req.params.capabilityId, enabled);
    return { success: true, data: cap };
  });

  app.put('/gemma4/capabilities/:capabilityId/config', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const cap = await capsSvc.updateCapabilityConfig(orgId, req.params.capabilityId, req.body);
    return { success: true, data: cap };
  });

  app.get('/gemma4/capabilities/native', async (_req: any) => {
    return { success: true, data: GemmaCapabilitiesService.getNativeCapabilities() };
  });

  app.get('/gemma4/capabilities/formats', async (_req: any) => {
    return { success: true, data: GemmaCapabilitiesService.getSupportedFormats() };
  });

  app.post('/gemma4/models/custom', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const userId = String(req.userId || '');
    const slot = await capsSvc.registerCustomModel(orgId, userId, req.body);
    return { success: true, data: slot };
  });

  app.get('/gemma4/models/custom', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const userId = String(req.userId || '');
    const slots = await capsSvc.listCustomModels(orgId, userId);
    return { success: true, data: slots };
  });

  app.delete('/gemma4/models/custom/:slotId', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    await capsSvc.deactivateSlot(orgId, req.params.slotId);
    return { success: true };
  });
}
