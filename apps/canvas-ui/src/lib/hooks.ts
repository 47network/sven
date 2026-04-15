import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import {
  api,
  type AgentStateRecord,
  type ApprovalsListResponse,
  type ApprovalsQuery,
  type ArtifactRecord,
  type ChatDetails,
  type ChatSummary,
  type CouncilConfig,
  type CouncilSession,
  type MemoryRecord,
  type MessageRecord,
  type RegistryCatalogEntry,
  type RegistryInstalledEntry,
  type RegistryMarketplaceEntry,
  type RegistrySkillReview,
  type RegistrySkillVersion,
  type SearchPaging,
  type SearchResponse,
  type ToolRunRecord,
  type UserMeRecord,
  type VideoJob,
} from './api';

// ── Me ──
export function useMe() {
  return useQuery<UserMeRecord>({
    queryKey: ['me'],
    queryFn: async () => (await api.me.get()).data,
    retry: false,
  });
}

// ── Chats ──
export function useChats() {
  return useQuery<ChatSummary[]>({
    queryKey: ['chats'],
    queryFn: async () => (await api.chats.list()).data.rows,
  });
}

export function useInfiniteChats(limit = 40) {
  return useInfiniteQuery({
    queryKey: ['chats', 'infinite', limit],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) =>
      (await api.chats.list({ limit, offset: Number(pageParam || 0) })).data,
    getNextPageParam: (lastPage, pages) => {
      if (!lastPage.has_more) return undefined;
      return pages.reduce((total, page) => total + page.rows.length, 0);
    },
  });
}

export function useCreateChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload?: { name?: string; type?: 'dm' | 'group' }) =>
      api.chats.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chats'] });
    },
  });
}

export function useRenameChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ chatId, name }: { chatId: string; name: string }) =>
      api.chats.rename(chatId, name),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['chats'] });
      qc.invalidateQueries({ queryKey: ['chats', vars.chatId] });
    },
  });
}

export function useDeleteChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ chatId }: { chatId: string }) => api.chats.remove(chatId),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['chats'] });
      qc.removeQueries({ queryKey: ['chats', vars.chatId] });
      qc.removeQueries({ queryKey: ['messages', vars.chatId] });
      qc.removeQueries({ queryKey: ['message-feedback', vars.chatId] });
    },
  });
}

export function useShareChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ chatId, expiresInDays }: { chatId: string; expiresInDays?: number }) =>
      api.chats.share(chatId, expiresInDays ? { expires_in_days: expiresInDays } : {}),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['chat-share', vars.chatId] });
    },
  });
}

export function useUnshareChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ chatId }: { chatId: string }) => api.chats.unshare(chatId),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['chat-share', vars.chatId] });
    },
  });
}

export function useShareStatus(chatId: string) {
  return useQuery({
    queryKey: ['chat-share', chatId],
    queryFn: async () => (await api.chats.shareStatus(chatId)).data,
    enabled: !!chatId,
    refetchInterval: 60000,
  });
}

export function useChat(chatId: string) {
  return useQuery<ChatDetails>({
    queryKey: ['chats', chatId],
    queryFn: async () => (await api.chats.get(chatId)).data,
    enabled: !!chatId,
  });
}

export function useMessages(chatId: string) {
  return useQuery<{ rows: MessageRecord[]; has_more: boolean }>({
    queryKey: ['messages', chatId],
    queryFn: async () => (await api.chats.messages(chatId)).data,
    enabled: !!chatId,
    refetchInterval: 15000, // fallback poll; realtime SSE handles fast updates
  });
}

export function useAgentState(chatId: string) {
  return useQuery<AgentStateRecord>({
    queryKey: ['agent-state', chatId],
    queryFn: async () => (await api.chats.agentState(chatId)).data,
    enabled: !!chatId,
    refetchInterval: 10000,
  });
}

export function usePauseAgent(chatId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.chats.pauseAgent(chatId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agent-state', chatId] });
    },
  });
}

export function useResumeAgent(chatId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.chats.resumeAgent(chatId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agent-state', chatId] });
    },
  });
}

export function useNudgeAgent(chatId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.chats.nudgeAgent(chatId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agent-state', chatId] });
      qc.invalidateQueries({ queryKey: ['messages', chatId] });
    },
  });
}

