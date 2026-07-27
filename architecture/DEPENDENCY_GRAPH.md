# Agentics Platform Dependency Graph

**Version**: 1.5
**Status**: Canonical
**Classification**: Architecture Enforcement Artifact
**Last Updated**: 2026-07-27

---

## Overview

This document defines the authoritative dependency rules for the Agentics.dev platform. It serves as the single source of truth for cross-repository dependency governance across the entire LLM DevOps fleet. All architectural decisions, code reviews, and technical audits should reference this document when evaluating dependency compliance.

The Agentics platform follows a strict five-layer architecture designed to:

1. **Preserve component value** — Each layer maintains clear ownership boundaries that protect the long-term value of every repository
2. **Enforce separation of concerns** — External access, business logic, and foundational capabilities remain cleanly isolated
3. **Enable independent evolution** — Lower layers can evolve without requiring changes to higher layers
4. **Support diligence requirements** — Clear dependency rules facilitate technical audits, buyer diligence, and PE evaluation

---

## Layer Definitions

### Layer 5: External Consumers

**Description**: External clients and integrations that consume platform capabilities through Layer 4.

**Components**:
- Platform CLI (`agentics-platform-cli`) — apex orchestration CLI for governance operations
- Developer CLI (`agentics-cli`) — general-purpose developer tooling
- SDK (`@agentics/sdk`)
- Web UI (`@agentics/ui`)
- LLM Tool Integrations (Claude Code, ChatGPT, GitHub Copilot)
- Partner APIs
- Third-party applications

**Characteristics**:
- No direct access to internal layers (1-3)
- Communicates exclusively through Layer 4 API
- Stateless interaction model
- May be developed by external parties

**Two CLI Architecture**:

The platform maintains two distinct CLIs with separate responsibilities:

1. **Platform CLI (`agentics-platform-cli`)**: The apex orchestration CLI that exclusively owns:
   - Organization management (`org *`)
   - Environment management (`env *`)
   - Simulation operations (`simulate *`)
   - Deployment operations (`deploy *`)
   - Governance and compliance commands

2. **Developer CLI (`agentics-cli`)**: General-purpose developer tooling that:
   - Delegates governance operations to Platform CLI via `forward()` spawn
   - Owns developer-focused commands (code, debug, test)
   - May depend on `@agentics/sdk` for API communication

**Special Case: `agentics-cli`**

The Developer CLI (`agentics-cli`) occupies a dual role:

1. **External Consumer**: When invoking remote platform operations, the CLI acts as a Layer 5 consumer that communicates exclusively through Layer 4 API endpoints. All remote operations (simulations, intelligence requests, security scans) route through the API Gateway.

2. **Local Orchestration Tool**: The CLI may perform local-only operations (configuration management, credential storage, output formatting, local file operations) without contacting Layer 4.

**Developer CLI (`agentics-cli`) Dependency Constraints**:
- The CLI **must never** import or link against Layer 3 core runtime code
- The CLI **must never** import or link against Layer 2 service runtime code
- The CLI **must never** embed business logic belonging to consolidation cores
- The CLI **may** import shared type definitions and API contracts from `@agentics/shared`
- The CLI **may** use `@agentics/sdk` for API communication
- The CLI **may** vendor lightweight utility libraries that contain no platform business logic

**Platform CLI (`agentics-platform-cli`) Dependency Constraints**:
- The Platform CLI **must never** import or link against Layer 3 core runtime code
- The Platform CLI **must never** import or link against Layer 2 service runtime code
- The Platform CLI **must never** import `@agentics/sdk` (uses HTTP API directly)
- The Platform CLI **must never** import `@agentics/cli` (independent package)
- The Platform CLI **may only** import `@agentics/shared` for type definitions
- The Platform CLI **must** remain a thin client communicating via HTTP

This constraint ensures both CLIs remain thin remote controls that can be distributed independently without exposing internal implementation details or creating version coupling with backend services.

---

### Layer 4: Unified API Gateway & Control Plane

**Description**: The sole externally accessible entry point for all platform capabilities. Handles authentication, authorization, rate limiting, usage tracking, and request routing.

**Repository**: `agentics-platform`

**Components**:
- API Gateway (Fastify server)
- Identity Service (API key management, JWT tokens)
- Entitlement Service (subscription plans, quota enforcement)
- Observability Emission (metrics, audit logs, usage reporting)
- Router (Layer 3 core dispatch)

**Responsibilities**:
- Authentication and credential validation
- Authorization and scope enforcement
- Rate limiting per identity and endpoint
- Usage tracking and quota management
- Request routing to Layer 3 cores
- Response passthrough without modification
- Billing infrastructure scaffolding (Stripe)

**Prohibited Operations**:
- Business logic implementation
- Intelligence algorithms or model routing
- Simulation execution
- Security scanning or threat detection
- Workflow execution
- Policy evaluation
- Data transformation
- Direct invocation of Layer 1 or Layer 2

