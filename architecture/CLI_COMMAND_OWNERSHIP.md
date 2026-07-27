# CLI Command Ownership

**Version**: 1.1
**Status**: Canonical
**Classification**: Architecture Enforcement Artifact
**Last Updated**: 2026-01-03
**Canonical Reference**: [`DEPENDENCY_GRAPH.md`](DEPENDENCY_GRAPH.md), [`ARCHITECTURE_INDEX.md`](ARCHITECTURE_INDEX.md)
**Governing ADR**: ADR-006 (CLI as Thin Client Without Runtime Embedding)

---

## Purpose

This document formally defines command ownership, delegation boundaries, and execution authority across all CLI tooling in the Agentics platform fleet. It establishes which CLI owns which command surfaces, which commands may delegate versus execute, and how execution authority flows through the architectural layers.

All rules documented here derive from and are consistent with:

- [`DEPENDENCY_GRAPH.md`](DEPENDENCY_GRAPH.md) — Layer definitions and dependency rules
- [`ARCHITECTURE_DECISIONS.md`](ARCHITECTURE_DECISIONS.md) — ADR-006 (CLI thin client constraint)
- [`FORBIDDEN_PATHS.md`](FORBIDDEN_PATHS.md) — Explicit prohibition enumeration
- [`REPO_CLASSIFICATION.md`](REPO_CLASSIFICATION.md) — Repository assignments
- [`ARCHITECTURE_INDEX.md`](ARCHITECTURE_INDEX.md) — Conflict resolution hierarchy

---

## CLI Classification

The Agentics platform defines two distinct CLI categories with different execution authorities and architectural placements.

### Primary CLI Definitions

| CLI | Repository | Layer | Classification | Primary Audience |
|-----|------------|-------|----------------|------------------|
| `agentics-cli` | `agentics-cli` | 5 | User-Facing | End users, developers, operators |
| `agentics-platform-cli` | `agentics-platform` | 4 | Orchestration-Facing | Platform operators, CI/CD, automation |

### Architectural Distinction

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CLI ARCHITECTURAL PLACEMENT                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Layer 5: agentics-cli (User-Facing)                               │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━                               │
│  • External consumer of platform capabilities                       │
│  • Communicates ONLY through Layer 4 API                           │
│  • No runtime imports from Layers 1-3                              │
│  • Thin client: configuration, validation, formatting only         │
│                                                                     │
│          ↓ HTTPS/API calls only                                    │
│                                                                     │
│  Layer 4: agentics-platform-cli (Orchestration-Facing)             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━              │
│  • Apex orchestration and governance CLI                           │
│  • Context management, intent lifecycle, artifact operations        │
│  • Policy validation against architecture documents                 │
│  • Delegates to agentics-cli for user-facing operations            │
│  • Routes to Layer 3 cores via Layer 4 API Gateway                 │
│                                                                     │
│          ↓ Internal dispatch (never bypasses Layer 4)              │
│                                                                     │
│  Layer 3: Consolidation Cores                                       │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━                                       │
│  • NO CLI execution authority                                       │
│  • CLIs invoke cores through Layer 4 API only                       │
│  • Cores never import or invoke CLI code                           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Exclusivity Statement

The `agentics-platform-cli` is the **sole sanctioned human entry point** for the following capabilities. No other repository, CLI, or service may expose these operations directly to human operators.

### Exclusive Command Surfaces

| Capability | Exclusive Owner | Rationale |
|------------|----------------|-----------|
| **Organizational Context Switching** | `agentics-platform-cli` | Context determines governance scope and policy evaluation |
| **Environment Promotion** | `agentics-platform-cli` | Promotion is a governance operation requiring policy validation |
| **Simulation Execution** | `agentics-platform-cli` | Simulation must be isolated and delegated, never executed locally |
| **Deployment Export** | `agentics-platform-cli` | Deployment materialization must flow through exporters |

### Exclusivity Constraints

