'use client';

import { Building2 } from 'lucide-react';
import { useMe } from '@/lib/hooks';

export function ActiveAccountPill() {
  const { data: me } = useMe();
  const name = me?.active_organization_name || me?.active_organization_slug || 'No active account';

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-xs font-medium text-cyan-300">
      <Building2 className="h-3.5 w-3.5" />
      {name}
    </span>
  );
}

