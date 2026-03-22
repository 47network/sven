'use client';

import { PageHeader } from '@/components/PageHeader';
import { FlaskConical, Play } from 'lucide-react';
import { useState } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

type PolicyMatchedRule = {
  id?: string | number;
  name?: string;
  description?: string;
};

type PolicySimulationResult = {
  allowed: boolean;
  explanation?: string;
  matched_rules?: PolicyMatchedRule[];
} & Record<string, unknown>;

function toPolicySimulationResult(value: unknown): PolicySimulationResult {
  const data = (value && typeof value === 'object') ? (value as Record<string, unknown>) : {};
  const matchedRulesRaw = data.matched_rules;
  const matchedRules = Array.isArray(matchedRulesRaw)
    ? matchedRulesRaw
        .map((rule) => (rule && typeof rule === 'object' ? (rule as Record<string, unknown>) : null))
        .filter((rule): rule is Record<string, unknown> => rule !== null)
        .map((rule) => ({
          id: typeof rule.id === 'string' || typeof rule.id === 'number' ? rule.id : undefined,
          name: typeof rule.name === 'string' ? rule.name : undefined,
          description: typeof rule.description === 'string' ? rule.description : undefined,
        }))
    : undefined;

  return {
    ...data,
    allowed: Boolean(data.allowed),
    explanation: typeof data.explanation === 'string' ? data.explanation : undefined,
    matched_rules: matchedRules,
  };
}

export default function PolicySimulatorPage() {
  const [input, setInput] = useState({
    user_id: '',
    tool_name: '',
    action: '',
    context: '{}',
  });
  const [result, setResult] = useState<PolicySimulationResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSimulate() {
    setLoading(true);
    try {
      let ctx = {};
      try {
        ctx = JSON.parse(input.context);
      } catch {
        toast.error('Invalid JSON in context');
        setLoading(false);
        return;
      }
      const res = await api.policy.simulate({
        user_id: input.user_id || undefined,
        tool_name: input.tool_name || undefined,
        action: input.action || undefined,
        context: ctx,
      });
      setResult(toPolicySimulationResult(res));
    } catch {
      toast.error('Simulation failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <PageHeader title="Policy Simulator" description="Test policy decisions with simulated inputs and see explanations" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Input */}
        <div className="card space-y-4">
          <h3 className="font-medium">Simulation Input</h3>
          <div>
            <label className="mb-1 block text-sm font-medium">User ID</label>
            <input
              className="input w-full"
              value={input.user_id}
              onChange={(e) => setInput({ ...input, user_id: e.target.value })}
              placeholder="optional — leave blank for anonymous"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Tool Name</label>
            <input
              className="input w-full"
              value={input.tool_name}
              onChange={(e) => setInput({ ...input, tool_name: e.target.value })}
              placeholder="e.g. ha.call_service"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Action</label>
            <input
              className="input w-full"
              value={input.action}
              onChange={(e) => setInput({ ...input, action: e.target.value })}
              placeholder="e.g. execute, read, write"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Context (JSON)</label>
            <textarea
              className="input w-full min-h-[120px] font-mono text-xs"
              value={input.context}
              onChange={(e) => setInput({ ...input, context: e.target.value })}
            />
          </div>
          <button
            onClick={handleSimulate}
            disabled={loading}
            className="btn-primary flex items-center gap-1"
          >
            <Play className="h-4 w-4" /> {loading ? 'Simulating…' : 'Run Simulation'}
          </button>
        </div>

        {/* Result */}
        <div className="card">
          <h3 className="font-medium mb-4">Decision Result</h3>
          {result === null ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
              <FlaskConical className="mb-3 h-10 w-10" />
              <p className="text-sm">Run a simulation to see the policy decision</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Decision badge */}
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">Decision:</span>
                <span className={result.allowed ? 'badge-success text-base' : 'badge-danger text-base'}>
                  {result.allowed ? 'ALLOWED' : 'DENIED'}
                </span>
              </div>

              {/* Explanation */}
              {result.explanation && (
                <div>
                  <p className="mb-1 text-sm font-medium">Explanation</p>
                  <div className="rounded-md bg-slate-50 p-3 text-sm dark:bg-slate-800">
                    {result.explanation}
                  </div>
                </div>
              )}

              {/* Matched rules */}
              {result.matched_rules && result.matched_rules.length > 0 && (
                <div>
                  <p className="mb-1 text-sm font-medium">Matched Rules</p>
                  <div className="space-y-1">
                    {result.matched_rules.map((rule, i: number) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 rounded-md bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800"
                      >
                        <span className="font-mono text-xs text-slate-500">{rule.id ?? i + 1}.</span>
                        <span>{rule.name ?? rule.description ?? JSON.stringify(rule)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Raw JSON */}
              <details className="text-sm">
                <summary className="cursor-pointer text-slate-500 hover:text-slate-700">
                  Raw response
                </summary>
                <pre className="mt-2 overflow-auto rounded-md bg-slate-50 p-3 text-xs dark:bg-slate-800">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
