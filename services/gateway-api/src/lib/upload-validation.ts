export const DEFAULT_FILE_UPLOAD_MAX_BYTES = 50 * 1024 * 1024;

export function getFileUploadMaxBytes(): number {
  const parsed = Number(process.env.SVEN_FILE_UPLOAD_MAX_BYTES || DEFAULT_FILE_UPLOAD_MAX_BYTES);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : DEFAULT_FILE_UPLOAD_MAX_BYTES;
}

export function estimateBase64DecodedBytes(base64: string): number {
  const normalized = String(base64 || '').replace(/\s+/g, '');
  const padding = normalized.endsWith('==') ? 2 : normalized.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((normalized.length * 3) / 4) - padding);
}

export function isLikelyBase64(value: string): boolean {
  const normalized = String(value || '').replace(/\s+/g, '');
  if (!normalized || normalized.length % 4 !== 0) return false;
  return /^[A-Za-z0-9+/]*={0,2}$/.test(normalized);
}