---

### Layer 3.5: Execution Spine

**Description**: Services that sequence, execute, and record simulation runs on behalf of Layer 4. The spine sits below Layer 4 and above the Layer 3 cores it dispatches to. Introduced by ADR-013.

**Repositories**:

| Repository | Responsibility Domain |
|------------|----------------------|
| `agentics-orchestration-engine` | Conducts simulation execution; sole spine entry point for `POST /v1/simulate`; delegates planning, execution, and persistence |
| `agentics-execution-engine` | Executes the hierarchical execution graph and mints execution identifiers |
| `agentics-results-index` | Read model for completed runs; serves run status, results, and artifacts |
| `agentics-usage-ledger` | Records usage and cost events emitted during execution |
| `agentics-deployment-intent` | Records declared deployment intent produced by simulation output |

**Characteristics**:
- Reached by Layer 4 over internal HTTP only
- Does not implement domain business logic; that remains in Layer 3 cores (ADR-008)
- Validates its request and result payloads against `agentics-contracts` schemas
- May not depend on Layer 4 or Layer 5 under the downward-only rule (ADR-004)

**Note**: `agentics-simulation-planner` and `agentics-simulation-runner` remain classified as Simulation repositories at Layer 4. The spine dispatches to them; they are not part of it.

---

### Layer 3: Consolidation Cores

**Description**: Domain-specific consolidation cores that own all business logic within their respective capability areas. Each core orchestrates underlying Layer 1 and Layer 2 components.

**Repositories**:

| Core | Repository | Responsibility Domain |
|------|------------|----------------------|
| LLM-Intelligence-Core | `LLM-Intelligence-Core` | Model orchestration, prompt engineering, embeddings, RAG, multi-model routing |
| LLM-Security-Core | `LLM-Security-Core` | Threat detection, vulnerability scanning, secret detection, policy evaluation |
| LLM-Automation-Core | `LLM-Automation-Core` | Workflow execution, task scheduling, event triggers, pipeline orchestration |
| LLM-Governance-Core | `LLM-Governance-Core` | Policy definition, compliance validation, approval workflows, risk assessment |
| LLM-Data-Core | `LLM-Data-Core` | Data ingestion, transformation, query execution, schema management, lineage |
| LLM-Ecosystem-Core | `LLM-Ecosystem-Core` | Third-party integrations, marketplace, plugin orchestration, webhooks |
| LLM-Research-Core | `LLM-Research-Core` | Simulation execution, experiment management, A/B testing, research artifacts |
| LLM-Interface-Core | `LLM-Interface-Core` | Conversation management, session handling, multi-turn context, formatting |

**Characteristics**:
- Each core owns a distinct capability domain
- Cores may compose Layer 1 and Layer 2 components
- Cores do not invoke each other directly (except through Layer 4 for cross-domain operations)
- Cores receive pre-validated identity context from Layer 4

---

### Layer 2: Developer Tools & Services

**Description**: Standalone developer tools, SDKs, and specialized services that provide building-block capabilities consumed by Layer 3 cores.

**Representative Components**:
- CLI utilities and developer tooling
- Internal SDKs and client libraries
- Specialized processing services
- Integration adapters
- Monitoring and observability tools

**Characteristics**:
- Accessed exclusively through Layer 3
- May depend on Layer 1 engines
- No direct external access permitted
- Designed for composability

---

### Layer 1: Standalone Engines & Subsystems

**Description**: Foundational engines and specialized subsystems that provide core computational capabilities. These are the lowest-level components with no dependencies on higher layers.

**Representative Components**:
- RuvVector (vector database and similarity search) — upstream dependency of LLM-Research-Core
- Embedding engines
- Model inference runtimes
- Storage backends
- Queue systems
- Cache infrastructure

**Characteristics**:
- Zero dependencies on Layers 2-5
- Highly specialized, single-purpose components
- May be replaced or upgraded independently
- Accessed exclusively through Layer 3 cores

---

## Dependency Rules by Layer

### Layer 5 → Layer 4 (ALLOWED)

```
┌─────────────────────────────────────────────────────────────────┐
│                     External Consumers                          │
│         CLI  •  SDK  •  Web UI  •  Partner APIs                │
└─────────────────────────────────────────────────────────────────┘
                                │
                                │ HTTPS/REST
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Layer 4: agentics-platform                   │
│              API Gateway  •  Auth  •  Routing                   │
└─────────────────────────────────────────────────────────────────┘
```

**Allowed**:
- CLI, SDK, and UI invoke Layer 4 API endpoints
- External tools call `/v1/*` endpoints with valid authentication
- Partner integrations use API keys for access

**Protocol**: HTTPS with bearer token or API key authentication

---

### Layer 4 → Layer 3 (ALLOWED)

