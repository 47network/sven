import { createHash } from 'node:crypto';
/**
 * Compute SHA-256 hex hash of a string.
 */
export function sha256(input) {
    return createHash('sha256').update(input, 'utf8').digest('hex');
}
/**
 * Compute canonical I/O hash for tool run attestation.
 * Deterministic JSON serialization ➜ SHA-256.
 */
export function canonicalIoHash(inputs, outputs) {
    const canonical = JSON.stringify({ inputs, outputs }, Object.keys({ inputs, outputs }).sort());
    return sha256(canonical);
}
/**
 * Compute run hash for the audit chain.
 * run_hash = SHA-256(prev_hash + canonical_io_sha256)
 */
export function computeRunHash(prevHash, canonicalIoSha256) {
    return sha256(prevHash + canonicalIoSha256);
}
//# sourceMappingURL=hash.js.map