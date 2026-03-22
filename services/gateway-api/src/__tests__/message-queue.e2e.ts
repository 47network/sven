import path from 'node:path';
import fs from 'node:fs/promises';
import { describe, expect, it } from '@jest/globals';

const GATEWAY_CANVAS = path.resolve(__dirname, '../routes/canvas.ts');
const RUNTIME_INDEX = path.resolve(__dirname, '../../../agent-runtime/src/index.ts');
const QUEUE_MIGRATION = path.resolve(__dirname, '../db/migrations/087_chat_message_queue.sql');

describe('A6 Message Queue', () => {
  it('Gateway: busy chat path queues message and returns queued payload', async () => {
    const source = await fs.readFile(GATEWAY_CANVAS, 'utf8');
    expect(source.includes('QUEUE_DEPTH_EXCEEDED')).toBe(true);
    expect(source.includes("status: 'queued'")).toBe(true);
    expect(source.includes('queue_position')).toBe(true);
    expect(source.includes("reply.status(202)")).toBe(true);
  });

  it('Gateway: queued messages are appended to message list tail with FIFO position', async () => {
    const source = await fs.readFile(GATEWAY_CANVAS, 'utf8');
    expect(source.includes('FROM chat_message_queue q')).toBe(true);
    expect(source.includes("q.status = 'queued'")).toBe(true);
    expect(source.includes('ROW_NUMBER() OVER (ORDER BY q.created_at ASC, q.id ASC)')).toBe(true);
    expect(source.includes('rows = [...rows, ...queuedRows]')).toBe(true);
  });

  it('Gateway: queued messages can be cancelled before dispatch', async () => {
    const source = await fs.readFile(GATEWAY_CANVAS, 'utf8');
    expect(source.includes("/v1/chats/:chatId/queue/:queueId")).toBe(true);
    expect(source.includes("SET status = 'cancelled'")).toBe(true);
    expect(source.includes('Queued message not found or already dispatched')).toBe(true);
  });

  it('Runtime: queued messages are dispatched FIFO and marked dispatched', async () => {
    const source = await fs.readFile(RUNTIME_INDEX, 'utf8');
    expect(source.includes('dispatchNextQueuedCanvasMessage')).toBe(true);
    expect(source.includes("status IN ('queued', 'failed')")).toBe(true);
    expect(source.includes('ORDER BY created_at ASC, id ASC')).toBe(true);
    expect(source.includes("SET status = 'dispatched', dispatched_at = NOW()")).toBe(true);
  });

  it('Migration: queue tables + default settings are created', async () => {
    const migration = await fs.readFile(QUEUE_MIGRATION, 'utf8');
    expect(migration.includes('CREATE TABLE IF NOT EXISTS chat_processing_state')).toBe(true);
    expect(migration.includes('CREATE TABLE IF NOT EXISTS chat_message_queue')).toBe(true);
    expect(migration.includes('chat.messageQueue.enabled')).toBe(true);
    expect(migration.includes('chat.messageQueue.maxDepth')).toBe(true);
    expect(migration.includes('chat.messageQueue.timeoutMinutes')).toBe(true);
  });
});
