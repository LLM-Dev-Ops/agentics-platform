# Architecture Decisions Record

**Version**: 1.1
**Status**: Canonical
**Classification**: Diligence Documentation
**Last Updated**: 2025-01-03
**Canonical Reference**: [`DEPENDENCY_GRAPH.md`](DEPENDENCY_GRAPH.md)

---

## Purpose

This document records key architectural decisions relevant to buyer diligence, PE technical audit, and CTO review. Each decision includes rationale, alternatives considered, and implications for platform value and risk assessment.

These decisions represent closed, intentional choices—not evolving experiments. The architecture is designed to be auditable, defensible, and suitable for transaction due diligence.

---

## Decision Index

| ID | Decision | Category |
|----|----------|----------|
| ADR-001 | Simulations are generic, not company-specific | Product Architecture |
| ADR-002 | Intent → Simulation → Export → Deploy abstraction boundary | System Boundaries |
| ADR-003 | Infrastructure, Services, and Integrations strict isolation | Dependency Governance |
| ADR-004 | Five-layer architecture with downward-only dependencies | Structural Architecture |
| ADR-005 | Layer 4 as sole external entry point | Security & Access |
| ADR-006 | CLI as thin client without runtime embedding | Distribution Model |
| ADR-007 | Simulation repositories isolated from production | Compliance & Safety |
| ADR-008 | Consolidation cores own all business logic | Domain Ownership |
| ADR-009 | Simulation abstraction and organization-agnostic design | Product Architecture |

**Note**: ADR-009 is documented in full in [`adr/ADR-009-simulation-abstraction.md`](adr/ADR-009-simulation-abstraction.md).

---

## ADR-001: Simulations Are Generic, Not Company-Specific

### Context

The platform provides simulation capabilities for testing, load analysis, and scenario validation. A design choice exists between:

1. **Generic simulations**: Platform-defined simulation types applicable across all customers
2. **Company-specific simulations**: Custom simulation logic per customer deployment

### Decision

**Simulations are generic.** The platform provides standardized simulation scenarios (load testing, failure injection, performance profiling) that apply uniformly across all deployments.

### Rationale

1. **IP Protection**: Generic simulations do not embed customer-specific business logic, reducing IP entanglement during acquisition
2. **Scalability**: Single simulation codebase serves all customers without per-customer maintenance burden
3. **Auditability**: Standard scenarios can be validated once and applied broadly
4. **Valuation Clarity**: Simulation capabilities are platform value, not customer-specific customization

### Implications

- Customers configure simulations through parameters, not custom code
- Simulation scenarios are versioned as platform releases
- No customer-specific simulation repositories exist
- Simulation planning and execution reside in Layer 4 repositories (`agentics-simulation-planner`, `agentics-simulation-runner`, `agentics-deployment-exporters`, `agentics-diligence-artifacts`, `agentics-org-manifests`)
- `LLM-Research-Core` consumes simulation outputs for research analytics but does not execute simulations directly

### Alternatives Considered

| Alternative | Reason Rejected |
|-------------|-----------------|
| Per-customer simulation repos | IP entanglement, maintenance burden, valuation complexity |
| Plugin-based custom simulations | Security risk, versioning complexity, support overhead |

---

## ADR-002: Intent → Simulation → Export → Deploy Abstraction Boundary

### Context

The platform must define clear boundaries between:

- User intent specification
- Simulation and validation
- Configuration export
- Production deployment

### Decision

**The platform enforces a strict abstraction boundary**: Intent → Simulation → Export → Deploy.

```
┌─────────┐    ┌────────────┐    ┌────────┐    ┌────────┐
│  Intent │ →  │ Simulation │ →  │ Export │ →  │ Deploy │
└─────────┘    └────────────┘    └────────┘    └────────┘
     │               │               │              │
     ▼               ▼               ▼              ▼
  User input    Planning &      Artifacts &    Production
  via L4 API    execution (L4)  configs (L4)   execution
```

**Layer Placement**: All simulation planning, execution, export, and evidence repositories reside entirely in Layer 4:

- `agentics-simulation-planner` — Scenario planning and specification
- `agentics-simulation-runner` — Execution engine and result collection
- `agentics-deployment-exporters` — Configuration and artifact export
- `agentics-diligence-artifacts` — Audit and compliance evidence
- `agentics-org-manifests` — Organization-level manifest definitions

`LLM-Research-Core` (Layer 3) consumes simulation outputs for research analytics, experiment tracking, and A/B test analysis. It does not execute simulations directly.

### Rationale

1. **Simulation Isolation**: Simulations never directly mutate production; they produce artifacts that are explicitly exported
2. **Audit Trail**: Each boundary crossing is logged and traceable
3. **Rollback Safety**: Export artifacts are versioned; deployment can target any artifact version
4. **Compliance**: Satisfies SOC 2 and financial services requirements for environment separation
5. **Diligence Clarity**: Each stage has distinct ownership and can be evaluated independently

### Implications

- `agentics-simulation-planner` and `agentics-simulation-runner` produce artifacts, not deployments
- `agentics-deployment-exporters` transforms validated results into deployable configurations
- No direct path exists from simulation execution to production state mutation
- Layer 4 API mediates all boundary crossings

### Alternatives Considered

| Alternative | Reason Rejected |
|-------------|-----------------|
| Direct simulation-to-deploy | Compliance violation, audit gap, rollback complexity |
| Unified simulation+deploy service | Separation of concerns violation, testing difficulty |

---

## ADR-003: Infrastructure, Services, and Integrations Strict Isolation

### Context

The platform includes multiple repository classes beyond the core layers:

- Infrastructure (`infra-*`): Deployment and provisioning
- Services (`services-*`): Internal microservices
- Integrations (`integrations-*`): Third-party connectors

These classes require governance to prevent coupling and preserve independent evolution.

### Decision

**Each repository class is strictly isolated with explicit forbidden paths.**

| Class | Must Not Depend On |
|-------|-------------------|
| `infra-*` | Platform logic, business logic, services, integrations, simulation |
| `services-*` | Simulation repos, diligence repos, Layer 4 direct |
| `integrations-*` | Infrastructure, Layer 1 engines, services direct, state ownership |

### Rationale

1. **Infrastructure Reuse**: `infra-*` repos can be applied to any application, not just this platform
2. **Production Safety**: `services-*` cannot accidentally include simulation code paths
3. **Stateless Integrations**: `integrations-*` delegate state to cores, enabling replacement without data migration
4. **Independent Scaling**: Each class can scale and evolve without affecting others
5. **Clear Ownership**: Team boundaries align with repository class boundaries

### Implications

- Infrastructure changes never require application code changes
- Service deployments never include simulation dependencies
- Integration additions never require infrastructure changes
- Each class has dedicated CI/CD pipelines

### Alternatives Considered

| Alternative | Reason Rejected |
|-------------|-----------------|
| Monorepo with mixed concerns | Coupling, deployment complexity, team collision |
| Shared utility libraries across classes | Hidden dependencies, versioning conflicts |

---

## ADR-004: Five-Layer Architecture with Downward-Only Dependencies

### Context

The platform requires a structural model that:

- Separates external access from internal implementation
- Preserves component value for potential transaction
- Enables independent evolution of subsystems

### Decision

**The platform uses a strict five-layer architecture with downward-only dependencies.**

```
Layer 5: External Consumers (CLI, SDK, UI, Partners)
    ↓
Layer 4: API Gateway & Control Plane (agentics-platform)
    ↓
Layer 3: Consolidation Cores (LLM-*-Core)
    ↓
Layer 2: Developer Tools & Services (services-*)
    ↓
Layer 1: Standalone Engines & Subsystems (RuvVector, etc.)
```

**Invariant**: Dependencies flow strictly downward. No upward or lateral dependencies permitted.

### Rationale

1. **Value Preservation**: Each layer represents distinct IP that can be evaluated independently
2. **Deployment Independence**: Lower layers deploy without higher layer changes
3. **Security Boundary**: Single entry point (Layer 4) simplifies access control
4. **Audit Simplicity**: Dependency direction is trivially verifiable
5. **Acquisition Clarity**: Buyers can assess layer-by-layer value and risk

