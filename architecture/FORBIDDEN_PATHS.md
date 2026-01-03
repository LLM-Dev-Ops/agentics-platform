# Forbidden Dependency Paths

**Version**: 1.1
**Status**: Canonical
**Classification**: Architecture Enforcement Artifact
**Last Updated**: 2025-01-03
**Canonical Reference**: [`DEPENDENCY_GRAPH.md`](DEPENDENCY_GRAPH.md)

---

## Purpose

This document enumerates all forbidden dependency paths at the repository-class level. It serves as a quick-reference enforcement checklist for code reviews, CI pipelines, and architectural audits. All rules documented here derive from and are consistent with the canonical [`DEPENDENCY_GRAPH.md`](DEPENDENCY_GRAPH.md).

Violations of any path listed below represent architectural failures that must be blocked at:
- Pre-commit hooks
- CI/CD pipeline checks
- Code review gates
- Deployment validation

---

## Repository Class Summary

| Class | Pattern | Examples |
|-------|---------|----------|
| Platform | `agentics-platform`, `agentics-cli` | Core product surface |
| Consolidation Cores | `LLM-*-Core` | Business logic domains |
| Infrastructure | `infra-*` | Deployment, provisioning, operations |
| Services | `services-*` | Internal microservices |
| Integrations | `integrations-*` | Third-party adapters |
| Simulation | `agentics-simulation-*`, `agentics-diligence-*` | Test, simulation, diligence |

---

## Forbidden Paths by Repository Class

### 1. CLI (`agentics-cli`)

The CLI is a thin client that must never embed runtime business logic. It communicates exclusively through platform orchestration APIs for remote operations.

| Forbidden Dependency | Rationale |
|---------------------|-----------|
| `LLM-Intelligence-Core` | CLI must not import core runtime code |
| `LLM-Security-Core` | CLI must not import core runtime code |
| `LLM-Automation-Core` | CLI must not import core runtime code |
| `LLM-Governance-Core` | CLI must not import core runtime code |
| `LLM-Data-Core` | CLI must not import core runtime code |
| `LLM-Ecosystem-Core` | CLI must not import core runtime code |
| `LLM-Research-Core` | CLI must not import core runtime code |
| `LLM-Interface-Core` | CLI must not import core runtime code |
| `services-*` | CLI must not import service implementations |
| `infra-*` | CLI does not manage infrastructure |
| `agentics-simulation-planner` | CLI must not directly trigger simulation planning |
| `agentics-simulation-runner` | CLI must not directly trigger simulation execution |
| `agentics-deployment-exporters` | CLI must not directly invoke export tooling |
| `agentics-diligence-artifacts` | CLI must not directly invoke diligence generation |

**Allowed**: `@agentics/shared` (types only), `agentics-platform` orchestration API (HTTP calls only)

**API Restriction**: The CLI may only call platform orchestration APIs exposed by `agentics-platform`. It must never directly trigger simulations, planners, runners, or diligence exporters. All such operations are mediated exclusively through platform-provided endpoints.

---

### 2. Platform (`agentics-platform`)

The platform is Layer 4 and must not bypass Layer 3. It exposes read-only, simulation-safe query APIs but never initiates or executes simulations directly.

| Forbidden Dependency | Rationale |
|---------------------|-----------|
| Layer 2 services (direct) | Must route through Layer 3 |
| Layer 1 engines (direct) | Must route through Layer 3 |
| `agentics-simulation-*` (execution) | Platform does not execute simulations |
| `agentics-diligence-*` (execution) | Platform does not generate diligence artifacts |
| `infra-*` | Platform is application logic, not infrastructure |

**Allowed**: Layer 3 cores (via HTTP), `@agentics/shared`

**Simulation Boundary**: The platform may expose APIs that allow authorized clients to query simulation status or retrieve immutable simulation outputs, but it must never initiate, schedule, or execute simulation runs. Simulation orchestration is the exclusive responsibility of simulation repositories (`agentics-simulation-planner`, `agentics-simulation-runner`).

---

### 3. Consolidation Cores (`LLM-*-Core`)

Cores must not invoke each other directly or depend upward.

| Forbidden Dependency | Rationale |
|---------------------|-----------|
| `agentics-platform` | Upward dependency forbidden |
| `agentics-cli` | Upward dependency forbidden |
| Other `LLM-*-Core` (direct import) | Lateral execution leak |
| `agentics-simulation-*` | Production cores must not import simulation code |
| `agentics-diligence-*` | Production cores must not import diligence code |

**Allowed**: Layer 2 services, Layer 1 engines, `@agentics/shared`

**Exception**: Cross-core operations route through Layer 4 API, not direct import.

---

### 4. Infrastructure Repositories (`infra-*`)

