// ---------------------------------------------------------------------------
// Env-backed SecretResolver (default). Private keys live in env vars whose
// names are encoded in secret_ref values like "env:VAR_NAME".
// ---------------------------------------------------------------------------
// Production deployments should swap this for a vault-backed resolver (HashiCorp
// Vault, Doppler, 1Password, etc.) by implementing the SecretResolver interface.
// ---------------------------------------------------------------------------

import type { SecretResolver } from './provider.js';

export class EnvSecretResolver implements SecretResolver {
  async resolvePrivateKey(ref: string): Promise<string> {
    const [scheme, name] = ref.split(':', 2);
    if (scheme !== 'env' || !name) throw new Error(`EnvSecretResolver cannot resolve ref '${ref}'`);
    const value = process.env[name];
    if (!value) throw new Error(`env secret '${name}' not set`);
    return value;
  }

  async storePrivateKey(label: string, _key: string): Promise<string> {
    // Env is read-only from the process perspective; callers must set it out-of-band.
    // We return the reference the operator should use.
    const envName = `SVEN_TREASURY_KEY_${label.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`;
    return `env:${envName}`;
  }
}