### Implications

- Build failures on upward dependency detection
- Cross-layer communication via defined interfaces only
- Layer 3 cores cannot import each other directly
- Layer 4 cannot bypass Layer 3 to access Layer 1

### Alternatives Considered

| Alternative | Reason Rejected |
|-------------|-----------------|
| Microservices mesh (no layers) | Hidden coupling, audit complexity, unclear boundaries |
| Three-layer (UI, API, DB) | Insufficient separation for consolidation core model |

---

## ADR-005: Layer 4 as Sole External Entry Point

### Context

External consumers (CLI, SDK, partners) need platform access. Options include:

1. Direct access to individual services
2. Multiple API gateways per domain
3. Single unified gateway

### Decision

**Layer 4 (`agentics-platform`) is the sole external entry point.** No internal service exposes public endpoints.

### Rationale

1. **Security Centralization**: Authentication, authorization, and rate limiting in one place
2. **Usage Tracking**: All external requests flow through unified metering
3. **Billing Integration**: Single point for quota enforcement and Stripe integration
4. **Observability**: Complete request tracing from a single ingress
5. **API Consistency**: Unified error handling, versioning, and documentation

### Implications

- Network configuration blocks direct access to Layer 3 and below
- All external clients use the same authentication mechanism
- API versioning is controlled at Layer 4
- Downstream services receive pre-validated identity context

### Alternatives Considered

| Alternative | Reason Rejected |
|-------------|-----------------|
| Per-core public APIs | Duplicated auth, inconsistent UX, complex rate limiting |
| Multiple gateways | Operational overhead, split observability |

---

## ADR-006: CLI as Thin Client Without Runtime Embedding

### Context

The CLI (`agentics-cli`) provides command-line access to platform capabilities. Design options:

1. **Thick client**: Embed core runtime for local execution
2. **Thin client**: Remote control that calls Layer 4 API

### Decision

**The CLI is a thin client.** It communicates exclusively through Layer 4 API for remote operations and performs only local-only operations without Layer 4.

**Permitted Local Operations**:
- Configuration management (credentials, endpoints, preferences)
- Schema validation and linting (using vendored schema definitions)
- Manifest file operations (reading, writing, validating `agentics-org-manifests` format)
- Simulation artifact inspection (reading exported artifacts, formatting output)
- Local file formatting and transformation (no execution)

**Forbidden Operations**:
- The CLI **must never** import or execute Layer 3 core runtime code
- The CLI **must never** import or execute Layer 2 service implementations
- The CLI **must never** import or execute infrastructure (`infra-*`) code
- The CLI **must never** import or execute integration adapters (`integrations-*`)
- The CLI **must never** embed business logic belonging to any consolidation core

The CLI may reference shared type definitions (`@agentics/shared`) and schema files for validation, but must not link against any runtime execution code.

### Rationale

1. **Distribution Safety**: CLI can be distributed without exposing internal implementation
2. **Version Independence**: CLI version decoupled from backend version
3. **Security**: No business logic in client-side code
4. **Size**: Minimal binary without embedded engines
5. **Consistency**: CLI behavior matches SDK and UI behavior exactly

### Implications

- CLI releases independent of platform releases
- No offline execution of platform operations
- CLI updates do not require backend coordination
- Error messages come from Layer 4, ensuring consistency

### Alternatives Considered

| Alternative | Reason Rejected |
|-------------|-----------------|
| Embedded inference engine | Distribution size, version coupling, IP exposure |
| Hybrid local/remote | Complexity, inconsistent behavior, testing burden |

---

## ADR-007: Simulation Repositories Isolated from Production

### Context

Simulation and diligence repositories exist for testing, validation, and artifact generation. These must not affect production systems.

### Decision

**Simulation repositories are strictly isolated from production.** They cannot:

- Write to production databases
- Mutate production service state
- Modify production infrastructure
- Import production service runtime directly

They may only:

- Read production telemetry (with audit logging)
- Consume schema snapshots (versioned, immutable)
- Invoke Layer 4 API (read operations)

