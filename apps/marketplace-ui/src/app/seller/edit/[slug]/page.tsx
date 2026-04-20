'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ShoppingBag, ArrowLeft, Save, Loader2 } from 'lucide-react';
import { fetchListingBySlug, updateListing, type Listing } from '@/lib/api';

export default function EditListingPage() {
  const params = useParams();
  const router = useRouter();
  const slug = typeof params.slug === 'string' ? params.slug : '';

  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [unitPrice, setUnitPrice] = useState('');

  useEffect(() => {
    if (!slug) return;
    fetchListingBySlug(slug).then((l) => {
      if (l) {
        setListing(l);
        setTitle(l.title);
        setDescription(l.description || '');
        setTags(l.tags?.join(', ') || '');
        setCoverImageUrl(l.coverImageUrl || '');
        setUnitPrice(String(l.unitPrice));
      }
      setLoading(false);
    });
  }, [slug]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!listing) return;
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const tagArr = tags.split(',').map((t) => t.trim()).filter(Boolean);
      await updateListing(listing.id, {
        title: title || undefined,
        description: description || undefined,
        tags: tagArr.length > 0 ? tagArr : undefined,
        coverImageUrl: coverImageUrl || null,
        unitPrice: unitPrice ? Number(unitPrice) : undefined,
      });
      setSuccess(true);
      setTimeout(() => router.push(`/seller?agent=${listing.sellerAgentId || 'sven'}`), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen">
      <header className="border-b border-white/5 backdrop-blur-xl bg-surface/40 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-wide">
            <ShoppingBag className="h-5 w-5 text-brand-400" />
            <span>sven <span className="text-brand-400">market</span></span>
          </Link>
          <Link
            href={`/seller?agent=${listing?.sellerAgentId || 'sven'}`}
            className="text-sm text-gray-400 hover:text-white flex items-center gap-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to dashboard
          </Link>
        </div>
      </header>

      <section className="max-w-3xl mx-auto px-6 pt-14 pb-10">
        <h1 className="text-2xl font-bold mb-8">Edit Listing</h1>

        {loading ? (
          <div className="glass-card p-10 text-center text-gray-400">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" /> Loading…
          </div>
        ) : !listing ? (
          <div className="glass-card p-10 text-center text-gray-400">
            Listing <code className="text-white">{slug}</code> not found.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}
            {success && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-4 py-3 text-sm text-emerald-400">
                Listing updated! Redirecting…
              </div>
            )}

            <div>
              <label className="block text-xs uppercase tracking-widest text-gray-400 mb-2">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-brand-400"
                placeholder="Listing title"
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-widest text-gray-400 mb-2">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-brand-400 resize-y"
                placeholder="Describe your listing…"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs uppercase tracking-widest text-gray-400 mb-2">
                  Unit Price ({listing.currency})
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-brand-400"
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest text-gray-400 mb-2">
                  Cover Image URL
                </label>
                <input
                  type="url"
                  value={coverImageUrl}
                  onChange={(e) => setCoverImageUrl(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-brand-400"
                  placeholder="https://…"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-widest text-gray-400 mb-2">
                Tags <span className="normal-case text-gray-600">(comma separated)</span>
              </label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-brand-400"
                placeholder="ai, api, automation"
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 bg-brand-500 hover:bg-brand-400 disabled:opacity-50 px-6 py-2.5 rounded-lg text-sm font-medium transition-colors"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}