Infrastructure defines deployment; it must contain no application logic.

| Forbidden Dependency | Rationale |
|---------------------|-----------|
| `agentics-platform` | Infra must not import platform logic |
| `LLM-*-Core` | Infra must not import business logic |
| `services-*` | Infra must not import service logic |
| `integrations-*` | Infra must not import integration logic |
| `agentics-simulation-*` | Infra must not import simulation logic |
| `agentics-diligence-*` | Infra must not import diligence logic |
| `agentics-cli` | Infra must not import CLI logic |

**Allowed**: Other `infra-*` repos, external infrastructure tools (Terraform, Helm, Pulumi), cloud provider SDKs

---

### 5. Service Repositories (`services-*`)

Services are internal components consumed by Layer 3. Services may invoke integration adapters when delegated by cores.

| Forbidden Dependency | Rationale |
|---------------------|-----------|
| `agentics-simulation-planner` | Production services must not import simulation |
| `agentics-simulation-runner` | Production services must not import simulation |
| `agentics-deployment-exporters` | Production services must not import diligence tooling |
| `agentics-diligence-artifacts` | Production services must not import diligence artifacts |
| `agentics-platform` (direct import) | Services are consumed by cores, not platform |
| `agentics-cli` | Services must not import CLI |

**Allowed**: Layer 1 engines, other `services-*` repos, infrastructure clients (drivers, SDKs), `integrations-*` (when delegated by Layer 3 cores)

**Invocation Direction**: Services may invoke integration adapters (`integrations-*`) to fulfill core-delegated operations. The reverse is forbidden: integrations must not invoke services directly.

---

### 6. Integration Repositories (`integrations-*`)

Integrations are stateless edge adapters; they must not own state or manage infrastructure. Integrations are invoked by services, never the reverse.

| Forbidden Dependency | Rationale |
|---------------------|-----------|
| `infra-*` | Integrations do not manage infrastructure |
| Layer 1 engines (direct) | Integrations do not access engines directly |
| `services-*` (direct invocation) | Integrations must not invoke services; services invoke integrations |
| Any stateful storage (ownership) | Integrations must not own persistent state |
| `agentics-simulation-*` | Integrations must not import simulation |
| `agentics-diligence-*` | Integrations must not import diligence |

**Allowed**: Third-party SDKs, `@agentics/shared`, Layer 4 API (HTTP calls for orchestration queries only)

**Invocation Direction**: The dependency direction is explicit: `services-*` → `integrations-*` is permitted; `integrations-*` → `services-*` is forbidden. Integrations receive invocations from services (when delegated by cores) and return results. Integrations must never initiate calls to internal services.

**State Ownership Rule**: Integrations delegate all persistent state to Layer 3 cores. Transient caching is permitted; source-of-truth ownership is forbidden.

---

### 7. Simulation Repositories (`agentics-simulation-*`, `agentics-org-manifests`)

Simulation repositories reside in Layer 4 and are strictly isolated from production. `LLM-Research-Core` consumes simulation outputs but does not execute simulations.

| Forbidden Dependency | Rationale |
|---------------------|-----------|
| Production databases (write) | Simulation cannot mutate production state |
| Production services (mutation) | Simulation cannot mutate production state |
| `infra-*` (production) | Simulation cannot modify production infrastructure |
| `LLM-*-Core` (direct import) | Simulation accesses cores through Layer 4 API only |
| `services-*` (direct import) | Simulation accesses services through Layer 4 API only |
| `integrations-*` (runtime adapters) | Simulation cannot import live integration adapters |
| Integration service endpoints (direct) | Simulation cannot call integration endpoints directly |

**Allowed**: Layer 4 API (read operations, simulation endpoints), `@agentics/shared`, production telemetry (read-only with audit), schema snapshots (versioned, immutable), integration schemas (read-only for validation and artifact generation)

---

### 8. Diligence Repositories (`agentics-diligence-*`, `agentics-deployment-exporters`, `agentics-org-manifests`)

Diligence and manifest tooling generates audit artifacts; it must not execute in production. These repositories reside in Layer 4. Diligence repositories are semantically distinct from simulation repositories: they never execute simulations.

| Forbidden Dependency | Rationale |
|---------------------|-----------|
| Production runtime (execution) | Diligence tools do not run in production |
| Production services (direct call) | Diligence accesses through Layer 4 API only |
| `infra-*` (production mutation) | Diligence cannot modify production infrastructure |
| `services-*` (direct import) | Diligence does not import service runtime |
| `integrations-*` (runtime adapters) | Diligence cannot import live integration adapters |
| Integration service endpoints (direct) | Diligence cannot call integration endpoints directly |
| `agentics-simulation-runner` (execution) | Diligence must not execute simulations |