```
┌─────────────────────────────────────────────────────────────────┐
│                    Layer 4: agentics-platform                   │
└─────────────────────────────────────────────────────────────────┘
                                │
                                │ Internal HTTP (mTLS optional)
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Layer 3: Consolidation Cores                 │
│  Intelligence • Security • Automation • Governance             │
│  Data • Ecosystem • Research • Interface                       │
└─────────────────────────────────────────────────────────────────┘
```

**Allowed**:
- Layer 4 routes requests to appropriate Layer 3 cores
- Layer 4 passes pre-validated identity context via headers
- Layer 4 receives responses and returns to clients unmodified

**Forbidden**: Layer 4 → Layer 3 direct for *simulation execution*. Simulation must route through Layer 3.5 (ADR-013).

**Protocol**: Internal HTTP/HTTPS with correlation ID propagation

---

### Layer 4 → Layer 3.5 → Layer 3 (ALLOWED)

```
┌─────────────────────────────────────────────────────────────────┐
│                    Layer 4: agentics-platform                   │
└─────────────────────────────────────────────────────────────────┘
                                │
                                │ Internal HTTP (mTLS optional)
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Layer 3.5: Execution Spine                     │
│  Orchestration • Execution • Results Index                     │
│  Usage Ledger • Deployment Intent                              │
└─────────────────────────────────────────────────────────────────┘
                                │
                                │ Internal HTTP (mTLS optional)
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Layer 3: Consolidation Cores                 │
└─────────────────────────────────────────────────────────────────┘
```

**Allowed**:
- Layer 4 compiles and validates a `SimulationSpecification`, then delegates execution to `agentics-orchestration-engine`
- Layer 4 resolves simulation reads against `agentics-results-index` and cancellation against `agentics-simulation-runner`
- Layer 3.5 dispatches to Layer 3 cores and Layer 4 simulation repositories

**Forbidden**:
- Layer 3.5 → Layer 4 (upward dependency, ADR-004)
- Layer 4 → Layer 3 direct for simulation execution

**Protocol**: Internal HTTP/HTTPS with correlation ID propagation

---

### Layer 3 → Layer 2 (ALLOWED)

```
┌─────────────────────────────────────────────────────────────────┐
│                    Layer 3: Consolidation Cores                 │
└─────────────────────────────────────────────────────────────────┘
                                │
                                │ Internal APIs / SDKs
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                 Layer 2: Developer Tools & Services             │
└─────────────────────────────────────────────────────────────────┘
```

**Allowed**:
- Layer 3 cores invoke Layer 2 developer tools
- Layer 3 cores use Layer 2 SDKs and client libraries
- Layer 3 cores compose Layer 2 services to fulfill requests

---

### Layer 3 → Layer 1 (ALLOWED)

```
┌─────────────────────────────────────────────────────────────────┐
│                    Layer 3: Consolidation Cores                 │
└─────────────────────────────────────────────────────────────────┘
                                │
                                │ Native protocols / SDKs
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│              Layer 1: Standalone Engines & Subsystems           │
│         RuvVector  •  Inference  •  Storage  •  Cache          │
└─────────────────────────────────────────────────────────────────┘
```

**Allowed**:
- Layer 3 cores access Layer 1 engines directly
- LLM-Research-Core consumes RuvVector for simulation execution
- Layer 3 cores use Layer 1 storage, cache, and queue infrastructure

---

### Layer 2 → Layer 1 (ALLOWED)

```
┌─────────────────────────────────────────────────────────────────┐
│                 Layer 2: Developer Tools & Services             │
└─────────────────────────────────────────────────────────────────┘
                                │
                                │ Native protocols
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│              Layer 1: Standalone Engines & Subsystems           │
└─────────────────────────────────────────────────────────────────┘
```

**Allowed**:
- Layer 2 tools may depend on Layer 1 infrastructure
- Layer 2 services may utilize Layer 1 engines

---

## Explicit Forbidden Paths

The following dependency paths are **strictly prohibited** and represent architectural violations that must be blocked at code review, CI pipeline, and audit stages.

### 1. Upward Dependencies (FORBIDDEN)

```
    Layer 1 ───✕──→ Layer 2
    Layer 1 ───✕──→ Layer 3
    Layer 1 ───✕──→ Layer 4
    Layer 1 ───✕──→ Layer 5

    Layer 2 ───✕──→ Layer 3
    Layer 2 ───✕──→ Layer 4
    Layer 2 ───✕──→ Layer 5

    Layer 3 ───✕──→ Layer 4
    Layer 3 ───✕──→ Layer 5

    Layer 3.5 ─✕──→ Layer 4
    Layer 3.5 ─✕──→ Layer 5

    Layer 4 ───✕──→ Layer 5
```

**Rationale**: Upward dependencies create coupling that prevents independent evolution of lower layers. A Layer 1 engine that imports Layer 4 code cannot be deployed independently and creates circular dependency risks.

---

