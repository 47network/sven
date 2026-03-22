import React, { useEffect, useState } from 'react';
import {
  Clock,
  CheckCircle,
  AlertCircle,
  Pause,
  Play,
  Trash2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface WorkflowStep {
  id: string;
  step_id: string;
  run_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
  attempt_number: number;
  result?: Record<string, any>;
  error_message?: string;
  created_at: string;
  completed_at?: string;
}

interface WorkflowRun {
  id: string;
  workflow_id: string;
  workflow_version: number;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  triggered_by: string;
  input_variables: Record<string, any>;
  output_variables?: Record<string, any>;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
  steps?: WorkflowStep[];
}

interface WorkflowRunsViewerProps {
  workflowId?: string;
  apiBaseUrl?: string;
  onRunDetails?: (run: WorkflowRun) => void;
}

const WorkflowRunsViewer: React.FC<WorkflowRunsViewerProps> = ({
  workflowId,
  apiBaseUrl = 'http://localhost:3000',
  onRunDetails,
}) => {
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch workflow runs
  useEffect(() => {
    const fetchRuns = async () => {
      try {
        setLoading(true);
        const query = new URLSearchParams();
        if (workflowId) {
          query.append('workflow_id', workflowId);
        }
        query.append('limit', '50');

        const response = await fetch(`${apiBaseUrl}/v1/admin/workflow-runs?${query.toString()}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch runs: ${response.statusText}`);
        }

        const data = await response.json();
        setRuns(data.data || []);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchRuns();
    const interval = setInterval(fetchRuns, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, [workflowId, apiBaseUrl]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'running':
        return <Clock className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'paused':
        return <Pause className="w-5 h-5 text-yellow-500" />;
      case 'cancelled':
        return <AlertCircle className="w-5 h-5 text-gray-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-50 border-green-200';
      case 'failed':
        return 'bg-red-50 border-red-200';
      case 'running':
        return 'bg-blue-50 border-blue-200';
      case 'paused':
        return 'bg-yellow-50 border-yellow-200';
      case 'cancelled':
        return 'bg-gray-50 border-gray-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const calculateDuration = (startDate: string, endDate?: string) => {
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : new Date();
    const diff = end.getTime() - start.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const handleCancel = async (runId: string) => {
    try {
      const response = await fetch(`${apiBaseUrl}/v1/admin/workflow-runs/${runId}/cancel`, {
        method: 'POST',
      });
      if (response.ok) {
        setRuns(runs.map(r => (r.id === runId ? { ...r, status: 'cancelled' } : r)));
      }
    } catch (err) {
      console.error('Failed to cancel run:', err);
    }
  };

  const handlePause = async (runId: string) => {
    try {
      const response = await fetch(`${apiBaseUrl}/v1/admin/workflow-runs/${runId}/pause`, {
        method: 'POST',
      });
      if (response.ok) {
        setRuns(runs.map(r => (r.id === runId ? { ...r, status: 'paused' } : r)));
      }
    } catch (err) {
      console.error('Failed to pause run:', err);
    }
  };

  const handleResume = async (runId: string) => {
    try {
      const response = await fetch(`${apiBaseUrl}/v1/admin/workflow-runs/${runId}/resume`, {
        method: 'POST',
      });
      if (response.ok) {
        setRuns(runs.map(r => (r.id === runId ? { ...r, status: 'running' } : r)));
      }
    } catch (err) {
      console.error('Failed to resume run:', err);
    }
  };

  if (loading && runs.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-8 text-center">
        <Clock className="w-8 h-8 text-gray-400 mx-auto mb-2 animate-spin" />
        <p className="text-gray-600">Loading workflow runs...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
        <AlertCircle className="w-5 h-5 inline mr-2" />
        {error}
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="bg-white px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Workflow Runs</h3>
      </div>

      {runs.length === 0 ? (
        <div className="bg-gray-50 px-6 py-8 text-center text-gray-600">
          No workflow runs found
        </div>
      ) : (
        <div className="divide-y divide-gray-200">
          {runs.map(run => (
            <div key={run.id}>
              <button
                onClick={() => setExpandedRunId(expandedRunId === run.id ? null : run.id)}
                className={`w-full px-6 py-4 flex items-center gap-4 hover:bg-gray-50 transition border-l-4 ${getStatusColor(run.status)}`}
              >
                <div className="flex-shrink-0">{getStatusIcon(run.status)}</div>

                <div className="flex-grow text-left">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-gray-700">{run.id.substring(0, 12)}...</span>
                    <span className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded-full capitalize">
                      {run.status}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    Started: {formatDate(run.created_at)}
                    {run.completed_at && (
                      <span className="ml-2">
                        • Duration: {calculateDuration(run.created_at, run.completed_at)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex-shrink-0 flex gap-2">
                  {run.status === 'running' && (
                    <>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          handlePause(run.id);
                        }}
                        className="p-2 text-yellow-600 hover:bg-yellow-100 rounded"
                        title="Pause run"
                      >
                        <Pause className="w-4 h-4" />
                      </button>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          handleCancel(run.id);
                        }}
                        className="p-2 text-red-600 hover:bg-red-100 rounded"
                        title="Cancel run"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  {run.status === 'paused' && (
                    <>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          handleResume(run.id);
                        }}
                        className="p-2 text-green-600 hover:bg-green-100 rounded"
                        title="Resume run"
                      >
                        <Play className="w-4 h-4" />
                      </button>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          handleCancel(run.id);
                        }}
                        className="p-2 text-red-600 hover:bg-red-100 rounded"
                        title="Cancel run"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>

                <div className="flex-shrink-0">
                  {expandedRunId === run.id ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </button>

              {/* Expanded Details */}
              {expandedRunId === run.id && (
                <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Run ID</label>
                      <code className="text-xs bg-white px-2 py-1 rounded border border-gray-200">
                        {run.id}
                      </code>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Workflow Version</label>
                      <p className="text-sm text-gray-600">{run.workflow_version}</p>
                    </div>
                  </div>

                  {run.input_variables && Object.keys(run.input_variables).length > 0 && (
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Input Variables</label>
                      <pre className="text-xs bg-white px-3 py-2 rounded border border-gray-200 overflow-auto">
                        {JSON.stringify(run.input_variables, null, 2)}
                      </pre>
                    </div>
                  )}

                  {run.output_variables && Object.keys(run.output_variables).length > 0 && (
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Output Variables</label>
                      <pre className="text-xs bg-white px-3 py-2 rounded border border-gray-200 overflow-auto">
                        {JSON.stringify(run.output_variables, null, 2)}
                      </pre>
                    </div>
                  )}

                  {run.steps && run.steps.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Steps</label>
                      <div className="space-y-2">
                        {run.steps.map(step => (
                          <div
                            key={step.id}
                            className="bg-white px-3 py-2 rounded border border-gray-200 flex items-start gap-2"
                          >
                            <div className="mt-0.5">{getStatusIcon(step.status)}</div>
                            <div className="flex-grow">
                              <div className="text-sm font-medium text-gray-900">{step.step_id}</div>
                              <div className="text-xs text-gray-500">
                                Attempt {step.attempt_number} • {formatDate(step.created_at)}
                              </div>
                              {step.error_message && (
                                <div className="text-xs text-red-600 mt-1">{step.error_message}</div>
                              )}
                              {step.result && (
                                <pre className="text-xs bg-gray-50 px-2 py-1 rounded mt-1 overflow-auto">
                                  {JSON.stringify(step.result, null, 2)}
                                </pre>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default WorkflowRunsViewer;
