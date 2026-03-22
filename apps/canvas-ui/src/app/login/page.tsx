'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { extractApiErrorMessage } from '@/lib/error';
import { Bot, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<'credentials' | 'totp'>('credentials');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const [preSessionId, setPreSessionId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function safeRedirectTarget(): string {
    if (typeof window === 'undefined') return '/';
    const redirect = String(new URLSearchParams(window.location.search).get('redirect') || '').trim();
    if (!redirect.startsWith('/')) return '/';
    if (redirect.startsWith('//')) return '/';
    return redirect;
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.auth.login(username, password);
      if (res.data.requires_totp) {
        setPreSessionId(res.data.pre_session_id);
        setStep('totp');
      } else {
        router.push(safeRedirectTarget());
      }
    } catch (error: unknown) {
      setError(extractApiErrorMessage(error, 'Login failed'));
    } finally {
      setLoading(false);
    }
  }

  async function handleTotp(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.auth.verifyTotp(preSessionId, totpCode);
      router.push(safeRedirectTarget());
    } catch (error: unknown) {
      setError(extractApiErrorMessage(error, 'Invalid code'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--bg-secondary)] px-4">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-16 top-12 h-72 w-72 rounded-full bg-cyan-500/15 blur-3xl" />
        <div className="absolute right-[-30px] top-[-40px] h-80 w-80 rounded-full bg-sky-500/12 blur-3xl" />
        <div className="absolute bottom-[-70px] left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-emerald-400/12 blur-3xl" />
      </div>
      <div className="relative w-full max-w-sm space-y-6">
        {/* Brand */}
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-teal-400 shadow-[0_0_24px_rgba(34,211,238,0.45)]">
            <Bot className="h-8 w-8 text-slate-950" />
          </div>
          <h1 className="mt-4 text-2xl font-bold text-[var(--fg)]">Sven Canvas</h1>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">
            {step === 'credentials' ? 'Sign in to continue' : 'Enter your TOTP code'}
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-400/35 bg-red-500/10 px-4 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        {step === 'credentials' ? (
          <form onSubmit={handleLogin} className="space-y-4 rounded-2xl border border-cyan-400/20 bg-white/70 p-5 shadow-xl shadow-cyan-950/5 backdrop-blur dark:bg-slate-900/50">
            <div>
              <label htmlFor="username" className="block text-sm font-medium mb-1">Username</label>
              <input
                id="username"
                className="input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
                required
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-1">Password</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  className="input pr-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--fg-muted)]"
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <button type="submit" className="btn btn-primary w-full justify-center" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
            <a href="/community" className="block text-center text-xs text-cyan-300 hover:text-cyan-200">
              Explore Sven Community
            </a>
          </form>
        ) : (
          <form onSubmit={handleTotp} className="space-y-4 rounded-2xl border border-cyan-400/20 bg-white/70 p-5 shadow-xl shadow-cyan-950/5 backdrop-blur dark:bg-slate-900/50">
            <div>
              <label htmlFor="totp" className="block text-sm font-medium mb-1">TOTP Code</label>
              <input
                id="totp"
                className="input text-center text-lg tracking-[0.3em] font-mono"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
                autoFocus
                required
                placeholder="000000"
              />
            </div>
            <button type="submit" className="btn btn-primary w-full justify-center" disabled={loading}>
              {loading ? 'Verifying…' : 'Verify'}
            </button>
            <button
              type="button"
              onClick={() => { setStep('credentials'); setError(''); }}
              className="btn btn-ghost w-full justify-center"
            >
              Back to login
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