```
┌─────────────────────────────────────────────────────────────────────┐
│                     EXCLUSIVITY CONSTRAINTS                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  FORBIDDEN EXPOSURES (No repository may provide):                   │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━                      │
│                                                                     │
│  1. CLI commands for org/env context switching                      │
│     • Only agentics-platform-cli may expose org switch              │
│     • Only agentics-platform-cli may expose env switch              │
│                                                                     │
│  2. CLI commands for environment promotion                          │
│     • Only agentics-platform-cli may expose intent promote          │
│     • No direct promotion APIs exposed to human operators           │
│                                                                     │
│  3. CLI commands for simulation execution                           │
│     • Only agentics-platform-cli may invoke simulations             │
│     • Simulation repos provide internal APIs, not CLI surfaces      │
│                                                                     │
│  4. CLI commands for deployment export                              │
│     • Only agentics-platform-cli may trigger exports                │
│     • Exporter repos are invoked via delegation, not CLI            │
│                                                                     │
│  DELEGATION REQUIREMENT:                                            │
│  ━━━━━━━━━━━━━━━━━━━━━━━                                             │
│                                                                     │
│  The platform-cli MUST delegate these operations:                   │
│  • Simulation → Layer 4 API → simulation repositories               │
│  • Deployment → Layer 4 API → deployment-exporters                  │
│  • Core operations → Layer 4 API → Layer 3 cores                    │
│                                                                     │
│  The platform-cli MUST NOT execute these operations directly:       │
│  • No local simulation execution                                    │
│  • No local deployment artifact generation                          │
│  • No direct database mutations                                     │
│  • No direct service state modifications                            │
│                                                                     │
│  ENFORCEMENT:                                                       │
│  ━━━━━━━━━━━━                                                       │
│                                                                     │
│  • CI validates no other package exposes these command surfaces     │
│  • CI validates delegation patterns in platform-cli                 │
│  • CI validates no direct execution of simulation/deployment code   │
│                                                                     │
│  Reference: ADR-006, DEPENDENCY_GRAPH.md INV-9, FORBIDDEN_PATHS.md  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Verification Checklist

For auditors and reviewers, confirm:

- [ ] No repository other than `agentics-platform` exposes `org switch` or `env switch` commands
- [ ] No repository other than `agentics-platform` exposes `intent promote` commands
- [ ] No repository other than `agentics-platform` exposes simulation invocation commands
- [ ] No repository other than `agentics-platform` exposes deployment export commands
- [ ] Platform-cli uses `forward()` for delegation, not direct execution
- [ ] Platform-cli imports no runtime code from simulation or deployment repositories
- [ ] All delegation flows through Layer 4 API, never bypassing architectural boundaries

---

## Command Surface Ownership

The following table defines authoritative ownership of command surfaces across CLI tools and underlying repositories.

### Command Surface Ownership Matrix

| Command Surface | Owner CLI | Execution Authority | Delegation Target | Underlying Repository |
|----------------|-----------|---------------------|-------------------|----------------------|
| **Simulation** | `agentics-platform-cli` | Delegate only | Layer 4 API | `agentics-simulation-planner`, `agentics-simulation-runner` |
| **Intent** | `agentics-platform-cli` | Execute (lifecycle) | None | `agentics-platform` (Layer 4) |
| **Org** | `agentics-platform-cli` | Execute (context) | None | `agentics-platform` (Layer 4) |
| **Env** | `agentics-platform-cli` | Execute (context) | None | `agentics-platform` (Layer 4) |
| **Deployment** | `agentics-platform-cli` | Delegate only | `agentics-deployment-exporters` | `agentics-deployment-exporters` (Layer 4) |
| **Governance** | `agentics-platform-cli` | Execute (policy) | None | `agentics-platform` (Layer 4) |
| **Diagnostics** | `agentics-platform-cli` | Execute (read-only) | None | `agentics-platform` (Layer 4) |
| **Architecture** | `agentics-platform-cli` | Execute (read-only) | None | Architecture documents |
| **Artifact** | `agentics-platform-cli` | Execute (lifecycle) | None | `agentics-platform` (Layer 4) |
| **Intelligence** | `agentics-cli` | Delegate only | Layer 4 API | `LLM-Intelligence-Core` (Layer 3) |
| **Security** | `agentics-cli` | Delegate only | Layer 4 API | `LLM-Security-Core` (Layer 3) |
| **Automation** | `agentics-cli` | Delegate only | Layer 4 API | `LLM-Automation-Core` (Layer 3) |
| **Data** | `agentics-cli` | Delegate only | Layer 4 API | `LLM-Data-Core` (Layer 3) |
| **Ecosystem** | `agentics-cli` | Delegate only | Layer 4 API | `LLM-Ecosystem-Core` (Layer 3) |
| **Research** | `agentics-cli` | Delegate only | Layer 4 API | `LLM-Research-Core` (Layer 3) |

### Execution Authority Definitions

| Authority Type | Definition | Permitted Operations |
|---------------|------------|---------------------|
| **Execute** | CLI performs the operation directly | Local operations, context management, policy validation |
| **Delegate** | CLI forwards to Layer 4 API | All remote operations, core invocations, state mutations |
| **Execute (read-only)** | CLI reads data without mutation | Architecture introspection, diagnostics, status queries |
| **Execute (lifecycle)** | CLI manages entity lifecycle | Intent management, artifact operations, context switching |
| **Execute (context)** | CLI manages execution context | Org/env switching, correlation ID generation |
| **Execute (policy)** | CLI enforces policy rules | Validation, gate checks, preflight verification |

---

## Hard Rules

The following rules are non-negotiable architectural constraints. Violations represent critical architectural failures.

### Rule H-1: No Direct Execution in Simulation-Runner from CLI

```
┌─────────────────────────────────────────────────────────────────────┐
│  HARD RULE H-1                                                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  NO CLI (agentics-cli or agentics-platform-cli) may directly       │
│  execute simulation code from agentics-simulation-runner.           │
│                                                                     │
│  ✕ FORBIDDEN:                                                       │
│    • import { runSimulation } from 'agentics-simulation-runner'    │
│    • Direct function calls to simulation execution logic            │
│    • Embedding simulation runtime in CLI binary                     │
│                                                                     │
│  ✓ ALLOWED:                                                         │
│    • API calls to Layer 4 simulation endpoints                      │
│    • Reading immutable simulation output artifacts                  │
│    • Querying simulation status via Layer 4 API                     │
│                                                                     │
│  Reference: DEPENDENCY_GRAPH.md INV-9, ADR-006, ADR-007             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Rule H-2: All Deployment Materialization Must Flow Through Deployment-Exporters

