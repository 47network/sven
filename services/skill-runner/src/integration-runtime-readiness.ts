export function buildMissingSettingsMessage(
  integrationType: string,
  missingSettings: string[],
  readinessPrefix?: string,
): string {
  const missing = missingSettings.map((item) => String(item || '').trim()).filter(Boolean);
  const suffix = `Integration ${integrationType} is not ready: missing required settings (${missing.join(', ')})`;
  return readinessPrefix ? `${readinessPrefix}. ${suffix}` : suffix;
}

export function blockReadinessWhenSettingsMissing(
  integrationType: string,
  missingSettings: string[],
  readinessPrefix?: string,
): { blocked: boolean; message?: string } {
  const missing = missingSettings.map((item) => String(item || '').trim()).filter(Boolean);
  if (missing.length === 0) {
    return { blocked: false };
  }
  return {
    blocked: true,
    message: buildMissingSettingsMessage(integrationType, missing, readinessPrefix),
  };
}
