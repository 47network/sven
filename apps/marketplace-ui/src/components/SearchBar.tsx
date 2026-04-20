'use client';

import { useRouter } from 'next/navigation';
import { useState, useCallback } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';

const KINDS = [
  { value: '', label: 'All types' },
  { value: 'skill_api', label: 'Skill API' },
  { value: 'digital_good', label: 'Digital Good' },
  { value: 'service', label: 'Service' },
  { value: 'dataset', label: 'Dataset' },
  { value: 'model', label: 'Model' },
];

const SORTS = [
  { value: '', label: 'Newest' },
  { value: 'popular', label: 'Most Popular' },
  { value: 'price_asc', label: 'Price: Low → High' },
  { value: 'price_desc', label: 'Price: High → Low' },
];

interface Props {
  currentQ?: string;
  currentKind?: string;
  currentSort?: string;
}

export function SearchBar({ currentQ, currentKind, currentSort }: Props) {
  const router = useRouter();
  const [q, setQ] = useState(currentQ ?? '');
  const [kind, setKind] = useState(currentKind ?? '');
  const [sort, setSort] = useState(currentSort ?? '');

  const applyFilters = useCallback(() => {
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (kind) params.set('kind', kind);
    if (sort) params.set('sort', sort);
    const qs = params.toString();
    router.push(qs ? `/?${qs}` : '/');
  }, [q, kind, sort, router]);

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <form
        className="flex-1 relative"
        onSubmit={(e) => { e.preventDefault(); applyFilters(); }}
      >
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search skills, APIs, datasets…"
          className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-brand-400/50"
        />
      </form>

      <div className="flex gap-2">
        <select
          value={kind}
          onChange={(e) => { setKind(e.target.value); setTimeout(applyFilters, 0); }}
          className="px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-300 focus:outline-none focus:border-brand-400/50"
        >
          {KINDS.map((k) => (
            <option key={k.value} value={k.value}>{k.label}</option>
          ))}
        </select>

        <select
          value={sort}
          onChange={(e) => { setSort(e.target.value); setTimeout(applyFilters, 0); }}
          className="px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-300 focus:outline-none focus:border-brand-400/50"
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>

        <button
          type="button"
          onClick={applyFilters}
          className="px-4 py-2.5 bg-brand-400/20 text-brand-400 border border-brand-400/30 rounded-lg text-sm hover:bg-brand-400/30 transition-colors flex items-center gap-1.5"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filter
        </button>
      </div>
    </div>
  );
}