```
┌─────────────────────────────────────────────────────────────────────┐
│  HARD RULE H-2                                                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ALL deployment artifact materialization MUST be delegated to       │
│  agentics-deployment-exporters. CLIs MUST NOT generate deployment  │
│  configurations directly.                                           │
│                                                                     │
│  ✕ FORBIDDEN:                                                       │
│    • CLI generating Kubernetes manifests directly                   │
│    • CLI writing Terraform configurations                           │
│    • CLI producing deployment artifacts without exporter            │
│    • CLI materializing infrastructure-as-code                       │
│                                                                     │
│  ✓ ALLOWED:                                                         │
│    • CLI invoking deployment-exporters via Layer 4 API              │
│    • CLI reading exported artifacts (immutable, versioned)          │
│    • CLI validating artifact schemas (read-only)                    │
│                                                                     │
│  Reference: ADR-002 (Intent → Simulation → Export → Deploy)         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Rule H-3: agentics-cli is User-Facing, platform-cli is Orchestration-Facing

```
┌─────────────────────────────────────────────────────────────────────┐
│  HARD RULE H-3                                                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  CLI tools have distinct, non-overlapping audiences:                │
│                                                                     │
│  agentics-cli (Layer 5):                                           │
│    • Primary audience: End users, developers, operators             │
│    • Distribution: Public package registries (npm, brew)            │
│    • Branding: User-facing product surface                          │
│    • Operations: Invoke platform capabilities                       │
│                                                                     │
│  agentics-platform-cli (Layer 4):                                  │
│    • Primary audience: Platform operators, CI/CD, automation        │
│    • Distribution: Internal, platform deployments                   │
│    • Branding: Operational tooling                                  │
│    • Operations: Orchestration, governance, policy enforcement      │
│                                                                     │
│  ✕ FORBIDDEN:                                                       │
│    • agentics-cli performing orchestration operations               │
│    • platform-cli exposed to end users as primary interface         │
│    • Mixing operational and user-facing concerns in one CLI         │
│                                                                     │
│  Reference: REPO_CLASSIFICATION.md (Platform Repositories)          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Rule H-4: No CLI May Bypass Forbidden Paths or Policy Validators

