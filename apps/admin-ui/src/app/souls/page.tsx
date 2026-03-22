'use client';

import { PageHeader } from '@/components/PageHeader';
import { PageSpinner } from '@/components/Spinner';
import { EmptyState } from '@/components/EmptyState';
import {
  useSoulsCatalog,
  useSoulsInstalled,
  useSoulsSignatures,
  useInstallSoul,
  useActivateSoul,
  useAddSoulSignature,
  usePublishSoul,
} from '@/lib/hooks';
import { useMemo, useState, useEffect } from 'react';
import { Package, Sparkles, Download, CheckCircle2, ShieldCheck, FileSignature } from 'lucide-react';
import { toast } from 'sonner';

type Tab = 'catalog' | 'installed' | 'signatures' | 'publish';
type Row = Record<string, unknown>;
type SoulRow = {
  id: string;
  slug: string;
  name: string;
  description?: string;
  version?: string;
  status?: string;
  content?: string;
};
type SignatureRow = {
  id: string;
  soul_id?: string;
  signature_type?: string;
  verified?: boolean;
  trusted?: boolean;
  fingerprint?: string;
};

function rowList(payload: unknown): Row[] {
  if (!payload || typeof payload !== 'object') return [];
  const rec = payload as Record<string, unknown>;
  if (rec.data && typeof rec.data === 'object' && rec.data !== null) {
    const dataRec = rec.data as Record<string, unknown>;
    if (Array.isArray(dataRec.rows)) {
      return dataRec.rows.filter((v): v is Row => typeof v === 'object' && v !== null);
    }
  }
  if (Array.isArray(rec.rows)) {
    return rec.rows.filter((v): v is Row => typeof v === 'object' && v !== null);
  }
  return [];
}

function mapSoulRows(rows: Row[]): SoulRow[] {
  return rows
    .map((r) => ({
      id: typeof r.id === 'string' ? r.id : '',
      slug: typeof r.slug === 'string' ? r.slug : '',
      name: typeof r.name === 'string' ? r.name : 'Soul',
      description: typeof r.description === 'string' ? r.description : undefined,
      version: typeof r.version === 'string' ? r.version : undefined,
      status: typeof r.status === 'string' ? r.status : undefined,
      content: typeof r.content === 'string' ? r.content : undefined,
    }))
    .filter((r) => r.id.length > 0);
}

function mapSignatureRows(rows: Row[]): SignatureRow[] {
  return rows
    .map((r) => ({
      id: typeof r.id === 'string' ? r.id : '',
      soul_id: typeof r.soul_id === 'string' ? r.soul_id : undefined,
      signature_type: typeof r.signature_type === 'string' ? r.signature_type : undefined,
      verified: Boolean(r.verified),
      trusted: Boolean(r.trusted),
      fingerprint: typeof r.fingerprint === 'string' ? r.fingerprint : undefined,
    }))
    .filter((r) => r.id.length > 0);
}

