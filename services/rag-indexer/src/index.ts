import { connect, JSONCodec, consumerOpts, createInbox } from 'nats';
import pg from 'pg';
import { v7 as uuidv7 } from 'uuid';
import type { Dispatcher } from 'undici';
import { createLogger, NATS_SUBJECTS, sha256 } from '@sven/shared';
import type { EventEnvelope, RagIndexRequestEvent, RagIndexResultEvent } from '@sven/shared';

const logger = createLogger('rag-indexer');
const jc = JSONCodec();

const OPENSEARCH_URL = process.env.OPENSEARCH_URL || 'https://localhost:9200';
const OPENSEARCH_USER = process.env.OPENSEARCH_USER || 'admin';
const OPENSEARCH_PASSWORD = process.env.OPENSEARCH_PASSWORD || 'admin';
const OPENSEARCH_TLS_INSECURE = (process.env.OPENSEARCH_TLS_INSECURE || 'false').toLowerCase() === 'true';

const EMBEDDINGS_ENABLED = (process.env.EMBEDDINGS_ENABLED || 'true').toLowerCase() !== 'false';
const EMBEDDINGS_PROVIDER = process.env.EMBEDDINGS_PROVIDER || 'ollama';
const EMBEDDINGS_URL = process.env.EMBEDDINGS_URL || process.env.OLLAMA_URL || 'http://localhost:11434';
const EMBEDDINGS_MODEL = process.env.EMBEDDINGS_MODEL || process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text';
const EMBEDDINGS_DIM = Number(process.env.EMBEDDINGS_DIM || 1536);

const CHUNK_TARGET_TOKENS = 1000;
const CHUNK_OVERLAP_TOKENS = 100;
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

let openSearchDispatcher: Dispatcher | undefined;
let openSearchDispatcherLoaded = false;

async function getOpenSearchDispatcher(): Promise<Dispatcher | undefined> {
  if (openSearchDispatcherLoaded) {
    return openSearchDispatcher;
  }

  openSearchDispatcherLoaded = true;
  if (!OPENSEARCH_TLS_INSECURE) {
    openSearchDispatcher = undefined;
    return openSearchDispatcher;
  }

  try {
    const undici = await import('undici');
    openSearchDispatcher = new undici.Agent({
      connect: {
        rejectUnauthorized: false,
      },
    });
    return openSearchDispatcher;
  } catch (err) {
    throw new Error(
      `OPENSEARCH_TLS_INSECURE=true requires undici Agent support for fetch dispatcher: ${String(err)}`,
    );
  }
}

// ── OpenSearch helpers ──────────────────────────────────────────────────────

async function osRequest(
  method: string,
  path: string,
  body?: unknown,
): Promise<unknown> {
  const url = `${OPENSEARCH_URL}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization:
      'Basic ' + Buffer.from(`${OPENSEARCH_USER}:${OPENSEARCH_PASSWORD}`).toString('base64'),
  };

  const dispatcher = await getOpenSearchDispatcher();
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    ...(dispatcher ? { dispatcher } : {}),
  });

  if (method === 'HEAD') {
    if (res.status === 404) {
      return false;
    }
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OpenSearch ${method} ${path}: ${res.status} ${text}`);
    }
    return true;
  }

  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    throw new Error(`OpenSearch ${method} ${path}: ${res.status} ${text}`);
  }

  const text = await res.text();
  if (!text.trim()) {
    return {};
  }

  return JSON.parse(text);
}

async function ensureIndices(): Promise<void> {
  const docsIndexExists = await osRequest('HEAD', '/sven_docs').catch(() => false);
  if (!docsIndexExists) {
    await osRequest('PUT', '/sven_docs', {
      mappings: {
        properties: {
          title: { type: 'text' },
          source: { type: 'keyword' },
          source_type: { type: 'keyword' },
          content: { type: 'text' },
          content_hash: { type: 'keyword' },
          visibility: { type: 'keyword' },
          allow_users: { type: 'keyword' },
          allow_chats: { type: 'keyword' },
          metadata: { type: 'object', enabled: false },
          indexed_at: { type: 'date' },
        },
      },
    });
    logger.info('Created sven_docs index');
  }

  const chunksIndexExists = await osRequest('HEAD', '/sven_chunks').catch(() => false);
  if (!chunksIndexExists) {
    await osRequest('PUT', '/sven_chunks', {
      ...(EMBEDDINGS_ENABLED ? { settings: { index: { knn: true } } } : {}),
      mappings: {
        properties: {
          doc_id: { type: 'keyword' },
          chunk_index: { type: 'integer' },
          content: { type: 'text' },
          content_hash: { type: 'keyword' },
          start_offset: { type: 'integer' },
          end_offset: { type: 'integer' },
          visibility: { type: 'keyword' },
          allow_users: { type: 'keyword' },
          allow_chats: { type: 'keyword' },
          source: { type: 'keyword' },
          indexed_at: { type: 'date' },
          ...(EMBEDDINGS_ENABLED ? { embedding: { type: 'knn_vector', dimension: EMBEDDINGS_DIM } } : {}),
        },
      },
    });
    logger.info('Created sven_chunks index');
  }
}

