/**
 * React Query hooks for every admin API endpoint.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type AgentStateRecord, type ChatMessageRecord, type ToolRunRecord } from './api';

// ── Auth ──
export function useMe(enabled = true) {
  return useQuery({ queryKey: ['me'], queryFn: api.auth.me, retry: false, staleTime: 60_000, enabled });
}

// ── Accounts ──
export function useAccounts(enabled = true) {
  return useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const res = await api.accounts.list();
      return res.data.rows;
    },
    enabled,
  });
}
export function useCreateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.accounts.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts'] }),
  });
}
export function useActivateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.accounts.activate,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['accounts'] });
      await qc.invalidateQueries({ queryKey: ['me'] });
    },
  });
}
export function useAddAccountMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ accountId, data }: { accountId: string; data: { user_id: string; role?: string } }) =>
      api.accounts.addMember(accountId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts'] }),
  });
}

// ── Users ──
export function useUsers() {
  return useQuery({ queryKey: ['users'], queryFn: api.users.list });
}
export function useUser(id: string) {
  return useQuery({ queryKey: ['users', id], queryFn: () => api.users.get(id), enabled: !!id });
}
export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.users.create, onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }) });
}
export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => api.users.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}
export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.users.delete, onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }) });
}
export function useUserIdentityLinks(userId: string, enabled = true) {
  return useQuery({
    queryKey: ['users', userId, 'identity-links'],
    queryFn: () => api.users.listIdentityLinks(userId),
    enabled: !!userId && enabled,
  });
}
export function useCreateUserIdentityLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, data }: { userId: string; data: { channel_type: string; channel_user_id: string } }) =>
      api.users.createIdentityLink(userId, data),
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ['users', vars.userId, 'identity-links'] });
      qc.invalidateQueries({ queryKey: ['users', vars.userId] });
    },
  });
}
export function useVerifyUserIdentityLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, linkId, code }: { userId: string; linkId: string; code?: string }) =>
      api.users.verifyIdentityLink(userId, linkId, code),
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ['users', vars.userId, 'identity-links'] });
      qc.invalidateQueries({ queryKey: ['users', vars.userId] });
    },
  });
}
export function useDeleteUserIdentityLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, linkId }: { userId: string; linkId: string }) =>
      api.users.deleteIdentityLink(userId, linkId),
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ['users', vars.userId, 'identity-links'] });
      qc.invalidateQueries({ queryKey: ['users', vars.userId] });
    },
  });
}

// ── Chats ──
export function useChats(enabled = true) {
  return useQuery({ queryKey: ['chats'], queryFn: api.chats.list, enabled });
}
export function useChat(id: string) {
  return useQuery({ queryKey: ['chats', id], queryFn: () => api.chats.get(id), enabled: !!id });
}
export function useChatMembers(chatId: string) {
  return useQuery({ queryKey: ['chats', chatId, 'members'], queryFn: () => api.chats.members(chatId), enabled: !!chatId });
}
export function useChatMessages(chatId: string) {
  return useQuery<{ rows: ChatMessageRecord[]; has_more: boolean }>({
    queryKey: ['chats', chatId, 'messages'],
    queryFn: async () => (await api.chats.messages(chatId)).data,
    enabled: !!chatId,
    refetchInterval: 15000,
  });
}
export function useDebugContext(sessionId: string, enabled = false) {
  return useQuery({
    queryKey: ['debug', 'context', sessionId],
    queryFn: () => api.debug.context(sessionId),
    enabled: !!sessionId && enabled,
  });
}
export function useUpdateCheckerStatus(enabled = true) {
  return useQuery({
    queryKey: ['update-checker', 'status'],
    queryFn: api.updateChecker.status,
    enabled,
    refetchInterval: 60_000,
  });
}
export function useUpdateCheckerCheck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.updateChecker.checkNow,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['update-checker', 'status'] }),
  });
}
export function useUpdateCheckerDismiss() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (version: string) => api.updateChecker.dismiss(version),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['update-checker', 'status'] }),
  });
}
export function useDeploymentConfig(enabled = true) {
  return useQuery({
    queryKey: ['deployment', 'config'],
    queryFn: api.deployment.config,
    enabled,
    refetchInterval: 30_000,
  });
}
export function useSetDeploymentMode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (mode: 'personal' | 'multi_user') => api.deployment.setMode(mode),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deployment', 'config'] }),
  });
}
export function useDevices(
  params?: { status?: string; type?: string },
  enabled = true,
) {
  return useQuery({
    queryKey: ['devices', params],
    queryFn: () => api.devices.list(params),
    enabled,
    refetchInterval: 15_000,
  });
}
export function useDeviceDetail(deviceId?: string, enabled = true) {
  return useQuery({
    queryKey: ['devices', deviceId, 'detail'],
    queryFn: () => api.devices.get(deviceId || ''),
    enabled: Boolean(deviceId) && enabled,
    refetchInterval: 10_000,
  });
}
export function useCreateDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.devices.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['devices'] }),
  });
}
export function useUpdateDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; capabilities?: string[]; config?: Record<string, unknown> } }) =>
      api.devices.update(id, data),
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ['devices'] });
      qc.invalidateQueries({ queryKey: ['devices', vars.id, 'detail'] });
    },
  });
}
export function useDeleteDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.devices.remove,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['devices'] }),
  });
}
export function useConfirmDevicePairing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, pairingCode }: { id: string; pairingCode: string }) => api.devices.confirmPairing(id, pairingCode),
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ['devices'] });
      qc.invalidateQueries({ queryKey: ['devices', vars.id, 'detail'] });
    },
  });
}
export function useRegenerateDeviceApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.devices.regenerateApiKey,
    onSuccess: (_res, id) => {
      qc.invalidateQueries({ queryKey: ['devices'] });
      qc.invalidateQueries({ queryKey: ['devices', id, 'detail'] });
    },
  });
}
export function useSendDeviceCommand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, command, payload }: { id: string; command: string; payload?: Record<string, unknown> }) =>
      api.devices.sendCommand(id, command, payload),
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ['devices'] });
      qc.invalidateQueries({ queryKey: ['devices', vars.id, 'detail'] });
    },
  });
}
export function useTunnelStatus(enabled = true) {
  return useQuery({
    queryKey: ['tunnel', 'status'],
    queryFn: api.tunnel.status,
    enabled,
    refetchInterval: 15_000,
  });
}
export function useCommunityStatus(enabled = true) {
  return useQuery({
    queryKey: ['community', 'status'],
    queryFn: api.community.status,
    enabled,
    refetchInterval: 30_000,
  });
}

export function useCommunityAccountsStatus(enabled = true) {
  return useQuery({
    queryKey: ['community', 'accounts', 'status'],
    queryFn: api.community.accountsStatus,
    enabled,
    refetchInterval: 30_000,
  });
}

export function useCommunityAccounts(
  params?: { limit?: number; verified?: 'true' | 'false'; q?: string },
  enabled = true,
) {
  return useQuery({
    queryKey: ['community', 'accounts', params],
    queryFn: () => api.community.accounts(params),
    enabled,
    refetchInterval: 30_000,
  });
}

export function useCommunityAccessRequests(
  params?: { limit?: number; status?: 'pending_review' | 'approved' | 'rejected' },
  enabled = true,
) {
  return useQuery({
    queryKey: ['community', 'access-requests', params],
    queryFn: () => api.community.accessRequests(params),
    enabled,
    refetchInterval: 30_000,
  });
}

export function useUpdateCommunityAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      accountId,
      reputation,
      verified,
    }: {
      accountId: string;
      reputation?: number;
      verified?: boolean;
    }) =>
      api.community.updateAccount(accountId, {
        reputation,
        verified,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['community', 'accounts'] });
      qc.invalidateQueries({ queryKey: ['community', 'accounts', 'status'] });
    },
  });
}

export function useResolveCommunityAccessRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      requestId,
      status,
      reviewNote,
    }: {
      requestId: string;
      status: 'approved' | 'rejected';
      reviewNote?: string;
    }) =>
      api.community.resolveAccessRequest(requestId, {
        status,
        review_note: reviewNote,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['community', 'access-requests'] });
      qc.invalidateQueries({ queryKey: ['community', 'accounts'] });
      qc.invalidateQueries({ queryKey: ['community', 'accounts', 'status'] });
    },
  });
}

export function useEditorTree(path?: string) {
  return useQuery({
    queryKey: ['editor', 'tree', path || '.'],
    queryFn: () => api.editor.tree(path),
  });
}
export function useSendChatMessage(chatId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (text: string) => api.chats.send(chatId, text),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chats', chatId, 'messages'] }),
  });
}
export function useCancelQueuedMessage(chatId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (queueId: string) => api.chats.cancelQueued(chatId, queueId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chats', chatId, 'messages'] }),
  });
}

export function useAgentState(chatId: string) {
  return useQuery<AgentStateRecord>({
    queryKey: ['chats', chatId, 'agent-state'],
    queryFn: async () => (await api.chats.agentState(chatId)).data,
    enabled: !!chatId,
    refetchInterval: 10000,
  });
}

export function usePauseAgent(chatId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.chats.pauseAgent(chatId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chats', chatId, 'agent-state'] }),
  });
}

export function useResumeAgent(chatId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.chats.resumeAgent(chatId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chats', chatId, 'agent-state'] }),
  });
}

export function useNudgeAgent(chatId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.chats.nudgeAgent(chatId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chats', chatId, 'agent-state'] });
      qc.invalidateQueries({ queryKey: ['chats', chatId, 'messages'] });
    },
  });
}

// ── Approvals ──
export function useApprovals(status?: string) {
  return useQuery({ queryKey: ['approvals', status], queryFn: () => api.approvals.list(status) });
}
export function useApproval(id: string) {
  return useQuery({ queryKey: ['approvals', id], queryFn: () => api.approvals.get(id), enabled: !!id });
}
export function useVoteApproval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      decision,
      reason,
      confirmPhrase,
    }: {
      id: string;
      decision: 'approve' | 'deny';
      reason: string;
      confirmPhrase: string;
    }) => api.approvals.vote(id, decision, reason, confirmPhrase),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['approvals'] }),
  });
}

// ── Pairing ──
export function usePairingRequests(
  params?: { status?: string; channel?: string; limit?: number },
  enabled = true,
) {
  return useQuery({
    queryKey: ['pairing', params],
    queryFn: () => api.pairing.list(params),
    enabled,
    refetchInterval: 10_000,
  });
}
export function useApprovePairing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ channel, code }: { channel: string; code: string }) => api.pairing.approve(channel, code),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pairing'] }),
  });
}
export function useDenyPairing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ channel, code, block }: { channel: string; code: string; block?: boolean }) =>
      api.pairing.deny(channel, code, block),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pairing'] }),
  });
}

// ── Tool Runs ──
export function useToolRuns(params?: { tool_name?: string; status?: string; limit?: number; chat_id?: string }) {
  return useQuery<{ rows: ToolRunRecord[] }>({
    queryKey: ['tool-runs', params],
    queryFn: () => api.toolRuns.list(params),
  });
}
export function useToolRun(id: string) {
  return useQuery<ToolRunRecord>({
    queryKey: ['tool-runs', id],
    queryFn: () => api.toolRuns.get(id),
    enabled: !!id,
  });
}

export function useAuditExport(params?: { from?: string; to?: string }) {
  return useQuery({
    queryKey: ['tool-runs', 'audit-export', params],
    queryFn: () => api.toolRuns.auditExport(params),
    enabled: false,
  });
}

export function useA2AAuditExport(params?: {
  from?: string;
  to?: string;
  status?: string;
  request_id?: string;
  limit?: number;
}) {
  return useQuery({
    queryKey: ['a2a', 'audit-export', params],
    queryFn: () => api.a2a.auditExport(params),
  });
}

// ── Backups ──
export function useBackupStatus() {
  return useQuery({ queryKey: ['backups', 'status'], queryFn: api.backups.status, refetchInterval: 30_000 });
}
export function useBackupConfigs(enabled = true) {
  return useQuery({ queryKey: ['backups', 'configs'], queryFn: api.backups.configs, enabled });
}
export function useBackups(limit = 50) {
  return useQuery({ queryKey: ['backups', limit], queryFn: () => api.backups.list(limit) });
}
export function useRestoreJobs(limit = 50) {
  return useQuery({ queryKey: ['restores', limit], queryFn: () => api.backups.restores(limit) });
}
export function useStartBackup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ configId }: { configId: string }) => api.backups.start(configId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['backups'] });
      qc.invalidateQueries({ queryKey: ['restores'] });
      qc.invalidateQueries({ queryKey: ['backups', 'configs'] });
    },
  });
}
export function useUpdateBackupConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ configId, data }: { configId: string; data: { enabled?: boolean; scheduleCron?: string; retentionDays?: number; storagePath?: string } }) =>
      api.backups.updateConfig(configId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['backups', 'configs'] });
    },
  });
}
export function useVerifyBackup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ backupId }: { backupId: string }) => api.backups.verify(backupId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['backups'] });
      qc.invalidateQueries({ queryKey: ['restores'] });
    },
  });
}
export function useStartRestore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      backupJobId: string;
      targetEnvironment: string;
      reason?: string;
      userId?: string;
    }) => api.backups.startRestore(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['backups'] });
      qc.invalidateQueries({ queryKey: ['restores'] });
    },
  });
}
export function useUploadBackup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { fileName: string; contentBase64: string; configId?: string }) =>
      api.backups.upload(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['backups'] });
      qc.invalidateQueries({ queryKey: ['restores'] });
    },
  });
}

// ── Permissions ──
export function usePermissions() {
  return useQuery({ queryKey: ['permissions'], queryFn: api.permissions.list });
}
export function useGrantPermission() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.permissions.grant, onSuccess: () => qc.invalidateQueries({ queryKey: ['permissions'] }) });
}
export function useRevokePermission() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.permissions.revoke, onSuccess: () => qc.invalidateQueries({ queryKey: ['permissions'] }) });
}

// ── Settings ──
export function useSettings(enabled = true) {
  return useQuery({ queryKey: ['settings'], queryFn: api.settings.list, enabled });
}
export function useSetting(key: string) {
  return useQuery({ queryKey: ['settings', key], queryFn: () => api.settings.get(key), enabled: !!key });
}
export function useSetSetting() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ key, value }: { key: string; value: unknown }) => api.settings.set(key, value), onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }) });
}
export function useEdgeAdmin47Access() {
  return useQuery({ queryKey: ['settings', 'edge', 'admin47', 'access'], queryFn: api.settings.edgeAdmin47Access });
}
export function useSyncEdgeAdmin47Access() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ reload, reason }: { reload?: boolean; reason: string }) =>
      api.settings.syncEdgeAdmin47Access(reload !== false, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] });
      qc.invalidateQueries({ queryKey: ['settings', 'edge', 'admin47', 'access'] });
    },
  });
}
export function useSsoSettings(enabled = true) {
  return useQuery({ queryKey: ['settings', 'sso'], queryFn: api.settings.getSso, enabled });
}
export function useSetSsoSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.settings.setSso,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings', 'sso'] });
      qc.invalidateQueries({ queryKey: ['settings'] });
    },
  });
}

// ── Registry ──
export function useRegistrySources() {
  return useQuery({ queryKey: ['registry', 'sources'], queryFn: api.registry.sources });
}
export function useCreateRegistrySource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.registry.createSource,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['registry'] }),
  });
}
export function useDeleteRegistrySource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.registry.deleteSource,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['registry'] }),
  });
}
export function useRegistryCatalog(name?: string) {
  return useQuery({ queryKey: ['registry', 'catalog', name], queryFn: () => api.registry.catalog(name) });
}
export function useRegistryInstalled() {
  return useQuery({ queryKey: ['registry', 'installed'], queryFn: api.registry.installed });
}
export function useRegistryQuarantine() {
  return useQuery({ queryKey: ['registry', 'quarantine'], queryFn: api.registry.quarantine });
}
export function useInstallSkill() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.registry.install, onSuccess: () => qc.invalidateQueries({ queryKey: ['registry'] }) });
}
export function usePromoteSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reviewReason }: { id: string; reviewReason: string }) => api.registry.promote(id, reviewReason),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['registry'] }),
  });
}
export function useSetInstalledSkillTrust() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, trustLevel }: { id: string; trustLevel: 'trusted' | 'quarantined' | 'blocked' }) =>
      api.registry.setInstalledTrust(id, trustLevel),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['registry'] }),
  });
}
export function useRemoveInstalledSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.registry.removeInstalled,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['registry'] }),
  });
}

// ── Souls ──
export function useSoulsCatalog(search?: string) {
  return useQuery({ queryKey: ['souls', 'catalog', search], queryFn: () => api.souls.catalog(search) });
}
export function useSoulsInstalled() {
  return useQuery({ queryKey: ['souls', 'installed'], queryFn: api.souls.installed });
}
export function useSoulsSignatures(soulId?: string) {
  return useQuery({ queryKey: ['souls', 'signatures', soulId], queryFn: () => api.souls.signatures(soulId) });
}
export function useInstallSoul() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.souls.install, onSuccess: () => qc.invalidateQueries({ queryKey: ['souls'] }) });
}
export function useActivateSoul() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.souls.activate, onSuccess: () => qc.invalidateQueries({ queryKey: ['souls'] }) });
}
export function useAddSoulSignature() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.souls.addSignature, onSuccess: () => qc.invalidateQueries({ queryKey: ['souls'] }) });
}
export function usePublishSoul() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.souls.publish, onSuccess: () => qc.invalidateQueries({ queryKey: ['souls'] }) });
}

// ── RAG ──
export function useRagCollections() {
  return useQuery({ queryKey: ['rag', 'collections'], queryFn: api.rag.collections });
}
export function useRagSources() {
  return useQuery({ queryKey: ['rag', 'sources'], queryFn: api.rag.sources });
}
export function useRagJobs() {
  return useQuery({ queryKey: ['rag', 'jobs'], queryFn: api.rag.jobs });
}
export function useTriggerRagIndex() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.rag.triggerIndex, onSuccess: () => qc.invalidateQueries({ queryKey: ['rag'] }) });
}

// ── Models ──
export function useModels(enabled = true) {
  return useQuery({ queryKey: ['models'], queryFn: api.models.list, enabled });
}
export function useModelPolicies() {
  return useQuery({ queryKey: ['models', 'policies'], queryFn: api.models.policies });
}
export function useModelRollouts() {
  return useQuery({ queryKey: ['models', 'rollouts'], queryFn: api.models.rollouts });
}
export function useModelUsage(days = 1) {
  return useQuery({ queryKey: ['models', 'usage', days], queryFn: () => api.models.usage(days) });
}
export function useCreateModel() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.models.create, onSuccess: () => qc.invalidateQueries({ queryKey: ['models'] }) });
}
export function useUpdateModelRollout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.models.updateRollout(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['models', 'rollouts'] }),
  });
}

// ── Knowledge Graph ──
export function useKnowledgeGraphEntities(params?: { type?: string; limit?: number; offset?: number }) {
  return useQuery({
    queryKey: ['knowledge-graph', 'entities', params],
    queryFn: () => api.knowledgeGraph.entities(params),
  });
}

export function useKnowledgeGraphRelations(params?: { entityId?: string; relationType?: string }) {
  return useQuery({
    queryKey: ['knowledge-graph', 'relations', params],
    queryFn: () => api.knowledgeGraph.relations(params),
  });
}

// ── LiteLLM ──
export function useLiteLLMKeys() {
  return useQuery({ queryKey: ['litellm', 'keys'], queryFn: api.litellm.keys });
}
export function useCreateLiteLLMKey() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.litellm.createKey, onSuccess: () => qc.invalidateQueries({ queryKey: ['litellm', 'keys'] }) });
}
export function useUpdateLiteLLMKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => api.litellm.updateKey(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['litellm', 'keys'] }),
  });
}
export function useDeleteLiteLLMKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.litellm.deleteKey(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['litellm', 'keys'] }),
  });
}

export function useDiscoveryInstances() {
  return useQuery({
    queryKey: ['discovery', 'instances'],
    queryFn: api.discovery.instances,
    refetchInterval: 15000,
  });
}

// ── Allowlists ──
export function useAllowlists() {
  return useQuery({ queryKey: ['allowlists'], queryFn: api.allowlists.list });
}
export function useCreateAllowlist() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.allowlists.create, onSuccess: () => qc.invalidateQueries({ queryKey: ['allowlists'] }) });
}
export function useDeleteAllowlist() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.allowlists.delete, onSuccess: () => qc.invalidateQueries({ queryKey: ['allowlists'] }) });
}
export function useAllowlistOrphans(params?: { type?: string; limit?: number }) {
  return useQuery({
    queryKey: ['allowlists', 'orphans', params],
    queryFn: () => api.allowlists.orphans(params),
    refetchInterval: 30_000,
  });
}
export function useAdoptAllowlistOrphans() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { confirm: true; type?: string }) => api.allowlists.adoptOrphansToCurrentOrg(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['allowlists'] });
      qc.invalidateQueries({ queryKey: ['allowlists', 'orphans'] });
      qc.invalidateQueries({ queryKey: ['web', 'allowlist'] });
    },
  });
}

// ── HA ──
export function useHaConfig() {
  return useQuery({ queryKey: ['ha', 'config'], queryFn: api.ha.config });
}
export function useHaDiscoveryEntities(params?: { domain?: string; limit?: number; enabled?: boolean }) {
  return useQuery({
    queryKey: ['ha', 'discovery', params?.domain || '', params?.limit || 100],
    queryFn: () => api.ha.discoverEntities({ domain: params?.domain, limit: params?.limit }),
    enabled: params?.enabled ?? true,
    staleTime: 15_000,
  });
}
export function useHaSubscriptions() {
  return useQuery({ queryKey: ['ha', 'subscriptions'], queryFn: api.ha.subscriptions });
}
export function useHaAutomations() {
  return useQuery({ queryKey: ['ha', 'automations'], queryFn: api.ha.automations });
}
export function useCreateHaAutomation() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.ha.createAutomation, onSuccess: () => qc.invalidateQueries({ queryKey: ['ha'] }) });
}
export function useDeleteHaAutomation() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.ha.deleteAutomation, onSuccess: () => qc.invalidateQueries({ queryKey: ['ha'] }) });
}

// ── Calendar ──
export function useCalendarAccounts() {
  return useQuery({ queryKey: ['calendar', 'accounts'], queryFn: api.calendar.accounts });
}
export function useCalendarSubscriptions() {
  return useQuery({ queryKey: ['calendar', 'subscriptions'], queryFn: api.calendar.subscriptions });
}
export function useAddCalendarAccount() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.calendar.addAccount, onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar'] }) });
}
export function useSubscribeCalendar() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.calendar.subscribe, onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar'] }) });
}
export function useUnsubscribeCalendar() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.calendar.unsubscribe, onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar'] }) });
}

// ── Git ──
export function useGitRepos() {
  return useQuery({ queryKey: ['git', 'repos'], queryFn: api.git.repos });
}
export function useAddGitRepo() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.git.addRepo, onSuccess: () => qc.invalidateQueries({ queryKey: ['git'] }) });
}
export function useDeleteGitRepo() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.git.deleteRepo, onSuccess: () => qc.invalidateQueries({ queryKey: ['git'] }) });
}

// ── Web ──
export function useWebAllowlist() {
  return useQuery({ queryKey: ['web', 'allowlist'], queryFn: api.web.allowlist });
}
export function useAddWebDomain() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ pattern, description }: { pattern: string; description?: string }) => api.web.addDomain(pattern, description), onSuccess: () => qc.invalidateQueries({ queryKey: ['web'] }) });
}
export function useDeleteWebDomain() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.web.deleteDomain, onSuccess: () => qc.invalidateQueries({ queryKey: ['web'] }) });
}

export function useWidgetSettings() {
  return useQuery({
    queryKey: ['web', 'widget', 'settings'],
    queryFn: api.web.widgetSettings,
  });
}
export function useUpdateWidgetSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.web.updateWidgetSettings,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['web', 'widget'] }),
  });
}
export function useWidgetInstances() {
  return useQuery({
    queryKey: ['web', 'widget', 'instances'],
    queryFn: api.web.widgetInstances,
  });
}
export function useCreateWidgetInstance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.web.createWidgetInstance,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['web', 'widget'] }),
  });
}
export function useWidgetEmbed(instanceId: string) {
  return useQuery({
    queryKey: ['web', 'widget', 'embed', instanceId],
    queryFn: () => api.web.widgetEmbed(instanceId),
    enabled: !!instanceId,
  });
}

// ── Search Settings ──
export function useSearchSettingsConfig(enabled = true) {
  return useQuery({
    queryKey: ['search-settings', 'config'],
    queryFn: api.searchSettings.config,
    enabled,
  });
}
export function useUpdateSearchSettingsConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.searchSettings.updateConfig,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['search-settings'] }),
  });
}
export function useTestSearchConnectivity() {
  return useMutation({ mutationFn: api.searchSettings.testConnectivity });
}
export function useSearchQuery() {
  return useMutation({ mutationFn: api.searchSettings.query });
}
export function useSearchStats() {
  return useQuery({
    queryKey: ['search-settings', 'stats'],
    queryFn: api.searchSettings.stats,
    refetchInterval: 30_000,
  });
}

// ── Workflows ──
export function useWorkflows() {
  return useQuery({ queryKey: ['workflows'], queryFn: api.workflows.list });
}
export function useWorkflow(id: string) {
  return useQuery({ queryKey: ['workflows', id], queryFn: () => api.workflows.get(id), enabled: !!id });
}
export function useWorkflowRuns(workflowId: string) {
  return useQuery({ queryKey: ['workflows', workflowId, 'runs'], queryFn: () => api.workflows.runs(workflowId), enabled: !!workflowId });
}
export function useCreateWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.workflows.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workflows'] }),
  });
}
export function useExecuteWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, inputVariables }: { id: string; inputVariables?: Record<string, unknown> }) =>
      api.workflows.execute(id, inputVariables),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workflows'] }),
  });
}
export function useToggleWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => api.workflows.toggle(id, enabled),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workflows'] }),
  });
}
export function useDeleteWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.workflows.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workflows'] }),
  });
}

// ── Schedules ──
export function useSchedules() {
  return useQuery({ queryKey: ['schedules'], queryFn: api.schedules.list });
}
export function useSchedule(id: string) {
  return useQuery({ queryKey: ['schedules', id], queryFn: () => api.schedules.get(id), enabled: !!id });
}
export function useCreateSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.schedules.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schedules'] }),
  });
}
export function useUpdateSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => api.schedules.update(id, data),
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ['schedules'] });
      qc.invalidateQueries({ queryKey: ['schedules', vars.id] });
    },
  });
}
export function useDeleteSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.schedules.remove,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schedules'] }),
  });
}
export function useScheduleHistory(id: string, limit = 10) {
  return useQuery({
    queryKey: ['schedules', id, 'history', limit],
    queryFn: () => api.schedules.history(id, limit),
    enabled: !!id,
  });
}
export function useRunSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.schedules.runNow,
    onSuccess: (_res, id) => {
      qc.invalidateQueries({ queryKey: ['schedules'] });
      qc.invalidateQueries({ queryKey: ['schedules', id, 'history'] });
    },
  });
}

// ── Cron ──
export function useCronJobs() {
  return useQuery({ queryKey: ['cron'], queryFn: api.cron.list });
}
export function useCreateCronJob() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.cron.create, onSuccess: () => qc.invalidateQueries({ queryKey: ['cron'] }) });
}
export function useRunCronJob() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.cron.runNow, onSuccess: () => qc.invalidateQueries({ queryKey: ['cron'] }) });
}
export function useDeleteCronJob() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.cron.remove, onSuccess: () => qc.invalidateQueries({ queryKey: ['cron'] }) });
}

// ── Webhooks ──
export function useWebhooks() {
  return useQuery({ queryKey: ['webhooks'], queryFn: api.webhooks.list });
}
export function useCreateWebhook() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.webhooks.create, onSuccess: () => qc.invalidateQueries({ queryKey: ['webhooks'] }) });
}
export function useDeleteWebhook() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.webhooks.remove, onSuccess: () => qc.invalidateQueries({ queryKey: ['webhooks'] }) });
}

// ── Email (Gmail Pub/Sub) ──
export function useEmailConfig() {
  return useQuery({ queryKey: ['email', 'config'], queryFn: api.email.config });
}
export function useSetEmailConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.email.setConfig,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['email', 'config'] }),
  });
}
export function useEmailSubscriptions() {
  return useQuery({ queryKey: ['email', 'subscriptions'], queryFn: api.email.subscriptions });
}
export function useCreateEmailSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.email.createSubscription,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['email', 'subscriptions'] }),
  });
}
export function useDeleteEmailSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.email.deleteSubscription,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['email', 'subscriptions'] }),
  });
}
export function useEmailSubscriptionEvents(id: string, limit = 50) {
  return useQuery({
    queryKey: ['email', 'events', id, limit],
    queryFn: () => api.email.events(id, limit),
    enabled: !!id,
  });
}
export function useTestEmailSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload?: Record<string, unknown> }) => api.email.test(id, payload),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['email', 'subscriptions'] });
      qc.invalidateQueries({ queryKey: ['email', 'events', vars.id] });
    },
  });
}

// ── Incidents ──
export function useIncidentsStatus() {
  return useQuery({ queryKey: ['incidents', 'status'], queryFn: api.incidents.status });
}
export function useKillSwitch() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.incidents.killSwitch, onSuccess: () => qc.invalidateQueries({ queryKey: ['incidents'] }) });
}
export function useLockdown() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.incidents.lockdown, onSuccess: () => qc.invalidateQueries({ queryKey: ['incidents'] }) });
}
export function useForensics() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.incidents.forensics, onSuccess: () => qc.invalidateQueries({ queryKey: ['incidents'] }) });
}
export function useExecuteEscalationRules() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.incidents.executeEscalationRules,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['incidents'] }),
  });
}
export function useEmergencyNotify() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.incidents.emergencyNotify,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['incidents'] }),
  });
}

// ── Health ──
export function useHealth() {
  return useQuery({ queryKey: ['health'], queryFn: api.health.all, refetchInterval: 15_000 });
}

export function useSelfCorrectionMetrics(windowHours = 168) {
  return useQuery({
    queryKey: ['performance', 'self-correction', windowHours],
    queryFn: () => api.performance.selfCorrection(windowHours),
    refetchInterval: 30_000,
  });
}

// ── Memory ──
export function useMemory(params?: {
  user_id?: string;
  chat_id?: string;
  visibility?: string;
  source?: string;
  key?: string;
  search?: string;
  exact?: string;
  sort_by?: string;
  sort_dir?: 'asc' | 'desc';
  page?: number;
  per_page?: number;
}) {
  return useQuery({ queryKey: ['memory', params], queryFn: () => api.memory.list(params) });
}
export function useMemoryStats() {
  return useQuery({ queryKey: ['memory', 'stats'], queryFn: api.memory.stats, refetchInterval: 30_000 });
}
export function useMemoryDetail(id?: string) {
  return useQuery({
    queryKey: ['memory', 'detail', id],
    queryFn: () => api.memory.detail(String(id)),
    enabled: Boolean(id),
  });
}
export function useUpdateMemory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { visibility?: string; key?: string; value?: string; importance?: number } }) =>
      api.memory.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['memory'] }),
  });
}
export function useDeleteMemory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.memory.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['memory'] }),
  });
}
export function useBulkDeleteMemories() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => api.memory.bulkDelete(ids),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['memory'] }),
  });
}
export function useImportMemories() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (memories: Array<{ user_id?: string; chat_id?: string; visibility?: string; key?: string; value?: string; source?: string; importance?: number }>) =>
      api.memory.importJson(memories),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['memory'] }),
  });
}
export function useSemanticMemorySearch() {
  return useMutation({
    mutationFn: (data: { query: string; user_id?: string; chat_id?: string; visibility?: string; top_k?: number }) =>
      api.memory.search(data),
  });
}
export function useExportMemories() {
  return useMutation({
    mutationFn: ({
      format,
      params,
    }: {
      format?: 'json' | 'csv';
      params?: { visibility?: string; user_id?: string; chat_id?: string };
    }) => api.memory.export(format || 'json', params),
  });
}

// ── Improvements ──
export function useImprovements() {
  return useQuery({ queryKey: ['improvements'], queryFn: api.improvements.list });
}
export function useApproveImprovement() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.improvements.approve, onSuccess: () => qc.invalidateQueries({ queryKey: ['improvements'] }) });
}
export function useDismissImprovement() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.improvements.dismiss, onSuccess: () => qc.invalidateQueries({ queryKey: ['improvements'] }) });
}

// ── MCP ──
export function useMcpServers(enabled = true) {
  return useQuery({ queryKey: ['mcp', 'servers'], queryFn: api.mcp.servers, enabled, refetchInterval: enabled ? 10_000 : false });
}
export function useMcpPresets() {
  return useQuery({ queryKey: ['mcp', 'presets'], queryFn: api.mcp.presets, staleTime: 60_000 });
}
export function useMcpSharedTokenConfig(enabled = true) {
  return useQuery({ queryKey: ['mcp', 'shared-token-config'], queryFn: api.mcp.sharedTokenConfig, enabled, staleTime: 10_000 });
}
export function useMcpCatalog(chatId?: string) {
  return useQuery({ queryKey: ['mcp', 'catalog', chatId], queryFn: () => api.mcp.catalog(chatId) });
}
export function useMcpChatOverrides(chatId?: string) {
  return useQuery({ queryKey: ['mcp', 'overrides', chatId], queryFn: () => api.mcp.chatOverrides(chatId) });
}
export function useCreateMcpServer() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.mcp.createServer, onSuccess: () => qc.invalidateQueries({ queryKey: ['mcp'] }) });
}
export function useDeleteMcpServer() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.mcp.deleteServer, onSuccess: () => qc.invalidateQueries({ queryKey: ['mcp'] }) });
}
export function useTestMcpServer() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.mcp.testServer, onSuccess: () => qc.invalidateQueries({ queryKey: ['mcp'] }) });
}
export function useReconnectMcpServers() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.mcp.reconnectAll, onSuccess: () => qc.invalidateQueries({ queryKey: ['mcp'] }) });
}
export function useUpdateMcpSharedTokenConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { enabled?: boolean; token?: string }) => api.mcp.updateSharedTokenConfig(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mcp'] }),
  });
}
export function useUpsertMcpChatOverride() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ chatId, serverId, enabled }: { chatId: string; serverId: string; enabled: boolean }) =>
      api.mcp.upsertChatOverride(chatId, serverId, enabled),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mcp'] }),
  });
}
export function useDeleteMcpChatOverride() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ chatId, serverId }: { chatId: string; serverId: string }) =>
      api.mcp.deleteChatOverride(chatId, serverId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mcp'] }),
  });
}

// ── Obsidian Sync ──
export function useObsidianSyncStatus(enabled = true) {
  return useQuery({
    queryKey: ['obsidian', 'sync', 'status'],
    queryFn: api.obsidianSync.status,
    enabled,
    refetchInterval: 30_000,
  });
}
export function useObsidianExportMemories() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.obsidianSync.exportMemories,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['obsidian', 'sync'] }),
  });
}
export function useObsidianImportMemories() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.obsidianSync.importMemories,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['obsidian', 'sync'] }),
  });
}

// ── Integration Runtime ──
export function useIntegrationRuntimeList() {
  return useQuery({
    queryKey: ['integrations', 'runtime'],
    queryFn: api.integrationRuntime.list,
    refetchInterval: 15_000,
  });
}
export function useIntegrationRuntime(integrationType?: string) {
  return useQuery({
    queryKey: ['integrations', 'runtime', integrationType],
    queryFn: () => api.integrationRuntime.get(integrationType || ''),
    enabled: Boolean(integrationType),
    refetchInterval: 15_000,
  });
}
export function useSetIntegrationRuntimeConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      integrationType,
      payload,
    }: {
      integrationType: string;
      payload: { config?: Record<string, unknown>; secret_refs?: Record<string, string> };
    }) => api.integrationRuntime.setConfig(integrationType, payload),
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ['integrations', 'runtime'] });
      qc.invalidateQueries({ queryKey: ['integrations', 'runtime', vars.integrationType] });
    },
  });
}
export function useDeployIntegrationRuntime() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      integrationType,
      payload,
    }: {
      integrationType: string;
      payload?: { runtime_mode?: 'container' | 'local_worker'; image_ref?: string; deployment_spec?: Record<string, unknown> };
    }) => api.integrationRuntime.deploy(integrationType, payload),
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ['integrations', 'runtime'] });
      qc.invalidateQueries({ queryKey: ['integrations', 'runtime', vars.integrationType] });
    },
  });
}
export function useStopIntegrationRuntime() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (integrationType: string) => api.integrationRuntime.stop(integrationType),
    onSuccess: (_res, integrationType) => {
      qc.invalidateQueries({ queryKey: ['integrations', 'runtime'] });
      qc.invalidateQueries({ queryKey: ['integrations', 'runtime', integrationType] });
    },
  });
}

export function useReconcileIntegrationRuntime() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.integrationRuntime.reconcile(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['integrations', 'runtime'] });
      qc.invalidateQueries({ queryKey: ['integrations', 'catalog'] });
    },
  });
}

export function useIntegrationRuntimeBootEvents(params?: {
  limit?: number;
  status?: string;
  integration_type?: string;
  chat_id?: string;
}) {
  return useQuery({
    queryKey: ['integrations', 'runtime', 'boot-events', params],
    queryFn: () => api.integrationRuntime.bootEvents(params),
    refetchInterval: 10_000,
  });
}

export function useIntegrationsCatalog(enabled = true) {
  return useQuery({
    queryKey: ['integrations', 'catalog'],
    queryFn: api.integrations.catalog,
    enabled,
    refetchInterval: enabled ? 15_000 : false,
  });
}

export function useIntegrationLibrary() {
  return useQuery({
    queryKey: ['integrations', 'library'],
    queryFn: api.integrations.library,
    staleTime: 60_000,
  });
}

export function useIntegrationRecoveryPlaybookRuns(params?: {
  limit?: number;
  page?: number;
  has_failures?: boolean;
  run_status?: 'in_progress' | 'completed' | 'failed';
  actor_user_id?: string;
  from?: string;
  to?: string;
  sort?: 'created_at';
  order?: 'asc' | 'desc';
  refetch_interval_ms?: number;
}) {
  return useQuery({
    queryKey: ['integrations', 'recovery-playbook', 'runs', params],
    queryFn: () => api.integrations.recoveryPlaybookRuns(params),
    refetchInterval:
      typeof params?.refetch_interval_ms === 'number'
        ? Math.max(0, Math.trunc(params.refetch_interval_ms))
        : 15_000,
  });
}

export function useIntegrationRecoveryPlaybookRun(runId?: string) {
  return useQuery({
    queryKey: ['integrations', 'recovery-playbook', 'runs', runId],
    queryFn: () => api.integrations.recoveryPlaybookRun(runId || ''),
    enabled: Boolean(runId),
  });
}

export function useInstallIntegrationLibraryProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      profileId,
      payload,
    }: {
      profileId: string;
      payload?: {
        deploy_runtime?: boolean;
        overwrite_existing?: boolean;
        setting_overrides?: Record<string, unknown>;
        runtime_mode?: 'container' | 'local_worker';
        image_ref?: string;
        integration_ids?: string[];
      };
    }) => api.integrations.installLibraryProfile(profileId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['integrations', 'catalog'] });
      qc.invalidateQueries({ queryKey: ['integrations', 'runtime'] });
      qc.invalidateQueries({ queryKey: ['settings'] });
    },
  });
}

export function useApplyIntegrationTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      integrationId,
      payload,
    }: {
      integrationId: string;
      payload?: {
        deploy_runtime?: boolean;
        overwrite_existing?: boolean;
        setting_overrides?: Record<string, unknown>;
        runtime_mode?: 'container' | 'local_worker';
        image_ref?: string;
      };
    }) => api.integrations.applyTemplate(integrationId, payload),
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ['integrations', 'catalog'] });
      qc.invalidateQueries({ queryKey: ['integrations', 'runtime'] });
      qc.invalidateQueries({ queryKey: ['integrations', 'runtime', vars.integrationId] });
      qc.invalidateQueries({ queryKey: ['settings'] });
    },
  });
}

export function useValidateIntegration() {
  return useMutation({
    mutationFn: (integrationId: string) => api.integrations.validate(integrationId),
  });
}

export function useRunIntegrationRecoveryPlaybook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload?: {
      retry_failed?: boolean;
      deploy_stopped?: boolean;
      apply_templates_unconfigured?: boolean;
      validate_unconfigured?: boolean;
      overwrite_existing?: boolean;
      boot_event_limit?: number;
    }) => api.integrations.runRecoveryPlaybook(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['integrations', 'catalog'] });
      qc.invalidateQueries({ queryKey: ['integrations', 'runtime'] });
      qc.invalidateQueries({ queryKey: ['integrations', 'runtime', 'boot-events'] });
      qc.invalidateQueries({ queryKey: ['integrations', 'recovery-playbook', 'runs'] });
      qc.invalidateQueries({ queryKey: ['settings'] });
    },
  });
}

// ── Agents ──
export function useAgents() {
  return useQuery({ queryKey: ['agents'], queryFn: api.agents.list });
}
export function useCreateAgent() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.agents.create, onSuccess: () => qc.invalidateQueries({ queryKey: ['agents'] }) });
}
export function useSpawnAgentSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ agentId, data }: { agentId: string; data: Record<string, unknown> }) =>
      api.agents.spawnSession(agentId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agents'] });
      qc.invalidateQueries({ queryKey: ['agents', 'routing-rules'] });
    },
  });
}
export function useAgentConfig(agentId?: string) {
  return useQuery({ queryKey: ['agents', agentId, 'config'], queryFn: () => api.agents.config(agentId || ''), enabled: !!agentId });
}
export function useSetAgentConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ agentId, data }: { agentId: string; data: Record<string, unknown> }) =>
      api.agents.setConfig(agentId, data),
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ['agents', vars.agentId, 'config'] });
      qc.invalidateQueries({ queryKey: ['agents'] });
    },
  });
}
export function useAgentRoutingRules(params?: { agent_id?: string; channel?: string; enabled?: boolean }) {
  return useQuery({ queryKey: ['agents', 'routing-rules', params], queryFn: () => api.agents.routingRules(params) });
}
export function useCreateAgentRoutingRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.agents.createRoutingRule,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agents', 'routing-rules'] }),
  });
}
export function useUpdateAgentRoutingRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.agents.updateRoutingRule(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agents', 'routing-rules'] }),
  });
}
export function useDeleteAgentRoutingRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.agents.deleteRoutingRule,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agents', 'routing-rules'] }),
  });
}

export function useAgentAnalyticsSummary(params?: { range?: '24h' | '7d' | '30d' | 'custom'; start?: string; end?: string }) {
  return useQuery({
    queryKey: ['agents', 'analytics', 'summary', params],
    queryFn: () => api.agentAnalytics.summary(params),
  });
}

export function useAgentAnalyticsAlerts() {
  return useQuery({
    queryKey: ['agents', 'analytics', 'alerts'],
    queryFn: api.agentAnalytics.alerts,
  });
}

export function useSetAgentAnalyticsAlerts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.agentAnalytics.setAlerts,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agents', 'analytics', 'alerts'] }),
  });
}

export function useEvaluateAgentAnalyticsAlerts(params?: { range?: '24h' | '7d' | '30d' | 'custom'; start?: string; end?: string }) {
  return useQuery({
    queryKey: ['agents', 'analytics', 'alerts', 'evaluate', params],
    queryFn: () => api.agentAnalytics.evaluateAlerts(params),
  });
}

// ── NAS ──
export function useNasSearch(path: string, pattern?: string) {
  return useQuery({ queryKey: ['nas', 'search', path, pattern], queryFn: () => api.nas.search(path, pattern), enabled: !!path });
}
export function useNasList(path: string, enabled = true) {
  return useQuery({ queryKey: ['nas', 'list', path], queryFn: () => api.nas.list(path), enabled: !!path && enabled });
}

// ── AI Pipelines (Gemma 4) ──
export function useImageStats() {
  return useQuery({ queryKey: ['ai', 'image', 'stats'], queryFn: api.aiPipelines.imageStats });
}
export function useImagePolicy() {
  return useQuery({ queryKey: ['ai', 'image', 'policy'], queryFn: api.aiPipelines.imagePolicy });
}
export function useImageJobs() {
  return useQuery({ queryKey: ['ai', 'image', 'jobs'], queryFn: api.aiPipelines.imageJobs });
}
export function useScribeStats() {
  return useQuery({ queryKey: ['ai', 'scribe', 'stats'], queryFn: api.aiPipelines.scribeStats });
}
export function useScribeConfig() {
  return useQuery({ queryKey: ['ai', 'scribe', 'config'], queryFn: api.aiPipelines.scribeConfig });
}
export function useScribeSessions() {
  return useQuery({ queryKey: ['ai', 'scribe', 'sessions'], queryFn: api.aiPipelines.scribeSessions });
}
export function useActionStats() {
  return useQuery({ queryKey: ['ai', 'actions', 'stats'], queryFn: api.aiPipelines.actionStats });
}
export function useActionBuiltins() {
  return useQuery({ queryKey: ['ai', 'actions', 'builtins'], queryFn: api.aiPipelines.actionBuiltins });
}
export function useActionExecutions() {
  return useQuery({ queryKey: ['ai', 'actions', 'executions'], queryFn: api.aiPipelines.actionExecutions });
}
export function useRoutingPolicy() {
  return useQuery({ queryKey: ['ai', 'routing', 'policy'], queryFn: api.aiPipelines.routingPolicy });
}
export function useRoutingStats() {
  return useQuery({ queryKey: ['ai', 'routing', 'stats'], queryFn: api.aiPipelines.routingStats });
}
export function usePrivacyPolicy() {
  return useQuery({ queryKey: ['ai', 'privacy', 'policy'], queryFn: api.aiPipelines.privacyPolicy });
}
export function usePrivacyVerify() {
  return useQuery({ queryKey: ['ai', 'privacy', 'verify'], queryFn: api.aiPipelines.privacyVerify });
}
export function usePrivacyAuditStats() {
  return useQuery({ queryKey: ['ai', 'privacy', 'audit'], queryFn: api.aiPipelines.privacyAuditStats });
}
export function useModulesList() {
  return useQuery({ queryKey: ['ai', 'modules', 'list'], queryFn: api.aiPipelines.modulesList });
}
export function useModulesStats() {
  return useQuery({ queryKey: ['ai', 'modules', 'stats'], queryFn: api.aiPipelines.modulesStats });
}
export function useUpdateRoutingPolicy() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.aiPipelines.updateRoutingPolicy, onSuccess: () => qc.invalidateQueries({ queryKey: ['ai', 'routing'] }) });
}
export function useUpdatePrivacyPolicy() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.aiPipelines.updatePrivacyPolicy, onSuccess: () => qc.invalidateQueries({ queryKey: ['ai', 'privacy'] }) });
}

// ── Brain Admin (Batch 2) ──
export function useBrainGraph(userId?: string) { return useQuery({ queryKey: ['brain', 'graph', userId], queryFn: () => api.brain.graph(userId) }); }
export function useQuantumFadeConfig() { return useQuery({ queryKey: ['brain', 'qf-config'], queryFn: api.brain.quantumFadeConfig }); }
export function useUpdateQuantumFadeConfig() { const qc = useQueryClient(); return useMutation({ mutationFn: api.brain.updateQuantumFadeConfig, onSuccess: () => qc.invalidateQueries({ queryKey: ['brain', 'qf-config'] }) }); }
export function useEmotionalHistory() { return useQuery({ queryKey: ['brain', 'emotional-history'], queryFn: () => api.brain.emotionalHistory() }); }
export function useEmotionalSummary(days = 30) { return useQuery({ queryKey: ['brain', 'emotional-summary', days], queryFn: () => api.brain.emotionalSummary(days) }); }
export function useReasoning() { return useQuery({ queryKey: ['brain', 'reasoning'], queryFn: () => api.brain.reasoning() }); }
export function useReasoningUnderstanding() { return useQuery({ queryKey: ['brain', 'reasoning-understanding'], queryFn: api.brain.reasoningUnderstanding }); }
export function useMemoryConsent() { return useQuery({ queryKey: ['brain', 'memory-consent'], queryFn: api.brain.memoryConsent }); }
export function useUpdateMemoryConsent() { const qc = useQueryClient(); return useMutation({ mutationFn: api.brain.updateMemoryConsent, onSuccess: () => qc.invalidateQueries({ queryKey: ['brain', 'memory-consent'] }) }); }
export function useMemoryForget() { const qc = useQueryClient(); return useMutation({ mutationFn: api.brain.memoryForget, onSuccess: () => qc.invalidateQueries({ queryKey: ['brain'] }) }); }

// ── Community Agents (Batch 3 + 4) ──
export function useAgentPersonas() { return useQuery({ queryKey: ['agents', 'personas'], queryFn: () => api.communityAgents.personas() }); }
export function useCreatePersona() { const qc = useQueryClient(); return useMutation({ mutationFn: api.communityAgents.createPersona, onSuccess: () => qc.invalidateQueries({ queryKey: ['agents', 'personas'] }) }); }
export function useModerationPending() { return useQuery({ queryKey: ['agents', 'moderation'], queryFn: () => api.communityAgents.moderationPending() }); }
export function useReviewModeration() { const qc = useQueryClient(); return useMutation({ mutationFn: ({ decisionId, body }: { decisionId: string; body: Record<string, unknown> }) => api.communityAgents.reviewModeration(decisionId, body), onSuccess: () => qc.invalidateQueries({ queryKey: ['agents', 'moderation'] }) }); }
export function useAgentChangelog() { return useQuery({ queryKey: ['agents', 'changelog'], queryFn: () => api.communityAgents.changelog() }); }
export function usePublishChangelog() { const qc = useQueryClient(); return useMutation({ mutationFn: (entryId: string) => api.communityAgents.publishChangelog(entryId), onSuccess: () => qc.invalidateQueries({ queryKey: ['agents', 'changelog'] }) }); }
export function useConfidenceCalibration(days = 30) { return useQuery({ queryKey: ['agents', 'confidence', days], queryFn: () => api.communityAgents.confidenceCalibration(days) }); }
export function useConfidenceLow() { return useQuery({ queryKey: ['agents', 'confidence-low'], queryFn: api.communityAgents.confidenceLow }); }
export function useFeedbackTaskSummary(days = 30) { return useQuery({ queryKey: ['agents', 'feedback-summary', days], queryFn: () => api.communityAgents.feedbackTaskSummary(days) }); }
export function useCorrections() { return useQuery({ queryKey: ['agents', 'corrections'], queryFn: () => api.communityAgents.corrections() }); }
export function useVerifyCorrection() { const qc = useQueryClient(); return useMutation({ mutationFn: (id: string) => api.communityAgents.verifyCorrection(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['agents', 'corrections'] }) }); }
export function usePromoteCorrection() { const qc = useQueryClient(); return useMutation({ mutationFn: (id: string) => api.communityAgents.promoteCorrection(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['agents', 'corrections'] }) }); }
export function useAgentPatterns() { return useQuery({ queryKey: ['agents', 'patterns'], queryFn: () => api.communityAgents.patterns() }); }
export function useSelfImprovementSnapshots(days = 30) { return useQuery({ queryKey: ['agents', 'self-improvement', days], queryFn: () => api.communityAgents.selfImprovementSnapshots(days) }); }

// ── Federation (Batch 5) ──
export function useFederationIdentity() { return useQuery({ queryKey: ['federation', 'identity'], queryFn: api.federation.identity }); }
export function useGenerateIdentity() { const qc = useQueryClient(); return useMutation({ mutationFn: api.federation.generateIdentity, onSuccess: () => qc.invalidateQueries({ queryKey: ['federation', 'identity'] }) }); }
export function useRotateIdentity() { const qc = useQueryClient(); return useMutation({ mutationFn: api.federation.rotateIdentity, onSuccess: () => qc.invalidateQueries({ queryKey: ['federation', 'identity'] }) }); }
export function useIdentityHistory() { return useQuery({ queryKey: ['federation', 'identity-history'], queryFn: api.federation.identityHistory }); }
export function useFederationPeers() { return useQuery({ queryKey: ['federation', 'peers'], queryFn: () => api.federation.peers() }); }
export function useRegisterPeer() { const qc = useQueryClient(); return useMutation({ mutationFn: api.federation.registerPeer, onSuccess: () => qc.invalidateQueries({ queryKey: ['federation', 'peers'] }) }); }
export function useHandshakePeer() { const qc = useQueryClient(); return useMutation({ mutationFn: (peerId: string) => api.federation.handshake(peerId), onSuccess: () => qc.invalidateQueries({ queryKey: ['federation', 'peers'] }) }); }
export function usePrunePeers() { const qc = useQueryClient(); return useMutation({ mutationFn: api.federation.prunePeers, onSuccess: () => qc.invalidateQueries({ queryKey: ['federation', 'peers'] }) }); }
export function useHomeserverConnections() { return useQuery({ queryKey: ['federation', 'homeserver'], queryFn: () => api.federation.homeserverConnections() }); }
export function useHomeserverStats() { return useQuery({ queryKey: ['federation', 'homeserver-stats'], queryFn: api.federation.homeserverStats }); }
export function useHomeserverConfig() { return useQuery({ queryKey: ['federation', 'homeserver-config'], queryFn: api.federation.homeserverConfig }); }
export function useFederatedTopics() { return useQuery({ queryKey: ['federation', 'topics'], queryFn: () => api.federation.communityTopics() }); }
export function useCommunitySummaryFed() { return useQuery({ queryKey: ['federation', 'community-summary'], queryFn: api.federation.communitySummary }); }
export function useDelegations() { return useQuery({ queryKey: ['federation', 'delegations'], queryFn: () => api.federation.delegations() }); }
export function useDelegationSummary() { return useQuery({ queryKey: ['federation', 'delegation-summary'], queryFn: api.federation.delegationSummary }); }
export function useFederationConsent() { return useQuery({ queryKey: ['federation', 'consent'], queryFn: api.federation.consent }); }
export function useUpdateFederationConsent() { const qc = useQueryClient(); return useMutation({ mutationFn: api.federation.updateConsent, onSuccess: () => qc.invalidateQueries({ queryKey: ['federation', 'consent'] }) }); }
export function useConsentStats() { return useQuery({ queryKey: ['federation', 'consent-stats'], queryFn: api.federation.consentStats }); }
export function useSovereignty() { return useQuery({ queryKey: ['federation', 'sovereignty'], queryFn: api.federation.sovereignty }); }
export function useUpdateSovereignty() { const qc = useQueryClient(); return useMutation({ mutationFn: api.federation.updateSovereignty, onSuccess: () => qc.invalidateQueries({ queryKey: ['federation', 'sovereignty'] }) }); }
export function useExportPolicy() { return useQuery({ queryKey: ['federation', 'export-policy'], queryFn: api.federation.exportPolicy }); }
export function useMeshHealth() { return useQuery({ queryKey: ['federation', 'mesh-health'], queryFn: api.federation.meshHealth }); }
export function useHealthCheck() { const qc = useQueryClient(); return useMutation({ mutationFn: (peerId: string) => api.federation.healthCheck(peerId), onSuccess: () => qc.invalidateQueries({ queryKey: ['federation', 'mesh-health'] }) }); }

// ── Trading (Batch 12) ──
export function useTradingDashboard() { return useQuery({ queryKey: ['trading', 'dashboard'], queryFn: api.trading.dashboard }); }
export function useTradingCorrelation() { return useQuery({ queryKey: ['trading', 'correlation'], queryFn: api.trading.correlationMatrix }); }
export function useTradingExecutionQuality() { return useQuery({ queryKey: ['trading', 'execution-quality'], queryFn: api.trading.executionQuality }); }
export function useTradingPnlChart() { return useQuery({ queryKey: ['trading', 'pnl-chart'], queryFn: api.trading.pnlChart }); }
export function useTradingCredentials() { return useQuery({ queryKey: ['trading', 'credentials'], queryFn: api.trading.credentials }); }
export function useAddTradingCredential() { const qc = useQueryClient(); return useMutation({ mutationFn: api.trading.addCredential, onSuccess: () => qc.invalidateQueries({ queryKey: ['trading', 'credentials'] }) }); }
export function useRevokeTradingCredential() { const qc = useQueryClient(); return useMutation({ mutationFn: (id: string) => api.trading.revokeCredential(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['trading', 'credentials'] }) }); }
export function useTradingBrokers() { return useQuery({ queryKey: ['trading', 'brokers'], queryFn: api.trading.brokers }); }
export function useTradingBrokerHealth() { return useQuery({ queryKey: ['trading', 'broker-health'], queryFn: api.trading.brokerHealth }); }
