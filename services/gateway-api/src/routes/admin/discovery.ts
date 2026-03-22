import { FastifyInstance } from 'fastify';
import pg from 'pg';
import { getDiscoveryService } from '../../services/DiscoveryService.js';

export async function registerDiscoveryRoutes(app: FastifyInstance, _pool: pg.Pool) {
  app.addHook('preHandler', async (request: any, reply) => {
    if (String(request.userRole || '').trim() === 'platform_admin') return;
    reply.status(403).send({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Global admin privileges required' },
    });
    return;
  });

  app.addHook('preHandler', async (request: any, reply) => {
    if (request.orgId) return;
    reply.status(403).send({
      success: false,
      error: { code: 'ORG_REQUIRED', message: 'Active account required' },
    });
    return;
  });

  app.get('/discovery', async (_request, reply) => {
    const svc = getDiscoveryService();
    if (!svc || !svc.isEnabled()) {
      reply.send({
        success: true,
        data: {
          enabled: false,
          mode: 'off',
          wide_area_domains: [],
          instances: [],
          nats_leaf_auto_peer_enabled: false,
          nats_leaf_peers: [],
        },
      });
      return;
    }
    const instances = svc.listInstances();
    const natsLeafPeers = svc.listNatsLeafPeers();
    reply.send({
      success: true,
      data: {
        enabled: true,
        mode: svc.getMode(),
        wide_area_domains: svc.getWideAreaDomains(),
        instances,
        nats_leaf_auto_peer_enabled: svc.isNatsLeafAutoPeerEnabled(),
        nats_leaf_peers: natsLeafPeers,
      },
    });
  });
}
