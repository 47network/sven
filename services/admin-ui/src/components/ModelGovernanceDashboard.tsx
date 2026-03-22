import React, { useState, useEffect } from 'react';
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Zap,
  DollarSign,
  TrendingUp,
  Settings,
  RefreshCw,
  PlayCircle,
  PauseCircle,
  AlertTriangle,
} from 'lucide-react';

interface Model {
  id: string;
  name: string;
  provider: string;
  model_identifier: string;
  version: string;
  is_active: boolean;
  cost_per_1k_tokens: number;
  rate_limit_rpm: number;
}

interface Policy {
  id: string;
  policy_scope: string;
  primary_model_id: string;
  fallback_model_id?: string;
  usage_budget_daily?: number;
}

interface CanaryRollout {
  id: string;
  source_model_id: string;
  target_model_id: string;
  rollout_status: string;
  total_traffic_percentage: number;
  error_threshold_percentage: number;
  latency_threshold_ms?: number;
  started_at: string;
  rolled_back_at?: string;
  rollback_reason?: string;
}

interface Metric {
  metric_type: string;
  value: number;
  unit: string;
}

const ModelGovernanceDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'models' | 'policies' | 'rollouts' | 'metrics'>('models');
  const [models, setModels] = useState<Model[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [rollouts, setRollouts] = useState<CanaryRollout[]>([]);
  const [metrics, setMetrics] = useState<Record<string, Metric[]>>({});
  const [loading, setLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
  const [selectedRollout, setSelectedRollout] = useState<CanaryRollout | null>(null);

  // Fetch data
  const fetchModels = async () => {
    try {
      const res = await fetch('/v1/admin/models?limit=100');
      const data = await res.json();
      setModels(data);
    } catch (error) {
      console.error('Failed to fetch models:', error);
    }
  };

  const fetchPolicies = async () => {
    try {
      const res = await fetch('/v1/admin/model-policies?limit=100');
      const data = await res.json();
      setPolicies(data);
    } catch (error) {
      console.error('Failed to fetch policies:', error);
    }
  };

  const fetchRollouts = async () => {
    try {
      const res = await fetch('/v1/admin/canary-rollouts?limit=100');
      const data = await res.json();
      setRollouts(data);
    } catch (error) {
      console.error('Failed to fetch rollouts:', error);
    }
  };

  const fetchMetrics = async (modelId: string) => {
    try {
      const res = await fetch(`/v1/admin/models/${modelId}/metrics?hours=24`);
      const data = await res.json();
      setMetrics((prev) => ({ ...prev, [modelId]: data }));
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
    }
  };

  useEffect(() => {
    if (activeTab === 'models') fetchModels();
    else if (activeTab === 'policies') fetchPolicies();
    else if (activeTab === 'rollouts') fetchRollouts();
  }, [activeTab]);

  useEffect(() => {
    if (selectedModel) {
      fetchMetrics(selectedModel.id);
    }
  }, [selectedModel]);

  // Auto-refresh rollouts every 10 seconds
  useEffect(() => {
    if (activeTab === 'rollouts') {
      const interval = setInterval(fetchRollouts, 10000);
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  // ============ MODELS TAB ============

  const handleCreateModel = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const model = {
      name: formData.get('name'),
      provider: formData.get('provider'),
      model_identifier: formData.get('model_identifier'),
      version: formData.get('version'),
      description: formData.get('description'),
      cost_per_1k_tokens: parseFloat(formData.get('cost_per_1k_tokens') as string) || 0,
      rate_limit_rpm: parseInt(formData.get('rate_limit_rpm') as string) || 0,
    };

    try {
      setLoading(true);
      await fetch('/v1/admin/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(model),
      });
      fetchModels();
      (e.target as HTMLFormElement).reset();
    } catch (error) {
      console.error('Failed to create model:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleModel = async (model: Model) => {
    try {
      await fetch(`/v1/admin/models/${model.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !model.is_active }),
      });
      fetchModels();
    } catch (error) {
      console.error('Failed to toggle model:', error);
    }
  };

  // ============ POLICIES TAB ============

  const handleCreatePolicy = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const policy = {
      policy_scope: formData.get('policy_scope'),
      primary_model_id: formData.get('primary_model_id'),
      fallback_model_id: formData.get('fallback_model_id') || null,
      usage_budget_daily: parseFloat(formData.get('usage_budget_daily') as string) || null,
    };

    try {
      setLoading(true);
      await fetch('/v1/admin/model-policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(policy),
      });
      fetchPolicies();
      (e.target as HTMLFormElement).reset();
    } catch (error) {
      console.error('Failed to create policy:', error);
    } finally {
      setLoading(false);
    }
  };

  // ============ ROLLOUTS TAB ============

  const handleCreateRollout = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const rollout = {
      source_model_id: formData.get('source_model_id'),
      target_model_id: formData.get('target_model_id'),
      error_threshold_percentage: parseFloat(formData.get('error_threshold_percentage') as string) || 5.0,
      latency_threshold_ms: parseInt(formData.get('latency_threshold_ms') as string) || 2000,
    };

    try {
      setLoading(true);
      await fetch('/v1/admin/canary-rollouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rollout),
      });
      fetchRollouts();
      (e.target as HTMLFormElement).reset();
    } catch (error) {
      console.error('Failed to create rollout:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateTraffic = async (rolloutId: string, percentage: number) => {
    try {
      await fetch(`/v1/admin/canary-rollouts/${rolloutId}/traffic`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ total_traffic_percentage: percentage }),
      });
      fetchRollouts();
    } catch (error) {
      console.error('Failed to update traffic:', error);
    }
  };

  const handleCompleteRollout = async (rolloutId: string) => {
    try {
      await fetch(`/v1/admin/canary-rollouts/${rolloutId}/complete`, {
        method: 'POST',
      });
      fetchRollouts();
    } catch (error) {
      console.error('Failed to complete rollout:', error);
    }
  };

  const handleRollback = async (rolloutId: string, reason: string) => {
    try {
      await fetch(`/v1/admin/canary-rollouts/${rolloutId}/rollback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      fetchRollouts();
    } catch (error) {
      console.error('Failed to rollback:', error);
    }
  };

  const getRolloutStatusIcon = (status: string) => {
    if (status === 'completed') return <CheckCircle className="w-4 h-4 text-green-500" />;
    if (status === 'rolled_back') return <AlertCircle className="w-4 h-4 text-red-500" />;
    if (status === 'in_progress') return <TrendingUp className="w-4 h-4 text-blue-500" />;
    return <Clock className="w-4 h-4 text-gray-500" />;
  };

  const getMetricValue = (metrics: Metric[], type: string): string => {
    const metric = metrics.find((m) => m.metric_type === type);
    if (!metric) return 'N/A';
    return `${metric.value.toFixed(2)} ${metric.unit}`;
  };

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Model Governance</h1>
        <RefreshCw className="w-5 h-5 text-gray-500 cursor-pointer hover:text-gray-700" />
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-4 border-b border-gray-200">
        {(['models', 'policies', 'rollouts', 'metrics'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 font-medium capitalize border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* MODELS TAB */}
      {activeTab === 'models' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-4">Add New Model</h2>
            <form onSubmit={handleCreateModel} className="grid grid-cols-2 gap-4">
              <input type="text" name="name" placeholder="Model Name" required className="input" />
              <select name="provider" required className="input">
                <option value="">Select Provider</option>
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="ollama">Ollama</option>
                <option value="custom">Custom</option>
              </select>
              <input type="text" name="model_identifier" placeholder="Model ID" required className="input" />
              <input type="text" name="version" placeholder="Version" required className="input" />
              <textarea name="description" placeholder="Description" className="input col-span-2" />
              <input type="number" name="cost_per_1k_tokens" placeholder="Cost per 1K tokens" step="0.000001" className="input" />
              <input type="number" name="rate_limit_rpm" placeholder="Rate Limit (rpm)" className="input" />
              <button type="submit" disabled={loading} className="col-span-2 btn btn-primary">
                {loading ? 'Creating...' : 'Create Model'}
              </button>
            </form>
          </div>

          {/* Models List */}
          <div className="space-y-3">
            {models.map((model) => (
              <div key={model.id} className="bg-white p-4 rounded-lg shadow hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedModel(model)}>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{model.name}</h3>
                    <p className="text-sm text-gray-600">
                      {model.provider} • {model.model_identifier} • v{model.version}
                    </p>
                    <div className="flex gap-4 mt-2 text-xs text-gray-600">
                      <span className="flex items-center gap-1">
                        <DollarSign className="w-3 h-3" /> ${model.cost_per_1k_tokens}/1K tokens
                      </span>
                      <span className="flex items-center gap-1">
                        <Zap className="w-3 h-3" /> {model.rate_limit_rpm} rpm
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleModel(model);
                      }}
                      className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                        model.is_active ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {model.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </div>
                </div>

                {/* Metrics preview for selected model */}
                {selectedModel?.id === model.id && metrics[model.id] && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div className="bg-blue-50 p-2 rounded">
                        <p className="text-gray-600">Avg Latency</p>
                        <p className="font-semibold text-blue-700">{getMetricValue(metrics[model.id], 'latency')}</p>
                      </div>
                      <div className="bg-red-50 p-2 rounded">
                        <p className="text-gray-600">Error Rate</p>
                        <p className="font-semibold text-red-700">{getMetricValue(metrics[model.id], 'error_rate')}</p>
                      </div>
                      <div className="bg-green-50 p-2 rounded">
                        <p className="text-gray-600">Cost</p>
                        <p className="font-semibold text-green-700">{getMetricValue(metrics[model.id], 'cost')}</p>
                      </div>
                      <div className="bg-purple-50 p-2 rounded">
                        <p className="text-gray-600">Quality</p>
                        <p className="font-semibold text-purple-700">{getMetricValue(metrics[model.id], 'output_quality')}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* POLICIES TAB */}
      {activeTab === 'policies' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-4">Create Model Policy</h2>
            <form onSubmit={handleCreatePolicy} className="grid grid-cols-2 gap-4">
              <select name="policy_scope" required className="input">
                <option value="">Select Scope</option>
                <option value="global">Global</option>
                <option value="chat">Chat-Specific</option>
                <option value="user">User-Specific</option>
              </select>
              <select name="primary_model_id" required className="input">
                <option value="">Select Primary Model</option>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              <select name="fallback_model_id" className="input">
                <option value="">Select Fallback (optional)</option>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              <input type="number" name="usage_budget_daily" placeholder="Daily Budget ($)" step="0.01" className="input" />
              <button type="submit" disabled={loading} className="col-span-2 btn btn-primary">
                {loading ? 'Creating...' : 'Create Policy'}
              </button>
            </form>
          </div>

          {/* Policies List */}
          <div className="space-y-3">
            {policies.map((policy) => {
              const primaryModel = models.find((m) => m.id === policy.primary_model_id);
              return (
                <div key={policy.id} className="bg-white p-4 rounded-lg shadow">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">
                        <span className="inline-block bg-blue-100 text-blue-700 px-2 py-1 rounded text-sm mr-2">{policy.policy_scope}</span>
                        {primaryModel?.name || 'Unknown'}
                      </p>
                      {policy.usage_budget_daily && (
                        <p className="text-sm text-gray-600">Daily Budget: ${policy.usage_budget_daily}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ROLLOUTS TAB */}
      {activeTab === 'rollouts' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-4">Start Canary Rollout</h2>
            <form onSubmit={handleCreateRollout} className="grid grid-cols-2 gap-4">
              <select name="source_model_id" required className="input">
                <option value="">Select Source Model</option>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              <select name="target_model_id" required className="input">
                <option value="">Select Target Model</option>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              <input type="number" name="error_threshold_percentage" placeholder="Error Threshold (%)" step="0.1" defaultValue="5.0" className="input" />
              <input type="number" name="latency_threshold_ms" placeholder="Latency Threshold (ms)" defaultValue="2000" className="input" />
              <button type="submit" disabled={loading} className="col-span-2 btn btn-primary">
                {loading ? 'Starting...' : 'Start Rollout'}
              </button>
            </form>
          </div>

          {/* Rollouts List */}
          <div className="space-y-3">
            {rollouts.map((rollout) => {
              const sourceModel = models.find((m) => m.id === rollout.source_model_id);
              const targetModel = models.find((m) => m.id === rollout.target_model_id);
              return (
                <div
                  key={rollout.id}
                  className="bg-white p-4 rounded-lg shadow border-l-4 transition-all"
                  style={{
                    borderLeftColor:
                      rollout.rollout_status === 'completed'
                        ? '#10b981'
                        : rollout.rollout_status === 'rolled_back'
                          ? '#ef4444'
                          : '#3b82f6',
                  }}
                  onClick={() => setSelectedRollout(rollout)}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3 flex-1">
                      {getRolloutStatusIcon(rollout.rollout_status)}
                      <div>
                        <p className="font-semibold text-gray-900">
                          {sourceModel?.name} → {targetModel?.name}
                        </p>
                        <p className="text-sm text-gray-600 capitalize">{rollout.rollout_status}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-2xl font-bold text-blue-600">{rollout.total_traffic_percentage}%</p>
                        <p className="text-xs text-gray-600">live traffic</p>
                      </div>
                    </div>
                  </div>

                  {/* Traffic Slider */}
                  {rollout.rollout_status === 'in_progress' && (
                    <div className="mb-3">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={rollout.total_traffic_percentage}
                        onChange={(e) => handleUpdateTraffic(rollout.id, parseInt(e.target.value))}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                  )}

                  {/* Thresholds */}
                  <div className="grid grid-cols-3 gap-2 mb-3 text-xs">
                    <div className="bg-red-50 p-2 rounded">
                      <p className="text-gray-600">Error Threshold</p>
                      <p className="font-semibold text-red-700">{rollout.error_threshold_percentage}%</p>
                    </div>
                    <div className="bg-yellow-50 p-2 rounded">
                      <p className="text-gray-600">Latency Threshold</p>
                      <p className="font-semibold text-yellow-700">{rollout.latency_threshold_ms}ms</p>
                    </div>
                    <div className="bg-blue-50 p-2 rounded">
                      <p className="text-gray-600">Started</p>
                      <p className="font-semibold text-blue-700">{new Date(rollout.started_at).toLocaleDateString()}</p>
                    </div>
                  </div>

                  {/* Rollback Reason */}
                  {rollout.rollback_reason && (
                    <div className="mb-3 flex items-start gap-2 bg-red-50 p-2 rounded">
                      <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-red-700">{rollout.rollback_reason}</p>
                    </div>
                  )}

                  {/* Action Buttons */}
                  {rollout.rollout_status === 'in_progress' && (
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCompleteRollout(rollout.id);
                        }}
                        className="flex-1 px-3 py-2 bg-green-500 text-white rounded text-sm font-medium hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
                      >
                        <CheckCircle className="w-4 h-4" /> Complete
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRollback(rollout.id, 'Manual rollback requested by admin');
                        }}
                        className="flex-1 px-3 py-2 bg-red-500 text-white rounded text-sm font-medium hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
                      >
                        <AlertCircle className="w-4 h-4" /> Rollback
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* METRICS TAB */}
      {activeTab === 'metrics' && (
        <div className="space-y-6">
          <p className="text-gray-600">Click on a model in the Models tab to view its metrics here</p>
          {selectedModel && metrics[selectedModel.id] && (
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-lg font-semibold mb-4">{selectedModel.name} - Metrics (24h)</h2>
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg">
                  <p className="text-gray-700 font-medium">Avg Latency</p>
                  <p className="text-3xl font-bold text-blue-600 mt-2">{getMetricValue(metrics[selectedModel.id], 'latency')}</p>
                </div>
                <div className="bg-gradient-to-br from-red-50 to-red-100 p-4 rounded-lg">
                  <p className="text-gray-700 font-medium">Error Rate</p>
                  <p className="text-3xl font-bold text-red-600 mt-2">{getMetricValue(metrics[selectedModel.id], 'error_rate')}</p>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg">
                  <p className="text-gray-700 font-medium">Avg Cost</p>
                  <p className="text-3xl font-bold text-green-600 mt-2">{getMetricValue(metrics[selectedModel.id], 'cost')}</p>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg">
                  <p className="text-gray-700 font-medium">Quality Score</p>
                  <p className="text-3xl font-bold text-purple-600 mt-2">{getMetricValue(metrics[selectedModel.id], 'output_quality')}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <style>{`
        .input {
          width: 100%;
          padding: 0.5rem;
          border: 1px solid #d1d5db;
          border-radius: 0.375rem;
          font-size: 0.875rem;
        }
        .input:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }
        .btn {
          padding: 0.5rem 1rem;
          border: none;
          border-radius: 0.375rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-primary {
          background-color: #3b82f6;
          color: white;
        }
        .btn-primary:hover:not(:disabled) {
          background-color: #2563eb;
        }
        .btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};

export default ModelGovernanceDashboard;