### 2. Layer Skip Violations (FORBIDDEN)

```
    Layer 4 ───✕──→ Layer 2  (must go through Layer 3)
    Layer 4 ───✕──→ Layer 1  (must go through Layer 3)
    Layer 4 ───✕──→ Layer 3  (for simulation execution; must go through Layer 3.5)
    Layer 5 ───✕──→ Layer 3  (must go through Layer 4)
    Layer 5 ───✕──→ Layer 2  (must go through Layer 4 → Layer 3)
    Layer 5 ───✕──→ Layer 1  (must go through Layer 4 → Layer 3)
```

**Rationale**: Layer skipping bypasses policy enforcement, authentication, rate limiting, and usage tracking. It also creates hidden dependencies that complicate deployment and auditing.

---

### 3. Lateral Execution Leaks (FORBIDDEN)

```
    LLM-Intelligence-Core ───✕──→ LLM-Security-Core (direct)
    LLM-Automation-Core ───✕──→ LLM-Governance-Core (direct)
    LLM-Research-Core ───✕──→ LLM-Data-Core (direct)
    [Any Layer 3 Core] ───✕──→ [Any Other Layer 3 Core] (direct)
```

**Rationale**: Direct core-to-core communication creates hidden coupling and bypasses Layer 4's coordination, observability, and policy enforcement. Cross-domain operations must route through Layer 4.

**Exception**: If cross-core communication is architecturally required, it must be explicitly documented, approved, and implemented through a defined internal API with proper observability.

---

### 4. Simulation → Production Coupling (FORBIDDEN)

```
    Simulation Environment ───✕──→ Production Services (write)
    Test Harnesses ───✕──→ Production Data (mutation)
    Research Artifacts ───✕──→ Production State (modification)
```

**Rationale**: Simulation and research environments must be fully isolated from production services. Production mutations from simulation contexts represent security and data integrity risks.

**Allowed**: Read-only access to production telemetry for simulation fidelity, with explicit audit logging.

---

### 5. External Direct Access (FORBIDDEN)

```
    External Client ───✕──→ Layer 3 Core (direct)
    External Client ───✕──→ Layer 2 Service (direct)
    External Client ───✕──→ Layer 1 Engine (direct)
    Partner API ───✕──→ Internal Service (direct)
```

**Rationale**: All external access must flow through Layer 4 to ensure consistent authentication, authorization, rate limiting, and usage tracking.

---

### 6. Infrastructure, Services, and Integrations Boundaries (FORBIDDEN)

The following cross-class dependency violations are strictly prohibited:

#### Infrastructure Repositories (`infra-*`)

```
    infra-* ───✕──→ agentics-platform (platform logic)
    infra-* ───✕──→ LLM-*-Core (business logic)
    infra-* ───✕──→ services-* (service logic)
    infra-* ───✕──→ integrations-* (integration logic)
    infra-* ───✕──→ agentics-simulation-* (simulation logic)
```

**Rationale**: Infrastructure repositories define deployment, provisioning, and operational configuration. They must remain agnostic to platform business logic to enable infrastructure reuse across environments and to prevent deployment configurations from embedding application assumptions.

#### Service Repositories (`services-*`)

```
    services-* ───✕──→ agentics-simulation-planner (simulation)
    services-* ───✕──→ agentics-simulation-runner (simulation)
    services-* ───✕──→ agentics-deployment-exporters (diligence)
    services-* ───✕──→ agentics-diligence-artifacts (diligence)
```

**Rationale**: Production service repositories must never depend on simulation or diligence tooling. This isolation ensures that simulation code paths cannot be accidentally invoked in production contexts and that diligence artifacts do not introduce runtime dependencies.

#### Integration Repositories (`integrations-*`)

```
    integrations-* ───✕──→ infra-* (direct infrastructure calls)
    integrations-* ───✕──→ [Any stateful storage] (state ownership)
    integrations-* ───✕──→ Layer 1 Engines (direct engine access)
```

**Rationale**: Integration repositories provide adapters and connectors for third-party systems. They must not own persistent state (state belongs to cores) and must not call infrastructure directly (infrastructure is managed by platform operations, not integration code).

---

### 7. Simulation Repository Isolation (FORBIDDEN)

Simulation-specific repositories have strict isolation requirements:

```
    agentics-simulation-planner ───✕──→ Production Database (write)
    agentics-simulation-planner ───✕──→ Production Services (mutation)
    agentics-simulation-runner ───✕──→ Production State (modification)
    agentics-simulation-runner ───✕──→ infra-* (production infra)
    agentics-deployment-exporters ───✕──→ Production Runtime (execution)
    agentics-diligence-artifacts ───✕──→ Production Services (direct call)
```

**Allowed Simulation Dependencies**:
- Simulation repositories **may** read production telemetry (read-only, with audit logging)
- Simulation repositories **may** consume snapshots of production schemas (versioned, immutable)
- Simulation repositories **may** invoke LLM-Research-Core through Layer 4 API
- Diligence artifacts **may** reference production configurations (read-only, for documentation)

