'use client';

import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { PageSpinner } from '@/components/Spinner';
import {
  useAgents,
  useCreateAgent,
  useSpawnAgentSession,
  useAgentConfig,
  useSetAgentConfig,
  useAgentRoutingRules,
  useCreateAgentRoutingRule,
  useUpdateAgentRoutingRule,
  useDeleteAgentRoutingRule,
} from '@/lib/hooks';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';

type Agent = {
  id: string;
  name: string;
  workspace_path?: string | null;
  model?: string | null;
};

type AgentRoutingRule = {
  id: string;
  agent_id: string;
  session_id?: string | null;
  channel: string;
  channel_chat_id?: string | null;
  user_id?: string | null;
  sender_identity_id?: string | null;
  priority: number;
  enabled: boolean;
};

type AgentConfig = {
  system_prompt?: string | null;
  model_name?: string | null;
  profile_name?: string | null;
  settings?: Record<string, unknown>;
};

export default function AgentRoutingPage() {
  const agentsQuery = useAgents();
  const rulesQuery = useAgentRoutingRules();
  const createAgent = useCreateAgent();
  const spawnAgentSession = useSpawnAgentSession();
  const createRule = useCreateAgentRoutingRule();
  const updateRule = useUpdateAgentRoutingRule();
  const deleteRule = useDeleteAgentRoutingRule();
  const setConfig = useSetAgentConfig();

  const agents = (agentsQuery.data?.data || []) as Agent[];
  const rules = (rulesQuery.data?.data || []) as AgentRoutingRule[];

  const [newAgent, setNewAgent] = useState({ name: '', workspace_path: '', model: '' });
  const [newRule, setNewRule] = useState({
    agent_id: '',
    session_id: '',
    channel: '',
    channel_chat_id: '',
    user_id: '',
    sender_identity_id: '',
    priority: '100',
    enabled: true,
  });
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [spawnForm, setSpawnForm] = useState({
    agent_id: '',
    parent_agent_id: '',
    session_id: '',
    session_name: '',
    chat_type: 'group' as 'dm' | 'group' | 'hq',
    system_prompt: '',
    model_name: '',
    profile_name: '',
    policy_scope: '',
  });
  const agentConfigQuery = useAgentConfig(selectedAgentId);
  const agentConfig = agentConfigQuery.data?.data as AgentConfig | undefined;
  const [agentConfigDraft, setAgentConfigDraft] = useState({
    system_prompt: '',
    model_name: '',
    profile_name: '',
  });

  const defaultAgentId = useMemo(() => (agents.length > 0 ? agents[0].id : ''), [agents]);
  useEffect(() => {
    if (!selectedAgentId && defaultAgentId) {
      setSelectedAgentId(defaultAgentId);
    }
  }, [selectedAgentId, defaultAgentId]);

  useEffect(() => {
    if (agentConfig) {
      setAgentConfigDraft({
        system_prompt: agentConfig.system_prompt || '',
        model_name: agentConfig.model_name || '',
        profile_name: agentConfig.profile_name || '',
      });
    } else if (selectedAgentId) {
      setAgentConfigDraft({ system_prompt: '', model_name: '', profile_name: '' });
    }
  }, [agentConfig, selectedAgentId]);

  if (agentsQuery.isLoading || rulesQuery.isLoading) return <PageSpinner />;

  function handleCreateAgent() {
    createAgent.mutate(
      {
        name: newAgent.name,
        workspace_path: newAgent.workspace_path || undefined,
        model: newAgent.model || undefined,
      },
      {
        onSuccess: () => {
          toast.success('Agent created');
          setNewAgent({ name: '', workspace_path: '', model: '' });
        },
        onError: () => toast.error('Failed to create agent'),
      },
    );
  }

  function handleSaveConfig() {
    if (!selectedAgentId) return;
    setConfig.mutate(
      {
        agentId: selectedAgentId,
        data: {
          system_prompt: agentConfigDraft.system_prompt || '',
          model_name: agentConfigDraft.model_name || '',
          profile_name: agentConfigDraft.profile_name || '',
          settings: agentConfig?.settings || {},
        },
      },
      {
        onSuccess: () => toast.success('Agent config saved'),
        onError: () => toast.error('Failed to save agent config'),
      },
    );
  }

  function handleCreateRule() {
    createRule.mutate(
      {
        agent_id: newRule.agent_id,
        session_id: newRule.session_id || undefined,
        channel: newRule.channel,
        channel_chat_id: newRule.channel_chat_id || undefined,
        user_id: newRule.user_id || undefined,
        sender_identity_id: newRule.sender_identity_id || undefined,
        priority: Number(newRule.priority || 100),
        enabled: Boolean(newRule.enabled),
      },
      {
        onSuccess: () => {
          toast.success('Routing rule created');
          setNewRule({
            agent_id: '',
            session_id: '',
            channel: '',
            channel_chat_id: '',
            user_id: '',
            sender_identity_id: '',
            priority: '100',
            enabled: true,
          });
        },
        onError: () => toast.error('Failed to create rule'),
      },
    );
  }

  function handleSpawnSession() {
    const agentId = spawnForm.agent_id.trim();
    if (!agentId) {
      toast.error('Select agent to spawn session');
      return;
    }
    const policyScope = spawnForm.policy_scope
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);

    spawnAgentSession.mutate(
      {
        agentId,
        data: {
          parent_agent_id: spawnForm.parent_agent_id || undefined,
          session_id: spawnForm.session_id || undefined,
          session_name: spawnForm.session_name || undefined,
          chat_type: spawnForm.chat_type,
          system_prompt: spawnForm.system_prompt || undefined,
          model_name: spawnForm.model_name || undefined,
          profile_name: spawnForm.profile_name || undefined,
          policy_scope: policyScope.length > 0 ? policyScope : undefined,
        },
      },
      {
        onSuccess: (res) => {
          const payload = (res?.data && typeof res.data === 'object') ? (res.data as Record<string, unknown>) : {};
          const sid = String(payload.session_id || '');
          toast.success(`Subagent session spawned${sid ? ` (${sid.slice(0, 12)})` : ''}`);
          setSpawnForm((prev) => ({
            ...prev,
            session_id: '',
            session_name: '',
            parent_agent_id: '',
            system_prompt: '',
            model_name: '',
            profile_name: '',
            policy_scope: '',
          }));
        },
        onError: () => toast.error('Failed to spawn subagent session'),
      },
    );
  }

  return (
    <>
      <PageHeader title="Agent Routing" description="Route channels and users to isolated agent runtimes" />

      <div className="card mb-6 space-y-3">
        <h3 className="font-medium">Create Agent</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <input
            className="input"
            placeholder="Agent name"
            value={newAgent.name}
            onChange={(e) => setNewAgent((p) => ({ ...p, name: e.target.value }))}
          />
          <input
            className="input"
            placeholder="Workspace path (optional)"
            value={newAgent.workspace_path}
            onChange={(e) => setNewAgent((p) => ({ ...p, workspace_path: e.target.value }))}
          />
          <input
            className="input"
            placeholder="Model override (optional)"
            value={newAgent.model}
            onChange={(e) => setNewAgent((p) => ({ ...p, model: e.target.value }))}
          />
          <button className="btn-primary" onClick={handleCreateAgent} disabled={createAgent.isPending}>
            Create
          </button>
        </div>
      </div>

      <div className="card mb-6 space-y-3">
        <h3 className="font-medium">Agent Prompt & Config</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <select
            className="input"
            value={selectedAgentId}
            onChange={(e) => setSelectedAgentId(e.target.value)}
          >
            <option value="">Select agent</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>
          <input
            className="input"
            placeholder="Model override (optional)"
            value={agentConfigDraft.model_name}
            onChange={(e) => setAgentConfigDraft((p) => ({ ...p, model_name: e.target.value }))}
          />
          <input
            className="input"
            placeholder="Profile override (optional)"
            value={agentConfigDraft.profile_name}
            onChange={(e) => setAgentConfigDraft((p) => ({ ...p, profile_name: e.target.value }))}
          />
          <button className="btn-primary" onClick={handleSaveConfig} disabled={!selectedAgentId}>
            Save
          </button>
        </div>
        <textarea
          className="input min-h-[140px]"
          placeholder="System prompt override (optional)"
          value={agentConfigDraft.system_prompt}
          onChange={(e) => setAgentConfigDraft((p) => ({ ...p, system_prompt: e.target.value }))}
        />
      </div>

      <div className="card mb-6 space-y-3">
        <h3 className="font-medium">Spawn Subagent Session</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <select
            className="input"
            value={spawnForm.agent_id}
            onChange={(e) => setSpawnForm((p) => ({ ...p, agent_id: e.target.value }))}
          >
            <option value="">Subagent</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>
          <select
            className="input"
            value={spawnForm.parent_agent_id}
            onChange={(e) => setSpawnForm((p) => ({ ...p, parent_agent_id: e.target.value }))}
          >
            <option value="">Parent agent (optional)</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>
          <select
            className="input"
            value={spawnForm.chat_type}
            onChange={(e) => setSpawnForm((p) => ({ ...p, chat_type: e.target.value as 'dm' | 'group' | 'hq' }))}
          >
            <option value="group">group</option>
            <option value="dm">dm</option>
            <option value="hq">hq</option>
          </select>
          <input
            className="input"
            placeholder="Session name (optional)"
            value={spawnForm.session_name}
            onChange={(e) => setSpawnForm((p) => ({ ...p, session_name: e.target.value }))}
          />
          <input
            className="input"
            placeholder="Attach to session id (optional)"
            value={spawnForm.session_id}
            onChange={(e) => setSpawnForm((p) => ({ ...p, session_id: e.target.value }))}
          />
          <input
            className="input"
            placeholder="Model override (optional)"
            value={spawnForm.model_name}
            onChange={(e) => setSpawnForm((p) => ({ ...p, model_name: e.target.value }))}
          />
          <input
            className="input"
            placeholder="Profile override (optional)"
            value={spawnForm.profile_name}
            onChange={(e) => setSpawnForm((p) => ({ ...p, profile_name: e.target.value }))}
          />
          <input
            className="input"
            placeholder="Policy scope CSV (e.g. web.fetch,nas.read)"
            value={spawnForm.policy_scope}
            onChange={(e) => setSpawnForm((p) => ({ ...p, policy_scope: e.target.value }))}
          />
        </div>
        <textarea
          className="input min-h-[90px]"
          placeholder="Subagent system prompt override (optional)"
          value={spawnForm.system_prompt}
          onChange={(e) => setSpawnForm((p) => ({ ...p, system_prompt: e.target.value }))}
        />
        <div className="flex justify-end">
          <button
            className="btn-primary"
            onClick={handleSpawnSession}
            disabled={spawnAgentSession.isPending || !spawnForm.agent_id}
          >
            Spawn Session
          </button>
        </div>
      </div>

      <div className="card mb-6 space-y-3">
        <h3 className="font-medium">Create Routing Rule</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <select
            className="input"
            value={newRule.agent_id}
            onChange={(e) => setNewRule((p) => ({ ...p, agent_id: e.target.value }))}
          >
            <option value="">Agent</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>
          <input
            className="input"
            placeholder="Channel (discord, slack, ...)"
            value={newRule.channel}
            onChange={(e) => setNewRule((p) => ({ ...p, channel: e.target.value }))}
          />
          <input
            className="input"
            placeholder="Channel chat id (optional)"
            value={newRule.channel_chat_id}
            onChange={(e) => setNewRule((p) => ({ ...p, channel_chat_id: e.target.value }))}
          />
          <input
            className="input"
            placeholder="User id (optional)"
            value={newRule.user_id}
            onChange={(e) => setNewRule((p) => ({ ...p, user_id: e.target.value }))}
          />
          <input
            className="input"
            placeholder="Sender identity id (optional)"
            value={newRule.sender_identity_id}
            onChange={(e) => setNewRule((p) => ({ ...p, sender_identity_id: e.target.value }))}
          />
          <input
            className="input"
            placeholder="Session id (optional)"
            value={newRule.session_id}
            onChange={(e) => setNewRule((p) => ({ ...p, session_id: e.target.value }))}
          />
          <input
            className="input"
            placeholder="Priority"
            value={newRule.priority}
            onChange={(e) => setNewRule((p) => ({ ...p, priority: e.target.value }))}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={newRule.enabled}
              onChange={(e) => setNewRule((p) => ({ ...p, enabled: e.target.checked }))}
            />
            Enabled
          </label>
          <button className="btn-primary" onClick={handleCreateRule} disabled={createRule.isPending}>
            Create
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {rules.map((rule) => (
          <div key={rule.id} className="card flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-medium">
                {rule.channel} → {agents.find((a) => a.id === rule.agent_id)?.name || rule.agent_id}
              </p>
              <p className="text-sm text-slate-500">
                chat: {rule.channel_chat_id || 'any'} · user: {rule.user_id || 'any'} · identity: {rule.sender_identity_id || 'any'}
              </p>
              <p className="text-xs text-slate-400">
                priority {rule.priority} · session {rule.session_id || 'auto'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(rule.enabled)}
                  onChange={(e) =>
                    updateRule.mutate({ id: rule.id, data: { enabled: e.target.checked } }, {
                      onError: () => toast.error('Failed to update rule'),
                    })
                  }
                />
                Enabled
              </label>
              <button
                className="btn-danger btn-sm"
                onClick={() =>
                  deleteRule.mutate(rule.id, {
                    onSuccess: () => toast.success('Rule deleted'),
                    onError: () => toast.error('Failed to delete rule'),
                  })
                }
              >
                <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
