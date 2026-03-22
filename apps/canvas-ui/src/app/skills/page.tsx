'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  useRegistryInstallSkill,
  useRegistryInstalled,
  useRegistryMarketplace,
  useRegistryPurchaseSkill,
  useRegistryReviews,
  useRegistrySubmitReview,
  useRegistryVersions,
} from '@/lib/hooks';

type FallbackSkill = {
  id: string;
  name: string;
  description: string;
  version: string;
  format: string;
  rating: number;
  reviewCount: number;
};

const FALLBACK_SKILLS: FallbackSkill[] = [
  {
    id: 'openclaw',
    name: 'openclaw',
    description: 'Integration and tool package for production workflows.',
    version: '0.1.0',
    format: 'skill_md',
    rating: 4.8,
    reviewCount: 23,
  },
  {
    id: 'email-generic',
    name: 'email-generic',
    description: 'Transactional messaging and notification automations.',
    version: '0.1.0',
    format: 'skill_md',
    rating: 4.6,
    reviewCount: 17,
  },
  {
    id: 'image-generation',
    name: 'image-generation',
    description: 'Media generation workflows and helper tools.',
    version: '0.1.0',
    format: 'skill_md',
    rating: 4.5,
    reviewCount: 14,
  },
  {
    id: 'spotify',
    name: 'spotify',
    description: 'Spotify music search and track lookups.',
    version: '0.1.0',
    format: 'skill_md',
    rating: 4.5,
    reviewCount: 12,
  },
  {
    id: 'weather-openmeteo',
    name: 'weather-openmeteo',
    description: 'Current weather and short forecasts by city or coordinates.',
    version: '0.1.0',
    format: 'skill_md',
    rating: 4.6,
    reviewCount: 11,
  },
  {
    id: 'gif-search',
    name: 'gif-search',
    description: 'Search GIFs from Tenor or Giphy with safe filters.',
    version: '0.1.0',
    format: 'skill_md',
    rating: 4.4,
    reviewCount: 10,
  },
  {
    id: 'notion',
    name: 'notion',
    description: 'Search and update Notion pages.',
    version: '0.1.0',
    format: 'skill_md',
    rating: 4.6,
    reviewCount: 13,
  },
  {
    id: 'trello',
    name: 'trello',
    description: 'Board and card workflows for Trello.',
    version: '0.1.0',
    format: 'skill_md',
    rating: 4.5,
    reviewCount: 9,
  },
];

