import { FastifyInstance } from 'fastify';
import pg from 'pg';
import { NatsConnection } from 'nats';
import { requireRole } from '../auth.js';
import { registerUserRoutes } from './users.js';
import { registerChatRoutes } from './chats.js';
import { registerChannelRoutes } from './channels.js';
import { registerPermissionRoutes } from './permissions.js';
import { registerApprovalRoutes } from './approvals.js';
import { registerToolRunRoutes } from './tool-runs.js';
import { registerSettingsRoutes } from './settings.js';
import { registerRegistryRoutes } from './registry.js';
import { registerWorkflowRoutes } from './workflows.js';
import { registerMemoryRoutes } from './memory.js';
import { registerModelRoutes } from './models.js';
import { registerRagRoutes } from './rag.js';
import { registerAllowlistRoutes } from './allowlists.js';
import { registerHaRoutes } from './ha.js';
import { registerHaSubscriptionRoutes } from './ha-subscriptions.js';
import { registerHaAutomationRoutes } from './ha-automations.js';
import { registerCalendarRoutes } from './calendar.js';
import { registerGitRoutes } from './git.js';
import { registerNasRoutes } from './nas.js';
import { registerWebRoutes } from './web.js';
import { registerKnowledgeGraphRoutes } from './knowledge-graph.js';
import { registerPrivacyRoutes } from './privacy.js';
import { registerIncidentRoutes } from './incidents.js';
import { registerBackupRoutes } from './backups.js';
import { registerReplayRoutes } from './replay.js';
import { registerPerformanceRoutes } from './performance.js';
import { registerPairingRoutes } from './pairing.js';
import { registerDbStatusRoutes } from './db-status.js';
import { registerAgentRoutes } from './agents.js';
import { registerMcpRoutes } from './mcp.js';
import { registerCronRoutes } from './cron.js';
import { registerAdminWebhookRoutes } from './webhooks.js';
import { registerEmailAdminRoutes } from './email.js';
import { registerSoulsRoutes } from './souls.js';
import { registerLlmAuditRoutes } from './llm-audit.js';
import { registerFrigateRoutes } from './frigate.js';
import { registerAccountRoutes } from './accounts.js';
import { registerImprovementsRoutes } from './improvements.js';
import { registerPolicyRoutes } from './policy.js';
import { registerDeviceRoutes } from './devices.js';
import { registerSearchRoutes } from './search.js';
import { registerLiteLLMRoutes } from './litellm.js';
import { registerDiscoveryRoutes } from './discovery.js';
import { registerDebugRoutes } from './debug.js';
import { registerUpdateCheckerRoutes } from './update-checker.js';
import { registerEditorRoutes } from './editor.js';
import { registerTunnelRoutes } from './tunnel.js';
import { registerIntegrationRuntimeRoutes } from './integration-runtime.js';
import { registerAgentAnalyticsRoutes } from './agent-analytics.js';
import { registerIntegrationsCatalogRoutes } from './integrations-catalog.js';
import { registerBridgeTenantMappingRoutes } from './bridge-tenant-mappings.js';
import { registerCommunityRoutes } from './community.js';
import { registerObsidianSyncRoutes } from './obsidian-sync.js';
import { registerA2AAdminRoutes } from './a2a.js';
import { registerGlobalSearchRoutes } from './global-search.js';
import { registerBrainRoutes } from './brain.js';
import { registerRevenueRoutes } from './revenue.js';
import { registerInfraRoutes } from './infra.js';
import { registerAutomatonRoutes } from './automatons.js';
import { registerAgentSpawnerRoutes } from './agent-spawner.js';
import { registerRevenueGoalRoutes } from './revenue-goals.js';
import { registerAgentProfileRoutes } from './agent-profiles.js';
import { registerBusinessSpaceRoutes } from './business-spaces.js';
import { registerCrewManagementRoutes } from './crew-management.js';
import { registerAccountantRoutes } from './accountant.js';
import { registerOversightDashboardRoutes } from './oversight-dashboard.js';
import { registerAgentMessagingRoutes } from './agent-messaging.js';
import { registerPublishingRoutes } from './publishing.js';
import { registerEidolonWorldRoutes } from './eidolon-world.js';
import { registerMisiuniRoutes } from './misiuni.js';
import { registerPublishingV2Routes } from './publishing-v2.js';
import { registerSocialMediaRoutes } from './social-media.js';
import { registerCommunityAgentRoutes } from './community-agents.js';
import { registerAgentTypeRoutes } from './agent-types.js';
import { registerFederationRoutes } from './federation.js';
import { registerGemma4Routes } from './gemma4.js';
import { registerPipelineRoutes } from './pipeline.js';
import { registerAnalyticsOverviewRoutes } from './analytics-overview.js';
import { registerProactiveNotificationRoutes } from './proactive-notifications.js';
import { registerTradingDashboardRoutes } from './trading.js';
import { registerXlviiRoutes } from './xlvii-merch.js';
import { registerCouncilRoutes } from './council.js';

