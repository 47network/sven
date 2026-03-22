'use client';

import React, { useState } from 'react';
import { Plus, Trash2, Play, Save } from 'lucide-react';

interface WorkflowStep {
  id: string;
  type: 'tool_call' | 'approval' | 'conditional' | 'notification';
  config: Record<string, any>;
  label: string;
  x?: number;
  y?: number;
}

interface WorkflowBuilderProps {
  workflowId?: string;
  initialSteps?: WorkflowStep[];
  initialEdges?: Array<{ from: string; to: string }>;
  onSave: (steps: WorkflowStep[], edges: Array<{ from: string; to: string }>) => void;
  onExecute: () => void;
}

export function WorkflowBuilder({
  workflowId,
  initialSteps = [],
  initialEdges = [],
  onSave,
  onExecute
}: WorkflowBuilderProps) {
  const [steps, setSteps] = useState<WorkflowStep[]>(initialSteps);
  const [edges, setEdges] = useState(initialEdges);
  const [selectedStep, setSelectedStep] = useState<string | null>(null);
  const [connectionMode, setConnectionMode] = useState<string | null>(null);

  const addStep = (type: WorkflowStep['type']) => {
    const id = `step_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const newStep: WorkflowStep = {
      id,
      type,
      label: type.replace(/_/g, ' '),
      config: {},
      x: steps.length * 200 + 50,
      y: 100
    };
    setSteps([...steps, newStep]);
  };

  const removeStep = (id: string) => {
    setSteps(steps.filter(s => s.id !== id));
    setEdges(edges.filter(e => e.from !== id && e.to !== id));
    setSelectedStep(null);
  };

  const startConnection = (fromId: string) => {
    setConnectionMode(fromId);
  };

  const endConnection = (toId: string) => {
    if (connectionMode && connectionMode !== toId) {
      setEdges([...edges, { from: connectionMode, to: toId }]);
    }
    setConnectionMode(null);
  };

  const updateStepConfig = (id: string, field: string, value: any) => {
    setSteps(steps.map(s => 
      s.id === id
        ? { ...s, config: { ...s.config, [field]: value } }
        : s
    ));
  };

  const handleSave = () => {
    onSave(steps, edges);
  };

  const getStepColor = (type: string) => {
    switch (type) {
      case 'tool_call':
        return 'bg-blue-500';
      case 'approval':
        return 'bg-yellow-500';
      case 'conditional':
        return 'bg-purple-500';
      case 'notification':
        return 'bg-green-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4 bg-white rounded-lg border">
      {/* Toolbar */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => addStep('tool_call')}
          className="flex items-center gap-1 px-3 py-1.5 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-sm"
        >
          <Plus size={16} /> Tool Call
        </button>
        <button
          onClick={() => addStep('approval')}
          className="flex items-center gap-1 px-3 py-1.5 bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 text-sm"
        >
          <Plus size={16} /> Approval
        </button>
        <button
          onClick={() => addStep('conditional')}
          className="flex items-center gap-1 px-3 py-1.5 bg-purple-100 text-purple-700 rounded hover:bg-purple-200 text-sm"
        >
          <Plus size={16} /> Conditional
        </button>
        <button
          onClick={() => addStep('notification')}
          className="flex items-center gap-1 px-3 py-1.5 bg-green-100 text-green-700 rounded hover:bg-green-200 text-sm"
        >
          <Plus size={16} /> Notification
        </button>
        <button
          onClick={handleSave}
          className="ml-auto flex items-center gap-1 px-3 py-1.5 bg-gray-800 text-white rounded hover:bg-gray-900 text-sm"
        >
          <Save size={16} /> Save Workflow
        </button>
        <button
          onClick={onExecute}
          className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
        >
          <Play size={16} /> Execute
        </button>
      </div>

      {/* Canvas */}
      <div className="relative w-full h-[500px] border-2 border-dashed border-gray-300 rounded bg-gray-50 overflow-auto">
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          {/* Draw edges */}
          {edges.map((edge, idx) => {
            const fromStep = steps.find(s => s.id === edge.from);
            const toStep = steps.find(s => s.id === edge.to);
            if (!fromStep || !toStep) return null;

            const x1 = (fromStep.x || 0) + 60;
            const y1 = (fromStep.y || 0) + 40;
            const x2 = (toStep.x || 0) + 60;
            const y2 = (toStep.y || 0);

            return (
              <line
                key={`edge_${idx}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="#ccc"
                strokeWidth="2"
                markerEnd="url(#arrowhead)"
              />
            );
          })}
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="10"
              refX="9"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 10 3, 0 6" fill="#ccc" />
            </marker>
          </defs>
        </svg>

        {/* Draw steps */}
        {steps.map(step => (
          <div
            key={step.id}
            className={`absolute w-[120px] p-2 rounded cursor-move text-white text-center text-sm font-medium ${getStepColor(step.type)} ${
              selectedStep === step.id ? 'ring-2 ring-offset-2 ring-black' : ''
            }`}
            style={{ left: `${step.x}px`, top: `${step.y}px` }}
            onClick={() => setSelectedStep(step.id)}
            draggable
            onDragEnd={(e) => {
              setSteps(steps.map(s =>
                s.id === step.id
                  ? { ...s, x: e.clientX - 60, y: e.clientY - 20 }
                  : s
              ));
            }}
          >
            <div className="font-semibold text-xs truncate">{step.label}</div>

            {/* Connection handles */}
            <div
              className="absolute -bottom-3 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-gray-800 rounded-full cursor-pointer hover:bg-black"
              onMouseDown={() => startConnection(step.id)}
              onMouseUp={() => endConnection(step.id)}
              title="Drag to connect"
            />

            <button
              onClick={(e) => {
                e.stopPropagation();
                removeStep(step.id);
              }}
              className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 rounded-full p-1"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>

      {/* Step Configuration */}
      {selectedStep && (
        <div className="p-3 bg-gray-100 rounded border">
          {(() => {
            const step = steps.find(s => s.id === selectedStep);
            if (!step) return null;

            if (step.type === 'tool_call') {
              return (
                <div className="space-y-2">
                  <label className="block text-sm font-medium">
                    Tool Name:
                    <input
                      type="text"
                      className="block w-full mt-1 p-2 border rounded"
                      value={step.config.tool_name || ''}
                      onChange={(e) => updateStepConfig(step.id, 'tool_name', e.target.value)}
                      placeholder="e.g., ha.call_service"
                    />
                  </label>
                </div>
              );
            } else if (step.type === 'approval') {
              return (
                <div className="space-y-2">
                  <label className="block text-sm font-medium">
                    Title:
                    <input
                      type="text"
                      className="block w-full mt-1 p-2 border rounded"
                      value={step.config.title || ''}
                      onChange={(e) => updateStepConfig(step.id, 'title', e.target.value)}
                      placeholder="Approval request title"
                    />
                  </label>
                </div>
              );
            } else if (step.type === 'conditional') {
              return (
                <div className="space-y-2">
                  <label className="block text-sm font-medium">Condition (JSON):</label>
                  <textarea
                    className="block w-full p-2 border rounded font-mono text-xs"
                    rows={3}
                    value={JSON.stringify(step.config.condition || {}, null, 2)}
                    onChange={(e) => {
                      try {
                        updateStepConfig(step.id, 'condition', JSON.parse(e.target.value));
                      } catch {}
                    }}
                    placeholder='{"variable":"status","operator":"equals","value":"ready"}'
                  />
                </div>
              );
            }

            return null;
          })()}
        </div>
      )}
    </div>
  );
}
