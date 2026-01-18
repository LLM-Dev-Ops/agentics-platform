<div align="center">

# Agentics Platform — Layer 4

<img src="https://img.shields.io/badge/Layer_4-Control_Plane-0ea5e9?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBvbHlnb24gcG9pbnRzPSIxMiAyIDIgNyAxMiAxMiAyMiA3IDEyIDIiPjwvcG9seWdvbj48cG9seWxpbmUgcG9pbnRzPSIyIDE3IDEyIDIyIDIyIDE3Ij48L3BvbHlsaW5lPjxwb2x5bGluZSBwb2ludHM9IjIgMTIgMTIgMTcgMjIgMTIiPjwvcG9seWxpbmU+PC9zdmc+" alt="Layer 4">
<img src="https://img.shields.io/badge/TypeScript-5.3-3178c6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript">
<img src="https://img.shields.io/badge/Next.js-14-000000?style=for-the-badge&logo=next.js&logoColor=white" alt="Next.js">
<img src="https://img.shields.io/badge/Fastify-4.x-000000?style=for-the-badge&logo=fastify&logoColor=white" alt="Fastify">
<img src="https://img.shields.io/badge/Supabase-Auth-3fcf8e?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase">

<br/>

<img src="https://img.shields.io/badge/8_Layer_3_Cores-Integrated-22c55e?style=flat-square" alt="8 Cores">
<img src="https://img.shields.io/badge/Usage_Analytics-Real_Time-a855f7?style=flat-square" alt="Usage Analytics">
<img src="https://img.shields.io/badge/Stripe_Metering-Supported-6366f1?style=flat-square" alt="Stripe Metering">
<img src="https://img.shields.io/badge/Architecture-Frozen_v1.0.0-ef4444?style=flat-square" alt="Architecture Frozen">

<br/><br/>

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│     █████╗  ██████╗ ███████╗███╗   ██╗████████╗██╗ ██████╗███████╗         │
│    ██╔══██╗██╔════╝ ██╔════╝████╗  ██║╚══██╔══╝██║██╔════╝██╔════╝         │
│    ███████║██║  ███╗█████╗  ██╔██╗ ██║   ██║   ██║██║     ███████╗         │
│    ██╔══██║██║   ██║██╔══╝  ██║╚██╗██║   ██║   ██║██║     ╚════██║         │
│    ██║  ██║╚██████╔╝███████╗██║ ╚████║   ██║   ██║╚██████╗███████║         │
│    ╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═══╝   ╚═╝   ╚═╝ ╚═════╝╚══════╝         │
│                                                                             │
│                    Unified Control Plane & API Gateway                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**The unified control plane and product surface for the Agentics.dev platform.**