export default function SoulsPage() {
  const [tab, setTab] = useState<Tab>('catalog');
  const [search, setSearch] = useState('');
  const { data: catalog, isLoading: catLoading } = useSoulsCatalog(search);
  const { data: installed, isLoading: instLoading } = useSoulsInstalled();
  const { data: signatures, isLoading: sigLoading } = useSoulsSignatures();
  const installSoul = useInstallSoul();
  const activateSoul = useActivateSoul();
  const addSignature = useAddSoulSignature();
  const publishSoul = usePublishSoul();

  const isLoading = catLoading || instLoading || sigLoading;
  const catalogRows = useMemo(() => mapSoulRows(rowList(catalog)), [catalog]);
  const installedRows = useMemo(() => mapSoulRows(rowList(installed)), [installed]);
  const signatureRows = useMemo(() => mapSignatureRows(rowList(signatures)), [signatures]);

  if (isLoading) return <PageSpinner />;

  function handleInstall(slug: string) {
    installSoul.mutate(
      { slug },
      {
        onSuccess: () => toast.success('Soul installed'),
        onError: () => toast.error('Install failed'),
      },
    );
  }

  function handleActivate(id: string) {
    activateSoul.mutate(id, {
      onSuccess: () => toast.success('Soul activated'),
      onError: () => toast.error('Activation failed'),
    });
  }

  function handleAddSignature(payload: {
    soul_id?: string;
    slug?: string;
    signature_type: string;
    signature: string;
    public_key: string;
    trusted?: boolean;
  }) {
    addSignature.mutate(payload, {
      onSuccess: () => toast.success('Signature added'),
      onError: () => toast.error('Signature add failed'),
    });
  }

  function handlePublish(payload: {
    slug: string;
    name: string;
    description?: string;
    version?: string;
    author?: string;
    tags?: string;
    source?: string;
    content: string;
  }) {
    publishSoul.mutate(
      {
        slug: payload.slug,
        name: payload.name,
        description: payload.description,
        version: payload.version,
        author: payload.author,
        tags: payload.tags ? payload.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
        source: payload.source,
        content: payload.content,
      },
      {
        onSuccess: () => toast.success('Soul published'),
        onError: () => toast.error('Publish failed'),
      },
    );
  }

  function handleDownloadSoul(soul: SoulRow) {
    const content = soul?.content ? String(soul.content) : '';
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${soul.slug || 'soul'}.SOUL.md`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
  }

  return (
    <>
      <PageHeader title="SOUL Registry" description="Browse, install, and activate personality profiles" />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
          {([
            { key: 'catalog', label: `Catalog (${catalogRows.length})` },
            { key: 'installed', label: `Installed (${installedRows.length})` },
            { key: 'signatures', label: `Signatures (${signatureRows.length})` },
            { key: 'publish', label: 'Publish' },
          ] as { key: Tab; label: string }[]).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === t.key
                  ? 'bg-white shadow-sm dark:bg-slate-700'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'catalog' && (
          <input
            className="input w-full sm:w-72"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search souls…"
          />
        )}
      </div>

      {tab === 'catalog' && (
        <>
          {catalogRows.length === 0 ? (
            <EmptyState
              icon={Package}
              title="No souls found"
              description="Publish a SOUL.md or adjust your search."
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {catalogRows.map((s) => (
                <div key={s.id} className="card py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{s.name}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{s.description || '—'}</p>
                      <p className="mt-2 text-xs text-slate-400">
                        {s.slug} · v{s.version}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => handleInstall(s.slug)}
                        disabled={installSoul.isPending}
                        className="btn-primary btn-sm flex items-center gap-1"
                      >
                        <Download className="h-3.5 w-3.5" /> Install
                      </button>
                      <button
                        onClick={() => handleDownloadSoul(s)}
                        className="btn-secondary btn-sm flex items-center gap-1"
                      >
                        <Package className="h-3.5 w-3.5" /> Download SOUL.md
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'installed' && (
        <>
          {installedRows.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="No installed souls"
              description="Install a soul from the catalog to activate a new personality."
            />
          ) : (
            <div className="space-y-3">
              {installedRows.map((s) => (
                <div key={s.id} className="card flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">{s.name}</p>
                    <p className="text-xs text-slate-500">{s.description || '—'}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {s.slug} · v{s.version} · {s.status}
                    </p>
                  </div>
                  <button
                    onClick={() => handleActivate(s.id)}
                    disabled={activateSoul.isPending || s.status === 'active'}
                    className="btn-primary btn-sm flex items-center gap-1"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> {s.status === 'active' ? 'Active' : 'Activate'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'signatures' && (
        <SoulsSignaturePanel
          catalogRows={catalogRows}
          signatureRows={signatureRows}
          onAddSignature={handleAddSignature}
          isPending={addSignature.isPending}
        />
      )}

      {tab === 'publish' && (
        <SoulsPublishPanel onPublish={handlePublish} isPending={publishSoul.isPending} />
      )}
    </>
  );
}

function SoulsSignaturePanel({
  catalogRows,
  signatureRows,
  onAddSignature,
  isPending,
}: {
  catalogRows: SoulRow[];
  signatureRows: SignatureRow[];
  onAddSignature: (payload: {
    soul_id?: string;
    slug?: string;
    signature_type: string;
    signature: string;
    public_key: string;
    trusted?: boolean;
  }) => void;
  isPending: boolean;
}) {
  const [selectedSoul, setSelectedSoul] = useState<string>(catalogRows[0]?.id || '');
  const [signatureType, setSignatureType] = useState('ed25519');
  const [signature, setSignature] = useState('');
  const [publicKey, setPublicKey] = useState('');
  const [trusted, setTrusted] = useState(false);
  const [fingerprint, setFingerprint] = useState('');
  const [verifyStatus, setVerifyStatus] = useState<'idle' | 'verifying' | 'valid' | 'invalid'>('idle');

  const filteredSignatures = selectedSoul
    ? signatureRows.filter((s) => s.soul_id === selectedSoul)
    : signatureRows;

  useEffect(() => {
    let cancelled = false;
    async function computeFingerprint() {
      if (!publicKey.trim()) {
        setFingerprint('');
        return;
      }
      try {
        const enc = new TextEncoder();
        const data = enc.encode(publicKey.trim());
        const hash = await crypto.subtle.digest('SHA-256', data);
        const hex = Array.from(new Uint8Array(hash))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');
        if (!cancelled) setFingerprint(hex);
      } catch {
        if (!cancelled) setFingerprint('');
      }
    }
    computeFingerprint();
    return () => {
      cancelled = true;
    };
  }, [publicKey]);

  async function verifySignatureClientSide() {
    if (!selectedSoul || !publicKey.trim() || !signature.trim()) return;
    setVerifyStatus('verifying');
    try {
      const soul = catalogRows.find((s) => s.id === selectedSoul);
      const message = new TextEncoder().encode(String(soul?.content || ''));
      const sigBytes = Uint8Array.from(atob(signature.trim()), (c) => c.charCodeAt(0));
      const pem = publicKey.trim().replace(/-----BEGIN PUBLIC KEY-----/g, '').replace(/-----END PUBLIC KEY-----/g, '').replace(/\s+/g, '');
      const keyBytes = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));

      let algo: AlgorithmIdentifier | RsaHashedImportParams | EcKeyImportParams | null = null;
      let keyType: 'public' | null = null;
      if (signatureType === 'ed25519') {
        algo = { name: 'Ed25519' };
        keyType = 'public';
      } else if (signatureType === 'rsa-sha256') {
        algo = { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' };
        keyType = 'public';
      } else if (signatureType === 'ecdsa-sha256') {
        algo = { name: 'ECDSA', namedCurve: 'P-256' };
        keyType = 'public';
      }
      if (!algo || !keyType) throw new Error('unsupported signature type');

      const key = await crypto.subtle.importKey('spki', keyBytes, algo, false, ['verify']);
      const verified = await crypto.subtle.verify(
        signatureType === 'ecdsa-sha256' ? { name: 'ECDSA', hash: 'SHA-256' } : algo,
        key,
        sigBytes,
        message,
      );
      setVerifyStatus(verified ? 'valid' : 'invalid');
    } catch {
      setVerifyStatus('invalid');
    }
  }

  return (
    <div className="space-y-4">
      <div className="card space-y-4">
        <div>
          <label className="text-sm font-medium">Soul</label>
          <select
            className="input mt-2 w-full"
            value={selectedSoul}
            onChange={(e) => setSelectedSoul(e.target.value)}
          >
            {catalogRows.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.slug})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium">Signature Type</label>
            <select
              className="input mt-2 w-full"
              value={signatureType}
              onChange={(e) => setSignatureType(e.target.value)}
            >
              <option value="ed25519">ed25519</option>
              <option value="rsa-sha256">rsa-sha256</option>
              <option value="ecdsa-sha256">ecdsa-sha256</option>
            </select>
          </div>
          <div className="flex items-center gap-2 pt-6">
            <button
              onClick={() => setTrusted((prev) => !prev)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                trusted ? 'bg-brand-600' : 'bg-slate-300 dark:bg-slate-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  trusted ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span className="text-sm">Mark signature as trusted</span>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium">Public Key (PEM)</label>
          <textarea
            className="input mt-2 min-h-[120px] w-full"
            value={publicKey}
            onChange={(e) => setPublicKey(e.target.value)}
            placeholder="-----BEGIN PUBLIC KEY-----"
          />
          {fingerprint && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span>fingerprint (sha256): {fingerprint}</span>
              <button
                className="btn-secondary btn-xs"
                onClick={() => {
                  navigator.clipboard.writeText(fingerprint).catch(() => {});
                  localStorage.setItem('sven-trust-fingerprint', fingerprint);
                  toast.success('Fingerprint copied and staged for Settings');
                }}
              >
                Copy
              </button>
            </div>
          )}
        </div>

        <div>
          <label className="text-sm font-medium">Signature (base64)</label>
          <textarea
            className="input mt-2 min-h-[120px] w-full"
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            placeholder="MEUCIQ..."
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            className="btn-secondary btn-sm flex items-center gap-1"
            disabled={!selectedSoul || !signature || !publicKey}
            onClick={verifySignatureClientSide}
          >
            <FileSignature className="h-3.5 w-3.5" />
            Verify
          </button>
          <span className="text-xs text-slate-500">
            {verifyStatus === 'verifying' && 'verifying...'}
            {verifyStatus === 'valid' && 'signature valid'}
            {verifyStatus === 'invalid' && 'signature invalid'}
          </span>
          <button
            className="btn-primary btn-sm flex items-center gap-1"
            disabled={isPending || !selectedSoul || !signature || !publicKey}
            onClick={() =>
              onAddSignature({
                soul_id: selectedSoul,
                signature_type: signatureType,
                signature,
                public_key: publicKey,
                trusted,
              })
            }
          >
            <ShieldCheck className="h-3.5 w-3.5" /> Add Signature
          </button>
        </div>
      </div>

      <div className="card">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Signatures</h3>
          <span className="text-xs text-slate-500">{filteredSignatures.length} records</span>
        </div>
        {filteredSignatures.length === 0 ? (
          <EmptyState icon={ShieldCheck} title="No signatures" description="Add a signature to verify a SOUL." />
        ) : (
          <div className="space-y-2">
            {filteredSignatures.map((s) => (
              <div key={s.id} className="flex flex-col gap-1 rounded-md border p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium">{s.signature_type}</div>
                  <div className="text-xs text-slate-500">
                    {s.verified ? 'verified' : 'unverified'} · {s.trusted ? 'trusted' : 'untrusted'}
                  </div>
                </div>
                <div className="text-xs text-slate-500">fingerprint: {s.fingerprint}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SoulsPublishPanel({
  onPublish,
  isPending,
}: {
  onPublish: (payload: {
    slug: string;
    name: string;
    description?: string;
    version?: string;
    author?: string;
    tags?: string;
    source?: string;
    content: string;
  }) => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState({
    slug: '',
    name: '',
    description: '',
    version: '0.1.0',
    author: '',
    tags: '',
    source: 'local',
    content: '',
  });

  const update = (key: string, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="card space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="text-sm font-medium">Slug</label>
          <input className="input mt-2 w-full" value={form.slug} onChange={(e) => update('slug', e.target.value)} />
        </div>
        <div>
          <label className="text-sm font-medium">Name</label>
          <input className="input mt-2 w-full" value={form.name} onChange={(e) => update('name', e.target.value)} />
        </div>
        <div>
          <label className="text-sm font-medium">Version</label>
          <input className="input mt-2 w-full" value={form.version} onChange={(e) => update('version', e.target.value)} />
        </div>
        <div>
          <label className="text-sm font-medium">Author</label>
          <input className="input mt-2 w-full" value={form.author} onChange={(e) => update('author', e.target.value)} />
        </div>
        <div>
          <label className="text-sm font-medium">Tags (comma-separated)</label>
          <input className="input mt-2 w-full" value={form.tags} onChange={(e) => update('tags', e.target.value)} />
        </div>
        <div>
          <label className="text-sm font-medium">Source</label>
          <input className="input mt-2 w-full" value={form.source} onChange={(e) => update('source', e.target.value)} />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium">Description</label>
        <textarea
          className="input mt-2 min-h-[80px] w-full"
          value={form.description}
          onChange={(e) => update('description', e.target.value)}
        />
      </div>
      <div>
        <label className="text-sm font-medium">SOUL Content</label>
        <textarea
          className="input mt-2 min-h-[160px] w-full"
          value={form.content}
          onChange={(e) => update('content', e.target.value)}
          placeholder="You are Sven..."
        />
      </div>
      <div className="flex justify-end">
        <button
          className="btn-primary btn-sm flex items-center gap-1"
          disabled={isPending || !form.slug || !form.name || !form.content}
          onClick={() => onPublish(form)}
        >
          <Package className="h-3.5 w-3.5" /> Publish Soul
        </button>
      </div>
    </div>
  );
}
