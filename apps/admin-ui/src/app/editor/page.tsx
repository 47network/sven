'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { PageSpinner } from '@/components/Spinner';
import { EmptyState } from '@/components/EmptyState';
import { api, type EditorEntry, type EditorFile } from '@/lib/api';
import { FileText, Folder, FolderOpen, Plus, Save, Search, Trash2, FilePlus2, FolderPlus, RefreshCcw, GitBranch } from 'lucide-react';
import CodeMirror from '@uiw/react-codemirror';
import { githubLight } from '@uiw/codemirror-theme-github';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { sql } from '@codemirror/lang-sql';
import { python } from '@codemirror/lang-python';
import { yaml } from '@codemirror/lang-yaml';
import { StreamLanguage } from '@codemirror/language';
import { shell } from '@codemirror/legacy-modes/mode/shell';
import { EditorView, keymap } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';

type OpenFile = {
  path: string;
  content: string;
  dirty: boolean;
  readOnly: boolean;
  tooLarge: boolean;
};

type SearchResult = { path: string; line: number; text: string };

export default function EditorPage() {
  const [root, setRoot] = useState<string>('.');
  const [entries, setEntries] = useState<Record<string, EditorEntry[]>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['.']));
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [gitStatus, setGitStatus] = useState<string>('');
  const [gitDiff, setGitDiff] = useState<string>('');
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const initialPathOpenedRef = useRef<string | null>(null);

  useEffect(() => {
    loadTree('.').finally(() => setLoading(false));
    refreshGit();
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  async function loadTree(path: string) {
    const res = await api.editor.tree(path);
    setRoot(res.data.root || '.');
    setEntries((prev) => ({ ...prev, [path]: res.data.entries }));
  }

  function toggleDir(path: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
        if (!entries[path]) {
          loadTree(path).catch(() => null);
        }
      }
      return next;
    });
  }

  async function openFile(path: string) {
    setSelectedPath(path);
    const existing = openFiles.find((f) => f.path === path);
    if (existing) {
      setActiveTab(path);
      loadDiff(path).catch(() => null);
      return;
    }
    const res = await api.editor.readFile(path);
    const data = res.data;
    const content = data.content ?? '';
    setOpenFiles((prev) => [
      ...prev,
      {
        path,
        content,
        dirty: false,
        readOnly: Boolean(data.read_only),
        tooLarge: Boolean(data.too_large),
      },
    ]);
    setActiveTab(path);
    loadDiff(path).catch(() => null);
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedPath = String(params.get('path') || '').trim();
    if (!requestedPath) return;
    if (initialPathOpenedRef.current === requestedPath) return;
    initialPathOpenedRef.current = requestedPath;
    openFile(requestedPath).catch(() => null);
  }, []);

  function updateFile(path: string, content: string) {
    setOpenFiles((prev) =>
      prev.map((f) => (f.path === path ? { ...f, content, dirty: true } : f)),
    );
  }

  async function saveFile(path: string) {
    const file = openFiles.find((f) => f.path === path);
    if (!file || file.readOnly) return;
    setSaving(true);
    try {
      await api.editor.writeFile(path, file.content, true);
      setOpenFiles((prev) => prev.map((f) => (f.path === path ? { ...f, dirty: false } : f)));
      refreshGit();
    } finally {
      setSaving(false);
    }
  }

  function closeTab(path: string) {
    setOpenFiles((prev) => prev.filter((f) => f.path !== path));
    if (activeTab === path) {
      const remaining = openFiles.filter((f) => f.path !== path);
      setActiveTab(remaining.length ? remaining[remaining.length - 1].path : null);
    }
  }

  async function handleCreateFile() {
    const name = window.prompt('New file path (relative to workspace root):');
    if (!name) return;
    await api.editor.writeFile(name, '', true);
    await loadTree('.');
    await openFile(name);
  }

  async function handleCreateFolder() {
    const name = window.prompt('New folder path (relative to workspace root):');
    if (!name) return;
    await api.editor.mkdir(name);
    await loadTree('.');
  }

  async function handleRename() {
    if (!selectedPath) return;
    const next = window.prompt('Rename to (relative path):', selectedPath);
    if (!next || next === selectedPath) return;
    await api.editor.rename(selectedPath, next);
    await loadTree('.');
    setSelectedPath(next);
  }

  async function handleDelete() {
    if (!selectedPath) return;
    const ok = window.confirm(`Delete ${selectedPath}?`);
    if (!ok) return;
    await api.editor.deletePath(selectedPath, true);
    await loadTree('.');
    setSelectedPath(null);
  }

  async function handleSearch() {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await api.editor.search('.', searchQuery.trim(), 200);
      setSearchResults(res.data.results || []);
    } finally {
      setSearching(false);
    }
  }

  async function refreshGit() {
    const statusRes = await api.editor.gitStatus().catch(() => null);
    setGitStatus(statusRes?.data?.status || '');
  }

  async function loadDiff(path: string) {
    const diffRes = await api.editor.gitDiff(path).catch(() => null);
    setGitDiff(diffRes?.data?.diff || '');
  }

  const activeFile = openFiles.find((f) => f.path === activeTab);
  const language = useMemo(() => {
    if (!activeFile) return [];
    const ext = activeFile.path.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'ts':
      case 'tsx':
      case 'js':
      case 'jsx':
        return [javascript({ jsx: true, typescript: true })];
      case 'json':
        return [json()];
      case 'md':
      case 'markdown':
        return [markdown()];
      case 'sql':
        return [sql()];
      case 'py':
        return [python()];
      case 'yml':
      case 'yaml':
        return [yaml()];
      case 'sh':
      case 'bash':
        return [StreamLanguage.define(shell)];
      default:
        return [];
    }
  }, [activeFile]);

  if (loading) return <PageSpinner />;

  return (
    <>
      <PageHeader title="Editor" description="Edit files directly in the workspace.">
        <div className="flex items-center gap-2">
          <button className="btn btn-secondary inline-flex items-center gap-1" onClick={handleCreateFile}>
            <FilePlus2 className="h-4 w-4" />
            New File
          </button>
          <button className="btn btn-secondary inline-flex items-center gap-1" onClick={handleCreateFolder}>
            <FolderPlus className="h-4 w-4" />
            New Folder
          </button>
          <button className="btn btn-secondary inline-flex items-center gap-1" onClick={handleRename} disabled={!selectedPath}>
            <Plus className="h-4 w-4 rotate-45" />
            Rename
          </button>
          <button className="btn btn-danger inline-flex items-center gap-1" onClick={handleDelete} disabled={!selectedPath}>
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
        </div>
      </PageHeader>

      <div className="grid grid-cols-[260px_1fr] gap-4">
        <div className="card h-[calc(100vh-220px)] overflow-auto">
          <div className="mb-3 flex items-center justify-between text-xs text-slate-500">
            <span>Workspace</span>
            <button
              className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-700"
              onClick={() => loadTree('.')}
            >
              <RefreshCcw className="h-3 w-3" />
              Refresh
            </button>
          </div>
          {renderTree(entries, entries['.'] || [], expanded, toggleDir, openFile, setSelectedPath, selectedPath)}
        </div>

        <div className="space-y-4">
          <div className="card">
            <div className="flex items-center justify-between">
              <div className="flex gap-1 overflow-x-auto">
                {openFiles.map((file) => (
                  <button
                    key={file.path}
                    onClick={() => {
                      setActiveTab(file.path);
                      loadDiff(file.path);
                    }}
                    className={`rounded-md px-3 py-1 text-xs ${activeTab === file.path ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}
                  >
                    {file.path.split('/').pop()}
                    {file.dirty ? '*' : ''}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="btn btn-primary inline-flex items-center gap-1"
                  onClick={() => activeTab && saveFile(activeTab)}
                  disabled={!activeTab || saving || Boolean(activeFile?.readOnly) || Boolean(activeFile?.tooLarge)}
                >
                  <Save className="h-4 w-4" />
                  Save
                </button>
              </div>
            </div>
            {!activeFile && (
              <EmptyState icon={FileText} title="No file open" description="Select a file from the tree to start editing." />
            )}
            {activeFile && (
              <div className="mt-3">
                {activeFile.tooLarge ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                    File is too large to edit in the browser.
                  </div>
                ) : (
                  <CodeMirror
                    value={activeFile.content}
                    height="520px"
                    theme={githubLight}
                    extensions={[
                      EditorView.lineWrapping,
                      history(),
                      keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
                      highlightSelectionMatches(),
                      ...language,
                    ]}
                    readOnly={activeFile.readOnly}
                    onChange={(value) => activeTab && updateFile(activeTab, value)}
                  />
                )}
                {activeFile.readOnly && (
                  <p className="mt-2 text-xs text-amber-600">Read-only: file is outside workspace boundary.</p>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-[1fr_1fr] gap-4">
            <div className="card">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold">Search</span>
                <button className="btn btn-secondary btn-sm inline-flex items-center gap-1" onClick={handleSearch} disabled={searching}>
                  <Search className="h-3 w-3" />
                  Search
                </button>
              </div>
              <input
                className="input w-full"
                placeholder="Search across project..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                ref={searchInputRef}
              />
              <div className="mt-3 space-y-2 text-xs">
                {searchResults.length === 0 && <p className="text-slate-500">No results yet.</p>}
                {searchResults.map((result, idx) => (
                  <button
                    key={`${result.path}-${result.line}-${idx}`}
                    className="w-full rounded-md border px-2 py-1 text-left hover:bg-slate-50"
                    onClick={() => openFile(result.path)}
                  >
                    <p className="text-[11px] text-slate-500">{result.path}:{result.line}</p>
                    <p className="truncate">{result.text}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold">Git</span>
                <button className="btn btn-secondary btn-sm inline-flex items-center gap-1" onClick={refreshGit}>
                  <GitBranch className="h-3 w-3" />
                  Status
                </button>
              </div>
              <pre className="h-[160px] overflow-auto rounded bg-slate-900 p-2 text-xs text-slate-200 whitespace-pre-wrap">
                {gitStatus || 'git status clean'}
              </pre>
              <div className="mt-2">
                <p className="text-xs text-slate-500">Diff (active file)</p>
                <pre className="h-[160px] overflow-auto rounded bg-slate-900 p-2 text-xs text-slate-200 whitespace-pre-wrap">
                  {gitDiff || 'No diff'}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function renderTree(
  allEntries: Record<string, EditorEntry[]>,
  nodes: EditorEntry[],
  expanded: Set<string>,
  toggleDir: (path: string) => void,
  openFile: (path: string) => void,
  onSelect: (path: string) => void,
  selectedPath: string | null,
) {
  if (!nodes.length) {
    return <p className="text-xs text-slate-500">Empty directory.</p>;
  }
  return (
    <ul className="space-y-1 text-sm">
      {nodes.map((entry) => {
        const path = entry.path || entry.name;
        const isDir = entry.type === 'dir';
        const isExpanded = expanded.has(path);
        const isSelected = selectedPath === path;
        const hasLoaded = Object.prototype.hasOwnProperty.call(allEntries, path);
        const children = hasLoaded ? allEntries[path] : [];
        return (
          <li key={path}>
            <button
              className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left ${isSelected ? 'bg-cyan-50 text-cyan-800' : 'hover:bg-slate-50'}`}
              onClick={() => {
                onSelect(path);
                if (isDir) {
                  toggleDir(path);
                } else {
                  openFile(path);
                }
              }}
            >
              {isDir ? (isExpanded ? <FolderOpen className="h-4 w-4" /> : <Folder className="h-4 w-4" />) : <FileText className="h-4 w-4" />}
              <span className="truncate">{entry.name}</span>
            </button>
            {isDir && isExpanded && (
              <div className="ml-4">
                {children.length > 0 && renderTree(allEntries, children, expanded, toggleDir, openFile, onSelect, selectedPath)}
                {children.length === 0 && hasLoaded && <p className="text-xs text-slate-500">Empty directory.</p>}
                {children.length === 0 && !hasLoaded && <p className="text-xs text-slate-500">Loading…</p>}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
