'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { toast } from 'sonner';

const PRESESSION_TTL_MS = 4 * 60 * 1000;

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [step, setStep] = useState<'creds' | 'totp'>('creds');
  const [preSessionId, setPreSessionId] = useState('');
  const [preSessionIssuedAt, setPreSessionIssuedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const adminBasePath = '/admin47';
  const defaultRedirect = '/overview';

  function apiErrorCode(err: unknown): string {
    if (!(err instanceof ApiError)) return '';
    const body = err.body as { error?: { code?: string } } | null;
    return String(body?.error?.code || '').trim().toUpperCase();
  }

  function safeRedirectTarget(): string {
    if (typeof window === 'undefined') return defaultRedirect;
    const redirect = String(new URLSearchParams(window.location.search).get('redirect') || '').trim();
    if (!redirect.startsWith('/')) return defaultRedirect;
    if (redirect.startsWith('//')) return defaultRedirect;
    if (redirect === '/' || redirect === adminBasePath || redirect === `${adminBasePath}/`) {
      return defaultRedirect;
    }
    if (redirect.startsWith(`${adminBasePath}/`)) {
      const trimmed = redirect.slice(adminBasePath.length);
      return trimmed || defaultRedirect;
    }
    if (redirect.startsWith('/v1/') || redirect.startsWith('/api/')) return defaultRedirect;
    return redirect;
  }

  function navigateTo(target: string) {
    if (typeof window === 'undefined') return;
    const normalized = target.startsWith(adminBasePath)
      ? target
      : `${adminBasePath}${target}`;
    window.location.assign(normalized);
  }

  function resetToCreds() {
    setStep('creds');
    setPreSessionId('');
    setPreSessionIssuedAt(null);
    setTotpCode('');
  }

  function isPreSessionExpired(): boolean {
    if (step !== 'totp' || !preSessionIssuedAt) return false;
    return Date.now() - preSessionIssuedAt >= PRESESSION_TTL_MS;
  }

  useEffect(() => {
    if (!preSessionId || step !== 'totp') return;
    const handle = window.setInterval(() => {
      if (preSessionIssuedAt && Date.now() - preSessionIssuedAt >= PRESESSION_TTL_MS) {
        resetToCreds();
        toast.error('Login session expired. Sign in again for a fresh code window.');
      }
    }, 1000);
    return () => window.clearInterval(handle);
  }, [preSessionId, preSessionIssuedAt, step]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.auth.login(username, password);
      if (res?.data?.requires_totp) {
        const nextPreSessionId = String(res.data.pre_session_id || '').trim();
        if (!nextPreSessionId) {
          toast.error('Login session could not be started. Retry sign-in.');
          return;
        }
        setPreSessionId(nextPreSessionId);
        setPreSessionIssuedAt(Date.now());
        setTotpCode('');
        setStep('totp');
      } else {
        navigateTo(safeRedirectTarget());
      }
    } catch (err) {
      const code = apiErrorCode(err);
      if (code === 'LOCAL_AUTH_DISABLED') {
        toast.error('Local auth is disabled for this account. Use SSO to continue.');
      } else if (code === 'ADMIN_TOTP_REQUIRED') {
        toast.error('Admin TOTP enrollment is required before login.');
      } else if (err instanceof ApiError && err.status === 401) {
        toast.error('Invalid credentials');
      } else {
        toast.error('Login failed');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleTotp(e: React.FormEvent) {
    e.preventDefault();
    if (!preSessionId || isPreSessionExpired()) {
      toast.error('Missing login session, please retry');
      resetToCreds();
      return;
    }
    setLoading(true);
    try {
      const res = await api.auth.verifyTotp(preSessionId, totpCode);
      if (res?.success) {
        navigateTo(safeRedirectTarget());
      } else {
        toast.error('Invalid TOTP code');
      }
    } catch (err) {
      const code = apiErrorCode(err);
      if (code === 'INVALID_TOTP') {
        toast.error('Invalid TOTP code');
        return;
      }
      if (code === 'INVALID_SESSION') {
        resetToCreds();
        toast.error('Login session expired. Sign in again for a fresh code window.');
        return;
      }
      if (code === 'ADMIN_TOTP_REQUIRED') {
        resetToCreds();
        toast.error('Admin TOTP enrollment is required before login.');
        return;
      }
      if (code === 'LOCAL_AUTH_DISABLED') {
        resetToCreds();
        toast.error('Local auth is disabled for this account. Use SSO to continue.');
        return;
      }
      if (err instanceof ApiError && err.status === 429) {
        toast.error('Too many attempts. Wait briefly and try again.');
        return;
      }
      toast.error('Verification failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 top-16 h-72 w-72 rounded-full bg-cyan-500/15 blur-3xl" />
        <div className="absolute right-[-40px] top-[-20px] h-80 w-80 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="absolute bottom-[-80px] left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-sky-500/10 blur-3xl" />
      </div>
      <div className="relative w-full max-w-sm">
        {/* Brand */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-sky-500 text-2xl font-bold text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.45)]">
            S
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-100">Sven Admin</h1>
          <p className="mt-1 text-sm text-slate-400">
            Sign in to your administration console
          </p>
        </div>

        <div className="card border-cyan-400/20 bg-slate-900/85 backdrop-blur-xl">
          {step === 'creds' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="username" className="mb-1 block text-sm font-medium text-slate-200">Username</label>
                <input
                  id="username"
                  type="text"
                  className="input w-full"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              <div>
                <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-200">Password</label>
                <input
                  id="password"
                  type="password"
                  className="input w-full"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="btn-primary w-full" disabled={loading}>
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleTotp} className="space-y-4">
              <p className="text-sm text-slate-400">
                Enter the 6-digit code from your authenticator app.
              </p>
              <p className="text-xs text-slate-500">
                If the code window expires, restart sign-in to mint a fresh pre-session.
              </p>
              <p className="text-xs text-cyan-300/80">
                TOTP session window: 4 minutes
              </p>
              <div>
                <label htmlFor="totp" className="mb-1 block text-sm font-medium text-slate-200">TOTP Code</label>
                <input
                  id="totp"
                  type="text"
                  className="input w-full text-center text-lg tracking-[0.3em]"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                  autoFocus
                  required
                />
              </div>
              <button type="submit" className="btn-primary w-full" disabled={loading}>
                {loading ? 'Verifying…' : 'Verify'}
              </button>
              <button
                type="button"
                className="btn-ghost w-full text-sm"
                onClick={() => {
                  resetToCreds();
                }}
              >
                Back to login
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