export async function registerAdminRoutes(
  app: FastifyInstance,
  pool: pg.Pool,
  nc: NatsConnection,
) {
  const authenticatedAdminSurface = requireRole(pool, 'admin', 'operator', 'user');
  const tenantAdminRoles = new Set(['owner', 'admin', 'operator']);
  const tenantSelfServicePaths = new Set(['/v1/admin/accounts', '/accounts']);

  await app.register(
    async (accountAdminApp) => {
      accountAdminApp.addHook('preHandler', authenticatedAdminSurface);
      await registerAccountRoutes(accountAdminApp, pool);
    },
    { prefix: '/v1/admin' },
  );

  function normalizedRequestPathCandidates(request: any): string[] {
    const rawUrlPath = String(request.raw?.url || '').split('?')[0];
    const requestUrl = String(request.url || '').split('?')[0];
    const routeOptionsUrl = String(request.routeOptions?.url || '').split('?')[0];
    const routerPath = String(request.routerPath || '').split('?')[0];
    return Array.from(new Set([rawUrlPath, requestUrl, routeOptionsUrl, routerPath].filter(Boolean)));
  }

  function isTenantSelfServicePath(urlPath: string, method: string): boolean {
    const canonicalPath = String(urlPath || '').replace(/\/+$/g, '') || '/';
    const normalizedPath = canonicalPath.startsWith('/v1/admin')
      ? String(canonicalPath.slice('/v1/admin'.length) || '/')
      : canonicalPath;
    if (
      (tenantSelfServicePaths.has(canonicalPath) || tenantSelfServicePaths.has(normalizedPath))
      && (method === 'GET' || method === 'POST')
    ) return true;
    const activateMatch = /^\/v1\/admin\/accounts\/[^/]+\/activate$/.test(canonicalPath)
      || /^\/accounts\/[^/]+\/activate$/.test(normalizedPath);
    if (activateMatch && method === 'POST') return true;
    return false;
  }

  // Prefix all admin routes
  app.register(
    async (adminApp) => {
      adminApp.addHook('preHandler', authenticatedAdminSurface);
      adminApp.addHook('preHandler', async (request: any, reply) => {
        const method = String(request.raw?.method || 'GET').toUpperCase();
        const selfServicePath = normalizedRequestPathCandidates(request)
          .some((candidate) => isTenantSelfServicePath(candidate, method));
        const orgId = String(request.orgId || '');
        const userId = String(request.userId || '');
        if (!userId) {
          return reply.status(401).send({
            success: false,
            error: { code: 'UNAUTHENTICATED', message: 'Session required' },
          });
        }
        if (!orgId) {
          if (selfServicePath) return;
          return reply.status(403).send({
            success: false,
            error: { code: 'ORG_REQUIRED', message: 'Active account required' },
          });
        }

        const membership = await pool.query(
          `SELECT role
           FROM organization_memberships
           WHERE organization_id = $1
             AND user_id = $2
             AND status = 'active'
           LIMIT 1`,
          [orgId, userId],
        );
        const tenantRole = String(membership.rows[0]?.role || '');
        request.tenantRole = tenantRole;

        if (selfServicePath) {
          if (!tenantRole) {
            return reply.status(403).send({
              success: false,
              error: { code: 'FORBIDDEN', message: 'Insufficient tenant permissions' },
            });
          }
          return;
        }

        if (!tenantAdminRoles.has(tenantRole)) {
          return reply.status(403).send({
            success: false,
            error: { code: 'FORBIDDEN', message: 'Insufficient tenant permissions' },
          });
        }
      });
      adminApp.get('/events', async (request: any, reply) => {
        const orgId = String(request.orgId || '').trim();
        if (!orgId) {
          return reply.status(403).send({
            success: false,
            error: { code: 'ORG_REQUIRED', message: 'Active account required' },
          });
        }

        reply.hijack();
        reply.raw.writeHead(200, {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
          'X-Accel-Buffering': 'no',
        });

        let streamOpen = true;
        const state = new Map<string, string>();

        const sendTypedEvent = (type: string, payload: Record<string, unknown>) => {
          if (!streamOpen) return;
          try {
            reply.raw.write(`data: ${JSON.stringify({ type, ...payload })}\n\n`);
          } catch {
            streamOpen = false;
          }
        };

        const resolveSignature = async (sql: string): Promise<string> => {
          const result = await pool.query(sql, [orgId]);
          const row = result.rows[0] as { latest_at?: unknown; total?: unknown } | undefined;
          return `${String(row?.latest_at || '')}|${Number(row?.total || 0)}`;
        };

        const publishIfChanged = async (key: string, type: string, sql: string): Promise<void> => {
          const signature = await resolveSignature(sql);
          const previous = state.get(key);
          if (previous === undefined) {
            state.set(key, signature);
            return;
          }
          if (previous !== signature) {
            state.set(key, signature);
            sendTypedEvent(type, {
              org_id: orgId,
              signature,
              observed_at: new Date().toISOString(),
            });
          }
        };

        const pollDomainChanges = async () => {
          await Promise.all([
            publishIfChanged(
              'approval',
              'approval.changed',
              `SELECT COALESCE(MAX(COALESCE(a.updated_at, a.created_at)), to_timestamp(0)) AS latest_at,
                      COUNT(*)::int AS total
               FROM approvals a
               JOIN chats c ON c.id = a.chat_id
               WHERE c.organization_id = $1`,
            ),
            publishIfChanged(
              'tool_run',
              'tool_run.changed',
              `SELECT COALESCE(MAX(COALESCE(tr.updated_at, tr.created_at)), to_timestamp(0)) AS latest_at,
                      COUNT(*)::int AS total
               FROM tool_runs tr
               JOIN chats c ON c.id = tr.chat_id
               WHERE c.organization_id = $1`,
            ),
            publishIfChanged(
              'chat',
              'chat.changed',
              `SELECT COALESCE(MAX(COALESCE(c.updated_at, c.created_at)), to_timestamp(0)) AS latest_at,
                      COUNT(*)::int AS total
               FROM chats c
               WHERE c.organization_id = $1`,
            ),
            publishIfChanged(
              'user',
              'user.changed',
              `SELECT COALESCE(MAX(COALESCE(u.updated_at, u.created_at)), to_timestamp(0)) AS latest_at,
                      COUNT(*)::int AS total
               FROM users u
               JOIN organization_memberships m ON m.user_id = u.id
               WHERE m.organization_id = $1
                 AND m.status = 'active'`,
            ),
          ]);
        };

        reply.raw.write('retry: 3000\n\n');
        sendTypedEvent('health.status', { ok: true, source: 'admin-events', org_id: orgId });

        try {
          await pollDomainChanges();
        } catch {
          sendTypedEvent('health.degraded', {
            ok: false,
            source: 'admin-events',
            reason: 'domain_poll_bootstrap_failed',
            org_id: orgId,
          });
        }

        const domainPoll = setInterval(() => {
          void pollDomainChanges().catch(() => {
            sendTypedEvent('health.degraded', {
              ok: false,
              source: 'admin-events',
              reason: 'domain_poll_failed',
              org_id: orgId,
            });
          });
        }, 5000);

        const heartbeat = setInterval(() => {
          try {
            reply.raw.write(': heartbeat\n\n');
          } catch {
            streamOpen = false;
          }
        }, 15000);

        let cleanedUp = false;
        const cleanup = () => {
          if (cleanedUp) return;
          cleanedUp = true;
          streamOpen = false;
          clearInterval(domainPoll);
          clearInterval(heartbeat);
        };

        request.raw.on('close', cleanup);
        reply.raw.on('close', cleanup);
        reply.raw.on('error', cleanup);
      });

      async function mountAdminRoutes(
        registrar: (scopedApp: FastifyInstance) => Promise<void>,
      ): Promise<void> {
        await adminApp.register(async (scopedApp) => {
          await registrar(scopedApp);
        });
      }

      await mountAdminRoutes((scopedApp) => registerUserRoutes(scopedApp, pool));
      await mountAdminRoutes((scopedApp) => registerChatRoutes(scopedApp, pool));
      await mountAdminRoutes((scopedApp) => registerChannelRoutes(scopedApp, pool, requireRole));
      await mountAdminRoutes((scopedApp) => registerPermissionRoutes(scopedApp, pool));
      await mountAdminRoutes((scopedApp) => registerApprovalRoutes(scopedApp, pool, nc));
      await mountAdminRoutes((scopedApp) => registerToolRunRoutes(scopedApp, pool));
      await mountAdminRoutes((scopedApp) => registerSettingsRoutes(scopedApp, pool));
      await mountAdminRoutes((scopedApp) => registerRegistryRoutes(scopedApp, pool));
      await mountAdminRoutes((scopedApp) => registerWorkflowRoutes(scopedApp, pool, nc));
      await mountAdminRoutes((scopedApp) => registerMemoryRoutes(scopedApp, pool));
      await mountAdminRoutes((scopedApp) => registerModelRoutes(scopedApp, pool));
      await mountAdminRoutes((scopedApp) => registerRagRoutes(scopedApp, pool));
      await mountAdminRoutes((scopedApp) => registerAllowlistRoutes(scopedApp, pool));
      await mountAdminRoutes((scopedApp) => registerHaRoutes(scopedApp, pool));
      await mountAdminRoutes((scopedApp) => registerHaSubscriptionRoutes(scopedApp, pool, nc));
      await mountAdminRoutes((scopedApp) => registerHaAutomationRoutes(scopedApp, pool));
      await mountAdminRoutes((scopedApp) => registerCalendarRoutes(scopedApp, pool));
      await mountAdminRoutes((scopedApp) => registerGitRoutes(scopedApp, pool));
      await mountAdminRoutes((scopedApp) => registerNasRoutes(scopedApp, pool));
      await mountAdminRoutes((scopedApp) => registerWebRoutes(scopedApp, pool));
      await mountAdminRoutes((scopedApp) => registerKnowledgeGraphRoutes(scopedApp));
      await mountAdminRoutes((scopedApp) => registerPrivacyRoutes(scopedApp, pool));
      await mountAdminRoutes((scopedApp) => registerIncidentRoutes(scopedApp, pool));
      await mountAdminRoutes((scopedApp) => registerBackupRoutes(scopedApp, pool));
      await mountAdminRoutes((scopedApp) => registerReplayRoutes(scopedApp, pool));
      await mountAdminRoutes((scopedApp) => registerPerformanceRoutes(scopedApp, pool));
      await mountAdminRoutes((scopedApp) => registerPairingRoutes(scopedApp, pool));
      await mountAdminRoutes((scopedApp) => registerDbStatusRoutes(scopedApp, pool));
      await mountAdminRoutes((scopedApp) => registerAgentRoutes(scopedApp, pool));
      await mountAdminRoutes((scopedApp) => registerMcpRoutes(scopedApp, pool));
      await mountAdminRoutes((scopedApp) => registerCronRoutes(scopedApp, pool, nc));
      await mountAdminRoutes((scopedApp) => registerAdminWebhookRoutes(scopedApp, pool));
      await mountAdminRoutes((scopedApp) => registerEmailAdminRoutes(scopedApp, pool));
      await mountAdminRoutes((scopedApp) => registerSoulsRoutes(scopedApp, pool));
      await mountAdminRoutes((scopedApp) => registerLlmAuditRoutes(scopedApp, pool));
      await mountAdminRoutes((scopedApp) => registerFrigateRoutes(scopedApp, pool));
      await mountAdminRoutes((scopedApp) => registerImprovementsRoutes(scopedApp, pool));
      await mountAdminRoutes((scopedApp) => registerPolicyRoutes(scopedApp, pool));
      await mountAdminRoutes((scopedApp) => registerDeviceRoutes(scopedApp, pool));
      await mountAdminRoutes((scopedApp) => registerSearchRoutes(scopedApp, pool));
      await mountAdminRoutes((scopedApp) => registerLiteLLMRoutes(scopedApp, pool));
      await mountAdminRoutes((scopedApp) => registerDiscoveryRoutes(scopedApp, pool));
      await mountAdminRoutes((scopedApp) => registerDebugRoutes(scopedApp, pool));
      await mountAdminRoutes((scopedApp) => registerUpdateCheckerRoutes(scopedApp, pool));
      await mountAdminRoutes((scopedApp) => registerEditorRoutes(scopedApp, pool));
      await mountAdminRoutes((scopedApp) => registerTunnelRoutes(scopedApp, pool));
      await mountAdminRoutes((scopedApp) => registerIntegrationRuntimeRoutes(scopedApp, pool));
      await mountAdminRoutes((scopedApp) => registerAgentAnalyticsRoutes(scopedApp, pool));
      await mountAdminRoutes((scopedApp) => registerIntegrationsCatalogRoutes(scopedApp, pool));
      await mountAdminRoutes((scopedApp) => registerBridgeTenantMappingRoutes(scopedApp, pool));
      await mountAdminRoutes((scopedApp) => registerCommunityRoutes(scopedApp, pool));
      await mountAdminRoutes((scopedApp) => registerObsidianSyncRoutes(scopedApp, pool));
      await mountAdminRoutes((scopedApp) => registerA2AAdminRoutes(scopedApp, pool));
      await mountAdminRoutes((scopedApp) => registerGlobalSearchRoutes(scopedApp, pool));
      await mountAdminRoutes((scopedApp) => registerBrainRoutes(scopedApp, pool));
      await mountAdminRoutes((scopedApp) => registerCommunityAgentRoutes(scopedApp, pool, nc));
      await mountAdminRoutes((scopedApp) => registerAgentTypeRoutes(scopedApp));
      await mountAdminRoutes((scopedApp) => registerFederationRoutes(scopedApp));
      await mountAdminRoutes((scopedApp) => registerGemma4Routes(scopedApp));
      await mountAdminRoutes((scopedApp) => registerPipelineRoutes(scopedApp));
      await mountAdminRoutes((scopedApp) => registerAnalyticsOverviewRoutes(scopedApp, pool));
      await mountAdminRoutes((scopedApp) => registerProactiveNotificationRoutes(scopedApp, pool, nc));
      await mountAdminRoutes((scopedApp) => registerTradingDashboardRoutes(scopedApp, pool));
      await mountAdminRoutes((scopedApp) => registerRevenueRoutes(scopedApp, pool));
      await mountAdminRoutes((scopedApp) => registerInfraRoutes(scopedApp, pool));
      await mountAdminRoutes((scopedApp) => registerAutomatonRoutes(scopedApp, pool));
      await mountAdminRoutes((scopedApp) => registerAgentProfileRoutes(scopedApp, pool, nc));
      await mountAdminRoutes((scopedApp) => registerAgentSpawnerRoutes(scopedApp, pool, nc));
      await mountAdminRoutes((scopedApp) => registerRevenueGoalRoutes(scopedApp, pool, nc));
      await mountAdminRoutes((scopedApp) => registerBusinessSpaceRoutes(scopedApp, pool, nc));
      await mountAdminRoutes((scopedApp) => registerCrewManagementRoutes(scopedApp, pool, nc));
      await mountAdminRoutes((scopedApp) => registerAccountantRoutes(scopedApp, pool, nc));
      await mountAdminRoutes((scopedApp) => registerOversightDashboardRoutes(scopedApp, pool, nc));
      await mountAdminRoutes((scopedApp) => registerAgentMessagingRoutes(scopedApp, pool, nc));
      await mountAdminRoutes((scopedApp) => registerPublishingRoutes(scopedApp, pool, nc));
      await mountAdminRoutes((scopedApp) => registerEidolonWorldRoutes(scopedApp, pool, nc));
      await mountAdminRoutes((scopedApp) => registerMisiuniRoutes(scopedApp, pool, nc));
      await mountAdminRoutes((scopedApp) => registerPublishingV2Routes(scopedApp, pool, nc));
      await mountAdminRoutes((scopedApp) => registerSocialMediaRoutes(scopedApp, pool, nc));
      await mountAdminRoutes((scopedApp) => registerXlviiRoutes(scopedApp, pool, nc));
      await mountAdminRoutes((scopedApp) => registerCouncilRoutes(scopedApp, pool));
    },
    { prefix: '/v1/admin' },
  );
}
