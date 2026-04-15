/**
 * Codebase context builder for Sven's self-awareness.
 * Provides a structured overview of the Sven monorepo
 * so Sven can help code himself with full knowledge.
 */

import * as vscode from 'vscode';
import * as path from 'path';

export async function buildCodebaseContext(): Promise<string> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    return '_No workspace open._';
  }

  const root = workspaceFolders[0].uri;
  const sections: string[] = [];

  sections.push('### Sven Monorepo (thesven_v0.1.0)\n');

  // Check which services exist
  const services = await listDir(root, 'services');
  if (services.length > 0) {
    sections.push('**Services:**');
    const serviceDescriptions: Record<string, string> = {
      'gateway-api': 'Fastify API — all routes, news, Kronos, MiroFish, GPU fleet, messaging, souls, goals',
      'agent-runtime': 'Chat sessions, LLM routing, soul loading, memory recall, session stitching, token budgeting',
      'skill-runner': 'Tool execution, self-healing pipeline (v9), security scanner, deploy manager, code healer, ops audit',
      'notification-service': 'Push notifications, Home Assistant, async delivery, NATS events',
      'workflow-executor': 'Multi-step workflow orchestration engine',
      'registry-worker': 'Skill registry scanning, cosign signature verification',
      'rag-indexer': 'Document chunking + OpenSearch indexing with embeddings',
      'rag-git-ingestor': 'Git repository indexing for RAG',
      'rag-nas-ingestor': 'NAS file system watching and ingestion',
      'rag-notes-ingestor': 'Notes (Obsidian etc.) indexing',
      'egress-proxy': 'Squid HTTP forward proxy with allowlist',
      'searxng': 'SearXNG private meta search engine',
      'litellm': 'LiteLLM OpenAI-compatible proxy, model routing',
      'faster-whisper': 'Speech-to-text (Whisper)',
      'piper': 'Text-to-speech (Piper TTS)',
      'wake-word': 'Voice activation detection',
      'openwakeword-detector': 'Neural wake-word detection',
      'sven-mirror-agent': 'Cross-channel message mirroring',
    };

    for (const svc of services) {
      const desc = serviceDescriptions[svc] || (svc.startsWith('adapter-') ? `Channel adapter (${svc.replace('adapter-', '')})` : '');
      sections.push(`- \`services/${svc}/\` — ${desc}`);
    }
    sections.push('');
  }

  // Check apps
  const apps = await listDir(root, 'apps');
  if (apps.length > 0) {
    sections.push('**Apps:**');
    const appDescriptions: Record<string, string> = {
      'admin-ui': 'Next.js admin dashboard — souls, users, orgs, settings, integrations',
      'canvas-ui': 'Canvas-based UI',
      'companion-user-flutter': 'Flutter mobile companion — dashboard, messages, news, goals',
      'companion-desktop-tauri': 'Tauri desktop companion app',
      'sven-copilot-extension': 'VS Code Copilot Chat participant (@sven) — this extension!',
    };

    for (const app of apps) {
      const desc = appDescriptions[app] || '';
      sections.push(`- \`apps/${app}/\` — ${desc}`);
    }
    sections.push('');
  }

  // Packages
  const packages = await listDir(root, 'packages');
  if (packages.length > 0) {
    sections.push('**Packages:**');
    for (const pkg of packages) {
      if (pkg === 'shared') {
        sections.push(`- \`packages/${pkg}/\` — Shared TypeScript types, utilities, contracts`);
      } else if (pkg === 'cli') {
        sections.push(`- \`packages/${pkg}/\` — Sven CLI tool`);
      }
    }
    sections.push('');
  }

  // Infrastructure
  sections.push('**Infrastructure:**');
  sections.push('- `deploy/multi-vm/` — Multi-VM deployment (VM4 Platform, VM5/9 AI, VM6 Data, VM7 Adapters, VM12 Matrix, VM13 GPU)');
  sections.push('- `config/` — Prometheus, Grafana, OTEL, Loki, Promtail, Caddy, Nginx, PM2, Traefik');
  sections.push('- `contracts/grpc/` — gRPC protocol definitions');
  sections.push('- `scripts/` — 100+ operational scripts');
  sections.push('');

  // Key files in scope
  sections.push('**Key Files (most frequently modified):**');
  sections.push('- `services/gateway-api/src/routes/` — API route handlers');
  sections.push('- `services/gateway-api/src/db/seed.ts` — DB seed including soul content');
  sections.push('- `services/agent-runtime/src/index.ts` — Agent session handler');
  sections.push('- `services/skill-runner/src/index.ts` — Skill execution + self-healing');
  sections.push('- `apps/companion-user-flutter/lib/` — Flutter companion app');
  sections.push('- `apps/admin-ui/src/app/` — Admin dashboard pages');
  sections.push('');

  return sections.join('\n');
}

async function listDir(root: vscode.Uri, subdir: string): Promise<string[]> {
  try {
    const dirUri = vscode.Uri.joinPath(root, subdir);
    const entries = await vscode.workspace.fs.readDirectory(dirUri);
    return entries
      .filter(([, type]) => type === vscode.FileType.Directory)
      .map(([name]) => name)
      .sort();
  } catch {
    return [];
  }
}
