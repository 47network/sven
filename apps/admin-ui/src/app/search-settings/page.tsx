'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { PageSpinner } from '@/components/Spinner';
import {
  useSearchSettingsConfig,
  useSearchStats,
  useUpdateSearchSettingsConfig,
  useTestSearchConnectivity,
  useSearchQuery,
} from '@/lib/hooks';
import { toast } from 'sonner';
import Link from 'next/link';

const ENGINE_OPTIONS = [
  'google',
  'bing',
  'duckduckgo',
  'wikipedia',
  'wikidata',
  'arxiv',
  'github',
  'stackoverflow',
  'google news',
  'google images',
  'bing images',
  'brave',
];

export default function SearchSettingsPage() {
  const configQuery = useSearchSettingsConfig();
  const statsQuery = useSearchStats();
  const updateConfig = useUpdateSearchSettingsConfig();
  const testConnectivity = useTestSearchConnectivity();
  const querySearch = useSearchQuery();

  const [safeSearch, setSafeSearch] = useState<'off' | 'moderate' | 'strict'>('moderate');
  const [engines, setEngines] = useState<string[]>([]);
  const [searxngUrl, setSearxngUrl] = useState('');
  const [defaultLanguage, setDefaultLanguage] = useState('auto');
  const [maxResults, setMaxResults] = useState(10);

  const [testQuery, setTestQuery] = useState('latest OpenSearch release notes');
  const [testCategories, setTestCategories] = useState('general');

  const config = configQuery.data?.data;
  const stats = statsQuery.data?.data;

  useEffect(() => {
    if (!config) return;
    setSafeSearch(config.safe_search);
    setEngines(config.engines || []);
    setSearxngUrl(config.searxng_url || '');
    setDefaultLanguage(config.default_language || 'auto');
    setMaxResults(config.max_results || 10);
  }, [config]);

  const loading = configQuery.isLoading || statsQuery.isLoading;
  if (loading) return <PageSpinner />;

  const searchResults = querySearch.data?.data?.results || [];
  const dailyCounts = stats?.daily_counts || [];
  const popularCategories = stats?.popular_categories || [];

  const topDays = dailyCounts
    .slice(0, 7)
    .map((row) => `${String(row.day).slice(0, 10)}: ${row.count}`)
    .join(' | ');

  const toggleEngine = (engine: string) => {
    setEngines((prev) => (prev.includes(engine) ? prev.filter((e) => e !== engine) : [...prev, engine]));
  };

  const saveConfig = () => {
    updateConfig.mutate(
      {
        safe_search: safeSearch,
        engines,
        searxng_url: searxngUrl,
        default_language: defaultLanguage,
        max_results: maxResults,
      },
      {
        onSuccess: () => toast.success('Search settings saved'),
        onError: () => toast.error('Failed to save search settings'),
      },
    );
  };

  return (
    <>
      <PageHeader
        title="Search Settings"
        description="Configure private SearXNG search engines, safety, and live query validation"
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <section className="card space-y-4 xl:col-span-2">
          <h2 className="text-lg font-semibold">Engine Controls</h2>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-sm text-slate-400">SearXNG URL</span>
              <input className="input" value={searxngUrl} onChange={(e) => setSearxngUrl(e.target.value)} placeholder="http://searxng:8080" />
            </label>

            <label className="space-y-1">
              <span className="text-sm text-slate-400">Safe Search</span>
              <select className="input" value={safeSearch} onChange={(e) => setSafeSearch(e.target.value as 'off' | 'moderate' | 'strict')}>
                <option value="off">off</option>
                <option value="moderate">moderate</option>
                <option value="strict">strict</option>
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-sm text-slate-400">Default Language</span>
              <input className="input" value={defaultLanguage} onChange={(e) => setDefaultLanguage(e.target.value)} placeholder="auto" />
            </label>

            <label className="space-y-1">
              <span className="text-sm text-slate-400">Max Results</span>
              <input
                className="input"
                type="number"
                min={1}
                max={100}
                value={maxResults}
                onChange={(e) => setMaxResults(Math.max(1, Math.min(100, Number(e.target.value || 10))))}
              />
            </label>
          </div>

          <div>
            <p className="mb-2 text-sm text-slate-400">Enabled Engines</p>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              {ENGINE_OPTIONS.map((engine) => (
                <label key={engine} className="flex items-center gap-2 rounded border border-slate-700/70 px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={engines.includes(engine)}
                    onChange={() => toggleEngine(engine)}
                  />
                  <span>{engine}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" onClick={saveConfig} disabled={updateConfig.isPending}>Save Settings</button>
            <Link href="/secrets" className="btn">
              Manage API key refs
            </Link>
            <button
              className="btn"
              onClick={() =>
                testConnectivity.mutate(undefined, {
                  onSuccess: (res) => {
                    if (res.data.reachable) toast.success('SearXNG reachable');
                    else toast.error(`SearXNG unreachable: ${res.data.error || 'unknown error'}`);
                  },
                  onError: () => toast.error('Connectivity check failed'),
                })
              }
              disabled={testConnectivity.isPending}
            >
              Test Connectivity
            </button>
          </div>
        </section>

        <section className="card space-y-3">
          <h2 className="text-lg font-semibold">Search Statistics</h2>
          <p className="text-sm text-slate-400">Queries/day: <span className="font-semibold text-slate-100">{stats?.queries_per_day || 0}</span></p>
          <p className="text-xs text-slate-500">Last 7 days: {topDays || 'No data yet'}</p>
          <div>
            <p className="mb-1 text-sm text-slate-400">Popular categories</p>
            <div className="space-y-1 text-sm">
              {popularCategories.length === 0 ? (
                <p className="text-slate-500">No search activity recorded yet.</p>
              ) : (
                popularCategories.map((row) => (
                  <div key={`${row.category}-${row.count}`} className="flex items-center justify-between rounded border border-slate-700/70 px-2 py-1">
                    <span>{row.category}</span>
                    <span className="font-medium">{row.count}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>

      <section className="card mt-4 space-y-3">
        <h2 className="text-lg font-semibold">Test Search Box</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <input
            className="input md:col-span-2"
            value={testQuery}
            onChange={(e) => setTestQuery(e.target.value)}
            placeholder="Search query"
          />
          <input
            className="input"
            value={testCategories}
            onChange={(e) => setTestCategories(e.target.value)}
            placeholder="general"
          />
          <button
            className="btn-primary"
            onClick={() =>
              querySearch.mutate(
                { query: testQuery, categories: testCategories, num_results: maxResults, language: defaultLanguage },
                { onError: () => toast.error('Search query failed') },
              )
            }
            disabled={!testQuery.trim() || querySearch.isPending}
          >
            Run Search
          </button>
        </div>

        <div className="space-y-2">
          {searchResults.length === 0 ? (
            <p className="text-sm text-slate-500">No results yet. Run a search test above.</p>
          ) : (
            searchResults.map((result, idx) => (
              <article key={`${result.url}-${idx}`} className="rounded border border-slate-700/70 p-3">
                <a className="font-medium text-cyan-300 hover:underline" href={result.url} target="_blank" rel="noreferrer">{result.title || result.url}</a>
                <p className="mt-1 text-xs text-slate-500">{result.source_engine}</p>
                <p className="mt-1 text-sm text-slate-300">{result.snippet}</p>
              </article>
            ))
          )}
        </div>
      </section>
    </>
  );
}
