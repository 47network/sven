# Sven v0.2.0 — Expansion Master Checklist

> Unified checklist across all 8 expansion pillars.
> Each item links to its pillar spec for full detail.
> Updated: 2026-04-11

---

## Legend

- [ ] Not started
- [~] In progress
- [x] Complete
- [!] Blocked

---

## Phase A — Foundation (Weeks 1-4)

### Pillar 1: Design Intelligence
> Spec: [PILLAR_01_DESIGN_INTELLIGENCE.md](PILLAR_01_DESIGN_INTELLIGENCE.md)

- [ ] Motion design skill: easing curves, animation presets, spring physics
- [ ] `/polish` command: typography, color contrast, layout, spacing audit
- [ ] Design reference engine: pull real examples from curated sources
- [ ] Design critique skill: identify visual issues in UI screenshots
- [ ] Design token system: spacing, color palette, typography scale
- [ ] Integration with canvas-ui and admin-ui
- [ ] Self-improvement: Sven applies design skills to his own interfaces
- [ ] Test suite: before/after design audits on sample UIs

### Pillar 5: Security & Defense
> Spec: [PILLAR_05_SECURITY_DEFENSE.md](PILLAR_05_SECURITY_DEFENSE.md)

- [ ] SAST scanner: TypeScript, Python, SQL injection, XSS detection
- [ ] DAST scanner: endpoint fuzzing, auth bypass, injection testing
- [ ] Dependency vulnerability scanner: npm audit, CVE database
- [ ] Infrastructure scanner: Docker, Nginx, SSH, firewall config audit
- [ ] Automated vulnerability reports with severity scoring
- [ ] Auto-remediation: generate fixes for known vulnerability patterns
- [ ] Penetration testing skills: organized recon → exploit → report
- [ ] Security dashboard in admin-ui
- [ ] Integration with self-healing pipeline (auto-fix vulnerabilities)
- [ ] Scheduled security scans (daily SAST, weekly DAST, monthly infra)

### Pillar 7: Marketing Intelligence
> Spec: [PILLAR_07_MARKETING_INTELLIGENCE.md](PILLAR_07_MARKETING_INTELLIGENCE.md)

- [ ] Competitive intelligence engine: scraper + LLM analysis
- [ ] Conversation simulator: role-play difficult scenarios
- [ ] Performance review generator: promotion-focused
- [ ] Strategic language analyzer: leadership language extraction
- [ ] Communication style auditor: self-perception mirror
- [ ] Content generation pipeline: blog, social, email, scripts
- [ ] Brand voice profile for 47Network
- [ ] Brand consistency checker
- [ ] Scheduled competitive scans + weekly reports
- [ ] Marketing analytics integration

---

## Phase B — Intelligence Layer (Weeks 5-10)

### Pillar 2: Multi-Model & AI Agency
> Spec: [PILLAR_02_MULTI_MODEL_AGENCY.md](PILLAR_02_MULTI_MODEL_AGENCY.md)