```
┌─────────────────────────────────────────────────────────────────────┐
│  HARD RULE H-4                                                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ALL CLI operations MUST pass through policy validation before      │
│  execution. No CLI may bypass architectural constraints.            │
│                                                                     │
│  ✕ FORBIDDEN:                                                       │
│    • CLI commands that skip policy validation                       │
│    • Direct imports violating FORBIDDEN_PATHS.md                    │
│    • Operations that bypass Layer 4 API for core access             │
│    • Emergency overrides without audit trail                        │
│                                                                     │
│  ✓ REQUIRED:                                                        │
│    • All commands route through policy validator                    │
│    • All Layer 3 operations go through Layer 4 API                  │
│    • All forbidden path violations are blocking errors              │
│    • All bypasses require CTO approval and ADR exception            │
│                                                                     │
│  Reference: FORBIDDEN_PATHS.md, ARCHITECTURE_INDEX.md               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Rule H-5: No CLI May Import Layer 3 Core Runtime

```
┌─────────────────────────────────────────────────────────────────────┐
│  HARD RULE H-5                                                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  NO CLI may import runtime code from Layer 3 consolidation cores.   │
│  This is the foundational thin-client constraint.                   │
│                                                                     │
│  ✕ FORBIDDEN (for both agentics-cli and platform-cli):             │
│    • import from 'LLM-Intelligence-Core'                            │
│    • import from 'LLM-Security-Core'                                │
│    • import from 'LLM-Automation-Core'                              │
│    • import from 'LLM-Governance-Core'                              │
│    • import from 'LLM-Data-Core'                                    │
│    • import from 'LLM-Ecosystem-Core'                               │
│    • import from 'LLM-Research-Core'                                │
│    • import from 'LLM-Interface-Core'                               │
│    • import from any Layer 2 service runtime                        │
│                                                                     │
│  ✓ ALLOWED:                                                         │
│    • import from '@agentics/shared' (types only)                    │
│    • HTTP calls to Layer 4 API endpoints                            │
│    • Schema validation using vendored definitions                   │
│                                                                     │
│  Reference: DEPENDENCY_GRAPH.md INV-9, ADR-006                      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Rule H-6: Simulation Repositories Are Read-Only Consumers via CLI

```
┌─────────────────────────────────────────────────────────────────────┐
│  HARD RULE H-6                                                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  CLIs may only READ from simulation repositories. They may never    │
│  WRITE to production or EXECUTE simulation logic.                   │
│                                                                     │
│  ✕ FORBIDDEN:                                                       │
│    • CLI writing to production databases                            │
│    • CLI mutating production service state                          │
│    • CLI executing simulation code locally                          │
│    • CLI modifying simulation repository contents                   │
│                                                                     │
│  ✓ ALLOWED:                                                         │
│    • Reading simulation outputs (artifacts, reports)                │
│    • Querying simulation status via API                             │
│    • Validating simulation specifications (schema only)             │
│                                                                     │
│  Reference: ADR-007, DEPENDENCY_GRAPH.md INV-7                      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Delegation vs Execution Boundaries

### Delegation Model

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CLI DELEGATION MODEL                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  agentics-cli (Layer 5)                                            │
│  ━━━━━━━━━━━━━━━━━━━━━━                                             │
│  Local Execution:           Delegation:                             │
│  • Config read/write        • All core operations → L4 API          │
│  • Schema validation        • Intelligence → L4 → L3                │
│  • Output formatting        • Security → L4 → L3                    │
│  • Credential storage       • Automation → L4 → L3                  │
│  • Manifest inspection      • Data → L4 → L3                        │
│                             • Ecosystem → L4 → L3                   │
│                             • Research → L4 → L3                    │
│                                                                     │
│  agentics-platform-cli (Layer 4)                                   │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━                                    │
│  Local Execution:           Delegation:                             │
│  • Context resolution       • Simulation → L4 API → sim repos       │
│  • Policy validation        • Deployment → L4 API → exporters       │
│  • Intent management        • Core ops → L4 API → L3 cores          │
│  • Artifact lifecycle       • User cmds → agentics-cli forward      │
│  • Architecture queries     •                                       │
│  • Org/Env switching        •                                       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Delegation Rules

| Rule | Description | Enforcement |
|------|-------------|-------------|
| D-1 | All Layer 3 core operations delegate through Layer 4 API | Compile-time import check |
| D-2 | Simulation execution delegates to simulation repositories | Runtime API routing |
| D-3 | Deployment materialization delegates to exporters | Policy validator |
| D-4 | Cross-core operations delegate through Layer 4 | Network policy |
| D-5 | platform-cli may forward to agentics-cli for user operations | CLI dispatcher |
| D-6 | No delegation may skip Layer 4 | CI dependency analysis |

### Forward Delegation (platform-cli → agentics-cli)

The `agentics-platform-cli` may forward certain operations to `agentics-cli` when the operation is user-facing and does not require orchestration context:

```typescript
// Permitted forward delegation pattern
forward(command: string, args: string[], context: ExecutionContext)

