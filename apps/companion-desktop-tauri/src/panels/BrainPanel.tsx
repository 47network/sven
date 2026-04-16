// src/panels/BrainPanel.tsx
//
// Brain Admin panel for Sven Desktop.
// Shows quantum fading config, emotional intelligence, reasoning, and GDPR consent.

import { useState, useEffect, useCallback } from 'react';
import { PanelHeader } from '../components/PanelHeader';

interface BrainPanelProps {
  token: string;
  apiBase: string;
}

type R = Record<string, unknown>;

async function fetchJson(url: string, token: string): Promise<unknown> {
  try {
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return {};
    const body = (await r.json()) as R;
    return body.data ?? body;
  } catch {
    return {};
  }
}

type Tab = 'quantum' | 'emotional' | 'reasoning' | 'consent';

export function BrainPanel({ token, apiBase }: BrainPanelProps) {
  const [tab, setTab] = useState<Tab>('quantum');
  const [graph, setGraph] = useState<R>({});
  const [quantumConfig, setQuantumConfig] = useState<R>({});
  const [emotionalSummary, setEmotionalSummary] = useState<R>({});
  const [emotionalHistory, setEmotionalHistory] = useState<R[]>([]);
  const [reasoning, setReasoning] = useState<R[]>([]);
  const [consent, setConsent] = useState<R>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [g, q, es, eh, rs, c] = await Promise.all([
      fetchJson(`${apiBase}/v1/admin/brain/graph`, token),
      fetchJson(`${apiBase}/v1/admin/brain/memory/quantum-fade-config`, token),
      fetchJson(`${apiBase}/v1/admin/brain/emotional/summary`, token),
      fetchJson(`${apiBase}/v1/admin/brain/emotional/history`, token),
      fetchJson(`${apiBase}/v1/admin/brain/reasoning`, token),
      fetchJson(`${apiBase}/v1/admin/brain/memory/consent`, token),
    ]);
    setGraph((g ?? {}) as R);
    setQuantumConfig((q ?? {}) as R);
    setEmotionalSummary((es ?? {}) as R);
    setEmotionalHistory(Array.isArray(eh) ? (eh as R[]) : []);
    setReasoning(Array.isArray(rs) ? (rs as R[]) : []);
    setConsent((c ?? {}) as R);
    setLoading(false);
  }, [apiBase, token]);

  useEffect(() => { load(); }, [load]);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'quantum', label: 'Quantum Fading' },
    { key: 'emotional', label: 'Emotional Intel' },
    { key: 'reasoning', label: 'Reasoning' },
    { key: 'consent', label: 'GDPR Consent' },
  ];

  return (
    <div className="panel">
      <PanelHeader title="Brain Admin" onRefresh={load} />
      <div className="tab-bar">
        {tabs.map((t) => (
          <button key={t.key} className={`tab${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="panel-center">Loading…</div>
      ) : (
        <div className="panel-scroll">
          {tab === 'quantum' && (
            <div className="panel-section">
              <h3>Decay Formula</h3>
              <code className="formula">S(t) = γ_base · e^(-amplitude·t) · cos(ω·t + φ)</code>
              <div className="stat-grid">
                <Stat label="Nodes" value={graph.total_nodes} />
                <Stat label="Edges" value={graph.total_edges} />
              </div>
              <h3>Parameters</h3>
              <div className="kv-list">
                {['gamma_base', 'amplitude', 'omega', 'consolidation_threshold', 'resonance_factor'].map((k) => (
                  <div key={k} className="kv-row">
                    <span className="kv-key">{k.replace(/_/g, ' ')}</span>
                    <span className="kv-val">{String(quantumConfig[k] ?? 'N/A')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {tab === 'emotional' && (
            <div className="panel-section">
              <div className="stat-grid">
                <Stat label="Dominant" value={emotionalSummary.dominant_mood} />
                <Stat label="Avg Sentiment" value={emotionalSummary.avg_sentiment} />
                <Stat label="Samples" value={emotionalSummary.total_samples} />
              </div>
              <h3>Recent History</h3>
              {emotionalHistory.length === 0 ? (
                <p className="empty">No emotional data.</p>
              ) : (
                <div className="kv-list">
                  {emotionalHistory.slice(0, 20).map((h, i) => (
                    <div key={i} className="kv-row">
                      <span className="kv-key">{String(h.emotion ?? 'unknown')}</span>
                      <span className="kv-val">{String(h.intensity ?? '')} · {String(h.timestamp ?? '')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {tab === 'reasoning' && (
            <div className="panel-section">
              <h3>Reasoning Records</h3>
              {reasoning.length === 0 ? (
                <p className="empty">No reasoning records.</p>
              ) : (
                reasoning.slice(0, 20).map((r, i) => (
                  <div key={i} className="card">
                    <strong>{String(r.topic ?? 'Untitled')}</strong>
                    <p>Choice: {String(r.choice ?? 'N/A')}</p>
                    {r.reasoning ? <p className="sub">{String(r.reasoning)}</p> : null}
                  </div>
                ))
              )}
            </div>
          )}
          {tab === 'consent' && (
            <div className="panel-section">
              <div className={`banner ${consent.consent_given ? 'ok' : 'warn'}`}>
                {consent.consent_given ? '✓ Memory consent granted' : '⚠ Consent pending'}
              </div>
              <div className="kv-list">
                <KV label="Allow Consolidation" value={consent.allow_consolidation} />
                <KV label="Emotional Tracking" value={consent.allow_emotional_tracking} />
                <KV label="Reasoning Capture" value={consent.allow_reasoning_capture} />
                <KV label="Retention Days" value={consent.retention_days} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="stat-card">
      <div className="stat-value">{String(value ?? 'N/A')}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function KV({ label, value }: { label: string; value: unknown }) {
  const display = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value ?? 'N/A');
  return (
    <div className="kv-row">
      <span className="kv-key">{label}</span>
      <span className="kv-val">{display}</span>
    </div>
  );
}
