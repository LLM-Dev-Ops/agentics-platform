# Repository Classification

**Version**: 1.1
**Status**: Canonical
**Classification**: Architecture Enforcement Artifact
**Last Updated**: 2025-01-03
**Canonical Reference**: [`DEPENDENCY_GRAPH.md`](DEPENDENCY_GRAPH.md)

---

## Purpose

This document provides the authoritative classification of every repository in the Agentics platform fleet. It serves as the single reference for determining repository class, architectural layer, allowed dependencies, and forbidden dependencies.

All repositories listed here have been explicitly defined in prior architectural context. This document does not introduce new repositories.

---

## Classification Legend

| Class | Description |
|-------|-------------|
| **Platform** | Core product surface (API Gateway, CLIs) |
| **External** | Layer 5 external consumers (SDK, UI) designed for third-party distribution |
| **Core** | Layer 3 consolidation cores owning business logic domains |
| **Engine** | Layer 1 foundational engines and subsystems |
| **Infrastructure** | Deployment, provisioning, and operational configuration |
| **Service** | Internal microservices consumed by Layer 3 cores |
| **Integration** | Third-party adapters and connectors |
| **Simulation** | Test, simulation, and diligence artifact generation |
| **Shared** | Cross-cutting type definitions and contracts |

---

## Authoritative Repository Table

### Platform Repositories

| Repository | Class | Layer | Allowed Dependencies | Forbidden Dependencies |
|------------|-------|-------|---------------------|------------------------|
| `agentics-platform` | Platform | 4 | Layer 3 cores (HTTP), `@agentics/shared` | Layer 2 direct, Layer 1 direct, simulation, infra |
| `agentics-platform-cli` | Platform | 5 | Layer 4 API (HTTP only), `@agentics/shared` | Layer 3 runtime, Layer 2 runtime, simulation, infra, all non-@agentics/shared packages |
| `agentics-cli` | Platform | 5 | Layer 4 API (HTTP), `@agentics/sdk`, `@agentics/shared` | Layer 3 runtime, Layer 2 runtime, simulation, infra |

**Note**: `agentics-platform-cli` is the apex orchestration CLI responsible for org/env/simulation/deployment operations. It is the **exclusive** entry point for governance operations and must remain a thin client. See [`CLI_COMMAND_OWNERSHIP.md`](CLI_COMMAND_OWNERSHIP.md) for command ownership rules.

---

### External Consumer Repositories (Layer 5)

| Repository | Class | Layer | Allowed Dependencies | Forbidden Dependencies |
|------------|-------|-------|---------------------|------------------------|
| `@agentics/sdk` | External | 5 | `@agentics/shared` (types), third-party HTTP clients | Layer 3 runtime, Layer 2 runtime, Layer 1 engines, simulation, infra |
| `@agentics/ui` | External | 5 | `@agentics/sdk`, `@agentics/shared`, React/Next.js | Layer 3 runtime, Layer 2 runtime, Layer 1 engines, simulation, infra |

**Note**: External consumer repositories are designed for distribution to third parties. They communicate exclusively through Layer 4 API endpoints and must never import internal platform runtime code.

---

### Consolidation Core Repositories (Layer 3)

| Repository | Class | Layer | Allowed Dependencies | Forbidden Dependencies |
|------------|-------|-------|---------------------|------------------------|
| `LLM-Intelligence-Core` | Core | 3 | Layer 2 services, Layer 1 engines, `@agentics/shared` | Layer 4, Layer 5, other cores (direct), simulation |
| `LLM-Security-Core` | Core | 3 | Layer 2 services, Layer 1 engines, `@agentics/shared` | Layer 4, Layer 5, other cores (direct), simulation |
| `LLM-Automation-Core` | Core | 3 | Layer 2 services, Layer 1 engines, `@agentics/shared` | Layer 4, Layer 5, other cores (direct), simulation |
| `LLM-Governance-Core` | Core | 3 | Layer 2 services, Layer 1 engines, `@agentics/shared` | Layer 4, Layer 5, other cores (direct), simulation |
| `LLM-Data-Core` | Core | 3 | Layer 2 services, Layer 1 engines, `@agentics/shared` | Layer 4, Layer 5, other cores (direct), simulation |
| `LLM-Ecosystem-Core` | Core | 3 | Layer 2 services, Layer 1 engines, `@agentics/shared` | Layer 4, Layer 5, other cores (direct), simulation |
| `LLM-Research-Core` | Core | 3 | Layer 2 services, Layer 1 engines (incl. RuvVector), `@agentics/shared` | Layer 4, Layer 5, other cores (direct) |
| `LLM-Interface-Core` | Core | 3 | Layer 2 services, Layer 1 engines, `@agentics/shared` | Layer 4, Layer 5, other cores (direct), simulation |