// ── Chunking ────────────────────────────────────────────────────────────────

interface Chunk {
  content: string;
  startOffset: number;
  endOffset: number;
  chunkIndex: number;
}

interface RagQueryRequestEvent {
  query_id: string;
  query: string;
  filters?: {
    knowledge_type?: string;
    organization_id?: string;
    source_tenant_id?: string;
  };
  top_k?: number;
}

interface RagQueryResultRow {
  document_id: string;
  title: string;
  snippet: string;
  score: number;
  match_type: 'text';
}

function isRagIndexRequestEvent(event: unknown): event is RagIndexRequestEvent {
  if (!event || typeof event !== 'object') return false;
  const value = event as Record<string, unknown>;
  return typeof value.source === 'string' && typeof value.content === 'string';
}

function isRagQueryRequestEvent(event: unknown): event is RagQueryRequestEvent {
  if (!event || typeof event !== 'object') return false;
  const value = event as Record<string, unknown>;
  return typeof value.query_id === 'string' && typeof value.query === 'string';
}

function safeSnippet(content: string, maxLength = 240): string {
  const normalized = String(content || '').replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength).trimEnd()}...`;
}

async function runRagQuery(event: RagQueryRequestEvent): Promise<RagQueryResultRow[]> {
  const topK = Math.min(Math.max(Number(event.top_k || 5), 1), 20);
  const candidateSize = Math.min(Math.max(topK * 8, 20), 200);
  const chunkSearch = await osRequest('POST', '/sven_chunks/_search', {
    size: candidateSize,
    query: {
      bool: {
        must: [
          {
            multi_match: {
              query: event.query,
              fields: ['content^2', 'source'],
              type: 'best_fields',
            },
          },
        ],
      },
    },
    sort: [{ _score: 'desc' }],
  }) as any;

  const hits = Array.isArray(chunkSearch?.hits?.hits) ? chunkSearch.hits.hits : [];
  if (hits.length === 0) {
    return [];
  }

  const docIds = Array.from(
    new Set(
      hits
        .map((hit: any) => String(hit?._source?.doc_id || '').trim())
        .filter((id: string) => id.length > 0),
    ),
  );
  if (docIds.length === 0) {
    return [];
  }

  const docsResponse = await osRequest('POST', '/sven_docs/_mget', { ids: docIds }) as any;
  const docs = Array.isArray(docsResponse?.docs) ? docsResponse.docs : [];
  const docById = new Map<string, any>();
  for (const doc of docs) {
    const id = String(doc?._id || '').trim();
    if (!id || doc?.found !== true) continue;
    docById.set(id, doc?._source || {});
  }

  const requiredKnowledgeType = String(event.filters?.knowledge_type || '').trim();
  const requiredOrganizationId = String(event.filters?.organization_id || '').trim();
  const requiredSourceTenantId = String(event.filters?.source_tenant_id || '').trim();

  const merged = new Map<string, RagQueryResultRow>();
  for (const hit of hits) {
    const source = hit?._source || {};
    const docId = String(source.doc_id || '').trim();
    if (!docId) continue;

    const docSource = docById.get(docId) || {};
    const metadata = docSource.metadata && typeof docSource.metadata === 'object'
      ? docSource.metadata as Record<string, unknown>
      : {};

    if (requiredKnowledgeType && String(metadata.knowledge_type || '').trim() !== requiredKnowledgeType) {
      continue;
    }
    if (requiredOrganizationId && String(metadata.organization_id || '').trim() !== requiredOrganizationId) {
      continue;
    }
    if (requiredSourceTenantId && String(metadata.source_tenant_id || '').trim() !== requiredSourceTenantId) {
      continue;
    }

    const score = Number(hit?._score || 0);
    const current = merged.get(docId);
    if (current && current.score >= score) {
      continue;
    }

    merged.set(docId, {
      document_id: docId,
      title: String(docSource.title || docSource.source || source.source || docId),
      snippet: safeSnippet(String(source.content || '')),
      score,
      match_type: 'text',
    });
  }

  return Array.from(merged.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

function chunkText(text: string): Chunk[] {
  const chunks: Chunk[] = [];
  // Approximate tokens as words (4 chars = ~1 token)
  const words = text.split(/\s+/);
  const targetWords = CHUNK_TARGET_TOKENS;
  const overlapWords = CHUNK_OVERLAP_TOKENS;

  let i = 0;
  let chunkIndex = 0;

  while (i < words.length) {
    const end = Math.min(i + targetWords, words.length);
    const chunkWords = words.slice(i, end);
    const content = chunkWords.join(' ');

    // Calculate approximate character offsets
    const startOffset = words.slice(0, i).join(' ').length + (i > 0 ? 1 : 0);
    const endOffset = startOffset + content.length;

    chunks.push({ content, startOffset, endOffset, chunkIndex });
    chunkIndex++;

    const step = targetWords - overlapWords;
    i += step > 0 ? step : targetWords;
  }

  return chunks;
}

// ── Heading-aware chunking ──────────────────────────────────────────────────

function chunkByHeadings(text: string): Chunk[] {
  // Split by markdown headings first
  const sections = text.split(/(?=^#{1,3}\s)/m);

  const chunks: Chunk[] = [];
  let chunkIndex = 0;
  let offset = 0;

  for (const section of sections) {
    if (!section.trim()) {
      offset += section.length;
      continue;
    }

    // If section is too large, sub-chunk by paragraph
    const words = section.split(/\s+/);
    if (words.length > CHUNK_TARGET_TOKENS * 1.5) {
      const subChunks = chunkText(section);
      for (const sc of subChunks) {
        chunks.push({
          content: sc.content,
          startOffset: offset + sc.startOffset,
          endOffset: offset + sc.endOffset,
          chunkIndex: chunkIndex++,
        });
      }
    } else {
      chunks.push({
        content: section.trim(),
        startOffset: offset,
        endOffset: offset + section.length,
        chunkIndex: chunkIndex++,
      });
    }

    offset += section.length;
  }

  return chunks;
}

// ── Embeddings ─────────────────────────────────────────────────────────────

function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}

async function embedText(text: string): Promise<number[] | null> {
  if (!EMBEDDINGS_ENABLED) {
    return null;
  }

  if (EMBEDDINGS_PROVIDER !== 'ollama') {
    throw new Error(`Unsupported embeddings provider: ${EMBEDDINGS_PROVIDER}`);
  }

  const response = await fetch(`${EMBEDDINGS_URL}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: EMBEDDINGS_MODEL, prompt: text }),
  });

  if (!response.ok) {
    throw new Error(`Embeddings error: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as { embedding?: number[] };
  const embedding = Array.isArray(data.embedding) ? data.embedding : null;

  if (!embedding || !embedding.length) {
    return null;
  }

  if (embedding.length !== EMBEDDINGS_DIM) {
    logger.warn('Embedding dimension mismatch', {
      expected: EMBEDDINGS_DIM,
      received: embedding.length,
    });
    return null;
  }

  return embedding as number[];
}

// ── Index a document ────────────────────────────────────────────────────────

async function indexDocument(
  pool: pg.Pool,
  event: RagIndexRequestEvent,
): Promise<{ doc_id: string; chunks_indexed: number }> {
  const docId = uuidv7();
  const contentHash = sha256(event.content);

  // Check for duplicate (same source + hash = skip)
  const existing = await osRequest('POST', '/sven_docs/_search', {
    query: {
      bool: {
        must: [
          { term: { source: event.source } },
          { term: { content_hash: contentHash } },
        ],
      },
    },
    size: 1,
  }) as any;

  if (existing?.hits?.total?.value > 0) {
    logger.info('Document unchanged, skipping', { source: event.source });
    return { doc_id: existing.hits.hits[0]._id, chunks_indexed: 0 };
  }

  // Delete old version if exists
  await osRequest('POST', '/sven_docs/_delete_by_query', {
    query: { term: { source: event.source } },
  });
  await osRequest('POST', '/sven_chunks/_delete_by_query', {
    query: { term: { source: event.source } },
  });

  if (EMBEDDINGS_ENABLED) {
    await pool.query('DELETE FROM rag_embeddings WHERE source = $1', [event.source]);
  }

  // Index document
  await osRequest('PUT', `/sven_docs/_doc/${docId}`, {
    title: event.title || event.source,
    source: event.source,
    source_type: event.source_type || 'file',
    content: event.content,
    content_hash: contentHash,
    visibility: event.visibility || 'global',
    allow_users: event.allow_users || [],
    allow_chats: event.allow_chats || [],
    metadata: event.metadata || {},
    indexed_at: new Date().toISOString(),
  });

  // Chunk and index
  const chunks = chunkByHeadings(event.content);

  for (const chunk of chunks) {
    const chunkId = `${docId}_${chunk.chunkIndex}`;
    let embedding: number[] | null = null;
    if (EMBEDDINGS_ENABLED) {
      try {
        embedding = await embedText(chunk.content);
      } catch (err) {
        logger.warn('Embedding generation failed', { err: String(err) });
      }
    }

    await osRequest('PUT', `/sven_chunks/_doc/${chunkId}`, {
      doc_id: docId,
      chunk_index: chunk.chunkIndex,
      content: chunk.content,
      content_hash: sha256(chunk.content),
      start_offset: chunk.startOffset,
      end_offset: chunk.endOffset,
      visibility: event.visibility || 'global',
      allow_users: event.allow_users || [],
      allow_chats: event.allow_chats || [],
      source: event.source,
      indexed_at: new Date().toISOString(),
      ...(embedding ? { embedding } : {}),
    });

    if (EMBEDDINGS_ENABLED && embedding) {
      const vectorLiteral = toVectorLiteral(embedding);
      await pool.query(
        `INSERT INTO rag_embeddings
          (id, doc_id, chunk_id, chunk_index, source, source_type, content_hash, visibility, allow_users, allow_chats, embedding, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::vector, $12)`,
        [
          uuidv7(),
          docId,
          chunkId,
          chunk.chunkIndex,
          event.source,
          event.source_type || 'file',
          sha256(chunk.content),
          event.visibility || 'global',
          event.allow_users || [],
          event.allow_chats || [],
          vectorLiteral,
          JSON.stringify({
            start_offset: chunk.startOffset,
            end_offset: chunk.endOffset,
            indexed_at: new Date().toISOString(),
          }),
        ],
      );
    }
  }

  // Also store embedding in pgvector if content is small enough
  // (embedding generation would go through a separate embeddings service)

  logger.info('Document indexed', {
    doc_id: docId,
    source: event.source,
    chunks: chunks.length,
  });

  return { doc_id: docId, chunks_indexed: chunks.length };
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  if (OPENSEARCH_TLS_INSECURE) {
    logger.warn('OpenSearch TLS verification disabled by configuration', {
      env: 'OPENSEARCH_TLS_INSECURE',
      requirement: 'Use only for self-signed development endpoints',
    });
  } else {
    logger.info('OpenSearch TLS verification enabled', {
      certificate_trust: 'system_ca_or_custom_trust_store_required',
    });
  }

  const nc = await connect({
    servers: process.env.NATS_URL || 'nats://localhost:4222',
    name: 'rag-indexer',
    maxReconnectAttempts: -1,
  });
  logger.info('Connected to NATS');

  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://sven:sven@localhost:5432/sven',
    max: 5,
  });
  logger.info('Connected to Postgres');

  // Ensure OpenSearch indices exist
  try {
    await ensureIndices();
  } catch (err) {
    logger.warn('OpenSearch index creation deferred (not yet available)', { err: String(err) });
  }

  const js = nc.jetstream();

  // Subscribe to RAG index requests
  const opts = consumerOpts();
  opts.durable('rag-indexer');
  opts.deliverTo(createInbox());
  opts.manualAck();
  opts.ackExplicit();
  const sub = await js.subscribe('rag.index.request', opts);

  logger.info('Subscribed to rag.index.request, processing...');

  for await (const msg of sub) {
    try {
      const envelope = jc.decode(msg.data) as EventEnvelope<Record<string, unknown>>;
      const event = envelope.data;

      if (isRagIndexRequestEvent(event)) {
        logger.info('Processing RAG index request', {
          source: event.source,
          source_type: event.source_type,
        });

        const result = await indexDocument(pool, event);

        const resultEnvelope: EventEnvelope<RagIndexResultEvent> = {
          schema_version: '1.0',
          event_id: uuidv7(),
          occurred_at: new Date().toISOString(),
          data: {
            doc_id: result.doc_id,
            source: event.source,
            chunks_indexed: result.chunks_indexed,
            status: 'completed',
          },
        };

        nc.publish(NATS_SUBJECTS.RAG_INDEX_RESULT, jc.encode(resultEnvelope));
        msg.ack();
        continue;
      }

      if (isRagQueryRequestEvent(event)) {
        logger.info('Processing RAG query request', {
          query_id: event.query_id,
          query_length: event.query.length,
          top_k: event.top_k,
        });

        const results = await runRagQuery(event);
        const queryResultEnvelope: EventEnvelope<Record<string, unknown>> = {
          schema_version: '1.0',
          event_id: uuidv7(),
          occurred_at: new Date().toISOString(),
          data: {
            query_id: event.query_id,
            status: 'completed',
            results,
          },
        };
        nc.publish(NATS_SUBJECTS.RAG_INDEX_RESULT, jc.encode(queryResultEnvelope));
        msg.ack();
        continue;
      }

      logger.warn('Unsupported rag.index.request payload shape; skipping', {
        keys: Object.keys(event || {}).slice(0, 12),
      });
      msg.ack();
    } catch (err) {
      logger.error('Error processing RAG index request', { err: String(err) });
      msg.nak(10000);
    }
  }
}

main().catch((err) => {
  logger.fatal('RAG indexer failed', { err: String(err) });
  process.exit(1);
});
