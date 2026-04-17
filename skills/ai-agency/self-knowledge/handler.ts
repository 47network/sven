export default async function handler(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const action = input.action as string;

  switch (action) {
    case 'describe_architecture': {
      return {
        result: {
          name: 'Sven',
          version: '0.1.0',
          description: 'A full-spectrum autonomous intelligence platform built by 47 Network.',
          philosophy: [
            'Model-swappable core — the base LLM can be upgraded without losing memories, tools, agents, security, or config.',
            'Evolution architecture — intelligence is separate from infrastructure. Everything that makes Sven "Sven" persists independently.',
            'Privacy-first — on-device inference, data minimisation, GDPR-aware, transparency changelog.',
            'Defence-in-depth — PolicyEngine, PromptFirewall, ApprovalManager, RBAC, rate limiting — any single layer can fail without compromising the system.',
            'Self-healing — production v9 pipeline with 33 safety features: file quarantine, circuit breaker, git checkpoints, build/test verification, auto-rollback.',
          ],
          infrastructure: {
            deployment: 'Multi-VM on Proxmox with WireGuard mesh (6 VMs)',
            orchestration: 'Docker Compose with profile-based service activation',
            database: 'PostgreSQL 16 + pgvector',
            eventBus: 'NATS JetStream',
            api: 'Fastify (gateway-api)',
            inference: 'Multi-GPU (AMD RX 9070 XT + RX 6750 XT on VM9, NVIDIA RTX 3060 on VM13)',
            monitoring: 'Prometheus + Grafana + Loki + OTEL Collector + Uptime Kuma',
            search: 'OpenSearch 2.18 (RAG vector + full-text)',
          },
          vmTopology: [
            { name: 'VM4 (sven-platform)', role: 'Core platform — postgres, NATS, gateway, agent-runtime, skill-runner, notifications, workflows' },
            { name: 'VM5/VM9 (sven-ai)', role: 'AI inference — llama-server, LiteLLM, voice pipeline (whisper, piper, wake-word)' },
            { name: 'VM6 (sven-data)', role: 'Data & observability — OpenSearch, RAG pipeline, SearXNG, OTEL, Prometheus, Grafana, Loki' },
            { name: 'VM7 (sven-adapters)', role: 'Channel adapters — 20+ messaging adapters (WhatsApp, Discord, Slack, Telegram, etc.)' },
            { name: 'VM12', role: 'Matrix/Synapse federation' },
            { name: 'VM13 (kaldorei)', role: 'GPU fallback — Ollama with qwen2.5:7b for fast trading inference' },
          ],
        },
      };
    }

    case 'list_capabilities': {
      return {
        result: {
          domains: [
            { name: 'Memory & Knowledge', description: 'Quantum-fading persistent memory, knowledge graph, session stitching, GDPR data rights' },
            { name: 'Emotional Intelligence', description: 'Tone detection, user preference learning, adaptive communication style' },
            { name: 'Calibrated Intelligence', description: 'Confidence scoring, feedback pipeline, self-improvement, pattern observation' },
            { name: 'Community Agents', description: '8+ specialised agents (Guide, Inspector, Curator, Advocate, QA, Librarian, Feature Tester, Imagination)' },
            { name: 'Multi-Channel Messaging', description: '20+ channels: WhatsApp, Discord, Slack, Telegram, Teams, Signal, Matrix, IRC, Twitch, Line, Nostr, and more' },
            { name: 'Smart Home', description: 'Home Assistant entities, Frigate cameras, device control, sensors, speakers' },
            { name: 'Productivity', description: 'Calendars, Trello, Obsidian, Bear, Notion, reminders, email, Slack, NAS file storage' },
            { name: 'Developer Tools', description: 'Git operations (status, diff, log, branches, commits, PRs), code analysis' },
            { name: 'Media & Entertainment', description: 'Spotify, Sonos, GIFs, image generation, media analysis, Shazam, X/Twitter' },
            { name: 'On-Device AI', description: 'Local model inference (Gemma 4 variants), fully private, offline-capable' },
            { name: 'Autonomous Trading', description: '24/7 crypto trading with Kronos predictions, MiroFish simulations, ATR exits, Kelly sizing, adaptive thresholds' },
            { name: 'Security', description: 'SAST scanning, dependency audit, secret scanning, pentest, infra audit, security posture reports' },
            { name: 'Self-Healing', description: 'v9 production pipeline — code scan, fix, deploy, rollback with 33 safety features' },
            { name: 'Self-Coding', description: 'Dynamic skill authoring at runtime, handler validation, quarantine review, gVisor sandboxing' },
            { name: 'Design Intelligence', description: 'Color systems, typography, motion design, layout spacing, design critique' },
            { name: 'OCR & Documents', description: 'Document reading, receipt scanning, table extraction, PII redaction, summarisation' },
            { name: 'Quantum Computing', description: 'State vector simulation, QAOA, Grover search, quantum random generation, hardware abstraction' },
            { name: 'Marketing Intelligence', description: 'Competitor analysis, brand voice, content drafting, campaign planning, ROI analytics' },
            { name: 'Compute Mesh', description: 'Federated device compute, job orchestration, inference routing, mesh scheduling' },
            { name: 'Federation', description: 'Instance-to-instance discovery, community sharing, task delegation, Ed25519 identity' },
            { name: 'Voice Pipeline', description: 'Wake-word detection, speech-to-text (Whisper), text-to-speech (Piper)' },
            { name: 'RAG Pipeline', description: 'Document chunking, embeddings, NAS/Git/Notes ingestion, vector + full-text search' },
          ],
        },
      };
    }

    case 'list_services': {
      return {
        result: {
          services: [
            { name: 'gateway-api', host: 'VM4', role: 'Main API, trading engine, all HTTP routes', port: 3000, resources: '1.5 CPU, 1GB RAM' },
            { name: 'agent-runtime', host: 'VM4', role: 'Chat sessions, LLM routing, soul loading, memory recall', resources: '1 CPU, 768MB RAM' },
            { name: 'skill-runner', host: 'VM4', role: 'Tool execution, self-healing pipeline, code scanner, deploy manager', resources: '1.5 CPU, 1GB RAM' },
            { name: 'registry-worker', host: 'VM4', role: 'Skill registry scanning, cosign verification', resources: '0.75 CPU, 512MB RAM' },
            { name: 'notification-service', host: 'VM4', role: 'Push notifications, Home Assistant, async delivery', resources: '1 CPU, 768MB RAM' },
            { name: 'workflow-executor', host: 'VM4', role: 'Multi-step workflow orchestration', resources: '1 CPU, 768MB RAM' },
            { name: 'postgres', host: 'VM4', role: 'PostgreSQL 16 + pgvector primary datastore', config: 'shared_buffers=512MB, max_connections=200' },
            { name: 'nats', host: 'VM4', role: 'NATS JetStream event bus and message queue' },
            { name: 'llama-server', host: 'VM9', role: 'Primary LLM inference (Qwen3-Coder-30B-A3B)', port: 8080 },
            { name: 'litellm', host: 'VM9', role: 'OpenAI-compatible proxy, model routing, token tracking' },
            { name: 'faster-whisper', host: 'VM9', role: 'Speech-to-text', port: 4500 },
            { name: 'piper', host: 'VM9', role: 'Text-to-speech', port: 4600 },
            { name: 'opensearch', host: 'VM6', role: 'RAG vector + full-text search', resources: '2 CPU, 2GB RAM' },
            { name: 'rag-indexer', host: 'VM6', role: 'Document chunking and embeddings' },
            { name: 'searxng', host: 'VM6', role: 'Private meta search engine', port: 8080 },
            { name: 'prometheus', host: 'VM6', role: 'Metrics storage (30d retention)', port: 9090 },
            { name: 'grafana', host: 'VM6', role: 'Dashboards', port: 9091 },
            { name: 'ollama', host: 'VM13', role: 'GPU fallback (qwen2.5:7b fast inference)', port: 11434 },
          ],
          adapterCount: '20+ messaging adapters on VM7',
          totalContainers: '40+',
        },
      };
    }

    case 'list_skills': {
      return {
        result: {
          totalSkills: 60,
          categories: [
            { name: 'ai-agency', skills: ['agent-messenger', 'agent-spawner', 'model-benchmark', 'model-registry', 'model-router', 'self-knowledge', 'self-heal-guide', 'self-code'], count: 8 },
            { name: 'security', skills: ['dependency-audit', 'infra-scanner', 'pentest-framework', 'sast-scanner', 'secret-scanner', 'security-posture'], count: 6 },
            { name: 'quantum', skills: ['quantum-benchmark', 'quantum-explain', 'quantum-optimize', 'quantum-random', 'quantum-simulate'], count: 5 },
            { name: 'compute-mesh', skills: ['layer-inference-planner', 'mesh-device-manager', 'mesh-job-orchestrator', 'mesh-scheduler'], count: 4 },
            { name: 'design', skills: ['color-system', 'design-critique', 'layout-spacing', 'motion-design', 'typography'], count: 5 },
            { name: 'marketing', skills: ['analytics-reporter', 'brand-voice-enforcer', 'campaign-planner', 'competitor-tracker', 'content-optimizer', 'content-writer', 'conversation-crafter', 'funnel-analyzer', 'roi-calculator'], count: 9 },
            { name: 'notifications', skills: ['proactive-config-manager', 'proactive-sender', 'schedule-message'], count: 3 },
            { name: 'ocr', skills: ['document-reader', 'receipt-scanner', 'table-extractor', 'and 7 more'], count: 10 },
            { name: 'trading', skills: ['chart-analysis', 'and others'], count: 10 },
            { name: 'email-generic', skills: ['email-generic'], count: 1 },
            { name: 'image-generation', skills: ['image-generation'], count: 1 },
            { name: 'openclaw', skills: ['openclaw-bridge'], count: 1 },
          ],
          builtInTools: '80+ tool cases in skill-runner (sven.*, shell.*, git.*, ha.*, calendar.*, nas.*, web.*, search.*, spotify.*, etc.)',
        },
      };
    }

    case 'codebase_map': {
      return {
        result: {
          monorepo: 'thesven_v0.1.0',
          structure: {
            'services/gateway-api/': 'Fastify API — trading engine, all HTTP routes, Binance integration, news aggregator, Kronos, MiroFish, GPU fleet, messaging, souls, goals',
            'services/agent-runtime/': 'Chat sessions, LLM routing, soul loading, memory recall, session stitching, token budgeting',
            'services/skill-runner/': 'Tool execution (80+ tools), self-healing pipeline (v9), code scanner, deploy manager, ops audit',
            'services/notification-service/': 'Push notifications, Home Assistant integration, async delivery, NATS events',
            'services/workflow-executor/': 'Multi-step workflow engine with tool dispatch',
            'services/registry-worker/': 'Skill registry scanning, signature verification (cosign)',
            'services/rag-*/': '4 RAG services: indexer, git-ingestor, nas-ingestor, notes-ingestor',
            'services/adapter-*/': '20+ channel adapters (discord, slack, telegram, whatsapp, matrix, signal, teams, irc, twitch, etc.)',
            'services/sso/': 'Single sign-on identity provider',
            'services/litellm/': 'LiteLLM OpenAI-compatible proxy config',
            'services/faster-whisper/': 'Speech-to-text server',
            'services/piper/': 'Text-to-speech server',
            'packages/shared/': 'Shared TypeScript types, utilities, contracts (skill-loader, tool-executor, personality-engine, stealth-commit)',
            'packages/cli/': 'Sven CLI tool',
            'contracts/grpc/': 'gRPC protocol definitions',
            'apps/admin-ui/': 'Next.js admin dashboard (souls, users, orgs, settings, integrations)',
            'apps/canvas-ui/': 'Canvas-based UI',
            'apps/companion-user-flutter/': 'Flutter mobile companion app (Android/iOS)',
            'apps/companion-desktop-tauri/': 'Tauri desktop companion app',
            'apps/sven-copilot-extension/': 'VS Code Copilot Chat participant extension (@sven)',
            'skills/': '12 categories, 60+ skills — auto-discovered by skill-runner',
            'config/': 'Prometheus, Grafana, OTEL collector, Loki, Promtail, Caddy, Nginx, PM2, Traefik configs',
            'deploy/': 'Multi-VM deployment configs, Kubernetes manifests',
            'scripts/': '100+ operational scripts (health checks, audits, parity checks, smoke tests)',
            'docs/': 'Architecture, API, security, deployment, runbooks, developer guides',
          },
          conventions: {
            api: 'Fastify with { success, data } response envelopes',
            db: 'Parameterized SQL (never string interpolation)',
            events: 'NATS JetStream pub/sub',
            auth: 'requireRole + requireTenantMembership middleware',
            logging: 'Structured JSON via createLogger()',
            git: 'Conventional Commits (feat/fix/perf/refactor/test/docs/chore)',
            testing: 'Jest (unit/integration), Playwright (e2e)',
          },
        },
      };
    }

    case 'trading_status': {
      return {
        result: {
          system: 'Autonomous Crypto Trading Agent',
          mode: 'Paper trading with 47T tokens',
          loopInterval: '60 seconds',
          coreSymbols: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT'],
          dynamicSymbols: 'Up to 10 from Trend Scout (4h TTL)',
          signalSources: ['Kronos BSQ predictions', 'MiroFish simulations', 'LLM reasoning', 'Multi-TF confluence', 'LLM sentiment', 'News intelligence'],
          riskManagement: {
            exits: 'ATR-based dynamic TP/SL (1.5-2.0x ATR stop-loss, 3.0-4.0x ATR take-profit)',
            sizing: 'Dynamic position sizing + Kelly criterion overlay (half-Kelly, active after ≥10 trades)',
            thresholds: 'Adaptive per-candidate confidence (streak penalty, win rate bonus, TF alignment, LLM agreement)',
            circuitBreaker: '5 consecutive losses or 5% daily loss triggers hard stop',
            correlation: 'Pearson correlation filter blocks same-direction entries on correlated assets (≥80%)',
            maxPositions: 5,
          },
          dataFeeds: {
            prices: 'Binance WebSocket (miniTicker stream, auto-reconnect, REST fallback)',
            news: '17 sources + RSS feeds',
            sentiment: 'Per-symbol LLM scoring (bullish/bearish/neutral, 10min cache)',
          },
          notifications: 'Push to companion app on trade entry, close, circuit breaker trip',
          persistence: 'Trading state survives restarts (DB columns on sven_trading_state)',
          goalSystem: 'Milestone-based upgrades, target 500K 47T for live trading access',
        },
      };
    }

    case 'self_assessment': {
      return {
        result: {
          strengths: [
            'Comprehensive self-healing pipeline with 33 safety features — I can scan, fix, test, deploy, and rollback my own code',
            'Multi-channel presence — I am available on 20+ messaging platforms simultaneously',
            'Real autonomous trading — not a demo, real market data, real decisions, real (paper) P&L',
            'Privacy-first architecture — on-device inference, data minimisation, GDPR-aware',
            'Extensible skill system — 60+ skills, dynamic authoring at runtime, gVisor sandboxing',
            'Deep observability — Prometheus, Grafana, Loki, OTEL, structured logging, heal telemetry',
          ],
          limitations: [
            'Paper trading only — have not yet earned live trading access (need 500K 47T milestone)',
            'Single-region deployment — all VMs in one physical location',
            'LLM inference bound by GPU VRAM — concurrent inference limited by 28GB combined VRAM on VM9',
            'No automated A/B testing for trading strategies yet',
            'Admin UI trading dashboard still basic — needs real-time charts and P&L visualisation',
            'Mobile companion app covers core features but some advanced views are still pending',
          ],
          growthAreas: [
            'Portfolio correlation guard (blocking concentrated risk on correlated assets)',
            'Admin UI trading dashboard with real-time charts',
            'Alerting system for trading anomalies and market events',
            'E2E testing coverage for trading loop edge cases',
            'Multi-strategy backtesting framework',
          ],
        },
      };
    }

    default:
      return { error: `Unknown action "${action}". Use: describe_architecture, list_capabilities, list_services, list_skills, codebase_map, trading_status, self_assessment` };
  }
}