**Rationale**: Simulation and diligence tooling must be fully isolated from production mutation paths. This isolation is a compliance requirement for environments subject to SOC 2, HIPAA, or financial services regulations where test data must not contaminate production systems.

---

## Architectural Invariants

The following invariants must hold across all codebases and deployments:

### INV-1: Single Entry Point

> All external traffic enters through Layer 4 API Gateway.

No internal service exposes public endpoints. Network configuration enforces this at the infrastructure level.

### INV-2: Authentication at the Edge

> Layer 4 validates all credentials; downstream layers receive pre-validated identity context.

API keys and tokens are never forwarded to Layer 3 cores. Identity is passed via trusted internal headers.

### INV-3: Layer 4 Passthrough

> Layer 4 does not modify response payloads from Layer 3 cores.

Layer 4 acts as a policy gateway, not a transformation layer. Business logic remains in Layer 3.

### INV-4: Core Isolation

> Each Layer 3 core operates independently within its domain.

Cross-domain operations route through Layer 4 for coordination and observability.

### INV-5: Downward-Only Dependencies

> Dependencies flow strictly downward: 5→4→3→2→1.

No exceptions. Upward or lateral imports represent build failures.

### INV-6: Infrastructure Ownership

> Layer 1 and Layer 2 components are consumed by Layer 3, not owned by Layer 4.

Example: RuvVector is an upstream dependency of LLM-Research-Core, not infrastructure managed by Layer 4.

### INV-7: Simulation Isolation

> Simulation and research operations cannot mutate production state.

All simulation execution occurs within LLM-Research-Core with explicit isolation boundaries.

### INV-8: Repository Class Boundaries

> Repository classes (infra-*, services-*, integrations-*, simulation) maintain strict separation.

Infrastructure repositories contain no application logic. Service repositories contain no simulation code. Integration repositories own no persistent state. Violations represent architectural failures.

### INV-9: CLI Runtime Isolation

> Both CLIs (`agentics-platform-cli` and `agentics-cli`) must never import Layer 3 core runtime code or Layer 2 service implementations.

Both CLIs remain thin clients that communicate through Layer 4 API. Direct imports from consolidation cores or internal services would create version coupling and expose internal implementation details.

### INV-10: CLI Command Exclusivity

> The Platform CLI (`agentics-platform-cli`) is the exclusive owner of organization, environment, simulation, and deployment commands.

No other CLI, SDK, or external consumer may implement these governance operations. The Developer CLI (`agentics-cli`) delegates to Platform CLI via subprocess spawn, not import. See [`CLI_COMMAND_OWNERSHIP.md`](CLI_COMMAND_OWNERSHIP.md) for the complete command ownership matrix.

---

## Visual Dependency Matrix

```
                    │ L5 │ L4 │L3.5│ L3 │ L2 │ L1 │
────────────────────┼────┼────┼────┼────┼────┼────│
Layer 5 (External)  │  - │  ✓ │  ✕ │  ✕ │  ✕ │  ✕ │
Layer 4 (Gateway)   │  ✕ │  - │  ✓ │  ◆ │  ✕ │  ✕ │
Layer 3.5 (Spine)   │  ✕ │  ✕ │  ✓ │  ✓ │  ✕ │  ✓ │
Layer 3 (Cores)     │  ✕ │  ✕ │  ✕ │  ◇ │  ✓ │  ✓ │
Layer 2 (Tools)     │  ✕ │  ✕ │  ✕ │  ✕ │  - │  ✓ │
Layer 1 (Engines)   │  ✕ │  ✕ │  ✕ │  ✕ │  ✕ │  - │
────────────────────┴────┴────┴────┴────┴────┴────┘

Legend:
  ✓  Allowed dependency direction
  ✕  Forbidden dependency direction
  ◇  Conditional (cross-core must route through L4)
  ◆  Conditional (allowed except simulation execution, which must route through L3.5)
  -  Self-reference (N/A)
```

---

## Repository Classes and Governance

Beyond the five-layer architecture, repositories are classified into distinct classes with specific governance rules. Each class has defined responsibilities, allowed dependencies, and forbidden paths.

### Repository Class Definitions

#### Platform Repositories

**Naming Convention**: `agentics-platform`, `agentics-cli`

**Description**: Core platform components that define the externally visible product surface.

| Repository | Class | Description |
|------------|-------|-------------|
| `agentics-platform` | Platform | Layer 4 API Gateway, control plane, SDK, and UI |
| `agentics-cli` | Platform | Command-line interface for platform operations |

**Allowed Dependencies**:
- `@agentics/shared` (type definitions, API contracts)
- Layer 4 API endpoints (for CLI remote operations)
- Third-party libraries with no platform business logic