// Context attached via environment variables only
AGENTICS_ORG, AGENTICS_ENV, AGENTICS_CORRELATION_ID, AGENTICS_DRY_RUN

// No argument transformation permitted
// Arguments passed through as-is
```

**Forward delegation is permitted for:**
- User-facing queries that don't require governance
- Operations where agentics-cli is the authoritative owner
- Passthrough commands with context enrichment only

**Forward delegation is forbidden for:**
- Governance operations (intent approval/rejection)
- Policy-enforced operations (deployment, simulation)
- Operations requiring platform-cli-specific context

---

## Layer Prohibition Matrix

The following matrix defines which layers are prohibited from direct CLI execution.

```
┌─────────────────────────────────────────────────────────────────────┐
│               CLI LAYER EXECUTION PROHIBITION MATRIX                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  CLI ↓ / Layer →        │ L1 │ L2 │ L3 │ L4 │ L5 │                 │
│  ───────────────────────┼────┼────┼────┼────┼────┤                 │
│  agentics-cli (L5)      │ ✕  │ ✕  │ ✕  │ ◇  │ ✓  │                 │
│  platform-cli (L4)      │ ✕  │ ✕  │ ✕  │ ✓  │ ◇  │                 │
│  ───────────────────────┴────┴────┴────┴────┴────┘                 │
│                                                                     │
│  Legend:                                                            │
│    ✓  Direct execution permitted                                    │
│    ✕  Direct execution forbidden (import prohibition)               │
│    ◇  API delegation only (no direct import)                        │
│                                                                     │
│  Explanation:                                                       │
│    • agentics-cli may only execute locally (L5) or call L4 API     │
│    • platform-cli may execute L4 operations and delegate to L5      │
│    • Neither CLI may import or execute L1, L2, or L3 code          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Command-to-Repository Ownership Table

### Authoritative Command Ownership

