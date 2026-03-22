import type { FastifyRequest } from 'fastify';

const CORRELATION_ID_HEADER = 'x-correlation-id';
const CORRELATION_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

function normalizeCandidate(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  return CORRELATION_ID_PATTERN.test(trimmed) ? trimmed : '';
}

export function getRequestCorrelationId(request: FastifyRequest): string {
  const header = request.headers[CORRELATION_ID_HEADER];
  const fromHeader = Array.isArray(header) ? normalizeCandidate(header[0]) : normalizeCandidate(header);
  if (fromHeader) return fromHeader;
  return String(request.id || '').trim() || 'unknown';
}

export function withCorrelationMetadata(
  metadata: Record<string, unknown> | undefined,
  correlationId: string,
): Record<string, unknown> {
  return {
    ...(metadata || {}),
    correlation_id: correlationId,
  };
}