export default function SkillsDirectoryPage() {
  const [query, setQuery] = useState('');
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [selectedSkillName, setSelectedSkillName] = useState<string | null>(null);
  const marketplace = useRegistryMarketplace();
  const installed = useRegistryInstalled();
  const install = useRegistryInstallSkill();
  const purchase = useRegistryPurchaseSkill();
  const reviews = useRegistryReviews(selectedSkillId || undefined);
  const versions = useRegistryVersions(selectedSkillName || undefined);
  const submitReview = useRegistrySubmitReview();

  const installedIds = useMemo(() => {
    const ids = new Set<string>();
    for (const row of installed.data || []) {
      if (row?.catalog_entry_id) ids.add(String(row.catalog_entry_id));
    }
    return ids;
  }, [installed.data]);

  const catalogRows = useMemo(() => {
    const rows = (marketplace.data || []).map((row) => ({
      id: String(row.id),
      name: String(row.name || 'skill'),
      description: String(row.description || 'No description'),
      version: String(row.version || '0.0.0'),
      format: String(row.format || 'skill_md'),
      rating: Number(row.average_rating || 0),
      reviewCount: Number(row.review_count || 0),
      installCount: Number(row.install_count || 0),
      usage30d: Number(row.usage_30d || 0),
      errorRate30d: Number(row.error_rate_30d || 0),
      versionCount: Number(row.version_count || 1),
      verified: Boolean(row.verified),
      changelog: String(row.changelog || ''),
      deprecationNotice: String(row.deprecation_notice || ''),
      deprecated: Boolean(row.deprecated),
      isPremium: Boolean(row.is_premium),
      priceCents: Number(row.price_cents || 0),
      currency: String(row.currency || 'USD'),
      creatorShareBps: Number(row.creator_share_bps || 7000),
      source: 'registry' as const,
    }));
    if (rows.length > 0) return rows;
    return FALLBACK_SKILLS.map((row) => ({
      ...row,
      source: 'fallback' as const,
      isPremium: false,
      priceCents: 0,
      currency: 'USD',
      creatorShareBps: 7000,
      deprecated: false,
      deprecationNotice: '',
      changelog: '',
      installCount: 0,
      usage30d: 0,
      errorRate30d: 0,
      versionCount: 1,
      verified: false,
    }));
  }, [marketplace.data]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return catalogRows;
    return catalogRows.filter((row) =>
      row.name.toLowerCase().includes(q) ||
      row.description.toLowerCase().includes(q) ||
      row.format.toLowerCase().includes(q),
    );
  }, [catalogRows, query]);

  const canInstall = !marketplace.error;

  return (
    <main className="mx-auto max-w-5xl px-6 py-12 text-zinc-100">
      <h1 className="text-3xl font-semibold tracking-tight">Skill Marketplace</h1>
      <p className="mt-3 text-sm text-zinc-400">
        Browse, search, and install skills. Install actions require registry access.
      </p>

      <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search skills by name, format, or description..."
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none transition focus:border-cyan-400/70 md:w-96"
          />
          <div className="text-xs text-zinc-400">
            {filtered.length} shown
            {' · '}
            {catalogRows.length} total
            {' · '}
            {installedIds.size} installed
          </div>
        </div>
        {marketplace.error ? (
          <p className="mt-3 text-xs text-amber-300">
            Registry endpoint unavailable in current session. Showing fallback public directory.
          </p>
        ) : null}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
        {filtered.map((skill) => {
          const isInstalled = installedIds.has(skill.id);
          return (
            <article key={skill.id} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-medium text-zinc-100">{skill.name}</h2>
                  <p className="mt-1 text-sm text-zinc-300">{skill.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  {skill.source === 'registry' && skill.verified ? (
                    <span className="rounded-full border border-emerald-500/50 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-300">
                      verified
                    </span>
                  ) : null}
                  {skill.source === 'registry' && skill.deprecated ? (
                    <span className="rounded-full border border-amber-500/50 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-300">
                      deprecated
                    </span>
                  ) : null}
                  <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-xs text-zinc-300">
                    {skill.format}
                  </span>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between text-xs">
                <p className="text-amber-300">
                  {'★'.repeat(Math.max(1, Math.round(skill.rating || 0)))}{' '}
                  <span className="text-zinc-300">{(skill.rating || 0).toFixed(1)}</span>
                  <span className="text-zinc-500"> ({skill.reviewCount || 0})</span>
                </p>
                <p className="text-zinc-500">v{skill.version}</p>
              </div>
              {skill.source === 'registry' ? (
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-zinc-400">
                  <span>installs: {skill.installCount}</span>
                  <span>usage 30d: {skill.usage30d}</span>
                  <span>error 30d: {(skill.errorRate30d * 100).toFixed(1)}%</span>
                  <span>versions: {skill.versionCount}</span>
                  {skill.isPremium ? (
                    <span className="text-emerald-300">
                      premium: {(skill.priceCents / 100).toFixed(2)} {skill.currency}
                    </span>
                  ) : null}
                </div>
              ) : null}
              {skill.source === 'registry' && skill.deprecationNotice ? (
                <p className="mt-2 text-xs text-amber-300">Deprecation: {skill.deprecationNotice}</p>
              ) : null}

              <div className="mt-4 flex items-center gap-2">
                <button
                  disabled={!canInstall || isInstalled || install.isPending || skill.source !== 'registry'}
                  onClick={() => {
                    if (skill.source !== 'registry') return;
                    if (skill.isPremium) {
                      purchase.mutate(skill.id, {
                        onSuccess: (res) => {
                          const d = res.data;
                          toast.success(
                            `Purchase recorded: ${(d.amount_cents / 100).toFixed(2)} ${d.currency} (creator ${(d.creator_amount_cents / 100).toFixed(2)})`,
                          );
                          install.mutate(skill.id, {
                            onSuccess: () => toast.success(`Installed ${skill.name}`),
                            onError: () => toast.error(`Failed to install ${skill.name}`),
                          });
                        },
                        onError: () => toast.error(`Failed to purchase ${skill.name}`),
                      });
                      return;
                    }
                    install.mutate(skill.id, {
                      onSuccess: () => toast.success(`Installed ${skill.name}`),
                      onError: () => toast.error(`Failed to install ${skill.name}`),
                    });
                  }}
                  className="rounded-md border border-cyan-500/60 bg-cyan-600/20 px-3 py-1.5 text-xs font-medium text-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isInstalled ? 'Installed' : skill.isPremium ? `Buy + Install (${(skill.priceCents / 100).toFixed(2)} ${skill.currency})` : 'Install'}
                </button>
                <button
                  disabled={skill.source !== 'registry' || submitReview.isPending}
                  onClick={() => {
                    const ratingInput = window.prompt(`Rate "${skill.name}" from 1-5`, '5');
                    if (ratingInput === null) return;
                    const rating = Number.parseInt(ratingInput, 10);
                    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
                      toast.error('Rating must be an integer between 1 and 5');
                      return;
                    }
                    const review = window.prompt('Optional review text', '') || '';
                    submitReview.mutate(
                      { catalog_entry_id: skill.id, rating, review },
                      {
                        onSuccess: () => {
                          setSelectedSkillId(skill.id);
                          toast.success(`Review saved for ${skill.name}`);
                        },
                        onError: () => toast.error(`Failed to save review for ${skill.name}`),
                      },
                    );
                  }}
                  className="rounded-md border border-zinc-600 px-3 py-1.5 text-xs font-medium text-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Rate
                </button>
                <button
                  disabled={skill.source !== 'registry'}
                  onClick={() => setSelectedSkillName(skill.name)}
                  className="rounded-md border border-zinc-600 px-3 py-1.5 text-xs font-medium text-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Versions
                </button>
                {skill.source === 'fallback' ? (
                  <span className="text-xs text-zinc-500">fallback listing</span>
                ) : null}
              </div>
              {skill.source === 'registry' && selectedSkillId === skill.id && reviews.data && reviews.data.length > 0 ? (
                <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950/40 p-2 text-xs text-zinc-300">
                  <p className="mb-1 text-zinc-400">Latest review</p>
                  <p>
                    {reviews.data[0].display_name || reviews.data[0].username || 'User'}: {reviews.data[0].rating}/5
                  </p>
                  {reviews.data[0].review ? <p className="mt-1 text-zinc-400">{reviews.data[0].review}</p> : null}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
      {selectedSkillName ? (
        <section className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-medium text-zinc-100">Version History: {selectedSkillName}</h2>
            <button
              onClick={() => setSelectedSkillName(null)}
              className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-300"
            >
              Close
            </button>
          </div>
          {versions.isLoading ? <p className="text-xs text-zinc-400">Loading versions…</p> : null}
          {versions.error ? <p className="text-xs text-amber-300">Failed to load version history.</p> : null}
          {versions.data?.length ? (
            <div className="space-y-2">
              {versions.data.slice(0, 8).map((v) => (
                <div key={v.id} className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3 text-xs text-zinc-300">
                  <div className="flex items-center justify-between gap-3">
                    <p>
                      <span className="font-medium text-zinc-100">v{v.version || '0.0.0'}</span>
                      {v.deprecated ? <span className="ml-2 text-amber-300">(deprecated)</span> : null}
                    </p>
                    <p className="text-zinc-500">{v.created_at ? new Date(v.created_at).toLocaleString() : ''}</p>
                  </div>
                  {v.changelog ? <p className="mt-1 text-zinc-400">Changelog: {v.changelog}</p> : null}
                  {v.deprecation_notice ? <p className="mt-1 text-amber-300">Deprecation: {v.deprecation_notice}</p> : null}
                </div>
              ))}
            </div>
          ) : !versions.isLoading ? (
            <p className="text-xs text-zinc-500">No versions found.</p>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
