# Repository Classification

**Version**: 1.0
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
| **Platform** | Core product surface (API Gateway, CLI, SDK, UI) |
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
| `agentics-cli` | Platform | 5 | Layer 4 API (HTTP), `@agentics/shared` | Layer 3 runtime, Layer 2 runtime, simulation, infra |

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
| Platform | 2 | `agentics-platform`, `agentics-cli` |
| Core | 8 | `LLM-Intelligence-Core`, `LLM-Security-Core`, `LLM-Automation-Core`, `LLM-Governance-Core`, `LLM-Data-Core`, `LLM-Ecosystem-Core`, `LLM-Research-Core`, `LLM-Interface-Core` |
| Engine | 1 | `RuvVector` |
| Simulation | 5 | `agentics-simulation-planner`, `agentics-simulation-runner`, `agentics-deployment-exporters`, `agentics-diligence-artifacts`, `agentics-org-manifests` |
| Infrastructure | 4 | `infra-kubernetes`, `infra-terraform`, `infra-monitoring`, `infra-secrets` |
| Service | 4 | `services-queue`, `services-cache`, `services-metrics`, `services-auth` |
| Integration | 4 | `integrations-github`, `integrations-slack`, `integrations-jira`, `integrations-datadog` |
| Shared | 1 | `@agentics/shared` |
| **Total** | **29** | |

---

## Layer Assignment Rules

1. **Layer 5**: External consumers (`agentics-cli`, SDK, UI, partner APIs)
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