- [ ] Model router: intelligent routing to best model per task
- [ ] Local model hosting: Ollama integration on VM5/VM9/VM13
- [ ] MIMO V2 Pro integration (Xiaomi's model)
- [ ] Qwen 3.5 integration (local 17B active)
- [ ] Nemotron 3 Super integration (120B, 1M context)
- [ ] Multi-agent agency: 120+ specialized AI agents
- [ ] Agent registry and lifecycle management
- [ ] Agent-to-agent communication protocol
- [ ] Parallel code review agents (inspired by Claude Code Review)
- [ ] Auto-research agent (inspired by Carpathian Auto Research)
- [ ] Model benchmarking and selection pipeline
- [ ] Cost optimization: prefer local models, cloud as fallback

### Pillar 3: OCR & Document Intelligence
> Spec: [PILLAR_03_OCR_DOCUMENT_INTELLIGENCE.md](PILLAR_03_OCR_DOCUMENT_INTELLIGENCE.md)

- [ ] GLM-OCR model integration (0.9B params, local inference)
- [ ] OCR pipeline: image → preprocess → OCR → structure → output
- [ ] Document types: invoices, receipts, contracts, forms, handwriting
- [ ] Multi-language support
- [ ] Structured data extraction (tables, key-value pairs)
- [ ] Batch processing with distributed compute mesh (Pillar 8)
- [ ] OCR skills: scan_document, extract_table, process_invoice
- [ ] Accuracy benchmarking against commercial offerings
- [ ] Integration with admin-ui for document upload
- [ ] Cost comparison dashboard: GLM-OCR vs. commercial APIs

### Pillar 8: Distributed Compute Mesh
> Spec: [PILLAR_08_DISTRIBUTED_COMPUTE.md](PILLAR_08_DISTRIBUTED_COMPUTE.md)

- [ ] Compute mesh coordinator service
- [ ] Device registry and heartbeat system
- [ ] Work decomposition: MapReduce, Scatter-Gather, Pipeline, Layer-Split
- [ ] Scheduler: capability matching, load balancing, battery awareness
- [ ] VM workers deployed on VM4-VM13
- [ ] Desktop worker (Tauri companion integration)
- [ ] Mobile worker (Flutter companion, S24 Ultra)
- [ ] AirLLM-style layer-by-layer inference on limited devices
- [ ] Work unit encryption (AES-256-GCM)
- [ ] Sandboxed execution per platform
- [ ] Result verification (hash integrity)
- [ ] Federation compute sharing protocol
- [ ] Compute credit system
- [ ] Gemma 4 on-device inference
- [ ] Monitoring: mesh topology dashboard, device utilization

---

## Phase C — Trading Platform (Weeks 11-20)

### Pillar 6: Trading Platform & Financial AI
> Spec: [PILLAR_06_TRADING_PLATFORM.md](PILLAR_06_TRADING_PLATFORM.md)

#### Phase 6A — Data Foundation (Weeks 11-12)
- [ ] TimescaleDB hypertables on VM6
- [ ] Market data ingest service with Binance + CoinGecko connectors
- [ ] Data normalization and NATS broadcasting
- [ ] Continuous aggregates: 1m → 5m, 15m, 1h, 4h, 1d
- [ ] Data quality monitoring and gap detection
- [ ] Retention policy: hot → warm → cold tiering

#### Phase 6B — Prediction Layer (Weeks 13-14)
- [ ] Kronos model downloaded and integrated
- [ ] Binary Spherical Quantization tokenizer
- [ ] Prediction pipeline: ingest → tokenize → predict → decode
- [ ] Multi-horizon predictions: 1h, 4h, 1d
- [ ] Prediction accuracy tracking
- [ ] MiroFish simulation engine: agent factory, orderbook sim

#### Phase 6C — Trading Engine (Weeks 15-16)
- [ ] Trading engine service with strategy framework
- [ ] Order Management System (paper trading)
- [ ] Risk management module with circuit breakers
- [ ] Position sizing: fixed fractional, Kelly, volatility-based
- [ ] Decision logging with full context
- [ ] Sven autonomous trading loop (60s cycle)

#### Phase 6D — News Intelligence (Weeks 16-17)
- [ ] News intelligence service
- [ ] News source integration: NewsAPI, Finnhub, CryptoPanic
- [ ] NLP pipeline: dedup → entities → sentiment → impact
- [ ] Sven LLM analysis for high-impact events
- [ ] News signals connected to trading engine

#### Phase 6E — Trading UI (Weeks 17-19)
- [ ] React SPA at trading.sven.systems
- [ ] Dashboard: portfolio, P&L, positions
- [ ] TradingView lightweight-charts integration
- [ ] Predictions page with accuracy history
- [ ] News feed with impact scoring
- [ ] Strategy management page
- [ ] Real-time WebSocket data flow
- [ ] Demo mode for external users

#### Phase 6F — Advanced (Weeks 19-20)
- [ ] MiroFish simulation complete
- [ ] Tool Builder: Sven self-creates analysis tools
- [ ] Backtesting engine with walk-forward optimization
- [ ] Monte Carlo simulation for stress testing
- [ ] Agent swarm: 8 specialized financial agents
- [ ] Internal currency system (47Token)
- [ ] Portfolio reviewer agent

---

## Phase D — Frontier (Weeks 21+)

### Pillar 4: Quantum Computing Exploration
> Spec: [PILLAR_04_QUANTUM_EXPLORATION.md](PILLAR_04_QUANTUM_EXPLORATION.md)

- [ ] Origin Pilot quantum OS evaluated and documented
- [ ] Quantum circuit simulator integration (local)
- [ ] Quantum algorithm library: Shor's, Grover's, VQE, QAOA
- [ ] Hybrid quantum-classical pipeline
- [ ] Quantum-ready encryption assessment for Sven infrastructure
- [ ] Educational mode: Sven explains quantum concepts
- [ ] Hardware gateway: connect to IBM/IonQ/Origin when available
- [ ] Quantum-inspired optimization for trading strategies
- [ ] Documentation: quantum computing primer for the team

---

## Cross-Pillar Integration

### Prediction → Trading
- [ ] Kronos predictions feed directly into trading signal aggregation
- [ ] MiroFish simulation consensus feeds into trading decisions
- [ ] News intelligence impact scores trigger trading signals

### Security → Self-Healing
- [ ] Vulnerability scanner findings feed into auto-remediation
- [ ] Security scan results tracked in self-healing audit trail
- [ ] Auto-fix pipeline for known vulnerability patterns

### Distributed Compute → Trading
- [ ] Backtesting distributed across compute mesh
- [ ] MiroFish simulations distributed across GPU devices
- [ ] Batch prediction processing distributed

### Marketing → Trading
- [ ] Trading performance data generates marketing content
- [ ] Competitive intel on trading platforms feeds strategy

### Multi-Model → All Pillars
- [ ] Model router serves all pillar LLM needs
- [ ] Local inference preferred, cloud fallback
- [ ] Task classification routes to best model per pillar

### OCR → Trading + Marketing
- [ ] Financial document processing for trading research
- [ ] Marketing collateral analysis through OCR

---

## Infrastructure Checklist

### DNS
- [ ] trading.sven.systems → VM4/VM-TRADE
- [ ] TLS certificate for trading.sven.systems

### New Services
- [ ] trading-engine (VM4)
- [ ] trading-gateway (VM4)
- [ ] market-data-ingest (VM4)
- [ ] prediction-engine (VM5)
- [ ] news-intelligence (VM4)
- [ ] compute-mesh coordinator (VM4)
- [ ] Worker containers on VM4-VM13

### Database Extensions
- [ ] TimescaleDB extension on VM6
- [ ] All hypertables created (market data, predictions, orders, etc.)
- [ ] Backup and retention policies configured

### Docker Compose
- [ ] docker-compose.trading.yml
- [ ] docker-compose.mesh.yml
- [ ] Integrated into main compose profiles

### Monitoring
- [ ] Prometheus targets for all new services
- [ ] Grafana dashboards: trading, mesh, predictions, security
- [ ] Alert rules: data gaps, prediction failures, risk breaches
- [ ] Health endpoints on all new services

### Models & ML
- [ ] Kronos weights downloaded to VM5
- [ ] GLM-OCR weights downloaded to VM5
- [ ] Gemma 4 compact variants pushed to mobile devices
- [ ] ONNX runtime configured for desktop inference
- [ ] TFLite configured for mobile inference

---

## Security & Compliance Checklist

- [ ] Exchange API keys encrypted at rest (AES-256)
- [ ] No secrets in code, config, or logs
- [ ] All new endpoints rate-limited
- [ ] JWT authentication on all WebSocket connections
- [ ] Admin-gated approval for real exchange connections
- [ ] Work unit encryption for distributed compute
- [ ] Device authentication tokens for mesh workers
- [ ] PII handling: none in trading logs, mesh payloads, or marketing scrapes
- [ ] GDPR: competitive intel scraping respects robots.txt and public data only
- [ ] Audit trail: all privileged actions logged
- [ ] TLS on all new connections

---

## Testing Checklist

- [ ] Unit tests for all new skills (marketing, trading, security, OCR)
- [ ] Integration tests: data pipeline → prediction → trading signal
- [ ] Integration tests: news → impact scoring → trading signal
- [ ] Integration tests: mesh coordinator → worker → result aggregation
- [ ] E2E tests: trading loop (paper trading) executes full cycle
- [ ] E2E tests: competitive intel scan produces report
- [ ] Load tests: data pipeline handles 50+ symbols at 1s resolution
- [ ] Load tests: mesh handles 1000+ work units concurrently
- [ ] Security tests: SAST/DAST on all new services
- [ ] Backtest validation: strategy backtests produce consistent results

---

## Documentation Checklist

- [ ] EXPANSION_MASTER_PLAN.md — complete
- [ ] PILLAR_01_DESIGN_INTELLIGENCE.md — complete
- [ ] PILLAR_02_MULTI_MODEL_AGENCY.md — complete
- [ ] PILLAR_03_OCR_DOCUMENT_INTELLIGENCE.md — complete
- [ ] PILLAR_04_QUANTUM_EXPLORATION.md — complete
- [ ] PILLAR_05_SECURITY_DEFENSE.md — complete
- [ ] PILLAR_06_TRADING_PLATFORM.md — complete
- [ ] PILLAR_07_MARKETING_INTELLIGENCE.md — complete
- [ ] PILLAR_08_DISTRIBUTED_COMPUTE.md — complete
- [ ] EXPANSION_MASTER_CHECKLIST.md — complete
- [ ] CHANGELOG.md updated for v0.2.0 planning
- [ ] Architecture docs updated with new services
- [ ] API documentation for new endpoints
- [ ] Runbook stubs for new services