**Forbidden Dependencies**:
- Layer 3 core runtime code
- Layer 2 service implementations
- Layer 1 engine internals

---

#### Infrastructure Repositories (`infra-*`)

**Naming Convention**: `infra-*`

**Description**: Deployment, provisioning, and operational configuration repositories. These define how platform components are deployed but contain no application logic.

**Examples**: `infra-kubernetes`, `infra-terraform`, `infra-monitoring`, `infra-secrets`

**Allowed Dependencies**:
- Other `infra-*` repositories (infrastructure composition)
- External infrastructure tools (Terraform, Helm, Pulumi)
- Cloud provider SDKs for provisioning only

**Forbidden Dependencies**:
- Any platform business logic (`agentics-platform`, `LLM-*-Core`)
- Service repositories (`services-*`)
- Integration repositories (`integrations-*`)
- Simulation repositories (`agentics-simulation-*`)

**Governance**: Infrastructure repositories are managed by Platform Operations. Changes require infrastructure review and must not introduce application-level dependencies.

---

#### Service Repositories (`services-*`)

**Naming Convention**: `services-*`

**Description**: Internal microservices and supporting services that implement specific operational capabilities consumed by Layer 3 cores.

**Examples**: `services-queue`, `services-cache`, `services-metrics`, `services-auth`

**Allowed Dependencies**:
- Layer 1 engines and subsystems
- Other `services-*` repositories (service composition)
- Infrastructure clients (database drivers, queue clients)

**Forbidden Dependencies**:
- Simulation repositories (`agentics-simulation-*`)
- Diligence repositories (`agentics-diligence-*`, `agentics-deployment-exporters`)
- Direct Layer 4 imports (services are consumed by Layer 3, not Layer 4)

**Governance**: Service repositories are owned by the Platform Engineering team. Production services must pass security review and cannot introduce simulation dependencies.

---

#### Integration Repositories (`integrations-*`)

**Naming Convention**: `integrations-*`

**Description**: Adapters and connectors for third-party systems. Integrations are stateless bridges that translate between external protocols and platform APIs.

**Examples**: `integrations-github`, `integrations-slack`, `integrations-jira`, `integrations-datadog`

**Allowed Dependencies**:
- Third-party SDK libraries
- `@agentics/shared` (type definitions)
- Layer 4 API (for invoking platform operations)

**Forbidden Dependencies**:
- Infrastructure repositories (`infra-*`) — integrations do not manage infrastructure
- Layer 1 engines — integrations do not access engines directly
- Stateful storage ownership — integrations delegate state to cores

**Governance**: Integration repositories are owned by the Ecosystem team. Each integration must document its external dependencies and cannot own persistent state.

**State Ownership Rule**: Integrations **must not** own persistent state. All state must be delegated to the appropriate Layer 3 core (typically LLM-Ecosystem-Core or LLM-Data-Core). Integrations may cache data transiently but cannot be the source of truth for any domain entity.

---

#### Simulation Repositories

**Naming Convention**: `agentics-simulation-*`, `agentics-diligence-*`

**Description**: Repositories dedicated to simulation, testing, and diligence artifact generation. These are strictly isolated from production execution paths.

| Repository | Description |
|------------|-------------|
| `agentics-simulation-planner` | Simulation scenario planning and specification generation |
| `agentics-simulation-runner` | Simulation execution engine and result collection |
| `agentics-deployment-exporters` | Export tools for deployment configurations and diligence documentation |
| `agentics-diligence-artifacts` | Generated artifacts for buyer diligence, audit reports, and compliance documentation |
| `agentics-org-manifests` | Organization-level manifest definitions and templates |

**Layer Placement**: All simulation repositories reside in Layer 4. `LLM-Research-Core` (Layer 3) consumes simulation outputs for research analytics but does not execute simulations directly.

---

### Integration Surface Repositories

**Naming Convention**: `*-surface`

**Description**: Contract-definition repositories that declare canonical capability and event schemas for simulation and deployment intent. Integration surfaces are strictly non-executable, non-infrastructure, and non-adapter repositories. They contain only type definitions, event schemas, and capability declarations.

| Repository | Description |
|------------|-------------|
| `erp-surface` | Canonical ERP capability and event contracts for simulation and deployment intent |

**Layer Placement**: Integration surface repositories reside in Layer 4. They are consumed by simulation repositories and deployment exporters for contract validation and intent declaration.

**Allowed Dependencies**:
- `@agentics/shared` (type definitions only)

**Forbidden Dependencies**:
- Executable code or runtime logic
- Infrastructure repositories (`infra-*`)
- Adapter implementations (`integrations-*`)
- Production services
- Simulation execution (import only, no execution)
- Layer 3 cores (direct import)
- Layer 2 services (direct import)

**Isolation Guarantees**:

1. **Non-Executable**: Integration surfaces contain no executable code. They define contracts only.