**Allowed**: Layer 4 API (read-only), production configurations (read-only for documentation), `@agentics/shared`, integration schemas (read-only for validation and artifact generation), simulation outputs (immutable, versioned artifacts only)

**Simulation/Diligence Separation**: Diligence repositories never execute simulations. They consume only immutable, versioned simulation outputs produced by `agentics-simulation-runner`. This separation ensures audit artifacts reflect validated, frozen simulation results rather than dynamic execution state.

---

## Cross-Class Forbidden Path Matrix

```
From ↓ / To →       │ CLI │ Platform │ Cores │ infra-* │ services-* │ integrations-* │ simulation │
────────────────────┼─────┼──────────┼───────┼─────────┼────────────┼────────────────┼────────────│
CLI                 │  -  │    ◇     │   ✕   │    ✕    │     ✕      │       ✕        │     ✕      │
Platform            │  ✕  │    -     │   ✓   │    ✕    │     ✕      │       ✕        │     △      │
Cores               │  ✕  │    ✕     │   ✕   │    ✕    │     ✓      │       ✕        │     ✕      │
infra-*             │  ✕  │    ✕     │   ✕   │    ✓    │     ✕      │       ✕        │     ✕      │
services-*          │  ✕  │    ✕     │   ✕   │    ✕    │     ✓      │       ⇨        │     ✕      │
integrations-*      │  ✕  │    ◇     │   ✕   │    ✕    │     ✕      │       ✓        │     ✕      │
simulation          │  ✕  │    ◇     │   ✕   │    ✕    │     ✕      │       ✕        │     ✓      │
diligence           │  ✕  │    ◇     │   ✕   │    ✕    │     ✕      │       ✕        │     ▽      │
────────────────────┴─────┴──────────┴───────┴─────────┴────────────┴────────────────┴────────────┘

Legend:
  ✓  Allowed (within class or designated path)
  ✕  Forbidden (architectural violation)
  ◇  Allowed via Layer 4 API only (not direct import)
  ⇨  Allowed invocation (services may invoke integrations when delegated by cores)
  △  Read-only query of simulation outputs (no execution)
  ▽  Consumes immutable simulation outputs only (no execution)
  -  Self-reference (N/A)
```

---

## Enforcement Checkpoints

### Pre-Commit

- Static import analysis blocks forbidden paths
- Package manifest dependency audit rejects violations

### CI Pipeline

- Build fails on forbidden import detection
- Dependency graph diff analysis on PRs
- Automated alerts for new cross-class imports

### Code Review

- Mandatory architectural review for cross-class changes
- Forbidden path violations are blocking findings

### Deployment

- Service mesh policies enforce network isolation
- Credential scoping prevents cross-boundary access

### Package-Level Dependency Allowlists

All repositories must maintain explicit dependency allowlists in their package manifests. This is a required architectural control.

| Manifest Type | Required Control |
|---------------|------------------|
| `package.json` | `dependencies` and `devDependencies` must exclude forbidden packages; allowlist enforcement via CI |
| `Cargo.toml` | `[dependencies]` must exclude forbidden crates; workspace-level allowlist validation |
| `go.mod` | `require` directives must exclude forbidden modules; `go mod graph` validation |
| `requirements.txt` / `pyproject.toml` | Must exclude forbidden packages; pip-audit or similar tooling |

**Enforcement Mechanism**: CI pipelines must validate that all declared dependencies conform to the repository's class-specific allowlist. New dependencies require architectural review if they introduce cross-class imports. Dependency additions that violate forbidden paths are blocking failures.

---

## Violation Handling

1. **Detection**: CI pipeline or code review identifies forbidden path
2. **Classification**: Violation categorized by severity (critical/high/medium)
3. **Remediation**: Author refactors to eliminate forbidden dependency
4. **Exception**: If architecturally necessary, RFC submitted for CTO approval
5. **Documentation**: Approved exceptions recorded in DEPENDENCY_GRAPH.md

**Critical Violations** (immediate block):
- Simulation → Production mutation
- CLI → Core runtime import
- Infra → Platform logic import

**High Violations** (block merge):
- Services → Simulation import
- Integrations → State ownership
- Cross-core direct import

---

## Document Governance

| Aspect | Policy |
|--------|--------|
| Canonical Source | [`DEPENDENCY_GRAPH.md`](DEPENDENCY_GRAPH.md) |
| Ownership | Platform Architecture Team |
| Amendment | Changes must update DEPENDENCY_GRAPH.md first |
| Review | Quarterly or upon architectural change |

---

*This document is derived from and subordinate to [`DEPENDENCY_GRAPH.md`](DEPENDENCY_GRAPH.md). In case of conflict, DEPENDENCY_GRAPH.md governs.*
