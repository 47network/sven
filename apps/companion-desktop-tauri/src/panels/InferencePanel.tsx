// src/panels/InferencePanel.tsx
//
// On-device inference management panel for Sven Desktop.
// Connects to local Ollama sidecar for llama.cpp-based inference.
// Privacy: all inference runs locally — no data leaves the machine.

import { useState } from 'react';
import type { InferenceResponse, LocalModelInfo } from '../lib/api';
import { PanelHeader } from '../components/PanelHeader';

interface InferencePanelProps {
  ollamaOnline: boolean;
  models: LocalModelInfo[];
  activeModelId: string;
  lastResponse: InferenceResponse | null;
  pulling: boolean;
  generating: boolean;
  onPullModel: (name: string) => Promise<void>;
  onDeleteModel: (name: string) => Promise<void>;
  onGenerate: (prompt: string, model: string) => Promise<void>;
  onSetActiveModel: (id: string) => void;
  onRefreshModels: () => Promise<void>;
}

const SUGGESTED_MODELS = [
  { name: 'gemma3:2b', label: 'Gemma 3 E2B', size: '~1.6 GB', desc: 'Fastest, phone-class' },
  { name: 'gemma3:4b', label: 'Gemma 3 E4B', size: '~3.0 GB', desc: 'Balanced, recommended' },
  { name: 'gemma3:12b', label: 'Gemma 3 12B', size: '~8.1 GB', desc: 'Higher quality' },
  { name: 'gemma3:27b', label: 'Gemma 3 27B', size: '~17 GB', desc: 'Max quality (needs 16GB+ RAM)' },
];

export function InferencePanel({
  ollamaOnline,
  models,
  activeModelId,
  lastResponse,
  pulling,
  generating,
  onPullModel,
  onDeleteModel,
  onGenerate,
  onSetActiveModel,
  onRefreshModels,
}: InferencePanelProps) {
  const [prompt, setPrompt] = useState('');
  const [pullTarget, setPullTarget] = useState('');

  return (
    <div className="panel inference-panel">
      <PanelHeader
        title="On-Device AI"
        subtitle="Local inference via Ollama — no data leaves your machine"
      />

      {/* Status */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            className="status-dot"
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: ollamaOnline ? 'var(--ok)' : 'var(--danger)',
              display: 'inline-block',
            }}
          />
          <span style={{ fontSize: 13 }}>
            Ollama: {ollamaOnline ? 'Online' : 'Offline'}
          </span>
          <button
            className="btn-sm"
            onClick={onRefreshModels}
            style={{ marginLeft: 'auto', fontSize: 11 }}
          >
            Refresh
          </button>
        </div>
        {!ollamaOnline && (
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
            Install Ollama from{' '}
            <span style={{ fontFamily: 'monospace' }}>ollama.com</span> and
            ensure it&apos;s running on port 11434.
          </p>
        )}
      </div>

      {/* Privacy badge */}
      <div
        className="card"
        style={{
          marginBottom: 12,
          borderColor: 'var(--ok)',
          backgroundColor: 'rgba(16, 185, 129, 0.05)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>🛡️</span>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>
            On-device inference never sends prompts or responses to external
            servers. Models run in full isolation.
          </span>
        </div>
      </div>

      {/* Installed models */}
      <div className="card" style={{ marginBottom: 12 }}>
        <h3 style={{ fontSize: 13, marginBottom: 8 }}>Installed Models</h3>
        {models.length === 0 && (
          <p style={{ fontSize: 12, color: 'var(--muted)' }}>
            No models installed. Pull one below.
          </p>
        )}
        {models.map((m) => (
          <div
            key={m.id}
            className="model-row"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 0',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <input
              type="radio"
              name="active-model"
              checked={m.id === activeModelId}
              onChange={() => onSetActiveModel(m.id)}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: m.id === activeModelId ? 600 : 400 }}>
                {m.name}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                {formatBytes(m.size_bytes)} · {(m.context_window / 1000).toFixed(0)}K ctx
                · {m.capabilities.join(', ')}
              </div>
            </div>
            <button
              className="btn-sm btn-danger"
              onClick={() => onDeleteModel(m.id)}
              style={{ fontSize: 11 }}
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      {/* Pull new model */}
      <div className="card" style={{ marginBottom: 12 }}>
        <h3 style={{ fontSize: 13, marginBottom: 8 }}>Download Model</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {SUGGESTED_MODELS.map((sm) => {
            const installed = models.some((m) => m.name === sm.name);
            return (
              <div
                key={sm.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  opacity: installed ? 0.5 : 1,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 500 }}>{sm.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                    {sm.size} — {sm.desc}
                  </div>
                </div>
                <button
                  className="btn-sm"
                  disabled={installed || pulling}
                  onClick={() => {
                    setPullTarget(sm.name);
                    onPullModel(sm.name);
                  }}
                  style={{ fontSize: 11 }}
                >
                  {pulling && pullTarget === sm.name
                    ? 'Pulling…'
                    : installed
                      ? 'Installed'
                      : 'Pull'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Inference test */}
      <div className="card" style={{ marginBottom: 12 }}>
        <h3 style={{ fontSize: 13, marginBottom: 8 }}>Test Inference</h3>
        <textarea
          className="input"
          rows={3}
          placeholder="Type a prompt to test local inference…"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          style={{ width: '100%', resize: 'vertical', fontSize: 12 }}
        />
        <button
          className="btn"
          disabled={!ollamaOnline || !activeModelId || generating || !prompt.trim()}
          onClick={() => onGenerate(prompt, activeModelId)}
          style={{ marginTop: 6, fontSize: 12 }}
        >
          {generating ? 'Generating…' : 'Run Local Inference'}
        </button>

        {lastResponse && (
          <div style={{ marginTop: 10, fontSize: 12 }}>
            <div
              style={{
                padding: 8,
                borderRadius: 6,
                backgroundColor: 'var(--bg-subtle)',
                whiteSpace: 'pre-wrap',
                maxHeight: 200,
                overflow: 'auto',
              }}
            >
              {lastResponse.text}
            </div>
            <div
              style={{ marginTop: 4, fontSize: 11, color: 'var(--muted)' }}
            >
              {lastResponse.model} · {lastResponse.tokens_generated} tokens
              · {lastResponse.duration_ms}ms
              · {lastResponse.tokens_per_second.toFixed(1)} tok/s
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  const gb = bytes / 1073741824;
  return gb >= 1.0 ? `${gb.toFixed(1)} GB` : `${(bytes / 1048576).toFixed(0)} MB`;
}
