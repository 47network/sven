import React, { useState, useEffect, useRef } from 'react';
import {
  AlertCircle,
  Search,
  Plus,
  Trash2,
  Link as LinkIcon,
  Eye,
  Download,
  FileText,
  Loader,
  ChevronRight,
} from 'lucide-react';

interface Entity {
  id: string;
  type: string;
  name: string;
  description?: string;
  confidence: number;
  created_at: string;
  evidence_count?: number;
}

interface Relation {
  id: string;
  source_entity_id: string;
  target_entity_id: string;
  relation_type: string;
  confidence: number;
  created_at: string;
}

interface Evidence {
  id: string;
  entity_id?: string;
  relation_id?: string;
  quote?: string;
  context: string;
  source_id: string;
  source_chat_id: string;
  extraction_method: string;
  created_at: string;
}

interface GraphStats {
  entities: number;
  relations: number;
  evidence: number;
  topEntityTypes: Array<{ type: string; count: number }>;
}

const KnowledgeGraphExplorer: React.FC<{ chatId?: string }> = ({ chatId = 'default' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [activeTab, setActiveTab] = useState<'explorer' | 'entities' | 'relations' | 'extract'>(
    'explorer'
  );

  // Explorer state
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const [entityList, setEntityList] = useState<Entity[]>([]);
  const [relationList, setRelationList] = useState<Relation[]>([]);
  const [evidenceList, setEvidenceList] = useState<Evidence[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('');
  const [stats, setStats] = useState<GraphStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Entity creation state
  const [newEntity, setNewEntity] = useState<Partial<Entity>>({
    type: 'person',
    name: '',
    confidence: 0.8,
  });

  // Relation creation state
  const [newRelation, setNewRelation] = useState<Partial<Relation>>({
    relation_type: 'knows',
    confidence: 0.8,
  });

  // Extraction state
  const [extractionText, setExtractionText] = useState('');
  const [jobType, setJobType] = useState<'entity' | 'relation' | 'full_analysis'>('full_analysis');
  const [extractionJob, setExtractionJob] = useState<{ jobId: string; status: string } | null>(
    null
  );
  const [extractionLoading, setExtractionLoading] = useState(false);

  // Load initial data
  useEffect(() => {
    loadGraphData();
  }, [chatId]);

  // Poll extraction job status
  useEffect(() => {
    if (!extractionJob) return;

    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/v1/admin/knowledge-graph/extraction-jobs/${extractionJob.jobId}`);
        const job = await response.json();
        setExtractionJob({ jobId: job.id, status: job.status });

        if (job.status === 'completed' || job.status === 'failed') {
          clearInterval(interval);
          if (job.status === 'completed') {
            loadGraphData();
          }
        }
      } catch (error) {
        console.error('Failed to poll job:', error);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [extractionJob]);

  const loadGraphData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [entitiesRes, relationsRes, statsRes] = await Promise.all([
        fetch('/v1/admin/knowledge-graph/entities'),
        fetch('/v1/admin/knowledge-graph/relations'),
        fetch(`/v1/admin/knowledge-graph/stats/${chatId}`),
      ]);

      if (!entitiesRes.ok || !relationsRes.ok) throw new Error('Failed to load data');

      const entitiesData = await entitiesRes.json();
      const relationsData = await relationsRes.json();
      const statsData = await statsRes.json();

      setEntityList(entitiesData.entities || []);
      setRelationList(relationsData.relations || []);
      setStats(statsData);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleEntitySelected = async (entity: Entity) => {
    setSelectedEntity(entity);

    try {
      const [neighborRes, evidenceRes] = await Promise.all([
        fetch(`/v1/admin/knowledge-graph/neighbors/${entity.id}`),
        fetch(`/v1/admin/knowledge-graph/evidence?entityId=${entity.id}`),
      ]);

      if (neighborRes.ok && evidenceRes.ok) {
        const evidenceData = await evidenceRes.json();
        setEvidenceList(evidenceData.evidence || []);
      }
    } catch (error) {
      console.error('Failed to load entity details:', error);
    }
  };

  const handleCreateEntity = async () => {
    if (!newEntity.name || !newEntity.type) {
      setError('Entity name and type required');
      return;
    }

    try {
      const response = await fetch('/v1/admin/knowledge-graph/entities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEntity),
      });

      if (!response.ok) throw new Error('Failed to create entity');

      setNewEntity({ type: 'person', name: '', confidence: 0.8 });
      await loadGraphData();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleCreateRelation = async () => {
    if (!newRelation.source_entity_id || !newRelation.target_entity_id) {
      setError('Source and target entities required');
      return;
    }

    try {
      const response = await fetch('/v1/admin/knowledge-graph/relations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRelation),
      });

      if (!response.ok) throw new Error('Failed to create relation');

      setNewRelation({ relation_type: 'knows', confidence: 0.8 });
      await loadGraphData();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleDeleteEntity = async (id: string) => {
    if (!confirm('Delete this entity and all its relations?')) return;

    try {
      const response = await fetch(`/v1/admin/knowledge-graph/entities/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete entity');

      setSelectedEntity(null);
      await loadGraphData();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleExtractFromText = async () => {
    if (!extractionText.trim()) {
      setError('Please enter text to extract from');
      return;
    }

    setExtractionLoading(true);

    try {
      const response = await fetch('/v1/admin/knowledge-graph/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: extractionText,
          job_type: jobType,
        }),
      });

      if (!response.ok) throw new Error('Failed to submit extraction');

      const job = await response.json();
      setExtractionJob({ jobId: job.jobId, status: job.status });
      setExtractionText('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setExtractionLoading(false);
    }
  };

  const filteredEntities = entityList.filter(
    (e) =>
      (e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.description?.toLowerCase().includes(searchQuery.toLowerCase())) &&
      (!filterType || e.type === filterType)
  );

  const getEntityColor = (type: string): string => {
    const colors: { [key: string]: string } = {
      person: 'bg-blue-100 text-blue-800',
      organization: 'bg-purple-100 text-purple-800',
      place: 'bg-green-100 text-green-800',
      concept: 'bg-yellow-100 text-yellow-800',
      event: 'bg-red-100 text-red-800',
      other: 'bg-gray-100 text-gray-800',
    };
    return colors[type] || colors.other;
  };

  const getRelationColor = (type: string): string => {
    const colors: { [key: string]: string } = {
      knows: 'text-blue-600',
      works_for: 'text-purple-600',
      part_of: 'text-green-600',
      created: 'text-orange-600',
      located_in: 'text-red-600',
      other: 'text-gray-600',
    };
    return colors[type] || colors.other;
  };

  return (
    <div className="w-full h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-800">Knowledge Graph Explorer</h1>
        <p className="text-sm text-gray-600 mt-1">
          {stats && `${stats.entities} entities • ${stats.relations} relations • ${stats.evidence} evidence items`}
        </p>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-4 flex gap-2">
        {(['explorer', 'entities', 'relations', 'extract'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-800'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1).replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
          <AlertCircle size={18} />
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-700 hover:text-red-900"
          >
            ✕
          </button>
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        {/* Explorer Tab */}
        {activeTab === 'explorer' && (
          <div className="h-full overflow-auto p-4">
            <div className="grid grid-cols-3 gap-4 h-full">
              {/* Entity List */}
              <div className="bg-white rounded-lg border border-gray-200 flex flex-col">
                <div className="p-4 border-b border-gray-200">
                  <div className="flex items-center gap-2 mb-3">
                    <Search size={16} className="text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search entities..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="flex-1 text-sm border border-gray-200 rounded px-2 py-1"
                    />
                  </div>
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded px-2 py-1"
                  >
                    <option value="">All Types</option>
                    {stats?.topEntityTypes.map((t) => (
                      <option key={t.type} value={t.type}>
                        {t.type} ({t.count})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex-1 overflow-auto">
                  {loading ? (
                    <div className="p-4 text-center text-gray-500">
                      <Loader size={20} className="animate-spin mx-auto" />
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-200">
                      {filteredEntities.map((entity) => (
                        <button
                          key={entity.id}
                          onClick={() => handleEntitySelected(entity)}
                          className={`w-full text-left p-3 hover:bg-gray-50 transition-colors ${
                            selectedEntity?.id === entity.id ? 'bg-blue-50' : ''
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${getEntityColor(entity.type)}`}>
                              {entity.type}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm text-gray-900 truncate">{entity.name}</p>
                              <p className="text-xs text-gray-500 mt-1">
                                Confidence: {(entity.confidence * 100).toFixed(0)}%
                              </p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Selected Entity Details */}
              {selectedEntity && (
                <div className="bg-white rounded-lg border border-gray-200 flex flex-col">
                  <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                    <h3 className="font-bold text-gray-800">{selectedEntity.name}</h3>
                    <button
                      onClick={() => handleDeleteEntity(selectedEntity.id)}
                      className="p-1 hover:bg-red-50 text-red-600 rounded"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div className="flex-1 overflow-auto p-4 space-y-4">
                    <div>
                      <p className="text-xs font-semibold text-gray-600 uppercase">Type</p>
                      <p className={`mt-1 px-2 py-1 rounded text-sm font-medium w-fit ${getEntityColor(selectedEntity.type)}`}>
                        {selectedEntity.type}
                      </p>
                    </div>

                    {selectedEntity.description && (
                      <div>
                        <p className="text-xs font-semibold text-gray-600 uppercase">Description</p>
                        <p className="mt-1 text-sm text-gray-700">{selectedEntity.description}</p>
                      </div>
                    )}

                    <div>
                      <p className="text-xs font-semibold text-gray-600 uppercase">Confidence</p>
                      <div className="mt-1 w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full"
                          style={{ width: `${selectedEntity.confidence * 100}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-gray-600 uppercase">Created</p>
                      <p className="mt-1 text-sm text-gray-700">
                        {new Date(selectedEntity.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Evidence Panel */}
              <div className="bg-white rounded-lg border border-gray-200 flex flex-col">
                <div className="p-4 border-b border-gray-200">
                  <h3 className="font-bold text-gray-800">Evidence</h3>
                </div>

                <div className="flex-1 overflow-auto">
                  {evidenceList.length === 0 ? (
                    <div className="p-4 text-center text-gray-500 text-sm">
                      No evidence available
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-200">
                      {evidenceList.map((evidence) => (
                        <div key={evidence.id} className="p-3 text-sm">
                          {evidence.quote && (
                            <p className="italic text-gray-700 mb-2 line-clamp-2">"{evidence.quote}"</p>
                          )}
                          <p className="text-xs text-gray-500">
                            {evidence.extraction_method} • {new Date(evidence.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Entities Tab */}
        {activeTab === 'entities' && (
          <div className="h-full overflow-auto p-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Entity List */}
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h3 className="font-bold text-gray-800 mb-4">Entities</h3>
                <div className="divide-y divide-gray-200">
                  {filteredEntities.map((entity) => (
                    <div key={entity.id} className="py-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-800">{entity.name}</p>
                          <span className={`text-xs mt-1 px-2 py-0.5 rounded ${getEntityColor(entity.type)}`}>
                            {entity.type}
                          </span>
                        </div>
                        <button
                          onClick={() => handleDeleteEntity(entity.id)}
                          className="p-1 hover:bg-red-50 text-red-600 rounded"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Create Entity Form */}
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h3 className="font-bold text-gray-800 mb-4">Add Entity</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <input
                      type="text"
                      value={newEntity.name || ''}
                      onChange={(e) => setNewEntity({ ...newEntity, name: e.target.value })}
                      className="w-full border border-gray-200 rounded px-2 py-2 text-sm"
                      placeholder="Entity name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                    <select
                      value={newEntity.type || ''}
                      onChange={(e) => setNewEntity({ ...newEntity, type: e.target.value })}
                      className="w-full border border-gray-200 rounded px-2 py-2 text-sm"
                    >
                      <option value="person">Person</option>
                      <option value="organization">Organization</option>
                      <option value="place">Place</option>
                      <option value="concept">Concept</option>
                      <option value="event">Event</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea
                      value={newEntity.description || ''}
                      onChange={(e) => setNewEntity({ ...newEntity, description: e.target.value })}
                      className="w-full border border-gray-200 rounded px-2 py-2 text-sm"
                      placeholder="Optional description"
                      rows={3}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Confidence: {((newEntity.confidence || 0.8) * 100).toFixed(0)}%
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={newEntity.confidence || 0.8}
                      onChange={(e) => setNewEntity({ ...newEntity, confidence: parseFloat(e.target.value) })}
                      className="w-full"
                    />
                  </div>

                  <button
                    onClick={handleCreateEntity}
                    className="w-full bg-blue-600 text-white rounded py-2 font-medium text-sm hover:bg-blue-700 flex items-center justify-center gap-2"
                  >
                    <Plus size={16} />
                    Create Entity
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Relations Tab */}
        {activeTab === 'relations' && (
          <div className="h-full overflow-auto p-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Relations List */}
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h3 className="font-bold text-gray-800 mb-4">Relations</h3>
                <div className="divide-y divide-gray-200">
                  {relationList.map((rel) => {
                    const source = entityList.find((e) => e.id === rel.source_entity_id);
                    const target = entityList.find((e) => e.id === rel.target_entity_id);

                    return (
                      <div key={rel.id} className="py-3">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-800 text-sm">{source?.name}</p>
                            <p className={`text-xs font-medium my-1 ${getRelationColor(rel.relation_type)}`}>
                              {rel.relation_type}
                            </p>
                            <p className="font-medium text-gray-800 text-sm">{target?.name}</p>
                          </div>
                          <button
                            onClick={() => {
                              // Handle delete
                              fetch(`/v1/admin/knowledge-graph/relations/${rel.id}`, {
                                method: 'DELETE',
                              }).then(() => loadGraphData());
                            }}
                            className="p-1 hover:bg-red-50 text-red-600 rounded"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Create Relation Form */}
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h3 className="font-bold text-gray-800 mb-4">Add Relation</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Source Entity</label>
                    <select
                      value={newRelation.source_entity_id || ''}
                      onChange={(e) =>
                        setNewRelation({ ...newRelation, source_entity_id: e.target.value })
                      }
                      className="w-full border border-gray-200 rounded px-2 py-2 text-sm"
                    >
                      <option value="">Select entity</option>
                      {entityList.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Relation Type</label>
                    <select
                      value={newRelation.relation_type || ''}
                      onChange={(e) =>
                        setNewRelation({ ...newRelation, relation_type: e.target.value })
                      }
                      className="w-full border border-gray-200 rounded px-2 py-2 text-sm"
                    >
                      <option value="knows">Knows</option>
                      <option value="works_for">Works For</option>
                      <option value="part_of">Part Of</option>
                      <option value="created">Created</option>
                      <option value="located_in">Located In</option>
                      <option value="member_of">Member Of</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Target Entity</label>
                    <select
                      value={newRelation.target_entity_id || ''}
                      onChange={(e) =>
                        setNewRelation({ ...newRelation, target_entity_id: e.target.value })
                      }
                      className="w-full border border-gray-200 rounded px-2 py-2 text-sm"
                    >
                      <option value="">Select entity</option>
                      {entityList.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={handleCreateRelation}
                    className="w-full bg-purple-600 text-white rounded py-2 font-medium text-sm hover:bg-purple-700 flex items-center justify-center gap-2"
                  >
                    <LinkIcon size={16} />
                    Create Relation
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Extraction Tab */}
        {activeTab === 'extract' && (
          <div className="h-full overflow-auto p-4">
            <div className="max-w-2xl">
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-xl font-bold text-gray-800 mb-4">Extract Entities & Relations</h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Text to Extract From</label>
                    <textarea
                      value={extractionText}
                      onChange={(e) => setExtractionText(e.target.value)}
                      className="w-full border border-gray-200 rounded px-3 py-2 text-sm font-mono"
                      placeholder="Paste text here to extract entities and relations..."
                      rows={8}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Extraction Type</label>
                    <select
                      value={jobType}
                      onChange={(e) => setJobType(e.target.value as typeof jobType)}
                      className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                    >
                      <option value="entity">Entities Only</option>
                      <option value="relation">Relations Only</option>
                      <option value="full_analysis">Full Analysis (Entities + Relations)</option>
                    </select>
                  </div>

                  <button
                    onClick={handleExtractFromText}
                    disabled={extractionLoading}
                    className="w-full bg-green-600 text-white rounded py-2 font-medium hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {extractionLoading ? (
                      <>
                        <Loader size={16} className="animate-spin" />
                        Extracting...
                      </>
                    ) : (
                      <>
                        <FileText size={16} />
                        Extract
                      </>
                    )}
                  </button>

                  {extractionJob && (
                    <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded">
                      <p className="text-sm font-medium text-blue-900">Job Status</p>
                      <p className="text-sm text-blue-700 mt-1">
                        ID: {extractionJob.jobId.substring(0, 8)}...
                      </p>
                      <p className="text-sm text-blue-700">
                        Status:{' '}
                        <span
                          className={`font-medium ${
                            extractionJob.status === 'completed'
                              ? 'text-green-600'
                              : extractionJob.status === 'failed'
                                ? 'text-red-600'
                                : 'text-blue-600'
                          }`}
                        >
                          {extractionJob.status}
                        </span>
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default KnowledgeGraphExplorer;