---

### Engine Repositories (Layer 1)

| Repository | Class | Layer | Allowed Dependencies | Forbidden Dependencies |
|------------|-------|-------|---------------------|------------------------|
| `RuvVector` | Engine | 1 | None (foundational) | All higher layers (2-5) |

---

### Simulation Repositories

| Repository | Class | Layer | Allowed Dependencies | Forbidden Dependencies |
|------------|-------|-------|---------------------|------------------------|
| `agentics-simulation-planner` | Simulation | 4 | Layer 4 API (read), `@agentics/shared`, telemetry (read-only), integration schemas (read-only) | Production DB (write), production services (mutation), infra (production), cores (direct), integration adapters (runtime) |
| `agentics-simulation-runner` | Simulation | 4 | Layer 4 API (read), `@agentics/shared`, telemetry (read-only), integration schemas (read-only) | Production DB (write), production services (mutation), infra (production), cores (direct), integration adapters (runtime) |
| `agentics-deployment-exporters` | Simulation | 4 | Layer 4 API (read), `@agentics/shared`, configs (read-only), integration schemas (read-only) | Production runtime (execution), services (direct), infra (mutation), integration adapters (runtime) |
| `agentics-diligence-artifacts` | Simulation | 4 | Layer 4 API (read), `@agentics/shared`, configs (read-only), integration schemas (read-only) | Production services (direct call), infra (mutation), integration adapters (runtime) |
| `agentics-org-manifests` | Simulation | 4 | Layer 4 API (read), `@agentics/shared`, configs (read-only), integration schemas (read-only) | Production services (direct call), infra (mutation), integration adapters (runtime) |

**Note**: `LLM-Research-Core` (Layer 3) consumes simulation outputs but does not execute simulations.

---

### Infrastructure Repositories

| Repository | Class | Layer | Allowed Dependencies | Forbidden Dependencies |
|------------|-------|-------|---------------------|------------------------|
| `infra-kubernetes` | Infrastructure | N/A | Other `infra-*`, Helm, external tools | Platform logic, cores, services, integrations, simulation |
| `infra-terraform` | Infrastructure | N/A | Other `infra-*`, Terraform providers | Platform logic, cores, services, integrations, simulation |
| `infra-monitoring` | Infrastructure | N/A | Other `infra-*`, Prometheus/Grafana configs | Platform logic, cores, services, integrations, simulation |
| `infra-secrets` | Infrastructure | N/A | Other `infra-*`, Vault/secrets tools | Platform logic, cores, services, integrations, simulation |

---

### Service Repositories (Layer 2)

| Repository | Class | Layer | Allowed Dependencies | Forbidden Dependencies |
|------------|-------|-------|---------------------|------------------------|
| `services-queue` | Service | 2 | Layer 1 engines, other `services-*`, infrastructure clients | Layer 4, Layer 5, simulation, diligence |
| `services-cache` | Service | 2 | Layer 1 engines, other `services-*`, infrastructure clients | Layer 4, Layer 5, simulation, diligence |
| `services-metrics` | Service | 2 | Layer 1 engines, other `services-*`, infrastructure clients | Layer 4, Layer 5, simulation, diligence |
| `services-auth` | Service | 2 | Layer 1 engines, other `services-*`, infrastructure clients | Layer 4, Layer 5, simulation, diligence |

---

### Integration Repositories

| Repository | Class | Layer | Allowed Dependencies | Forbidden Dependencies |
|------------|-------|-------|---------------------|------------------------|
| `integrations-github` | Integration | N/A | Third-party SDKs, `@agentics/shared`, Layer 4 API | infra, Layer 1 engines, services (direct), state ownership, simulation |
| `integrations-slack` | Integration | N/A | Third-party SDKs, `@agentics/shared`, Layer 4 API | infra, Layer 1 engines, services (direct), state ownership, simulation |
| `integrations-jira` | Integration | N/A | Third-party SDKs, `@agentics/shared`, Layer 4 API | infra, Layer 1 engines, services (direct), state ownership, simulation |
| `integrations-datadog` | Integration | N/A | Third-party SDKs, `@agentics/shared`, Layer 4 API | infra, Layer 1 engines, services (direct), state ownership, simulation |

---

### Shared Packages

| Package | Class | Layer | Allowed Dependencies | Forbidden Dependencies |
|---------|-------|-------|---------------------|------------------------|
| `@agentics/shared` | Shared | N/A | None (type definitions only) | All runtime code |

---

## Repository Count Summary

