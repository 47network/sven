export type ScopedSettingsGuardInput = {
  enforceTenantScope: boolean;
  allowGlobalFallback: boolean;
  chatId?: string;
  organizationId?: string | null;
};

export function shouldBlockScopedSettings(input: ScopedSettingsGuardInput): { blocked: boolean; error?: string } {
  if (!input.enforceTenantScope) return { blocked: false };
  if (input.allowGlobalFallback) return { blocked: false };
  const orgId = String(input.organizationId || '').trim();
  if (orgId) return { blocked: false };
  const chatPart = input.chatId ? ` chat_id=${input.chatId}` : '';
  return {
    blocked: true,
    error: `Tenant-scoped integration settings require resolvable organization scope.${chatPart}`.trim(),
  };
}
