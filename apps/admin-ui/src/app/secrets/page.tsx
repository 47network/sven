'use client';

import { PageHeader } from '@/components/PageHeader';
import { PageSpinner } from '@/components/Spinner';
import { EmptyState } from '@/components/EmptyState';
import { ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';

type SecretEntry = {
  key: string;
  scope: string;
  updated_at: string;
  masked: boolean;
};

export default function SecretsPage() {
  const [secrets, setSecrets] = useState<SecretEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/admin/integrations/runtime/secrets', { credentials: 'include' });
        if (!cancelled && res.ok) {
          const data = await res.json();
          setSecrets(Array.isArray(data?.secrets) ? data.secrets : []);
        }
      } catch {
        if (!cancelled) setSecrets([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <PageSpinner />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Secrets"
        description="Manage integration secrets and API keys"
      />
      {secrets.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="No secrets configured"
          description="Integration secrets will appear here once configured."
        />
      ) : (
        <div className="rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-2 text-left font-medium">Key</th>
                <th className="px-4 py-2 text-left font-medium">Scope</th>
                <th className="px-4 py-2 text-left font-medium">Updated</th>
              </tr>
            </thead>
            <tbody>
              {secrets.map((s) => (
                <tr key={s.key} className="border-b last:border-0">
                  <td className="px-4 py-2 font-mono text-xs">{s.key}</td>
                  <td className="px-4 py-2">{s.scope}</td>
                  <td className="px-4 py-2 text-muted-foreground">{s.updated_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