export function useSendMessage(chatId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (text: string) => api.chats.send(chatId, text),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['messages', chatId] });
    },
  });
}

export function useCancelQueuedMessage(chatId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (queueId: string) => api.chats.cancelQueued(chatId, queueId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['messages', chatId] });
    },
  });
}

export function useMessageFeedback(chatId: string) {
  return useQuery({
    queryKey: ['message-feedback', chatId],
    queryFn: async () => (await api.chats.messageFeedback(chatId)).data.rows,
    enabled: !!chatId,
    refetchInterval: 15000,
  });
}

export function useSetMessageFeedback(chatId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ messageId, feedback }: { messageId: string; feedback: 'up' | 'down' | null }) =>
      api.chats.setMessageFeedback(chatId, messageId, feedback),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['message-feedback', chatId] });
      qc.invalidateQueries({ queryKey: ['messages', chatId] });
    },
  });
}

export function useCanvasEvents(chatId: string) {
  return useQuery({
    queryKey: ['canvas', chatId],
    queryFn: async () => (await api.chats.canvas(chatId)).data.rows,
    enabled: !!chatId,
  });
}

// ── Artifacts ──
export function useArtifact(id: string) {
  return useQuery<ArtifactRecord>({
    queryKey: ['artifacts', id],
    queryFn: async () => (await api.artifacts.get(id)).data,
    enabled: !!id,
  });
}

// ── Tool Runs ──
export function useToolRun(id: string) {
  return useQuery<ToolRunRecord>({
    queryKey: ['runs', id],
    queryFn: async () => (await api.runs.get(id)).data,
    enabled: !!id,
  });
}

// ── Registry / Skills Marketplace ──
export function useRegistryCatalog(name?: string) {
  return useQuery<RegistryCatalogEntry[]>({
    queryKey: ['registry-catalog', name ?? 'all'],
    queryFn: async () => (await api.registry.catalog(name)).data,
    retry: false,
  });
}

export function useRegistryMarketplace(name?: string) {
  return useQuery<RegistryMarketplaceEntry[]>({
    queryKey: ['registry-marketplace', name ?? 'all'],
    queryFn: async () => (await api.registry.marketplace(name)).data,
    retry: false,
  });
}

export function useRegistryInstalled() {
  return useQuery<RegistryInstalledEntry[]>({
    queryKey: ['registry-installed'],
    queryFn: async () => (await api.registry.installed()).data,
    retry: false,
  });
}

export function useRegistryInstallSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (catalogId: string) => api.registry.install(catalogId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['registry-installed'] });
      qc.invalidateQueries({ queryKey: ['registry-catalog'] });
    },
  });
}

export function useRegistryPurchaseSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (catalogId: string) => api.registry.purchase(catalogId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['registry-marketplace'] });
    },
  });
}

export function useRegistryReviews(catalogEntryId?: string) {
  return useQuery<RegistrySkillReview[]>({
    queryKey: ['registry-reviews', catalogEntryId ?? 'all'],
    queryFn: async () => (await api.registry.reviews(catalogEntryId)).data,
    retry: false,
    enabled: !!catalogEntryId,
  });
}

export function useRegistrySubmitReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { catalog_entry_id: string; rating: number; review?: string }) =>
      api.registry.submitReview(payload),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['registry-reviews', vars.catalog_entry_id] });
      qc.invalidateQueries({ queryKey: ['registry-marketplace'] });
    },
  });
}

export function useRegistryVersions(name?: string) {
  return useQuery<RegistrySkillVersion[]>({
    queryKey: ['registry-versions', name ?? 'none'],
    queryFn: async () => (await api.registry.versions(String(name))).data,
    retry: false,
    enabled: !!name,
  });
}

// ── Approvals ──
export function useApprovals(filters?: string | ApprovalsQuery) {
  const normalized: ApprovalsQuery = typeof filters === 'string'
    ? { status: filters }
    : (filters || {});
  return useQuery<ApprovalsListResponse>({
    queryKey: [
      'approvals',
      normalized.status ?? null,
      normalized.chat_id ?? null,
      normalized.query ?? null,
      normalized.requester ?? 'any',
      normalized.limit ?? null,
      normalized.offset ?? 0,
    ],
    queryFn: async () => (await api.approvals.list(normalized)).data,
    refetchInterval: 5000,
  });
}

