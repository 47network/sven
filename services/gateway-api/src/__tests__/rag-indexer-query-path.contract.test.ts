import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from '@jest/globals';

const RAG_INDEXER = path.resolve(__dirname, '../../../rag-indexer/src/index.ts');

describe('rag-indexer query path contract', () => {
  it('keeps query-request detection and query execution branch for rag.index.request', async () => {
    const source = await fs.readFile(RAG_INDEXER, 'utf8');

    expect(source).toContain('function isRagQueryRequestEvent(event: unknown): event is RagQueryRequestEvent {');
    expect(source).toContain("return typeof value.query_id === 'string' && typeof value.query === 'string';");
    expect(source).toContain('if (isRagQueryRequestEvent(event)) {');
    expect(source).toContain('const results = await runRagQuery(event);');
  });

  it('publishes query responses on rag.index.result using correlation query_id', async () => {
    const source = await fs.readFile(RAG_INDEXER, 'utf8');

    expect(source).toContain('const queryResultEnvelope: EventEnvelope<Record<string, unknown>> = {');
    expect(source).toContain('query_id: event.query_id,');
    expect(source).toContain('nc.publish(NATS_SUBJECTS.RAG_INDEX_RESULT, jc.encode(queryResultEnvelope));');
  });
});
