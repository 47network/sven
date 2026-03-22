# System Diagrams and Trust Boundaries (2026)

Date: 2026-02-13

## 1) High-Level Runtime Topology

```mermaid
flowchart LR
  U[Operator / User] --> M[Companion Mobile]
  U --> W[Web Admin / Canvas]
  U --> D[Desktop Tauri]
  U --> C[CLI]

  M --> G[Gateway API]
  W --> G
  D --> G
  C --> G

  G --> P[(Postgres)]
  G --> N[(NATS JetStream)]
  G --> R[Runtime/Workers]
  R --> A[Adapters / External Integrations]
```

## 2) Trust Zones

```mermaid
flowchart TB
  subgraph ZoneA[Client Trust Zone]
    M[Mobile]
    D[Desktop]
    W[Web]
    C[CLI]
  end

  subgraph ZoneB[Edge/Ingress Trust Zone]
    X[Nginx / Traefik]
  end

  subgraph ZoneC[Core Service Trust Zone]
    G[Gateway API]
    R[Runtime + Workers]
    N[NATS]
    P[Postgres]
  end

  subgraph ZoneD[External Trust Zone]
    E[Third-party APIs / Messaging platforms]
  end

  ZoneA --> ZoneB --> ZoneC --> ZoneD
```

## 3) Primary Trust Boundaries

- Boundary A: client devices -> edge ingress
- Boundary B: ingress -> gateway-api
- Boundary C: gateway-api -> data plane (Postgres/NATS)
- Boundary D: core services -> external integrations

## 4) Security Controls by Boundary

- Boundary A:
  - TLS-only external transport
  - session/bootstrap auth controls
  - rate limiting and ingress abuse controls
- Boundary B:
  - trusted proxy headers and strict host routing
  - ACME challenge isolation
- Boundary C:
  - service-authenticated internal calls
  - least-privilege DB and message-bus access
- Boundary D:
  - allowlist/policy gates before egress actions
  - approval and audit trails for high-risk actions

## 5) Data Class Mapping

- Secrets/tokens:
  - must stay in secure storage on clients; never persisted plaintext.
- Operational metadata:
  - service health, approvals, audit references.
- User/content data:
  - chat/timeline payloads, subject to retention and privacy controls.