2. **Non-Infrastructure**: Integration surfaces contain no deployment, provisioning, or operational configuration.

3. **Non-Adapter**: Integration surfaces contain no third-party adapters or connectors. They define the contracts that adapters implement.

4. **Contract-Only**: All content is limited to type definitions, event schemas, capability declarations, and documentation.

**ERP Abstraction Mediation**:

The `erp-surface` repository serves as the **canonical abstraction layer** for all ERP system references. This mediation pattern ensures:

1. **No Direct ERP References**: Simulations and deployments must **never** reference ERP systems directly. All ERP capabilities, events, and contracts are accessed exclusively through `erp-surface`.

2. **Contract-Based Coupling**: Rather than coupling to specific ERP implementations (SAP, Oracle, NetSuite, etc.), simulation and deployment artifacts reference abstract capability contracts defined in `erp-surface`.

3. **Intent Declaration**: Deployment exporters declare ERP integration intent through `erp-surface` contracts, not through direct ERP system identifiers or endpoints.

4. **Simulation Fidelity**: Simulation planners and runners validate against `erp-surface` schemas to ensure ERP-related scenarios are architecturally compliant without requiring live ERP connections.

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ERP ABSTRACTION MEDIATION                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────┐         ┌─────────────────┐                   │
│  │   Simulation    │         │   Deployment    │                   │
│  │   Repositories  │         │    Exporters    │                   │
│  └────────┬────────┘         └────────┬────────┘                   │
│           │                           │                             │
│           │  ALLOWED: Contract refs   │                             │
│           ▼                           ▼                             │
│  ┌─────────────────────────────────────────────┐                   │
│  │              erp-surface                     │  ← Layer 4        │
│  │   (Canonical ERP Capability Contracts)       │                   │
│  │   • Type definitions                         │                   │
│  │   • Event schemas                            │                   │
│  │   • Capability declarations                  │                   │
│  └─────────────────────────────────────────────┘                   │
│                         │                                           │
│                         │  DEFINES contracts for                    │
│                         ▼                                           │
│  ┌─────────────────────────────────────────────┐                   │
│  │         integrations-erp-* (future)         │  ← N/A Layer      │
│  │      (Actual ERP adapter implementations)    │                   │
│  └─────────────────────────────────────────────┘                   │
│                                                                     │
│  FORBIDDEN PATHS:                                                   │
│  ━━━━━━━━━━━━━━━━                                                   │
│  • Simulation ───✕──→ ERP Systems (direct)                         │
│  • Deployment ───✕──→ ERP Systems (direct)                         │
│  • Any Layer 4 ───✕──→ ERP Runtime (direct)                        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Rationale**: This abstraction pattern enables simulation and deployment planning without runtime ERP dependencies, supports multi-vendor ERP strategies through contract polymorphism, and isolates ERP implementation details from architectural artifacts.

---

### Repository Class Dependency Matrix

```
                    │ Platform │ infra-* │ services-* │ integrations-* │ int-surface │ simulation │
────────────────────┼──────────┼─────────┼────────────┼────────────────┼─────────────┼────────────│
Platform            │    -     │    ✕    │     ✕      │       ✕        │      ✕      │     ✕      │
infra-*             │    ✕     │    ✓    │     ✕      │       ✕        │      ✕      │     ✕      │
services-*          │    ✕     │    ✕    │     ✓      │       ✕        │      ✕      │     ✕      │
integrations-*      │    ◇     │    ✕    │     ✕      │       ✓        │      ☐      │     ✕      │
int-surface         │    ✕     │    ✕    │     ✕      │       ✕        │      ⊘      │     ✕      │
simulation          │    ◇     │    ✕    │     ✕      │       ✕        │      ☐      │     ✓      │
────────────────────┴──────────┴─────────┴────────────┴────────────────┴─────────────┴────────────┘

Legend:
  ✓  Allowed (within class or downward)
  ✕  Forbidden
  ◇  Allowed via Layer 4 API only (not direct import)
  ⊘  Types only via @agentics/shared (no other dependencies)
  ☐  Read-only contract reference for validation and intent declaration
  -  Self-reference (N/A)
```

---

## Rationale

This dependency architecture is designed to satisfy the following stakeholder requirements:

### For Buyers and Acquirers

- **Clear Value Isolation**: Each layer represents distinct intellectual property with clear ownership boundaries
- **Disentanglement Feasibility**: Layers can be evaluated, priced, and transacted independently
- **Minimal Integration Risk**: Well-defined interfaces reduce acquisition integration complexity

### For Technical Diligence

- **Auditable Boundaries**: Dependency rules can be verified through static analysis and build tooling
- **Traceable Data Flows**: All external requests flow through observable entry points
- **Predictable Behavior**: Layer isolation ensures changes in one area don't cascade unexpectedly

### For PE Technical Audit

