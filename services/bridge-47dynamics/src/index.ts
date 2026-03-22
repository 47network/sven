/**
 * Bridge-47Dynamics gRPC Service
 *
 * Receives AI processing requests from the 47Dynamics platform over mTLS gRPC
 * and routes them through TheSven's agent runtime, RAG pipeline, and tool executor.
 *
 * Architecture:
 *   47Dynamics api-go ──(mTLS gRPC)──▸ this service ──(NATS)──▸ agent-runtime
 *                                                     ──(NATS)──▸ rag-indexer
 *                                                     ──(PG)────▸ organizations/chats
 *
 * Tenant isolation: 47Dynamics requests can be mapped to per-tenant Sven contexts
 * via bridge_tenant_mappings. If no mapping exists, the bridge can optionally
 * fall back to legacy static defaults.
 */

import { Server, type ServerCredentials } from '@grpc/grpc-js';
import { loadSync } from '@grpc/proto-loader';
import { resolve, dirname } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { connect, type NatsConnection, type JetStreamClient } from 'nats';
import { createLogger } from '@sven/shared';

import { registerBridgeHandlers } from './handlers.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const logger = createLogger('bridge-47dynamics');

// ─── Configuration ──────────────────────────────────────────────────────────

interface BridgeConfig {
  grpcPort: number;
  grpcHost: string;
  databaseUrl: string;
  natsUrl: string;
  tlsCertPath: string;
  tlsKeyPath: string;
  tlsCaPath: string;
  serviceToken: string;
  inferenceUrl: string;
  inferenceApiKey: string;
  embeddingsUrl: string;
  embeddingsModel: string;
  summarizeModel: string;
  orgId: string;
  agentId: string;
  chatId: string;
  requireTenantMapping: boolean;
}

function loadConfig(): BridgeConfig {
  const required = (key: string): string => {
    const val = process.env[key];
    if (!val) throw new Error(`Required env var ${key} is not set`);
    return val;
  };
  const tenantMappingStrictRaw = String(
    process.env['BRIDGE_REQUIRE_TENANT_MAPPING']
    ?? process.env['SVEN_BRIDGE_REQUIRE_TENANT_MAPPING']
    ?? '',
  ).toLowerCase();

  return {
    grpcPort: parseInt(process.env['BRIDGE_GRPC_PORT'] ?? '4020', 10),
    grpcHost: process.env['BRIDGE_GRPC_HOST'] ?? '0.0.0.0',
    databaseUrl: required('DATABASE_URL'),
    natsUrl: process.env['NATS_URL'] ?? 'nats://localhost:4222',
    tlsCertPath: process.env['BRIDGE_TLS_CERT'] ?? '',
    tlsKeyPath: process.env['BRIDGE_TLS_KEY'] ?? '',
    tlsCaPath: process.env['BRIDGE_TLS_CA'] ?? '',
    serviceToken: required('BRIDGE_SERVICE_TOKEN'),
    inferenceUrl: process.env['LITELLM_URL'] ?? 'http://litellm:4001',
    inferenceApiKey: process.env['LITELLM_API_KEY'] ?? '',
    embeddingsUrl: process.env['EMBEDDINGS_URL'] ?? 'http://litellm:4001',
    embeddingsModel: process.env['EMBEDDINGS_MODEL'] ?? 'text-embedding-3-small',
    summarizeModel: process.env['BRIDGE_SUMMARIZE_MODEL'] ?? 'ollama/llama3.2:3b',
    orgId: process.env['BRIDGE_ORG_ID'] ?? '47dynamics-legacy-org',
    agentId: process.env['BRIDGE_AGENT_ID'] ?? '47dynamics-copilot',
    chatId: process.env['BRIDGE_CHAT_ID'] ?? '47dynamics-hq',
    requireTenantMapping: ['1', 'true', 'yes', 'on'].includes(tenantMappingStrictRaw),
  };
}

