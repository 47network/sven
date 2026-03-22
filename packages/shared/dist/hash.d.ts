/**
 * Compute SHA-256 hex hash of a string.
 */
export declare function sha256(input: string): string;
/**
 * Compute canonical I/O hash for tool run attestation.
 * Deterministic JSON serialization ➜ SHA-256.
 */
export declare function canonicalIoHash(inputs: Record<string, unknown>, outputs: Record<string, unknown>): string;
/**
 * Compute run hash for the audit chain.
 * run_hash = SHA-256(prev_hash + canonical_io_sha256)
 */
export declare function computeRunHash(prevHash: string, canonicalIoSha256: string): string;
//# sourceMappingURL=hash.d.ts.map