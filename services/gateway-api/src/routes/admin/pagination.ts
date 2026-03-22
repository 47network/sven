export type ParsedPagination =
  | { ok: true; page: number; perPage: number; offset: number }
  | { ok: false; message: string };

function parsePositiveInteger(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === '') return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 1) {
    return null;
  }
  return parsed;
}

export function parsePaginationQuery(
  query: { page?: string; per_page?: string },
  options?: { defaultPage?: number; defaultPerPage?: number; maxPerPage?: number },
): ParsedPagination {
  const defaultPage = options?.defaultPage ?? 1;
  const defaultPerPage = options?.defaultPerPage ?? 20;
  const maxPerPage = options?.maxPerPage ?? 100;

  const parsedPage = parsePositiveInteger(query.page);
  if (query.page !== undefined && parsedPage === null) {
    return { ok: false, message: 'page must be a positive integer when provided' };
  }

  const parsedPerPage = parsePositiveInteger(query.per_page);
  if (query.per_page !== undefined && parsedPerPage === null) {
    return { ok: false, message: 'per_page must be a positive integer when provided' };
  }

  const page = parsedPage ?? defaultPage;
  const perPage = Math.min(parsedPerPage ?? defaultPerPage, maxPerPage);
  const offset = (page - 1) * perPage;
  return { ok: true, page, perPage, offset };
}