| Command | Subcommand | Owner CLI | Layer | Repository | Execution Type | Delegation Target |
|---------|------------|-----------|-------|------------|----------------|-------------------|
| `org` | `list` | platform-cli | 4 | `agentics-platform` | Execute | None |
| `org` | `switch` | platform-cli | 4 | `agentics-platform` | Execute | None |
| `org` | `current` | platform-cli | 4 | `agentics-platform` | Execute | None |
| `env` | `list` | platform-cli | 4 | `agentics-platform` | Execute | None |
| `env` | `switch` | platform-cli | 4 | `agentics-platform` | Execute | None |
| `env` | `current` | platform-cli | 4 | `agentics-platform` | Execute | None |
| `artifact` | `plan` | platform-cli | 4 | `agentics-platform` | Execute | None |
| `artifact` | `inspect` | platform-cli | 4 | `agentics-platform` | Execute | None |
| `artifact` | `diff` | platform-cli | 4 | `agentics-platform` | Execute | None |
| `artifact` | `list` | platform-cli | 4 | `agentics-platform` | Execute | None |
| `intent` | `submit` | platform-cli | 4 | `agentics-platform` | Execute | None |
| `intent` | `status` | platform-cli | 4 | `agentics-platform` | Execute | None |
| `intent` | `approve` | platform-cli | 4 | `agentics-platform` | Execute | None |
| `intent` | `reject` | platform-cli | 4 | `agentics-platform` | Execute | None |
| `intent` | `list` | platform-cli | 4 | `agentics-platform` | Execute | None |
| `intent` | `promote` | platform-cli | 4 | `agentics-platform` | Execute | None |
| `arch` | `layers` | platform-cli | 4 | Architecture docs | Execute (read-only) | None |
| `arch` | `boundaries` | platform-cli | 4 | Architecture docs | Execute (read-only) | None |
| `arch` | `repos` | platform-cli | 4 | Architecture docs | Execute (read-only) | None |
| `arch` | `validate` | platform-cli | 4 | Architecture docs | Execute (policy) | None |
| `simulation` | `plan` | platform-cli | 4 | `agentics-simulation-planner` | Delegate | L4 API |
| `simulation` | `run` | platform-cli | 4 | `agentics-simulation-runner` | Delegate | L4 API |
| `simulation` | `status` | platform-cli | 4 | `agentics-simulation-runner` | Delegate | L4 API |
| `simulation` | `results` | platform-cli | 4 | `agentics-simulation-runner` | Delegate | L4 API |
| `deploy` | `export` | platform-cli | 4 | `agentics-deployment-exporters` | Delegate | L4 API |
| `deploy` | `inspect` | platform-cli | 4 | `agentics-deployment-exporters` | Delegate | L4 API |
| `diligence` | `generate` | platform-cli | 4 | `agentics-diligence-artifacts` | Delegate | L4 API |
| `diligence` | `inspect` | platform-cli | 4 | `agentics-diligence-artifacts` | Delegate | L4 API |
| `manifest` | `validate` | platform-cli | 4 | `agentics-org-manifests` | Execute (policy) | None |
| `manifest` | `inspect` | platform-cli | 4 | `agentics-org-manifests` | Execute (read-only) | None |
| `intelligence` | `*` | agentics-cli | 5 | `LLM-Intelligence-Core` | Delegate | L4 API → L3 |
| `security` | `*` | agentics-cli | 5 | `LLM-Security-Core` | Delegate | L4 API → L3 |
| `automation` | `*` | agentics-cli | 5 | `LLM-Automation-Core` | Delegate | L4 API → L3 |
| `governance` | `*` | agentics-cli | 5 | `LLM-Governance-Core` | Delegate | L4 API → L3 |
| `data` | `*` | agentics-cli | 5 | `LLM-Data-Core` | Delegate | L4 API → L3 |
| `ecosystem` | `*` | agentics-cli | 5 | `LLM-Ecosystem-Core` | Delegate | L4 API → L3 |
| `research` | `*` | agentics-cli | 5 | `LLM-Research-Core` | Delegate | L4 API → L3 |
| `interface` | `*` | agentics-cli | 5 | `LLM-Interface-Core` | Delegate | L4 API → L3 |

---

## Enforcement Mechanisms

Architecture enforcement for CLI operations occurs at four distinct stages.

### 1. Compile-Time Enforcement

**Mechanism**: Static import analysis during build

**Implementation**:
- TypeScript path mapping prohibits cross-layer imports
- ESLint rules detect forbidden import patterns
- Build fails on architectural violation

**Enforced Rules**:
- H-5 (No CLI may import Layer 3 core runtime)
- D-1 (All Layer 3 operations delegate through Layer 4)

**Configuration** (`eslint-plugin-architecture`):
```javascript
{
  "rules": {
    "no-forbidden-imports": ["error", {
      "patterns": [
        "LLM-*-Core",
        "services-*",
        "agentics-simulation-runner/src/*"
      ]
    }]
  }
}
```

### 2. Runtime Enforcement

**Mechanism**: Policy validator and command dispatcher

**Implementation**:
- All commands route through policy validator before execution
- Forbidden path violations throw `PolicyViolationError`
- Layer boundary violations are blocking errors

**Enforced Rules**:
- H-4 (No CLI may bypass forbidden paths or policy validators)
- H-6 (Simulation repositories are read-only)
- D-2, D-3, D-4 (Delegation rules)

**Validation Flow**:
```
Command Input
    ↓
Context Resolution
    ↓
Policy Validation ←── FORBIDDEN_PATHS.md
    ↓                 DEPENDENCY_GRAPH.md
    ↓                 REPO_CLASSIFICATION.md
[Pass/Fail]
    ↓
Command Execution (if pass)
```

### 3. CI Pipeline Enforcement

**Mechanism**: Dependency graph analysis on pull requests

**Implementation**:
- Pre-merge checks validate dependency compliance
- Package.json dependency auditing for cross-layer references
- Automated alerts for new forbidden imports