| Class | Count | Repositories |
|-------|-------|--------------|
| Platform | 3 | `agentics-platform`, `agentics-platform-cli`, `agentics-cli` |
| External | 2 | `@agentics/sdk`, `@agentics/ui` |
| Core | 8 | `LLM-Intelligence-Core`, `LLM-Security-Core`, `LLM-Automation-Core`, `LLM-Governance-Core`, `LLM-Data-Core`, `LLM-Ecosystem-Core`, `LLM-Research-Core`, `LLM-Interface-Core` |
| Engine | 1 | `RuvVector` |
| Simulation | 5 | `agentics-simulation-planner`, `agentics-simulation-runner`, `agentics-deployment-exporters`, `agentics-diligence-artifacts`, `agentics-org-manifests` |
| Infrastructure | 4 | `infra-kubernetes`, `infra-terraform`, `infra-monitoring`, `infra-secrets` |
| Service | 4 | `services-queue`, `services-cache`, `services-metrics`, `services-auth` |
| Integration | 4 | `integrations-github`, `integrations-slack`, `integrations-jira`, `integrations-datadog` |
| Shared | 1 | `@agentics/shared` |
| **Total** | **32** | |

---

## Monorepo Package Mapping

The Agentics platform is implemented as a monorepo with scoped npm packages. This table maps logical repository names used in architecture documentation to their actual package implementations.

| Architecture Repository | Package Name | Location | Layer |
|------------------------|--------------|----------|-------|
| `agentics-platform` | `@agentics/api` | `packages/api` | 4 |
| `agentics-platform-cli` | `@agentics/platform-cli` | `packages/platform-cli` | 5 |
| `agentics-cli` | `@agentics/cli` | `packages/cli` | 5 |
| `@agentics/sdk` | `@agentics/sdk` | `packages/sdk` | 5 |
| `@agentics/ui` | `@agentics/ui` | `packages/ui` | 5 |
| `@agentics/shared` | `@agentics/shared` | `packages/shared` | N/A |

**Implementation Notes**:

1. **API Gateway**: The `agentics-platform` logical repository is implemented as `@agentics/api` in the monorepo. All architecture rules for `agentics-platform` apply to this package.

2. **Two CLIs**: The platform has two distinct CLIs:
   - `@agentics/platform-cli` (apex orchestration): Exclusive owner of org/env/simulation/deployment commands
   - `@agentics/cli` (developer CLI): General-purpose developer tooling that delegates governance operations to platform-cli

3. **Package Scoping**: All packages use the `@agentics` npm scope for consistent namespacing and dependency management.

4. **Cross-Package Dependencies**: Within the monorepo, packages reference each other via `*` version specifiers. CI enforces that cross-package dependencies comply with layer rules.

---

## Layer Assignment Rules

1. **Layer 5**: External consumers and CLIs
   - `agentics-platform-cli` (apex orchestration CLI)
   - `agentics-cli` (developer CLI)
   - `@agentics/sdk` (TypeScript SDK)
   - `@agentics/ui` (Web UI)
   - Partner APIs and third-party applications
2. **Layer 4**: API Gateway, control plane (`agentics-platform`), and simulation repositories (`agentics-simulation-*`, `agentics-org-manifests`, `agentics-diligence-*`, `agentics-deployment-exporters`)
3. **Layer 3**: Consolidation cores (`LLM-*-Core`) — note: `LLM-Research-Core` consumes simulation outputs but does not execute simulations
4. **Layer 2**: Internal services (`services-*`)
5. **Layer 1**: Foundational engines (`RuvVector`)
6. **N/A**: Cross-cutting repositories that do not fit the layer model (infra, integrations, shared)

---

## Validation Rules

A repository is correctly classified if:

1. Its name follows the designated pattern for its class
2. Its dependencies conform to allowed paths
3. No imports exist from forbidden paths
4. Network access patterns match layer boundaries
5. State ownership rules are respected (for integrations)

---

## Amendment Process

Adding a new repository requires:

1. Classification proposal with class and layer assignment
2. Dependency analysis confirming allowed/forbidden paths
3. Update to this document and [`DEPENDENCY_GRAPH.md`](DEPENDENCY_GRAPH.md)
4. Architectural review approval
5. CI enforcement rule addition

---

## Document Governance

| Aspect | Policy |
|--------|--------|
| Canonical Source | [`DEPENDENCY_GRAPH.md`](DEPENDENCY_GRAPH.md) |
| Ownership | Platform Architecture Team |
| Amendment | RFC required for new repositories |
| Validation | Quarterly audit against actual fleet |

---

*This document enumerates all repositories defined in prior architectural context. No new repositories are introduced. In case of conflict with [`DEPENDENCY_GRAPH.md`](DEPENDENCY_GRAPH.md), that document governs.*
