'use client';

import { PageHeader } from '@/components/PageHeader';
import { PageSpinner } from '@/components/Spinner';
import { useSetSsoSettings, useSsoSettings } from '@/lib/hooks';
import type { SsoConfig } from '@/lib/api';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

const DEFAULT_SSO: SsoConfig = {
  enabled: false,
  fallback_local_auth: true,
  oidc: {
    enabled: false,
    issuer_url: '',
    client_id: '',
    client_secret: '',
    authorization_endpoint: '',
    token_endpoint: '',
    userinfo_endpoint: '',
    scopes: 'openid profile email',
    callback_url: '',
  },
  saml: {
    enabled: false,
    entrypoint_url: '',
    entity_id: '',
    cert_pem: '',
    callback_url: '',
  },
  jit: { enabled: true, default_role: 'member' },
  group_mapping: [],
};

export default function SsoSettingsPage() {
  const { data, isLoading } = useSsoSettings();
  const setSso = useSetSsoSettings();
  const [draft, setDraft] = useState<SsoConfig>(DEFAULT_SSO);
  const [groupMappingText, setGroupMappingText] = useState<string>('[]');

  useEffect(() => {
    const incoming = data?.data || DEFAULT_SSO;
    setDraft(incoming);
    setGroupMappingText(JSON.stringify(incoming.group_mapping || [], null, 2));
  }, [data]);

  if (isLoading) return <PageSpinner />;

  async function save() {
    let parsedGroups: Array<{ external_group: string; tenant_role: string }> = [];
    try {
      const parsed = JSON.parse(groupMappingText || '[]');
      parsedGroups = Array.isArray(parsed) ? parsed : [];
    } catch {
      toast.error('Group mapping JSON is invalid');
      return;
    }

    try {
      await setSso.mutateAsync({
        ...draft,
        group_mapping: parsedGroups,
      });
      toast.success('SSO settings saved');
    } catch {
      toast.error('Failed to save SSO settings');
    }
  }

  return (
    <>
      <PageHeader title="SSO Settings" description="Configure enterprise OIDC/SAML SSO per tenant account" />

      <div className="card space-y-4 py-5">
        <h3 className="text-base font-semibold">Global</h3>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(draft.enabled)}
            onChange={(e) => setDraft((prev) => ({ ...prev, enabled: e.target.checked }))}
          />
          Enable SSO
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(draft.fallback_local_auth)}
            onChange={(e) => setDraft((prev) => ({ ...prev, fallback_local_auth: e.target.checked }))}
          />
          Allow local auth fallback
        </label>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card space-y-3 py-5">
          <h3 className="text-base font-semibold">OIDC</h3>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(draft.oidc.enabled)}
              onChange={(e) => setDraft((prev) => ({ ...prev, oidc: { ...prev.oidc, enabled: e.target.checked } }))}
            />
            Enable OIDC
          </label>
          <input className="input" placeholder="Issuer URL" value={draft.oidc.issuer_url || ''} onChange={(e) => setDraft((prev) => ({ ...prev, oidc: { ...prev.oidc, issuer_url: e.target.value } }))} />
          <input className="input" placeholder="Client ID" value={draft.oidc.client_id || ''} onChange={(e) => setDraft((prev) => ({ ...prev, oidc: { ...prev.oidc, client_id: e.target.value } }))} />
          <input className="input" placeholder="Client Secret (*** means unchanged)" value={draft.oidc.client_secret || ''} onChange={(e) => setDraft((prev) => ({ ...prev, oidc: { ...prev.oidc, client_secret: e.target.value } }))} />
          <input className="input" placeholder="Authorization Endpoint (optional)" value={draft.oidc.authorization_endpoint || ''} onChange={(e) => setDraft((prev) => ({ ...prev, oidc: { ...prev.oidc, authorization_endpoint: e.target.value } }))} />
          <input className="input" placeholder="Token Endpoint (optional)" value={draft.oidc.token_endpoint || ''} onChange={(e) => setDraft((prev) => ({ ...prev, oidc: { ...prev.oidc, token_endpoint: e.target.value } }))} />
          <input className="input" placeholder="UserInfo Endpoint (optional)" value={draft.oidc.userinfo_endpoint || ''} onChange={(e) => setDraft((prev) => ({ ...prev, oidc: { ...prev.oidc, userinfo_endpoint: e.target.value } }))} />
          <input className="input" placeholder="Scopes" value={draft.oidc.scopes || ''} onChange={(e) => setDraft((prev) => ({ ...prev, oidc: { ...prev.oidc, scopes: e.target.value } }))} />
          <input className="input" placeholder="Callback URL" value={draft.oidc.callback_url || ''} onChange={(e) => setDraft((prev) => ({ ...prev, oidc: { ...prev.oidc, callback_url: e.target.value } }))} />
        </div>

        <div className="card space-y-3 py-5">
          <h3 className="text-base font-semibold">SAML</h3>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(draft.saml.enabled)}
              onChange={(e) => setDraft((prev) => ({ ...prev, saml: { ...prev.saml, enabled: e.target.checked } }))}
            />
            Enable SAML
          </label>
          <input className="input" placeholder="Entrypoint URL" value={draft.saml.entrypoint_url || ''} onChange={(e) => setDraft((prev) => ({ ...prev, saml: { ...prev.saml, entrypoint_url: e.target.value } }))} />
          <input className="input" placeholder="Entity ID" value={draft.saml.entity_id || ''} onChange={(e) => setDraft((prev) => ({ ...prev, saml: { ...prev.saml, entity_id: e.target.value } }))} />
          <textarea className="input min-h-[110px]" placeholder="Certificate PEM (*** means unchanged)" value={draft.saml.cert_pem || ''} onChange={(e) => setDraft((prev) => ({ ...prev, saml: { ...prev.saml, cert_pem: e.target.value } }))} />
          <input className="input" placeholder="Callback URL" value={draft.saml.callback_url || ''} onChange={(e) => setDraft((prev) => ({ ...prev, saml: { ...prev.saml, callback_url: e.target.value } }))} />
        </div>
      </div>

      <div className="mt-6 card space-y-3 py-5">
        <h3 className="text-base font-semibold">JIT Provisioning & Group Mapping</h3>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(draft.jit.enabled)}
            onChange={(e) => setDraft((prev) => ({ ...prev, jit: { ...prev.jit, enabled: e.target.checked } }))}
          />
          Enable JIT provisioning
        </label>
        <select
          className="input"
          value={draft.jit.default_role}
          onChange={(e) => setDraft((prev) => ({ ...prev, jit: { ...prev.jit, default_role: e.target.value } }))}
        >
          <option value="owner">owner</option>
          <option value="admin">admin</option>
          <option value="operator">operator</option>
          <option value="member">member</option>
          <option value="viewer">viewer</option>
        </select>
        <textarea
          className="input min-h-[140px] font-mono text-xs"
          value={groupMappingText}
          onChange={(e) => setGroupMappingText(e.target.value)}
          placeholder='[{"external_group":"okta-admins","tenant_role":"admin"}]'
        />
      </div>

      <div className="mt-6">
        <button className="btn-primary" disabled={setSso.isPending} onClick={save}>
          Save SSO Settings
        </button>
      </div>
    </>
  );
}
