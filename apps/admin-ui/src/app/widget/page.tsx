'use client';

import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { PageSpinner } from '@/components/Spinner';
import {
  useCreateWidgetInstance,
  useUpdateWidgetSettings,
  useWidgetEmbed,
  useWidgetInstances,
  useWidgetSettings,
} from '@/lib/hooks';
import { toast } from 'sonner';
import { Copy, Sparkles } from 'lucide-react';

const DEFAULT_SETTINGS = {
  enabled: true,
  endpoint_url: '',
  title: 'Sven',
  avatar_url: '',
  position: 'bottom-right' as 'bottom-right' | 'bottom-left',
  primary_color: '#2563eb',
  background_color: '#0f172a',
  welcome_text: 'Hi, how can I help?',
};

export default function WidgetPage() {
  const settingsQuery = useWidgetSettings();
  const instancesQuery = useWidgetInstances();
  const saveSettings = useUpdateWidgetSettings();
  const createInstance = useCreateWidgetInstance();

  const [enabled, setEnabled] = useState(DEFAULT_SETTINGS.enabled);
  const [endpointUrl, setEndpointUrl] = useState(DEFAULT_SETTINGS.endpoint_url);
  const [title, setTitle] = useState(DEFAULT_SETTINGS.title);
  const [avatarUrl, setAvatarUrl] = useState(DEFAULT_SETTINGS.avatar_url);
  const [position, setPosition] = useState(DEFAULT_SETTINGS.position);
  const [primaryColor, setPrimaryColor] = useState(DEFAULT_SETTINGS.primary_color);
  const [backgroundColor, setBackgroundColor] = useState(DEFAULT_SETTINGS.background_color);
  const [welcomeText, setWelcomeText] = useState(DEFAULT_SETTINGS.welcome_text);

  const [instanceName, setInstanceName] = useState('Production Website');
  const [instanceRateLimit, setInstanceRateLimit] = useState(60);
  const [selectedInstanceId, setSelectedInstanceId] = useState('');
  const [instanceApiKey, setInstanceApiKey] = useState('');
  const [latestOneTimeKey, setLatestOneTimeKey] = useState('');

  const suggestedEndpointUrl =
    typeof window !== 'undefined' && window.location.origin ? window.location.origin : '';

  const settings = settingsQuery.data;
  const instances = instancesQuery.data?.instances || [];

  useEffect(() => {
    if (!settings) return;
    setEnabled(settings.enabled !== false);
    setEndpointUrl(String(settings.endpoint_url || suggestedEndpointUrl || ''));
    setTitle(String(settings.title || DEFAULT_SETTINGS.title));
    setAvatarUrl(String(settings.avatar_url || ''));
    setPosition(settings.position === 'bottom-left' ? 'bottom-left' : 'bottom-right');
    setPrimaryColor(String(settings.primary_color || DEFAULT_SETTINGS.primary_color));
    setBackgroundColor(String(settings.background_color || DEFAULT_SETTINGS.background_color));
    setWelcomeText(String(settings.welcome_text || DEFAULT_SETTINGS.welcome_text));
  }, [settings, suggestedEndpointUrl]);

  useEffect(() => {
    if (!settings && !endpointUrl && suggestedEndpointUrl) {
      setEndpointUrl(suggestedEndpointUrl);
    }
  }, [endpointUrl, settings, suggestedEndpointUrl]);

  useEffect(() => {
    if (!selectedInstanceId && instances.length > 0) setSelectedInstanceId(String(instances[0].id || ''));
  }, [instances, selectedInstanceId]);

  const embedQuery = useWidgetEmbed(selectedInstanceId);
  const embed = embedQuery.data;

  const generatedSnippet = useMemo(() => {
    const raw = String(embed?.embed_snippet || '').trim();
    if (!raw) return '';
    const key = instanceApiKey.trim() || latestOneTimeKey.trim();
    if (!key) return raw;
    return raw.replace('REPLACE_WITH_WIDGET_API_KEY', key);
  }, [embed?.embed_snippet, instanceApiKey, latestOneTimeKey]);

  const loading = settingsQuery.isLoading || instancesQuery.isLoading;
  if (loading) return <PageSpinner />;

  function handleSaveSettings() {
    const normalizedEndpointUrl = endpointUrl.trim() || suggestedEndpointUrl;
    if (!normalizedEndpointUrl) {
      toast.error('Endpoint URL is required');
      return;
    }

    try {
      const parsedUrl = new URL(normalizedEndpointUrl);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        toast.error('Endpoint URL must use http or https');
        return;
      }
    } catch {
      toast.error('Endpoint URL must be a valid http/https URL');
      return;
    }

    saveSettings.mutate(
      {
        enabled,
        endpoint_url: normalizedEndpointUrl,
        title: title.trim(),
        avatar_url: avatarUrl.trim() || null,
        position,
        primary_color: primaryColor.trim(),
        background_color: backgroundColor.trim(),
        welcome_text: welcomeText.trim(),
      },
      {
        onSuccess: () => toast.success('Widget settings saved'),
        onError: () => toast.error('Failed to save widget settings'),
      },
    );
  }

  function handleCreateInstance() {
    createInstance.mutate(
      {
        name: instanceName.trim() || 'Widget Instance',
        rate_limit_rpm: Math.max(1, Math.min(2000, Math.trunc(instanceRateLimit || 60))),
      },
      {
        onSuccess: (res) => {
          setLatestOneTimeKey(String(res.api_key || ''));
          setInstanceApiKey(String(res.api_key || ''));
          setSelectedInstanceId(String(res.id || ''));
          toast.success(`Instance created (${res.api_key_last4})`);
        },
        onError: () => toast.error('Failed to create widget instance'),
      },
    );
  }

  async function copyText(value: string, successMessage: string) {
    if (!value.trim()) return;
    try {
      await navigator.clipboard.writeText(value);
      toast.success(successMessage);
    } catch {
      toast.error('Copy failed');
    }
  }

  return (
    <>
      <PageHeader
        title="Embeddable Widget"
        description="Configure chat widget branding, generate per-site API keys, and copy script embed code."
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <section className="card space-y-4 xl:col-span-2">
          <h2 className="text-lg font-semibold">Widget Settings</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-sm text-slate-400">Endpoint URL</span>
              <input
                className="input"
                value={endpointUrl}
                onChange={(e) => setEndpointUrl(e.target.value)}
                placeholder="https://chat.example.com"
              />
            </label>
            <label className="space-y-1">
              <span className="text-sm text-slate-400">Title</span>
              <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Sven" />
            </label>
            <label className="space-y-1">
              <span className="text-sm text-slate-400">Position</span>
              <select
                className="input"
                value={position}
                onChange={(e) => setPosition(e.target.value as 'bottom-right' | 'bottom-left')}
              >
                <option value="bottom-right">bottom-right</option>
                <option value="bottom-left">bottom-left</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-sm text-slate-400">Avatar URL (optional)</span>
              <input className="input" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} />
            </label>
            <label className="space-y-1">
              <span className="text-sm text-slate-400">Primary Color</span>
              <input className="input" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} />
            </label>
            <label className="space-y-1">
              <span className="text-sm text-slate-400">Background Color</span>
              <input className="input" value={backgroundColor} onChange={(e) => setBackgroundColor(e.target.value)} />
            </label>
          </div>
          <label className="space-y-1">
            <span className="text-sm text-slate-400">Welcome Text</span>
            <input className="input" value={welcomeText} onChange={(e) => setWelcomeText(e.target.value)} />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            Widget enabled
          </label>
          <button className="btn-primary" onClick={handleSaveSettings} disabled={saveSettings.isPending}>
            Save Widget Settings
          </button>
        </section>

        <section className="card space-y-3">
          <h2 className="text-lg font-semibold">Live Preview</h2>
          <div className="relative min-h-[280px] rounded border border-slate-700/70 bg-slate-950 p-4">
            <div
              className={`absolute bottom-4 ${position === 'bottom-left' ? 'left-4' : 'right-4'} flex items-center gap-2 rounded-full px-3 py-2 text-sm text-white shadow-lg`}
              style={{ backgroundColor: primaryColor }}
            >
              <Sparkles className="h-4 w-4" />
              <span>{title || 'Sven'}</span>
            </div>
            <div
              className="absolute bottom-16 right-4 w-[min(340px,calc(100%-32px))] rounded border border-slate-700 p-3 text-sm"
              style={{ backgroundColor }}
            >
              <p className="font-medium text-white">{title || 'Sven'}</p>
              <p className="mt-2 text-slate-300">{welcomeText || DEFAULT_SETTINGS.welcome_text}</p>
            </div>
          </div>
        </section>
      </div>

      <section className="card mt-4 space-y-4">
        <h2 className="text-lg font-semibold">Instances & Embed Code</h2>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <input
            className="input md:col-span-2"
            value={instanceName}
            onChange={(e) => setInstanceName(e.target.value)}
            placeholder="Website instance name"
          />
          <input
            className="input"
            type="number"
            min={1}
            max={2000}
            value={instanceRateLimit}
            onChange={(e) => setInstanceRateLimit(Number(e.target.value || 60))}
          />
          <button className="btn-primary" onClick={handleCreateInstance} disabled={createInstance.isPending}>
            Create Instance
          </button>
        </div>

        {latestOneTimeKey ? (
          <div className="rounded border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
            One-time API key (save now): <span className="font-mono">{latestOneTimeKey}</span>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-sm text-slate-400">Widget Instance</span>
            <select
              className="input"
              value={selectedInstanceId}
              onChange={(e) => setSelectedInstanceId(e.target.value)}
            >
              {instances.length === 0 ? <option value="">No instances yet</option> : null}
              {instances.map((inst) => (
                <option key={inst.id} value={inst.id}>
                  {inst.name} (****{inst.api_key_last4}, {inst.rate_limit_rpm} rpm)
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-sm text-slate-400">API Key For Snippet</span>
            <input
              className="input font-mono"
              value={instanceApiKey}
              onChange={(e) => setInstanceApiKey(e.target.value)}
              placeholder="Paste one-time key if needed"
            />
          </label>
        </div>

        {embedQuery.isError ? (
          <p className="text-sm text-red-400">Failed to load embed snippet for this instance.</p>
        ) : null}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-400">Embed snippet</p>
            <button
              className="btn btn-sm inline-flex items-center gap-1"
              onClick={() => copyText(generatedSnippet, 'Embed snippet copied')}
              disabled={!generatedSnippet}
            >
              <Copy className="h-3.5 w-3.5" />
              Copy
            </button>
          </div>
          <textarea
            className="input min-h-[140px] font-mono text-xs"
            value={generatedSnippet}
            readOnly
            placeholder="Select an instance to generate embed code..."
          />
          <p className="text-xs text-slate-500">
            {embed?.note || 'Use a dedicated instance per website so rate limits and key rotation are isolated.'}
          </p>
        </div>
      </section>
    </>
  );
}