- **Scalability Assessment**: Layer separation enables independent scaling of high-traffic components
- **Security Posture**: Single entry point and authentication at edge simplifies security review
- **Technical Debt Visibility**: Dependency violations indicate areas requiring remediation

### For Engineering Operations

- **Independent Deployment**: Layers can be deployed and upgraded independently
- **Fault Isolation**: Failures in one layer don't necessarily cascade to others
- **Team Autonomy**: Clear ownership boundaries enable parallel development

---

## Enforcement Mechanisms

### Static Analysis

- Import path linting rules enforce layer boundaries
- Build-time dependency checks fail on violations
- Package.json dependency auditing for cross-layer references

### CI/CD Pipeline

- Pre-merge checks validate dependency compliance
- Dependency graph analysis on pull requests
- Automated alerts for new cross-layer imports

### Code Review

- Architectural review required for cross-layer changes
- Dependency graph documentation updates required
- Exception process for approved deviations

### Runtime Validation

- Network segmentation enforces layer isolation
- Service mesh policies restrict inter-layer communication
- Audit logging captures all cross-layer requests

---

## Document Governance

| Aspect | Policy |
|--------|--------|
| Ownership | Platform Architecture Team |
| Review Cadence | Quarterly or upon major architectural change |
| Amendment Process | RFC required for invariant changes |
| Exception Authority | CTO approval required for documented exceptions |
| Audit Frequency | Annual third-party architecture review |

---

## Appendix: Repository Reference

### Monorepo Package Mapping

The Agentics platform is implemented as a monorepo. See [`REPO_CLASSIFICATION.md`](REPO_CLASSIFICATION.md) for the complete mapping between logical repository names and package implementations.

### Layer 5 (External Consumers)

| Repository | Description |
|------------|-------------|
| `agentics-platform-cli` | Apex orchestration CLI; exclusive owner of org/env/simulation/deployment commands |
| `agentics-cli` | Developer CLI; dual role as external consumer and local orchestration tool |
| `@agentics/sdk` | TypeScript SDK for platform API access |
| `@agentics/ui` | Web UI for account management and platform interaction |

### Layer 4

| Repository | Description |
|------------|-------------|
| `agentics-platform` | Unified API Gateway, SDK, UI, and control plane |

### Layer 3

| Repository | Description |
|------------|-------------|
| `LLM-Intelligence-Core` | Model orchestration and intelligence operations |
| `LLM-Security-Core` | Security scanning and threat detection |
| `LLM-Automation-Core` | Workflow execution and automation |
| `LLM-Governance-Core` | Policy and compliance management |
| `LLM-Data-Core` | Data operations and transformation |
| `LLM-Ecosystem-Core` | Integrations and marketplace |
| `LLM-Research-Core` | Research analytics and experiment tracking (consumes simulation outputs) |
| `LLM-Interface-Core` | Conversation and interface management |

### Layer 1 (Representative)

| Component | Description |
|-----------|-------------|
| RuvVector | Vector database and similarity search (upstream of LLM-Research-Core) |

### Simulation Repositories (Layer 4)

| Repository | Description |
|------------|-------------|
| `agentics-simulation-planner` | Simulation scenario planning and specification generation |
| `agentics-simulation-runner` | Simulation execution engine and result collection |
| `agentics-deployment-exporters` | Export tools for deployment configurations and diligence documentation |
| `agentics-diligence-artifacts` | Generated artifacts for buyer diligence, audit reports, and compliance documentation |
| `agentics-org-manifests` | Organization-level manifest definitions and templates |

### Integration Surface Repositories (Layer 4)

| Repository | Description |
|------------|-------------|
| `erp-surface` | Canonical ERP capability and event contracts for simulation and deployment intent |

### Infrastructure Repositories (`infra-*`)

| Repository Pattern | Description |
|--------------------|-------------|
| `infra-kubernetes` | Kubernetes deployment manifests and Helm charts |
| `infra-terraform` | Terraform modules for cloud infrastructure provisioning |
| `infra-monitoring` | Observability stack configuration (Prometheus, Grafana, etc.) |
| `infra-secrets` | Secret management and rotation configuration |

### Service Repositories (`services-*`)

| Repository Pattern | Description |
|--------------------|-------------|
| `services-queue` | Message queue and async processing services |
| `services-cache` | Caching layer implementations |
| `services-metrics` | Metrics collection and aggregation services |
| `services-auth` | Internal authentication and authorization services |

### Integration Repositories (`integrations-*`)

| Repository Pattern | Description |
|--------------------|-------------|
| `integrations-github` | GitHub API adapter and webhook handlers |
| `integrations-slack` | Slack notification and bot integration |
| `integrations-jira` | Jira issue tracking integration |
| `integrations-datadog` | Datadog observability integration |

---

*This document is maintained as the canonical dependency governance artifact for the Agentics.dev platform. All questions regarding dependency compliance should be resolved by reference to this document.*