**Integrations Boundary Closure**: Simulation, exporter, and org-manifest repositories (`agentics-simulation-planner`, `agentics-simulation-runner`, `agentics-deployment-exporters`, `agentics-diligence-artifacts`, `agentics-org-manifests`) may reference:

- Integration schema definitions (for validation and artifact generation)
- Integration configuration templates (read-only, for export purposes)

They **must never**:

- Import live integration adapters (`integrations-*` runtime code)
- Call integration service endpoints directly
- Depend on integration runtime state or connections

This boundary ensures simulation artifacts can describe integration configurations without creating runtime coupling to third-party systems.

### Rationale

1. **Compliance**: SOC 2, HIPAA, and financial services require test/production separation
2. **Safety**: Prevents accidental production mutations from test code
3. **Auditability**: Clear boundary enables compliance attestation
4. **Confidence**: Production behavior unaffected by simulation changes

### Implications

- Separate network segments for simulation environments
- Distinct credential sets with no production write access
- Build configurations that exclude simulation from production artifacts
- Dedicated simulation data namespaces

### Alternatives Considered

| Alternative | Reason Rejected |
|-------------|-----------------|
| Shared environment with flags | Risk of flag misconfiguration, audit complexity |
| Simulation in production with read-only | Still creates coupling, complicates deployment |

---

## ADR-008: Consolidation Cores Own All Business Logic

### Context

Business logic (intelligence, security, automation, governance, data, ecosystem, research, interface) must be located somewhere. Options:

1. Distributed across services
2. Embedded in API gateway
3. Consolidated in domain-specific cores

### Decision

**Eight consolidation cores own all business logic.** Layer 4 performs no business logic. Layer 2 and Layer 1 provide building blocks without domain logic.

| Core | Domain |
|------|--------|
| `LLM-Intelligence-Core` | Model orchestration, prompt engineering, embeddings |
| `LLM-Security-Core` | Threat detection, vulnerability scanning, policies |
| `LLM-Automation-Core` | Workflow execution, scheduling, pipelines |
| `LLM-Governance-Core` | Policy definition, compliance, approvals |
| `LLM-Data-Core` | Ingestion, transformation, queries, lineage |
| `LLM-Ecosystem-Core` | Integrations, marketplace, webhooks |
| `LLM-Research-Core` | Research analytics, experiment tracking, A/B test analysis (consumes simulation outputs) |
| `LLM-Interface-Core` | Conversations, sessions, formatting |

### Rationale

1. **Clear Ownership**: Each domain has a single owner
2. **Value Identification**: Business logic is concentrated and identifiable
3. **Independent Evolution**: Cores evolve without affecting each other
4. **Team Alignment**: Teams own domains, not layers
5. **Transaction Clarity**: Buyers can evaluate domain-by-domain value

### Implications

- Layer 4 is a passthrough gateway only
- Cross-domain operations route through Layer 4
- Each core has distinct API surface exposed through Layer 4
- Core-to-core direct imports are forbidden

### Alternatives Considered

| Alternative | Reason Rejected |
|-------------|-----------------|
| Logic in gateway | Gateway becomes monolith, testing complexity |
| Logic in services | Scattered ownership, unclear domain boundaries |
| Single unified core | Monolith risks, team collision, deployment coupling |

---

## Decision Traceability

All decisions documented here are reflected in:

- [`DEPENDENCY_GRAPH.md`](DEPENDENCY_GRAPH.md) — Canonical dependency rules
- [`FORBIDDEN_PATHS.md`](FORBIDDEN_PATHS.md) — Explicit prohibition enumeration
- [`REPO_CLASSIFICATION.md`](REPO_CLASSIFICATION.md) — Repository assignments
- `.github/workflows/architecture-enforcement.yml` — CI enforcement

---

## Document Governance

| Aspect | Policy |
|--------|--------|
| Ownership | Platform Architecture Team |
| Amendment | RFC required; CTO approval for changes |
| Review | Prior to any acquisition diligence |
| Audience | CTOs, PE technical auditors, acquisition teams |

---

*This document records closed architectural decisions. Changes require RFC process and CTO approval. The architecture is designed to be auditable, defensible, and transaction-ready.*
