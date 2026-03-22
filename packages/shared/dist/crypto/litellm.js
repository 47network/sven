import { createDecipheriv, createHash } from 'node:crypto';
import { createCipheriv, randomBytes } from 'node:crypto';
const PREFIX = 'enc:v1:';
const ALGO = 'aes-256-gcm';
const IV_BYTES = 12;
function base64UrlDecode(input) {
    const normalized = String(input || '').replace(/-/g, '+').replace(/_/g, '/');
    const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
    return Buffer.from(`${normalized}${padding}`, 'base64');
}
function getKey() {
    const raw = String(process.env.SVEN_MASTER_KEY_V1 || '').trim();
    if (!raw)
        return Buffer.alloc(0);
    return createHash('sha256').update(raw, 'utf8').digest();
}
function base64UrlEncode(input) {
    return input.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
export function encryptLiteLlmVirtualKey(value) {
    const input = String(value || '').trim();
    if (!input)
        return '';
    if (input.startsWith(PREFIX))
        return input;
    const key = getKey();
    if (key.length === 0)
        return input;
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGO, key, iv);
    const encrypted = Buffer.concat([cipher.update(input, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${PREFIX}${base64UrlEncode(iv)}.${base64UrlEncode(tag)}.${base64UrlEncode(encrypted)}`;
}
export function decryptLiteLlmVirtualKey(value) {
    const input = String(value || '').trim();
    if (!input)
        return '';
    if (!input.startsWith(PREFIX))
        return input;
    const key = getKey();
    if (key.length === 0)
        return input;
    const payload = input.slice(PREFIX.length);
    const [ivPart, tagPart, encryptedPart] = payload.split('.');
    if (!ivPart || !tagPart || !encryptedPart)
        return input;
    try {
        const iv = base64UrlDecode(ivPart);
        const tag = base64UrlDecode(tagPart);
        const encrypted = base64UrlDecode(encryptedPart);
        const decipher = createDecipheriv(ALGO, key, iv);
        decipher.setAuthTag(tag);
        const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
        return decrypted.toString('utf8');
    }
    catch {
        return input;
    }
}
//# sourceMappingURL=litellm.js.map