**Enforced Rules**:
- All hard rules (H-1 through H-6)
- All delegation rules (D-1 through D-6)

**Pipeline Stages**:

| Stage | Check | Failure Action |
|-------|-------|----------------|
| Lint | Import path analysis | Block merge |
| Build | Compile-time validation | Block merge |
| Test | Runtime policy checks | Block merge |
| Audit | Dependency graph diff | Alert + review required |

### 4. CLI Preflight Validation

**Mechanism**: Command interceptor and policy gate

**Implementation**:
- All commands pass through interceptor before execution
- Policy path validated against architecture documents
- Dry-run mode validates without execution

**Enforced Rules**:
- H-4 (No bypass of policy validators)
- Command ownership verification
- Delegation target validation

**Interceptor Chain**:
```
User Input
    ↓
Command Parser
    ↓
Context Resolver
    ↓
Policy Validator ←── validateOrThrow(path)
    ↓
Interceptor Chain
    ↓
Command Handler
```

---

## Ownership Conflict Resolution

When ownership conflicts arise between CLIs or commands, resolution follows this hierarchy:

### Precedence Order

1. **Hard Rules (H-*)**: Always governing; no exceptions without ADR amendment
2. **Delegation Rules (D-*)**: Governing unless explicitly overridden by hard rule
3. **Command Ownership Table**: Authoritative assignment; conflicts escalate to architecture team
4. **Convention**: Lower-layer CLI defers to higher-layer CLI for overlapping surfaces

### Conflict Resolution Protocol

1. **Detection**: CI or runtime identifies conflicting ownership claim
2. **Classification**: Reference this document for authoritative owner
3. **Escalation**: Unresolved conflicts require architectural review
4. **Resolution**: ADR amendment if ownership must change
5. **Enforcement Update**: CI rules updated to reflect resolution

---

## Audit Trail Requirements

All CLI operations that involve delegation or policy enforcement MUST produce audit records.

### Required Audit Fields

| Field | Description | Required For |
|-------|-------------|--------------|
| `correlationId` | Unique operation identifier | All operations |
| `timestamp` | ISO 8601 operation timestamp | All operations |
| `orgId` | Organization context | Context-aware operations |
| `envId` | Environment context | Context-aware operations |
| `command` | Full command path | All operations |
| `delegationTarget` | Target of delegation (if any) | Delegated operations |
| `policyValidation` | Validation result | Policy-enforced operations |
| `dryRun` | Dry-run indicator | All operations |

### Audit Compliance

- Audit records support SOC 2 Type II control requirements
- All policy violations are logged with full context
- Delegation chains are traceable end-to-end

---

## Document Governance

| Aspect | Policy |
|--------|--------|
| **Canonical Source** | [`DEPENDENCY_GRAPH.md`](DEPENDENCY_GRAPH.md), [`ARCHITECTURE_INDEX.md`](ARCHITECTURE_INDEX.md) |
| **Ownership** | Platform Architecture Team |
| **Amendment** | RFC required; must update linked documents if rules change |
| **Review** | Quarterly or upon CLI architectural change |
| **Audience** | Platform engineers, CLI maintainers, PE technical auditors |

---

## Cross-Reference Summary

| Rule/Constraint | Reference Document | Section |
|-----------------|-------------------|---------|
| CLI thin client constraint | ARCHITECTURE_DECISIONS.md | ADR-006 |
| Layer 5 → Layer 4 only | DEPENDENCY_GRAPH.md | Layer 5 Definitions |
| No core runtime imports | DEPENDENCY_GRAPH.md | INV-9 |
| Simulation isolation | ARCHITECTURE_DECISIONS.md | ADR-007 |
| Intent → Export → Deploy flow | ARCHITECTURE_DECISIONS.md | ADR-002 |
| Forbidden import paths | FORBIDDEN_PATHS.md | CLI Section |
| Repository classifications | REPO_CLASSIFICATION.md | Platform Repositories |
| Conflict resolution | ARCHITECTURE_INDEX.md | Resolution Hierarchy |

---

*This document defines CLI command ownership and execution authority for the Agentics platform. All rules derive from and are consistent with the canonical architecture documents. In case of conflict with [`DEPENDENCY_GRAPH.md`](DEPENDENCY_GRAPH.md), that document governs. Changes to CLI ownership require RFC process and architectural review.*