// ─── Bootstrap ──────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const config = loadConfig();

  // Connect to PostgreSQL
  const pool = new Pool({ connectionString: config.databaseUrl, max: 10 });
  try {
    const client = await pool.connect();
    client.release();
    logger.info('PostgreSQL connected');
  } catch (err) {
    logger.error('PostgreSQL connection failed', { error: (err as Error).message });
    process.exit(1);
  }

  // Verify 47Dynamics org exists
  const orgCheck = await pool.query(
    'SELECT id FROM organizations WHERE id = $1',
    [config.orgId]
  );
  if (orgCheck.rowCount === 0) {
    logger.error('47Dynamics organization not found — run migration 20260319120000 first', { orgId: config.orgId });
    process.exit(1);
  }

  // Connect to NATS
  let nc: NatsConnection;
  try {
    nc = await connect({ servers: config.natsUrl });
    logger.info('NATS connected', { url: config.natsUrl });
  } catch (err) {
    logger.error('NATS connection failed', { error: (err as Error).message });
    process.exit(1);
  }

  const js: JetStreamClient = nc.jetstream();

  // Load proto definition from explicit env override or local repo paths.
  const candidateProtoPaths = [
    process.env['BRIDGE_PROTO_PATH'] ? resolve(process.env['BRIDGE_PROTO_PATH']) : null,
    // Service-local proto path (works for dev and Docker runtime image).
    resolve(__dirname, '../proto/sven_bridge.proto'),
    // Monorepo canonical proto path (works for source tree development).
    resolve(__dirname, '../../../contracts/grpc/sven-bridge/v1/sven_bridge.proto'),
  ].filter((value): value is string => Boolean(value));

  const resolvedProto = candidateProtoPaths.find((protoPath) => existsSync(protoPath));
  if (!resolvedProto) {
    logger.error('Proto file not found', { tried: candidateProtoPaths });
    process.exit(1);
  }

  const packageDefinition = loadSync(resolvedProto, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });

  const { loadPackageDefinition, ServerCredentials: SC } = await import('@grpc/grpc-js');
  const proto = loadPackageDefinition(packageDefinition) as any;
  const bridgeService = proto.fortyseven.sven.bridge.v1.SvenBridge;

  // Create gRPC server
  const server = new Server({
    'grpc.max_receive_message_length': 4 * 1024 * 1024,
    'grpc.max_send_message_length': 16 * 1024 * 1024,
  });

  // Register handlers
  const handlers = registerBridgeHandlers({
    pool,
    nc,
    js,
    config,
    logger,
  });

  server.addService(bridgeService.service, handlers);

  // Load mTLS credentials
  let credentials: ServerCredentials;
  if (config.tlsCertPath && config.tlsKeyPath && config.tlsCaPath) {
    const rootCerts = readFileSync(config.tlsCaPath);
    const certChain = readFileSync(config.tlsCertPath);
    const privateKey = readFileSync(config.tlsKeyPath);
    credentials = SC.createSsl(rootCerts, [{ cert_chain: certChain, private_key: privateKey }], true);
    logger.info('mTLS enabled for gRPC server');
  } else if ((process.env['NODE_ENV'] ?? 'development') === 'development') {
    credentials = SC.createInsecure();
    logger.warn('gRPC server running without mTLS — development only');
  } else {
    logger.error('mTLS required in production');
    process.exit(1);
  }

  // Start server
  const addr = `${config.grpcHost}:${config.grpcPort}`;
  server.bindAsync(addr, credentials, (err: Error | null) => {
    if (err) {
      logger.error('gRPC bind failed', { error: err.message, addr });
      process.exit(1);
    }
    logger.info('bridge-47dynamics gRPC server listening', { addr });
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info('Shutting down', { signal });
    server.tryShutdown(() => {
      nc.drain().then(() => {
        pool.end().then(() => {
          logger.info('Shutdown complete');
          process.exit(0);
        });
      });
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error('Fatal startup error', { error: (err as Error).message });
  process.exit(1);
});