[Getting Started](#getting-started) • [API Reference](#unified-api-surface) • [CLI Commands](#command-line-interface) • [SDK Documentation](#software-development-kit) • [Architecture](#architecture-overview)

</div>

---

Layer 4 is the externally facing gateway through which all platform capabilities are accessed. It provides a single API, CLI, SDK, and minimal web UI that expose intelligence, simulation, security, automation, governance, data, ecosystem, and research operations to external consumers. Layer 4 handles authentication, authorization, rate limiting, usage tracking, and request routing. It does not implement any business logic, intelligence algorithms, simulation engines, or analytics computation—those responsibilities belong to the underlying Layer 3 consolidation cores.

---

## Table of Contents

- [Platform Capabilities](#platform-capabilities)
- [Architecture Overview](#architecture-overview)
  - [Dependency Graph](#dependency-graph)
  - [Enforcement Artifacts](#enforcement-artifacts)
- [Architecture Freeze](#architecture-freeze)
- [Layer 3 Backend Services](#layer-3-backend-services)
- [Unified API Surface](#unified-api-surface)
- [Usage Dashboard & Analytics](#usage-dashboard--analytics)
- [Command-Line Interface](#command-line-interface)
- [Software Development Kit](#software-development-kit)
- [Simulation Workflow](#simulation-workflow)
- [Authentication and Access Control](#authentication-and-access-control)
- [Getting Started](#getting-started)
- [What This Layer Does Not Do](#what-this-layer-does-not-do)
- [Repository Structure](#repository-structure)
- [Configuration](#configuration)
- [License](#license)

---

## Platform Capabilities

<div align="center">

| Capability | Status | Description |
|:-----------|:------:|:------------|
| **API Gateway** | ✅ | Unified REST API with authentication, rate limiting, and routing |
| **Web Dashboard** | ✅ | Next.js 14 UI for account management and usage monitoring |
| **Usage Analytics** | ✅ | Real-time usage tracking with interactive charts |
| **CLI Authentication** | ✅ | Device flow OAuth for secure CLI login |
| **API Key Management** | ✅ | Self-service key creation, scoping, and revocation |
| **Stripe Metering** | ✅ | Usage-based billing integration with metering status |
| **8 Layer 3 Cores** | ✅ | Intelligence, Security, Automation, Governance, Data, Ecosystem, Research, Interface |

</div>

### Key Features

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           PLATFORM FEATURES                                   │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  🔐 AUTHENTICATION          📊 USAGE ANALYTICS        💳 BILLING             │
│  ├─ Supabase JWT (UI)       ├─ Real-time tracking     ├─ Stripe metering    │
│  ├─ API Keys (Machine)      ├─ Interactive charts     ├─ Tier management    │
│  ├─ Device Flow (CLI)       ├─ Time range selectors   └─ Status visibility  │
│  └─ Scope-based access      └─ Per-user/command view                        │
│                                                                              │
│  🚀 API GATEWAY             🖥️ WEB DASHBOARD          📦 SDK & CLI           │
│  ├─ Request routing         ├─ Usage dashboard        ├─ TypeScript SDK     │
│  ├─ Rate limiting           ├─ API key management     ├─ Node.js CLI        │
│  ├─ Usage recording         ├─ Account settings       └─ Browser support    │
│  └─ Error handling          └─ Platform status                              │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Architecture Overview

The Agentics.dev platform follows a strict four-layer architecture that separates concerns and preserves the value of each component:

```
┌─────────────────────────────────────────────────────────────────────┐
│                        EXTERNAL CONSUMERS                            │
│         CLI  •  SDK  •  Web UI  •  LLM Tools  •  Partner APIs       │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                            LAYER 4                                   │
│              Unified API Gateway & Control Plane                     │
│                                                                      │
│   Authentication  •  Rate Limiting  •  Usage Tracking  •  Routing   │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                            LAYER 3                                   │
│                     Consolidation Cores (×8)                         │
│                                                                      │
│  Intelligence • Security • Automation • Governance                   │
│  Data • Ecosystem • Research • Interface                             │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         LAYER 2 & LAYER 1                            │
│            Developer Tools, Engines & Specialized Subsystems         │
└─────────────────────────────────────────────────────────────────────┘
```

### Architectural Principles

**Layer 4** is the only externally accessible entry point. All client requests—whether from the CLI, SDK, web UI, or external LLM tools—enter through Layer 4. This layer validates credentials, enforces rate limits, records usage, and routes requests to the appropriate Layer 3 core. Layer 4 never modifies response payloads from Layer 3; it acts purely as a policy gateway.

**Layer 3** consolidation cores own all domain logic. Each core is responsible for a specific capability area and orchestrates the underlying Layer 1 and Layer 2 components to fulfill requests. Layer 4 forwards requests to these cores and returns their responses.

**Layer 1 and Layer 2** repositories remain first-class components of the platform. These standalone engines, developer tools, and specialized subsystems continue to evolve independently and provide the foundational capabilities that Layer 3 cores compose. Layer 4 never invokes Layer 1 or Layer 2 directly—all access flows through Layer 3. This structure preserves the long-term value of every previously built repository while enforcing strict architectural boundaries.

### Dependency Graph

The platform enforces strict dependency rules across all layers to preserve component value, enable independent evolution, and support technical diligence. The canonical dependency governance artifact is maintained at [`architecture/DEPENDENCY_GRAPH.md`](architecture/DEPENDENCY_GRAPH.md).

Key architectural invariants enforced by the dependency graph:

- **Downward-only dependencies**: Dependencies flow strictly from Layer 5 → Layer 4 → Layer 3 → Layer 2 → Layer 1
- **No layer skipping**: Layer 4 cannot invoke Layer 1 or Layer 2 directly; all access routes through Layer 3
- **No lateral execution leaks**: Layer 3 cores do not invoke each other directly; cross-domain operations route through Layer 4
- **Simulation isolation**: Simulation and research environments cannot mutate production state
- **Single entry point**: All external traffic enters through Layer 4 API Gateway

This dependency graph serves as an enforcement artifact for code reviews, CI pipeline checks, and architectural audits. Violations of the documented dependency rules should be treated as build failures.

The dependency graph also defines governance for repository classes including infrastructure repositories (`infra-*`), service repositories (`services-*`), integration repositories (`integrations-*`), and simulation repositories (`agentics-simulation-*`, `agentics-diligence-*`). Each class has explicit allowed and forbidden dependency paths. The document is designed to satisfy CTO review, broker diligence, and PE technical audit requirements.

### Enforcement Artifacts

The architecture is enforced through a suite of canonical documents and CI tooling:

| Artifact | Purpose |
|----------|---------|
| [`architecture/DEPENDENCY_GRAPH.md`](architecture/DEPENDENCY_GRAPH.md) | Canonical dependency rules and layer definitions |
| [`architecture/FORBIDDEN_PATHS.md`](architecture/FORBIDDEN_PATHS.md) | Explicit enumeration of prohibited dependency paths |
| [`architecture/REPO_CLASSIFICATION.md`](architecture/REPO_CLASSIFICATION.md) | Authoritative repository-to-class mapping |
| [`architecture/ARCHITECTURE_DECISIONS.md`](architecture/ARCHITECTURE_DECISIONS.md) | Key architectural decisions for diligence review |
| [`architecture/DEPENDENCY_DIAGRAM.md`](architecture/DEPENDENCY_DIAGRAM.md) | Visual representation of the dependency graph |
| [`.github/workflows/architecture-enforcement.yml`](.github/workflows/architecture-enforcement.yml) | CI enforcement checks |

These documents form a closed, intentional system designed for technical audit. All artifacts reference `DEPENDENCY_GRAPH.md` as the canonical authority.

---

## Architecture Freeze

The platform architecture is frozen at version **architecture-v1.0.0** as declared in [`ARCHITECTURE_VERSION.md`](ARCHITECTURE_VERSION.md). This freeze establishes an immutable baseline governing **all repositories in the Agentics fleet**. No architectural changes, exceptions, or deviations are permitted except through the approved Architecture Decision Record (ADR) process with CTO approval.

All code changes across the fleet are validated against this frozen architecture via automated CI enforcement. Violations block merge and require either remediation or formal ADR amendment.

### Governance

| Aspect | Status |
|--------|--------|
| Frozen Version | architecture-v1.0.0 |
| Git Tag | `architecture-v1.0.0` |
| Freeze Date | 2025-01-03 |
| Amendment Authority | CTO approval via ADR process |
| Enforcement | Automated CI gate (`ci/check-architecture.sh`) |

### What Is Frozen

- Five-layer architecture (Layers 1-5)
- Downward-only dependency rule (5→4→3→2→1)
- Repository classifications and layer assignments
- Forbidden dependency paths
- CLI command ownership and delegation boundaries
- Architectural invariants (INV-1 through INV-9)
- Hard rules for CLI enforcement (H-1 through H-6)

### What Is Not Frozen

- Implementation details within repositories
- User experience and interface design
- Performance tuning and optimization
- Internal service architecture (within layer boundaries)

### CI Enforcement

The [`ci/check-architecture.sh`](ci/check-architecture.sh) script runs as a mandatory CI gate. It validates:

- Architecture version file exists and matches expected frozen version
- Cross-document consistency (REPO_CLASSIFICATION ↔ DEPENDENCY_GRAPH ↔ FORBIDDEN_PATHS)
- CLI hard rules H-1 through H-6 are defined
- No forbidden dependencies exist in any package
- No upward or layer-skipping dependencies
- CLI packages do not import Layer 3 core runtime
- Simulation isolation is maintained
- Infrastructure and integration boundaries are preserved

CI exits non-zero on any violation. Violations include the rule identifier, source document reference, file location, and actionable message.

### Requesting Changes

Architectural changes require a formal Architecture Decision Record (ADR). The frozen architecture (`architecture-v1.0.0`) cannot be modified without completing this process:

1. Submit RFC with proposed change, rationale, and impact analysis
2. Platform Architecture Team reviews for consistency and compliance
3. CTO approval required for any frozen element modification
4. Update architecture documents in precedence order
5. Update CI enforcement to reflect approved changes
6. Increment architecture version and update Git tag

**No exceptions are permitted without ADR amendment.** This policy ensures architectural integrity, auditability, and transaction readiness.

### Canonical References

| Document | Purpose |
|----------|---------|
| [`ARCHITECTURE_VERSION.md`](ARCHITECTURE_VERSION.md) | Frozen version declaration |
| [`architecture/ARCHITECTURE_INDEX.md`](architecture/ARCHITECTURE_INDEX.md) | Conflict resolution hierarchy |
| [`architecture/DEPENDENCY_GRAPH.md`](architecture/DEPENDENCY_GRAPH.md) | Layer rules (supreme authority) |
| [`architecture/ARCHITECTURE_DECISIONS.md`](architecture/ARCHITECTURE_DECISIONS.md) | Closed architectural decisions |

---

## Layer 3 Backend Services

Layer 4 routes requests to eight consolidation cores. Each core owns a distinct capability domain:

### LLM-Intelligence-Core

Provides model orchestration, prompt engineering, context management, embedding generation, retrieval-augmented generation, and multi-model routing. Accessed via `/v1/intelligence/*` endpoints for completions, embeddings, chat, model listing, and chain-of-thought workflows.

### LLM-Security-Core

Provides threat detection, vulnerability scanning, secret detection, access policy evaluation, and security event correlation. Accessed via `/v1/security/*` endpoints for scans, threat retrieval, audit logging, and policy evaluation.

### LLM-Automation-Core

Provides workflow execution, task scheduling, event-driven triggers, pipeline orchestration, and state machine management. Accessed via `/v1/automation/*` endpoints for workflow creation, triggering, job listing, and schedule management.

### LLM-Governance-Core

Provides policy definition, compliance validation, approval workflows, audit trails, and risk assessment. Accessed via `/v1/governance/*` endpoints for validation, policy listing, approvals, and compliance reporting.

### LLM-Data-Core

Provides data ingestion, transformation, storage orchestration, query execution, schema management, and data lineage tracking. Accessed via `/v1/data/*` endpoints for ingestion, querying, catalog browsing, and transformation.

### LLM-Ecosystem-Core

Provides third-party integrations, marketplace management, plugin orchestration, and webhook delivery. Accessed via `/v1/ecosystem/*` endpoints for integration listing, connection management, and marketplace browsing.

### LLM-Research-Core

Provides simulation execution, experiment management, A/B testing, hypothesis validation, and research artifact storage. Accessed via `/v1/research/*` and `/v1/simulate` endpoints for creating and monitoring simulations and experiments.

### LLM-Interface-Core

Provides conversation management, session handling, multi-turn context, and response formatting for different client types. Accessed via `/v1/interface/*` endpoints for conversation creation, message handling, and content formatting.

---

## Unified API Surface

All clients interact with the same RESTful API regardless of interface. The API is organized into logical endpoint categories:

| Category | Base Path | Description |
|----------|-----------|-------------|
| Identity | `/v1/identity/*` | Authentication, API key management, user identity |
| Usage | `/v1/usage/*` | Usage summaries and historical data |
| Simulate | `/v1/simulate` | Unified simulation entry point |
| Intelligence | `/v1/intelligence/*` | Completions, embeddings, chat, models |
| Security | `/v1/security/*` | Scans, threats, policies, evaluation |
| Automation | `/v1/automation/*` | Workflows, jobs, schedules |
| Governance | `/v1/governance/*` | Validation, policies, approvals, compliance |
| Data | `/v1/data/*` | Ingestion, queries, catalog, lineage |
| Ecosystem | `/v1/ecosystem/*` | Integrations, marketplace, webhooks |
| Research | `/v1/research/*` | Experiments, results, hypotheses |
| Interface | `/v1/interface/*` | Conversations, sessions, formatting |

### Request Format

All requests use JSON bodies and require authentication via the `Authorization` header:

```http
POST /v1/intelligence/completions HTTP/1.1
Host: api.agentics.dev
Authorization: Bearer agentics_abc123...
Content-Type: application/json

{
  "model": "gpt-4",
  "prompt": "Explain quantum computing",
  "max_tokens": 500
}
```

### Response Format

Successful responses return JSON with the requested data. Error responses follow a consistent structure:

```json
{
  "error": "Rate limit exceeded",
  "code": "RATE_LIMIT_EXCEEDED",
  "request_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

Error codes include `AUTHENTICATION_REQUIRED`, `AUTHORIZATION_DENIED`, `RATE_LIMIT_EXCEEDED`, `QUOTA_EXCEEDED`, `INVALID_REQUEST`, `UPSTREAM_ERROR`, and `SERVICE_UNAVAILABLE`.

---

## Usage Dashboard & Analytics

The platform includes a comprehensive usage dashboard with real-time analytics, interactive charts, and detailed breakdowns.

### Dashboard Components

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          USAGE DASHBOARD                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │ Executions  │ │ Total Cost  │ │ Failure Rate│ │ Tokens Used │           │
│  │   12,456    │ │   $234.56   │ │    2.3%     │ │   1.2M      │           │
│  │ Last 30 days│ │ Last 30 days│ │  28 failures│ │ Last 30 days│           │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘           │
│                                                                             │
│  ┌─────────────────────────────┐  ┌─────────────────────────────┐          │
│  │   Command Usage Bar Chart   │  │   Daily Usage Time Series   │          │
│  │   ████████████ completions  │  │      📈 Executions         │          │
│  │   ████████ embeddings       │  │      📈 Cost               │          │
│  │   ██████ chat               │  │                             │          │
│  │   ████ scan                 │  │   [Interactive Recharts]    │          │
│  └─────────────────────────────┘  └─────────────────────────────┘          │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────┐           │
│  │                    User Usage Table                          │           │
│  │   Principal          │ Executions │ Cost    │ Failures      │           │
│  │   user@example.com   │    5,234   │ $123.45 │     12        │           │
│  │   api-key-prod       │    4,122   │  $89.32 │      8        │           │
│  └─────────────────────────────────────────────────────────────┘           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Usage API Endpoints

The platform exposes usage data through dedicated proxy endpoints:

| Endpoint | Description |
|----------|-------------|
| `GET /v1/api/usage/summary` | Aggregated totals (executions, cost, failures, tokens) |
| `GET /v1/api/usage/by-command` | Breakdown by command/operation type |
| `GET /v1/api/usage/by-day` | Daily time series for trend analysis |
| `GET /v1/api/usage/by-user` | Per-user breakdown (read-only) |

### Time Range Selection

All usage views support configurable time ranges:

- **Last 7 days** — Recent activity snapshot
- **Last 30 days** — Monthly overview (default)
- **Last 90 days** — Quarterly trends

### Chart Library

The dashboard uses [Recharts](https://recharts.org/) for interactive data visualization:

- **Bar Charts** — Command usage distribution
- **Line Charts** — Daily execution and cost trends
- **Dual Axis** — Correlate executions with cost over time
- **Tooltips** — Detailed data on hover

### Platform Status

The settings page displays read-only platform status indicators:

```
Platform Status
─────────────────────────────────────────────────────
Stripe Usage Metering                    ● Active
Tracks API usage for billing purposes
```

This allows operators to confirm Stripe metering is active without exposing billing UI, invoices, or payment methods.

---

## Command-Line Interface

The `agentics` CLI is a thin remote control that communicates exclusively with the Layer 4 API. It performs no local computation, simulation, or intelligence operations.

### Installation

```bash
npm install -g @agentics/cli
```

### Global Options

```bash
agentics [command] --api-key <key> --endpoint <url> --format <json|table>
```

The CLI reads credentials from the `AGENTICS_API_KEY` environment variable or `~/.agentics/credentials` file when not provided as flags.

### Core Commands

**Authentication**

```bash
# Authenticate via email/password or OAuth
agentics login

# Display current identity and usage
agentics whoami
```

**Simulation**

```bash
# Run simulation with structured flags
agentics simulate --scenario production-load --duration 3600 --users 1000

# Run simulation with natural language
agentics simulate --prompt "Simulate a production load test with 1000 concurrent users for one hour"

# Run simulation from configuration file
agentics simulate --config ./simulation.yaml

# Check simulation status
agentics simulate status <simulation-id>

# Cancel running simulation
agentics simulate cancel <simulation-id>
```

**Intelligence**

```bash
# Generate text completion
agentics intelligence completions --model gpt-4 --prompt "Summarize this document"

# Generate embeddings
agentics intelligence embeddings --model text-embedding-ada-002 --input "Sample text"

# Stream completion output
agentics intelligence completions --model gpt-4 --prompt "Write a story" --stream
```

**Security**

```bash
# Run security scan
agentics security scan --target ./src --type vulnerabilities

# List detected threats
agentics security threats

# View security policies
agentics security policies
```

**Automation**

```bash
# List workflows
agentics automation workflows list

# Create workflow from definition
agentics automation workflows create ./workflow.yaml

# Trigger workflow execution
agentics automation workflows trigger <workflow-id>

# Check workflow status
agentics automation workflows status <workflow-id>
```

**API Key Management**

```bash
# List API keys
agentics api-keys list

# Create new API key
agentics api-keys create "production-key" --scopes intelligence:write,security:read

# Revoke API key
agentics api-keys revoke <key-id>
```

**Usage**

```bash
# View current period usage
agentics usage --period month

# Export usage data
agentics usage --format json > usage.json
```

---

## Software Development Kit

The `@agentics/sdk` package is a thin, stateless TypeScript library that mirrors the Layer 4 API. It provides type-safe methods for all platform operations.

### Installation

```bash
npm install @agentics/sdk
```

### Initialization

```typescript
import { AgenticsClient } from '@agentics/sdk';

const client = new AgenticsClient({
  apiKey: process.env.AGENTICS_API_KEY,
  baseUrl: 'https://api.agentics.dev/v1', // optional
  timeout: 30000, // optional, milliseconds
  retries: 3 // optional
});
```

### Usage Examples

**Identity Operations**

```typescript
// Get current identity
const identity = await client.identity.whoami();
console.log(identity.email, identity.scopes);

// Create API key
const apiKey = await client.identity.apiKeys.create({
  name: 'production-key',
  scopes: ['intelligence:write', 'security:read']
});

// List API keys
const keys = await client.identity.apiKeys.list();

// Revoke API key
await client.identity.apiKeys.revoke(keyId);
```

**Intelligence Operations**

```typescript
// Generate completion
const completion = await client.intelligence.completions({
  model: 'gpt-4',
  prompt: 'Explain distributed systems',
  maxTokens: 500,
  temperature: 0.7
});
console.log(completion.text);

// Stream completion
for await (const chunk of client.intelligence.completions.stream({
  model: 'gpt-4',
  prompt: 'Write a technical blog post'
})) {
  process.stdout.write(chunk.text);
}

// Generate embeddings
const embeddings = await client.intelligence.embeddings({
  model: 'text-embedding-ada-002',
  input: ['First document', 'Second document']
});
```

**Simulation Operations**

```typescript
// Start simulation with specification
const simulation = await client.simulate({
  specification: {
    scenario: 'production-load',
    parameters: { duration: 3600, users: 1000 }
  }
});

// Start simulation with natural language
const simulation = await client.simulate({
  prompt: 'Simulate API traffic patterns during a product launch'
});

// Check simulation status
const status = await client.simulate.get(simulation.id);
console.log(status.progress, status.status);

// Stream simulation events
for await (const event of client.simulate.stream({ specification })) {
  console.log(event.type, event.data);
}
```

**Error Handling**

```typescript
import {
  AgenticsError,
  AuthenticationError,
  RateLimitError,
  QuotaExceededError
} from '@agentics/sdk';

try {
  await client.intelligence.completions(params);
} catch (error) {
  if (error instanceof AuthenticationError) {
    // Invalid or expired credentials
  } else if (error instanceof RateLimitError) {
    // Wait and retry after error.retryAfter seconds
  } else if (error instanceof QuotaExceededError) {
    // Monthly quota exhausted
  } else if (error instanceof AgenticsError) {
    console.error(error.code, error.requestId);
  }
}
```

### Supported Platforms

- **Node.js**: 18.x and later (ESM and CommonJS)
- **Browser**: Modern browsers via bundler (Webpack, Vite, esbuild)
- **TypeScript**: First-class support with complete type definitions

---

## Simulation Workflow

The simulation system provides a unified interface for running load tests, scenario simulations, and research experiments. All simulation requests follow the same workflow regardless of input method.

### Input Methods

**Structured Specification**: Provide a complete simulation specification as JSON or YAML.

```json
{
  "specification": {
    "scenario": "production-load",
    "parameters": {
      "duration": 3600,
      "users": 1000,
      "ramp_up": 300
    }
  }
}
```

**CLI Flags**: Provide simulation parameters as command-line flags. Layer 4 compiles these into a specification.

```bash
agentics simulate --scenario production-load --duration 3600 --users 1000
```

**Natural Language Prompt**: Describe the simulation in plain English. Layer 4 sends the prompt to the Intelligence core for interpretation, receives a structured specification, and forwards it to the Research core.

```bash
agentics simulate --prompt "Run a stress test simulating Black Friday traffic"
```

**UI Form**: Configure simulation parameters via the web interface. Layer 4 constructs the specification from form values.

### Execution Flow

1. Layer 4 receives the simulation request via API, CLI, SDK, or UI
2. Layer 4 validates authentication and checks entitlements
3. Layer 4 compiles the input into a canonical simulation specification
4. Layer 4 forwards the specification to LLM-Research-Core
5. LLM-Research-Core executes the simulation using production telemetry and vector data
6. Layer 4 returns status updates and results to the client

### External Tool Integration

External LLM tools such as Claude Code, ChatGPT, or GitHub Copilot can invoke simulations by calling the `/v1/simulate` endpoint with either structured specifications or natural language prompts. These tools are optional clients—not required dependencies. The platform treats all clients equally regardless of origin.

---

## Authentication and Access Control

### API Keys

API keys are the primary authentication method for programmatic access. Keys follow the format `agentics_<base64_encoded_token>` and are stored as bcrypt hashes.

**Creating API Keys**

```bash
# Via CLI
agentics api-keys create "my-key" --scopes intelligence:write,security:read

# Via SDK
const key = await client.identity.apiKeys.create({
  name: 'my-key',
  scopes: ['intelligence:write', 'security:read'],
  expiresAt: '2025-12-31T23:59:59Z' // optional
});
```

**Using API Keys**

```bash
# Environment variable
export AGENTICS_API_KEY=agentics_abc123...

# CLI flag
agentics whoami --api-key agentics_abc123...

# HTTP header
Authorization: Bearer agentics_abc123...
```

### Session Tokens

The web UI uses JWT session tokens obtained through email/password or OAuth authentication. Tokens expire after 24 hours and support refresh.

### Scopes

Access to endpoints is controlled by scopes assigned to API keys or session tokens:

| Scope | Access |
|-------|--------|
| `identity:read` | View identity and usage |
| `identity:write` | Manage API keys |
| `intelligence:read` | List models |
| `intelligence:write` | Generate completions and embeddings |
| `security:read` | View policies and threats |
| `security:write` | Execute scans |
| `automation:read` | View workflows |
| `automation:write` | Create and trigger workflows |
| `governance:read` | View policies |
| `governance:write` | Execute validations |
| `data:read` | Query data |
| `data:write` | Ingest data |
| `ecosystem:read` | View integrations |
| `ecosystem:write` | Manage connections |
| `research:read` | View experiments |
| `research:write` | Create simulations |
| `admin:*` | Full administrative access |

### Entitlement Tiers

Usage is governed by subscription tiers:

| Tier | Requests/Month | Tokens/Month | API Keys |
|------|----------------|--------------|----------|
| Free | 1,000 | 100,000 | 1 |
| Developer | 50,000 | 5,000,000 | 10 |
| Team | 500,000 | 50,000,000 | 100 |
| Enterprise | Unlimited | Unlimited | Unlimited |

### Usage Tracking

Every API request is recorded with endpoint, timestamp, token usage, and duration. Usage data is available via:

```bash
agentics usage --period month
```

```typescript
const usage = await client.usage.current({ period: 'month' });
console.log(usage.requests, usage.tokens);
```

Billing infrastructure exists for Stripe integration. Enforcement behavior depends on deployment configuration.

---

## Getting Started

### 1. Create an Account

Visit [agentics.dev](https://agentics.dev) and sign up with email or OAuth.

### 2. Generate an API Key

```bash
# Install the CLI
npm install -g @agentics/cli

# Authenticate
agentics login

# Create an API key
agentics api-keys create "quickstart-key" --scopes intelligence:write,research:write
```

Save the returned API key securely—it is displayed only once.

### 3. Configure Your Environment

```bash
export AGENTICS_API_KEY=agentics_your_key_here
```

### 4. Run a Simple Simulation

```bash
# Using structured flags
agentics simulate --scenario hello-world --duration 60

# Using natural language
agentics simulate --prompt "Run a quick connectivity test"
```

### 5. Generate a Completion

```bash
agentics intelligence completions --model gpt-4 --prompt "Hello, world!"
```

### 6. Use the SDK

```typescript
import { AgenticsClient } from '@agentics/sdk';

const client = new AgenticsClient({
  apiKey: process.env.AGENTICS_API_KEY
});

const result = await client.intelligence.completions({
  model: 'gpt-4',
  prompt: 'Explain the Agentics platform in one sentence.',
  maxTokens: 100
});

console.log(result.text);
```

### 7. Check Your Usage

```bash
agentics usage --period today
```

---

## What This Layer Does Not Do

Layer 4 is explicitly scoped to access control, routing, and user experience. The following capabilities are **not** implemented in this layer:

- **Intelligence algorithms**: Model selection, prompt engineering, token optimization, and embedding computation are owned by LLM-Intelligence-Core.

- **Simulation execution**: Load tests, scenario simulations, and experiment runners are owned by LLM-Research-Core.

- **Security scanning**: Threat detection, vulnerability analysis, and secret pattern matching are owned by LLM-Security-Core.

- **Workflow execution**: Job scheduling, state machines, and automation pipelines are owned by LLM-Automation-Core.

- **Policy evaluation**: Compliance checking, governance rules, and approval logic are owned by LLM-Governance-Core.

- **Data transformation**: Query execution, schema validation, and data pipelines are owned by LLM-Data-Core.

- **Vector storage**: Embedding storage and similarity search are infrastructure consumed by Layer 3 cores.

- **Analytics computation**: Usage aggregation and business intelligence are downstream system responsibilities.

- **Full SaaS dashboards**: The web UI is intentionally minimal, limited to account management, API keys, and usage display.

- **Direct Layer 1/Layer 2 access**: All domain operations route through Layer 3 consolidation cores.

---

## Repository Structure

```
agentics-platform/
├── packages/
│   ├── api/                       # API Gateway (Fastify server)
│   │   ├── migrations/            # PostgreSQL migrations
│   │   │   ├── 001_organizations.sql
│   │   │   ├── 002_api_keys.sql
│   │   │   ├── 003_enterprise_gate.sql
│   │   │   ├── 004_cli_auth_sessions.sql
│   │   │   └── 005_stripe_metering.sql
│   │   └── src/
│   │       ├── handlers/          # Request handlers
│   │       │   ├── usage.ts       # Usage summary handlers
│   │       │   ├── usage-proxy.ts # Usage ledger proxy
│   │       │   └── billing.ts     # Stripe billing handlers
│   │       ├── middleware/        # Auth, rate limiting, observability
│   │       ├── routes/            # Route definitions
│   │       │   ├── usage.ts       # Usage routes
│   │       │   ├── usage-proxy.ts # Usage proxy routes
│   │       │   └── keys.ts        # API key management
│   │       ├── services/          # Identity, entitlements, observability
│   │       └── router/            # Layer 3 routing logic
│   ├── cli/                       # Command-line interface
│   │   └── src/
│   │       ├── commands/          # Individual CLI commands
│   │       ├── client.ts          # HTTP client for API calls
│   │       └── config.ts          # Configuration management
│   ├── sdk/                       # TypeScript SDK
│   │   └── src/
│   │       ├── resources/         # API resource wrappers
│   │       ├── client.ts          # Main client class
│   │       └── errors.ts          # Error classes
│   ├── ui/                        # Next.js web interface
│   │   └── src/
│   │       ├── app/               # Page components
│   │       │   ├── usage/         # Usage dashboard page
│   │       │   ├── settings/      # Account settings
│   │       │   └── api-keys/      # API key management
│   │       ├── components/
│   │       │   ├── usage/         # Usage overview components
│   │       │   └── usage-graphs/  # Recharts visualizations
│   │       │       ├── UsageSummaryCards.tsx
│   │       │       ├── CommandUsageBarChart.tsx
│   │       │       ├── DailyUsageTimeSeries.tsx
│   │       │       ├── UserUsageTable.tsx
│   │       │       └── TimeRangeSelector.tsx
│   │       └── lib/               # Auth and API utilities
│   │           ├── api-client.ts  # API client with Supabase JWT
│   │           └── supabase.ts    # Supabase configuration
│   └── shared/                    # Shared TypeScript types
├── architecture/                  # Architecture documentation
│   ├── DEPENDENCY_GRAPH.md
│   ├── FORBIDDEN_PATHS.md
│   └── ARCHITECTURE_DECISIONS.md
├── package.json                   # Workspace configuration
└── tsconfig.base.json             # Shared TypeScript config
```

---

## Configuration

Layer 4 is configured via environment variables:

### Core Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | API server port | `3000` |
| `HOST` | API server host | `0.0.0.0` |
| `NODE_ENV` | Environment mode | `development` |
| `DATABASE_URL` | PostgreSQL connection string | Required |

### Authentication

| Variable | Description | Default |
|----------|-------------|---------|
| `JWT_SECRET` | JWT signing secret | Required |
| `JWT_ISSUER` | JWT issuer claim | `agentics.dev` |
| `SUPABASE_URL` | Supabase project URL | Required |
| `SUPABASE_ANON_KEY` | Supabase anonymous key | Required |

### Billing & Metering

| Variable | Description | Default |
|----------|-------------|---------|
| `STRIPE_SECRET_KEY` | Stripe API key | Optional |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook secret | Optional |
| `STRIPE_ENABLED` | Enable Stripe integration | `false` |
| `USAGE_LEDGER_URL` | Usage ledger service URL | `http://localhost:3009` |

### Layer 3 Core Endpoints

| Variable | Description | Default |
|----------|-------------|---------|
| `INTELLIGENCE_CORE_URL` | LLM-Intelligence-Core endpoint | Required |
| `SECURITY_CORE_URL` | LLM-Security-Core endpoint | Required |
| `AUTOMATION_CORE_URL` | LLM-Automation-Core endpoint | Required |
| `GOVERNANCE_CORE_URL` | LLM-Governance-Core endpoint | Required |
| `DATA_CORE_URL` | LLM-Data-Core endpoint | Required |
| `ECOSYSTEM_CORE_URL` | LLM-Ecosystem-Core endpoint | Required |
| `RESEARCH_CORE_URL` | LLM-Research-Core endpoint | Required |
| `INTERFACE_CORE_URL` | LLM-Interface-Core endpoint | Required |

### UI Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | API base URL for UI | `http://localhost:8000` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase URL for UI | Required |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key for UI | Required |

---

## Development

```bash
# Install dependencies
npm install

# Start API server in development mode
npm run dev --workspace=@agentics/api

# Build all packages
npm run build

# Run tests
npm test
```

---

## License

Copyright 2024 Agentics.dev. All rights reserved.

For licensing inquiries, contact licensing@agentics.dev.