export function useVoteApproval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'approve' | 'deny' }) =>
      api.approvals.vote(id, decision),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['approvals'] });
    },
  });
}

// ── Search ──
export function useSearch(
  query: string,
  chatId?: string,
  paging?: SearchPaging,
) {
  return useQuery<SearchResponse>({
    queryKey: [
      'search',
      query,
      chatId,
      paging?.limits?.messages ?? null,
      paging?.limits?.tool_runs ?? null,
      paging?.limits?.artifacts ?? null,
      paging?.offsets?.messages ?? 0,
      paging?.offsets?.tool_runs ?? 0,
      paging?.offsets?.artifacts ?? 0,
    ],
    queryFn: async () => (await api.search.query(query, chatId, paging)).data,
    enabled: query.length > 1,
  });
}

// ── Council ──
export function useCouncilConfig() {
  return useQuery<CouncilConfig>({
    queryKey: ['council-config'],
    queryFn: async () => (await api.council.getConfig()).config,
    staleTime: 30_000,
  });
}

export function useUpdateCouncilConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (config: Partial<CouncilConfig>) => api.council.updateConfig(config),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['council-config'] }); },
  });
}

export function useCouncilDeliberate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ query, models, strategy }: { query: string; models?: string[]; strategy?: string }) =>
      api.council.deliberate(query, { models, strategy }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['council-sessions'] }); },
  });
}

export function useCouncilSessions(limit = 20) {
  return useQuery<{ sessions: CouncilSession[]; total: number }>({
    queryKey: ['council-sessions', limit],
    queryFn: () => api.council.sessions({ limit }),
    refetchInterval: 10_000,
  });
}

export function useCouncilSession(id: string) {
  return useQuery<CouncilSession>({
    queryKey: ['council-sessions', id],
    queryFn: () => api.council.session(id),
    enabled: !!id,
    refetchInterval: (query) => {
      const data = query.state.data as CouncilSession | undefined;
      return data?.status === 'completed' || data?.status === 'failed' ? false : 3_000;
    },
  });
}

// ── Memory ──
export function useMemories(params?: { scope?: string; chat_id?: string }) {
  return useQuery<{ rows: MemoryRecord[]; total: number }>({
    queryKey: ['memories', params?.scope ?? 'all', params?.chat_id ?? 'all'],
    queryFn: async () => (await api.memory.list(params)).data,
    staleTime: 15_000,
  });
}

export function useMemorySearch(query: string, chatId?: string) {
  return useQuery<{ rows: MemoryRecord[] }>({
    queryKey: ['memory-search', query, chatId],
    queryFn: async () => (await api.memory.search(query, { chat_id: chatId, limit: 10 })).data,
    enabled: query.length > 2,
  });
}

export function useCreateMemory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { key: string; value: string; scope?: string; visibility?: string; importance?: number; chat_id?: string }) =>
      api.memory.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['memories'] }); },
  });
}

export function useDeleteMemory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.memory.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['memories'] }); },
  });
}

export function useMemoryStats() {
  return useQuery({
    queryKey: ['memory-stats'],
    queryFn: async () => (await api.memory.stats()).data,
    staleTime: 60_000,
  });
}

// ── Video ──
export function useCreateVideoJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { title?: string; description?: string; template?: string; spec?: Record<string, unknown> }) =>
      api.video.createJob(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['video-jobs'] }); },
  });
}

export function useVideoJobs(limit = 10) {
  return useQuery<{ jobs: VideoJob[]; total: number }>({
    queryKey: ['video-jobs', limit],
    queryFn: () => api.video.jobs({ limit }),
    refetchInterval: 10_000,
  });
}

export function useVideoJob(id: string) {
  return useQuery<VideoJob>({
    queryKey: ['video-jobs', id],
    queryFn: () => api.video.job(id),
    enabled: !!id,
    refetchInterval: (query) => {
      const data = query.state.data as VideoJob | undefined;
      return data?.status === 'completed' || data?.status === 'failed' || data?.status === 'cancelled' ? false : 5_000;
    },
  });
}

export function useCancelVideoJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.video.cancel(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['video-jobs'] }); },
  });
}
