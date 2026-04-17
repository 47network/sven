import { FastifyInstance } from 'fastify';
import pg from 'pg';
import { v7 as uuidv7 } from 'uuid';
import { requireRole } from './auth.js';
import { createHash } from 'crypto';
import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { pipeline } from 'stream/promises';
import path from 'path';

function resolveStoragePath(baseDir: string, storageKey: unknown): string | null {
  const baseDirValue = String(baseDir || '').trim();
  if (!baseDirValue) return null;
  const base = path.resolve(baseDirValue);
  const key = String(storageKey || '').trim();
  if (!key) return null;
  const candidate = path.resolve(base, key);
  const rel = path.relative(base, candidate);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
    return null;
  }
  return candidate;
}

function toSafeStorageUserSegment(value: unknown): string | null {
  const trimmed = String(value || '').trim();
  const normalized = trimmed.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128);
  if (!normalized) return null;
  return normalized;
}

export async function registerMediaRoutes(app: FastifyInstance, pool: pg.Pool) {
  const requireAuth = requireRole(pool, 'admin', 'user');

  // ── Upload file ──────────────────────────────────────────────
  app.post('/v1/media/upload', {
    preHandler: requireAuth,
  }, async (request: any, reply) => {
    const userId: string = request.userId;
    const chatId = (request.headers['x-chat-id'] as string) || '';
    const contentType = request.headers['content-type'] || '';

    // Must be multipart
    if (!contentType.includes('multipart/form-data')) {
      return reply.status(400).send({ success: false, error: 'multipart/form-data required' });
    }

    // Get storage config
    const configResult = await pool.query(
      `SELECT * FROM media_storage_config WHERE id = 'default'`,
    );
    const config = configResult.rows[0] || {
      backend: 'local',
      local_path: '/data/uploads',
      max_file_size_mb: 100,
      allowed_mime_types: ['image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'video/mp4', 'video/webm', 'audio/mpeg', 'audio/ogg',
        'application/pdf', 'text/plain'],
    };

    const maxBytes = (config.max_file_size_mb || 100) * 1024 * 1024;
    const data = await request.file({ limits: { fileSize: maxBytes } });

    if (!data) {
      return reply.status(400).send({ success: false, error: 'no file provided' });
    }

    const originalName = data.filename || 'upload';
    const mimeType = data.mimetype || 'application/octet-stream';

    // Validate MIME type
    const allowedTypes: string[] = config.allowed_mime_types || [];
    if (allowedTypes.length > 0 && !allowedTypes.includes(mimeType)) {
      return reply.status(415).send({ success: false, error: `file type ${mimeType} not allowed` });
    }

    const uploadId = uuidv7();
    const ext = path.extname(originalName) || '';
    const safeExt = ext.replace(/[^a-zA-Z0-9.]/g, '').slice(0, 10);
    const storageUserSegment = toSafeStorageUserSegment(userId);
    if (!storageUserSegment) {
      return reply.status(400).send({ success: false, error: 'invalid user context for storage path' });
    }
    const storageKey = `${storageUserSegment}/${uploadId}${safeExt}`;

    // Write to local storage
    const localPath = config.local_path || '/data/uploads';
    const uploadDir = path.join(localPath, storageUserSegment);
    if (!existsSync(uploadDir)) {
      mkdirSync(uploadDir, { recursive: true });
    }

    const filePath = resolveStoragePath(localPath, storageKey);
    if (!filePath) {
      return reply.status(400).send({ success: false, error: 'invalid upload storage path' });
    }
    const hash = createHash('sha256');
    let totalBytes = 0;

    const writeStream = createWriteStream(filePath);
    const transform = new (await import('stream')).Transform({
      transform(chunk, _encoding, callback) {
        totalBytes += chunk.length;
        if (totalBytes > maxBytes) {
          callback(new Error('File exceeds maximum size'));
          return;
        }
        hash.update(chunk);
        callback(null, chunk);
      },
    });

    try {
      await pipeline(data.file, transform, writeStream);
    } catch (err: any) {
      return reply.status(413).send({ success: false, error: err.message || 'upload failed' });
    }

    const checksum = hash.digest('hex');

    // Insert record
    await pool.query(
      `INSERT INTO media_uploads (id, user_id, chat_id, file_name, mime_type, size_bytes,
         storage_backend, storage_key, checksum_sha256, processing_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'ready')`,
      [uploadId, userId, chatId || null, originalName, mimeType, totalBytes,
        config.backend, storageKey, checksum],
    );

    const cdnBase = config.cdn_base_url || '';
    const downloadUrl = cdnBase
      ? `${cdnBase}/${storageKey}`
      : `/v1/media/${uploadId}/download`;

    return reply.status(201).send({
      success: true,
      data: {
        id: uploadId,
        file_name: originalName,
        mime_type: mimeType,
        size_bytes: totalBytes,
        checksum_sha256: checksum,
        url: downloadUrl,
      },
    });
  });

  // ── Download file ────────────────────────────────────────────
  app.get('/v1/media/:mediaId/download', {
    preHandler: requireAuth,
  }, async (request: any, reply) => {
    const { mediaId } = request.params as { mediaId: string };

    const { rows } = await pool.query(
      `SELECT mu.*, msc.local_path, msc.cdn_base_url
       FROM media_uploads mu
       CROSS JOIN media_storage_config msc
       WHERE mu.id = $1 AND msc.id = 'default'`,
      [mediaId],
    );

    if (rows.length === 0) {
      return reply.status(404).send({ success: false, error: 'file not found' });
    }

    const media = rows[0];

    // CDN redirect if configured
    if (media.cdn_base_url) {
      return reply.redirect(`${media.cdn_base_url}/${media.storage_key}`);
    }

    // Local file serve
    const filePath = resolveStoragePath(media.local_path || '/data/uploads', media.storage_key);
    if (!filePath) {
      return reply.status(404).send({ success: false, error: 'file not found' });
    }
    if (!existsSync(filePath)) {
      return reply.status(404).send({ success: false, error: 'file not found on disk' });
    }

    const { createReadStream } = await import('fs');
    const stream = createReadStream(filePath);

    return reply
      .header('Content-Type', media.mime_type)
      .header('Content-Length', media.size_bytes)
      .header('Content-Disposition', `inline; filename="${encodeURIComponent(media.file_name)}"`)
      .header('Cache-Control', 'private, max-age=86400')
      .send(stream);
  });

  // ── Get media thumbnail ─────────────────────────────────────
  app.get('/v1/media/:mediaId/thumbnail', {
    preHandler: requireAuth,
  }, async (request: any, reply) => {
    const { mediaId } = request.params as { mediaId: string };

    const { rows } = await pool.query(
      `SELECT mu.thumbnail_key, msc.local_path, msc.cdn_base_url
       FROM media_uploads mu
       CROSS JOIN media_storage_config msc
       WHERE mu.id = $1 AND msc.id = 'default'`,
      [mediaId],
    );

    if (rows.length === 0 || !rows[0].thumbnail_key) {
      return reply.status(404).send({ success: false, error: 'no thumbnail' });
    }

    const media = rows[0];

    if (media.cdn_base_url) {
      return reply.redirect(`${media.cdn_base_url}/${media.thumbnail_key}`);
    }

    const filePath = resolveStoragePath(media.local_path || '/data/uploads', media.thumbnail_key);
    if (!filePath) {
      return reply.status(404).send({ success: false, error: 'thumbnail not found' });
    }
    if (!existsSync(filePath)) {
      return reply.status(404).send({ success: false, error: 'thumbnail not found' });
    }

    const { createReadStream } = await import('fs');
    return reply
      .header('Content-Type', 'image/webp')
      .header('Cache-Control', 'public, max-age=604800')
      .send(createReadStream(filePath));
  });

  // ── Attach media to message ──────────────────────────────────
  app.post('/v1/media/attach', {
    preHandler: requireAuth,
    schema: {
      body: {
        type: 'object',
        required: ['message_id', 'media_ids'],
        properties: {
          message_id: { type: 'string' },
          media_ids: { type: 'array', items: { type: 'string' }, maxItems: 20 },
        },
      },
    },
  }, async (request: any, reply) => {
    const { message_id, media_ids } = request.body as { message_id: string; media_ids: string[] };

    if (media_ids.length > 0) {
      const insertValues: string[] = [];
      const insertParams: any[] = [];
      let paramIndex = 1;

      for (let i = 0; i < media_ids.length; i++) {
        insertValues.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`);
        insertParams.push(uuidv7(), message_id, media_ids[i], i);
      }

      await pool.query(
        `INSERT INTO message_attachments (id, message_id, media_upload_id, sort_order)
         VALUES ${insertValues.join(', ')}
         ON CONFLICT (message_id, media_upload_id) DO NOTHING`,
        insertParams,
      );

      // Link media to message
      const updateParams = [message_id, media_ids];
      await pool.query(
        `UPDATE media_uploads SET message_id = $1 WHERE id = ANY($2)`,
        updateParams,
      );
    }

    return reply.status(200).send({ success: true });
  });

  // ── Gallery: list media in a chat ────────────────────────────
  app.get('/v1/chats/:chatId/media', {
    preHandler: requireAuth,
  }, async (request: any, reply) => {
    const { chatId } = request.params as { chatId: string };
    const query = request.query as { limit?: string; before?: string; type?: string };
    const limit = Math.min(parseInt(query.limit || '50', 10), 100);
    const mimeFilter = query.type || '';

    let sql = `SELECT id, file_name, mime_type, size_bytes, storage_key, thumbnail_key,
                      width, height, duration_seconds, created_at
               FROM media_uploads WHERE chat_id = $1 AND processing_status = 'ready'`;
    const params: any[] = [chatId];

    if (mimeFilter) {
      params.push(`${mimeFilter}%`);
      sql += ` AND mime_type LIKE $${params.length}`;
    }
    if (query.before) {
      params.push(query.before);
      sql += ` AND created_at < $${params.length}`;
    }

    params.push(limit);
    sql += ` ORDER BY created_at DESC LIMIT $${params.length}`;

    const { rows } = await pool.query(sql, params);

    return reply.status(200).send({
      success: true,
      data: { media: rows, has_more: rows.length === limit },
    });
  });
}
