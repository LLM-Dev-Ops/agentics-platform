# Dependency Diagram

**Version**: 1.1
**Status**: Canonical
**Classification**: Architecture Visualization
**Last Updated**: 2025-01-03
**Canonical Reference**: [`DEPENDENCY_GRAPH.md`](DEPENDENCY_GRAPH.md)

---

## Purpose

This document provides a static, human-readable visualization of the Agentics platform dependency graph. The diagrams represent existing architectural rules as documented in [`DEPENDENCY_GRAPH.md`](DEPENDENCY_GRAPH.md) without adding or redefining rules.

All constraints shown are **strict and enforced**. Violations represent architectural failures.

---

## Platform Dependency Diagram

```mermaid
flowchart TB
    subgraph L5["Layer 5: External Consumers"]
        CLI["agentics-cli<br/>━━━━━━━━━━━━━━━<br/>Thin Client Only<br/>No Core Runtime"]
        SDK["@agentics/sdk"]
        UI["@agentics/ui"]
        Partners["Partner APIs"]
    end

    subgraph L4["Layer 4: API Gateway & Simulation (L4)"]
        subgraph GATEWAY["Control Plane"]
            Platform["agentics-platform<br/>━━━━━━━━━━━━━━━<br/>Auth • Rate Limit<br/>Usage • Routing<br/>━━━━━━━━━━━━━━━<br/>NO BUSINESS LOGIC"]
        end

        subgraph CORE_ROUTER["Core Gateway Abstraction"]
            Router["Request Router<br/>━━━━━━━━━━━━━━━<br/>Dispatch Only<br/>No Transformation"]
        end

        subgraph SIM_L4["Simulation Repositories (L4)"]
            SimPlanner["agentics-simulation-planner"]
            SimRunner["agentics-simulation-runner"]
            Exporters["agentics-deployment-exporters"]
            Diligence["agentics-diligence-artifacts"]
            OrgManifests["agentics-org-manifests"]
        end
    end

    subgraph L3["Layer 3: Consolidation Cores"]
        subgraph CORES["Domain Logic Owners"]
            Intelligence["LLM-Intelligence-Core<br/>Model Orchestration"]
            Security["LLM-Security-Core<br/>Threat Detection"]
            Automation["LLM-Automation-Core<br/>Workflow Execution"]
            Governance["LLM-Governance-Core<br/>Policy Evaluation"]
            Data["LLM-Data-Core<br/>Data Operations"]
            Ecosystem["LLM-Ecosystem-Core<br/>Integrations"]
            Research["LLM-Research-Core<br/>━━━━━━━━━━━━━━━<br/>Consumes Sim Outputs<br/>No Sim Execution"]
            Interface["LLM-Interface-Core<br/>Conversations"]
        end
    end

    subgraph L2["Layer 2: Services"]
        subgraph SHARED_SVC["Shared Services"]
            SvcQueue["services-queue"]
            SvcCache["services-cache"]
            SvcMetrics["services-metrics"]
        end
        subgraph CORE_SCOPED["Core-Scoped Services"]
            SvcAuth["services-auth<br/>(Identity-scoped)"]
        end
    end

    subgraph L1["Layer 1: State Substrate"]
        subgraph SUBSTRATE["Deterministic State (No Logic)"]
            RuvVector["RuvVector<br/>━━━━━━━━━━━━━━━<br/>Vector Storage<br/>Similarity Search<br/>━━━━━━━━━━━━━━━<br/>STATE ONLY"]
            Storage["Storage Backends<br/>━━━━━━━━━━━━━━━<br/>Persistence Only"]
            Cache["Cache Infrastructure<br/>━━━━━━━━━━━━━━━<br/>Ephemeral State"]
        end
    end

    %% Layer 5 → Layer 4 (HTTPS only)
    CLI -->|"HTTPS<br/>API Calls Only"| Platform
    SDK -->|"HTTPS"| Platform
    UI -->|"HTTPS"| Platform
    Partners -->|"HTTPS"| Platform

    %% Platform → Router (internal dispatch)
    Platform --> Router

    %% Router → Cores (dispatch only, no logic)
    Router -.->|"Dispatch"| Intelligence
    Router -.->|"Dispatch"| Security
    Router -.->|"Dispatch"| Automation
    Router -.->|"Dispatch"| Governance
    Router -.->|"Dispatch"| Data
    Router -.->|"Dispatch"| Ecosystem
    Router -.->|"Dispatch"| Research
    Router -.->|"Dispatch"| Interface

    %% Simulation → Platform (read-only API)
    SimPlanner -.->|"API Read Only"| Platform
    SimRunner -.->|"API Read Only"| Platform

    %% Research consumes simulation outputs (not executes)
    SimRunner -.->|"Outputs"| Research

    %% Cores → Services
    Intelligence --> SvcQueue
    Intelligence --> SvcCache
    Security --> SvcMetrics
    Automation --> SvcAuth
    Data --> SvcQueue
    Research --> SvcMetrics

    %% Services → Substrate
    SvcQueue --> Storage
    SvcCache --> Cache
    SvcMetrics --> Storage

    %% Cores → Substrate (direct access allowed)
    Research --> RuvVector
    Data --> Storage
    Intelligence --> Cache

    classDef l5 fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    classDef l4 fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    classDef l4sim fill:#fff8e1,stroke:#fbc02d,stroke-width:2px,stroke-dasharray: 5 5
    classDef l3 fill:#e8f5e9,stroke:#388e3c,stroke-width:2px
    classDef l2 fill:#fce4ec,stroke:#c2185b,stroke-width:2px
    classDef l1 fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
    classDef router fill:#ffecb3,stroke:#ff8f00,stroke-width:2px

    class CLI,SDK,UI,Partners l5
    class Platform l4
    class Router router
    class SimPlanner,SimRunner,Exporters,Diligence,OrgManifests l4sim
    class Intelligence,Security,Automation,Governance,Data,Ecosystem,Research,Interface l3
    class SvcQueue,SvcCache,SvcMetrics,SvcAuth l2
    class RuvVector,Storage,Cache l1
```

---

## Repository Class Diagram (Strict Boundaries)

```mermaid
flowchart TB
    subgraph PLATFORM["Platform (L4/L5)"]
        direction TB
        P1["agentics-platform<br/>━━━━━━━━━━━━━━━<br/>Gateway Only<br/>No Business Logic"]
        P2["agentics-cli<br/>━━━━━━━━━━━━━━━<br/>Thin Client<br/>Schema Refs Only<br/>No Runtime Imports"]
    end

    subgraph CORES["Consolidation Cores (L3)"]
        C1["LLM-*-Core (×8)<br/>━━━━━━━━━━━━━━━<br/>ALL Business Logic<br/>Domain Owners"]
    end

    subgraph SERVICES["Services (L2)"]
        direction TB
        S_SHARED["Shared Services<br/>━━━━━━━━━━━━━━━<br/>queue • cache • metrics"]
        S_SCOPED["Core-Scoped Services<br/>━━━━━━━━━━━━━━━<br/>auth (identity-bound)"]
    end

    subgraph SUBSTRATE["State Substrate (L1)"]
        E1["RuvVector<br/>━━━━━━━━━━━━━━━<br/>Deterministic State<br/>No Logic Execution"]
    end

    subgraph SIMULATION["Simulation Repositories (L4)"]
        direction TB
        SIM_NOTE["READ-ONLY CONSUMERS<br/>━━━━━━━━━━━━━━━<br/>API: Read Only<br/>Schemas: Reference Only<br/>Production: No Writes<br/>Integrations: Schema Only"]
        SIM1["agentics-simulation-planner"]
        SIM2["agentics-simulation-runner"]
        SIM3["agentics-deployment-exporters"]
        SIM4["agentics-diligence-artifacts"]
        SIM5["agentics-org-manifests"]
    end

    subgraph INFRA["Infrastructure"]
        I1["infra-*<br/>━━━━━━━━━━━━━━━<br/>PROVISIONING ONLY<br/>No Application Logic<br/>No Runtime Dependencies<br/>No Business Rules"]
    end

    subgraph INTEGRATIONS["Integrations"]
        INT1["integrations-*<br/>━━━━━━━━━━━━━━━<br/>STATELESS EDGE ADAPTERS<br/>No Persistent State<br/>No Direct Infra Calls<br/>API Passthrough Only"]
    end

    %% Platform relationships
    P2 -.->|"API Only<br/>No Runtime"| P1
    P1 -->|"Dispatch"| C1

    %% Core relationships
    C1 --> S_SHARED
    C1 --> S_SCOPED
    C1 --> E1

    %% Service relationships
    S_SHARED --> E1
    S_SCOPED --> E1

    %% Simulation relationships (read-only)
    SIM1 -.->|"L4 API<br/>Read Only"| P1
    SIM2 -.->|"L4 API<br/>Read Only"| P1
    SIM3 -.->|"Schemas<br/>Read Only"| P1
    SIM4 -.->|"Schemas<br/>Read Only"| P1
    SIM5 -.->|"Schemas<br/>Read Only"| P1

    %% Integration relationships (API only)
    INT1 -.->|"L4 API Only<br/>Stateless"| P1

    classDef platform fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    classDef cores fill:#e8f5e9,stroke:#388e3c,stroke-width:2px
    classDef services fill:#fce4ec,stroke:#c2185b,stroke-width:2px
    classDef substrate fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
    classDef simulation fill:#fff8e1,stroke:#fbc02d,stroke-width:2px,stroke-dasharray: 5 5
    classDef infra fill:#eceff1,stroke:#546e7a,stroke-width:2px
    classDef integration fill:#e0f7fa,stroke:#00838f,stroke-width:2px
    classDef note fill:#fafafa,stroke:#9e9e9e,stroke-width:1px

    class P1,P2 platform
    class C1 cores
    class S_SHARED,S_SCOPED services
    class E1 substrate
    class SIM1,SIM2,SIM3,SIM4,SIM5 simulation
    class SIM_NOTE note
    class I1 infra
    class INT1 integration
```

---

## Simulation Isolation Diagram

```mermaid
flowchart TB
    subgraph PRODUCTION["Production Environment"]
        direction TB
        PROD_DB[("Production DB<br/>━━━━━━━━━━━━━━━<br/>WRITE PROTECTED")]
        PROD_SVC["Production Services<br/>━━━━━━━━━━━━━━━<br/>MUTATION PROTECTED"]
        PROD_INFRA["Production Infra<br/>━━━━━━━━━━━━━━━<br/>MODIFICATION PROTECTED"]
        PROD_INT["Integration Endpoints<br/>━━━━━━━━━━━━━━━<br/>DIRECT CALL FORBIDDEN"]
    end

    subgraph SIMULATION["Simulation Environment (L4)"]
        direction TB
        SIM_REPOS["Simulation Repositories<br/>━━━━━━━━━━━━━━━<br/>• agentics-simulation-planner<br/>• agentics-simulation-runner<br/>• agentics-deployment-exporters<br/>• agentics-diligence-artifacts<br/>• agentics-org-manifests"]
    end

    subgraph ALLOWED["Allowed Access (Read-Only)"]
        direction TB
        TELEMETRY["Production Telemetry<br/>(Audit Logged)"]
        SCHEMAS["Schema Snapshots<br/>(Versioned, Immutable)"]
        INT_SCHEMAS["Integration Schemas<br/>(Definition Only)"]
        L4_API["Layer 4 API<br/>(Read Operations)"]
    end

    subgraph RESEARCH["LLM-Research-Core (L3)"]
        RESEARCH_CORE["Research Analytics<br/>━━━━━━━━━━━━━━━<br/>CONSUMES Outputs<br/>Does NOT Execute"]
    end

    %% Forbidden paths (red X)
    SIM_REPOS -.-x|"✕ WRITE"| PROD_DB
    SIM_REPOS -.-x|"✕ MUTATE"| PROD_SVC
    SIM_REPOS -.-x|"✕ MODIFY"| PROD_INFRA
    SIM_REPOS -.-x|"✕ DIRECT CALL"| PROD_INT

    %% Allowed paths (green check)
    SIM_REPOS -.->|"✓ READ"| TELEMETRY
    SIM_REPOS -.->|"✓ REF"| SCHEMAS
    SIM_REPOS -.->|"✓ REF"| INT_SCHEMAS
    SIM_REPOS -.->|"✓ API"| L4_API

    %% Research consumes outputs
    SIM_REPOS -->|"Outputs"| RESEARCH_CORE

    style PRODUCTION fill:#ffebee,stroke:#c62828,stroke-width:2px
    style SIMULATION fill:#fff8e1,stroke:#fbc02d,stroke-width:2px
    style ALLOWED fill:#e8f5e9,stroke:#388e3c,stroke-width:2px
    style RESEARCH fill:#e8f5e9,stroke:#388e3c,stroke-width:2px

    style PROD_DB fill:#ffcdd2,stroke:#c62828
    style PROD_SVC fill:#ffcdd2,stroke:#c62828
    style PROD_INFRA fill:#ffcdd2,stroke:#c62828
    style PROD_INT fill:#ffcdd2,stroke:#c62828
```

---

## Forbidden Path Visualization (Complete)

```mermaid
flowchart TB
    subgraph CRITICAL["Critical Violations (Immediate Block)"]
        direction LR
        F1["CLI → Core Runtime<br/>(direct import)"]
        F2["Simulation → Production<br/>(write/mutate)"]
        F3["Infra → Platform Logic<br/>(any import)"]
    end

    subgraph HIGH["High Violations (Block Merge)"]
        direction LR
        F4["Platform → L1/L2<br/>(layer skip)"]
        F5["Core → Core<br/>(lateral import)"]
        F6["Services → Simulation<br/>(any import)"]
        F7["Integrations → State<br/>(ownership)"]
    end

    subgraph BOUNDARY["Boundary Violations"]
        direction LR
        F8["Simulation → Integration Adapters<br/>(runtime import)"]
        F9["Simulation → Integration Endpoints<br/>(direct call)"]
        F10["Integrations → Infra<br/>(direct call)"]
        F11["Integrations → L1 Engines<br/>(direct access)"]
    end

    subgraph UPWARD["Upward Dependency Violations"]
        direction LR
        F12["L1 → L2/L3/L4/L5"]
        F13["L2 → L3/L4/L5"]
        F14["L3 → L4/L5"]
        F15["L4 → L5"]
    end

    style CRITICAL fill:#b71c1c,stroke:#b71c1c,color:#fff
    style HIGH fill:#c62828,stroke:#c62828,color:#fff
    style BOUNDARY fill:#d32f2f,stroke:#d32f2f,color:#fff
    style UPWARD fill:#e53935,stroke:#e53935,color:#fff

    style F1 fill:#ffcdd2,stroke:#c62828
    style F2 fill:#ffcdd2,stroke:#c62828
    style F3 fill:#ffcdd2,stroke:#c62828
    style F4 fill:#ffcdd2,stroke:#c62828
    style F5 fill:#ffcdd2,stroke:#c62828
    style F6 fill:#ffcdd2,stroke:#c62828
    style F7 fill:#ffcdd2,stroke:#c62828
    style F8 fill:#ffcdd2,stroke:#c62828
    style F9 fill:#ffcdd2,stroke:#c62828
    style F10 fill:#ffcdd2,stroke:#c62828
    style F11 fill:#ffcdd2,stroke:#c62828
    style F12 fill:#ffcdd2,stroke:#c62828
    style F13 fill:#ffcdd2,stroke:#c62828
    style F14 fill:#ffcdd2,stroke:#c62828
    style F15 fill:#ffcdd2,stroke:#c62828
```

---

## Intent → Simulation → Export → Deploy Flow

```mermaid
flowchart LR
    subgraph INPUT["Intent Phase"]
        Intent["User Intent<br/>━━━━━━━━━━━━━━━<br/>CLI / SDK / UI<br/>Via L4 API Only"]
    end

    subgraph PLANNING["Planning Phase (L4)"]
        Plan["agentics-simulation-planner<br/>━━━━━━━━━━━━━━━<br/>Scenario Specification<br/>Schema Validation"]
    end

    subgraph EXECUTION["Execution Phase (L4)"]
        Run["agentics-simulation-runner<br/>━━━━━━━━━━━━━━━<br/>Isolated Execution<br/>No Production Writes"]
    end

    subgraph EXPORT["Export Phase (L4)"]
        Exp["agentics-deployment-exporters<br/>━━━━━━━━━━━━━━━<br/>Artifact Generation<br/>Config Templates"]
        Art["agentics-diligence-artifacts<br/>━━━━━━━━━━━━━━━<br/>Audit Evidence<br/>Compliance Docs"]
        Manifest["agentics-org-manifests<br/>━━━━━━━━━━━━━━━<br/>Org Definitions<br/>Template Validation"]
    end

    subgraph ANALYTICS["Analytics (L3)"]
        Research["LLM-Research-Core<br/>━━━━━━━━━━━━━━━<br/>Consumes Outputs<br/>Experiment Tracking"]
    end

    subgraph DEPLOY["Deploy Phase"]
        Deploy["Production Deployment<br/>━━━━━━━━━━━━━━━<br/>Explicit Approval<br/>Versioned Artifacts"]
    end

    Intent -->|"L4 API"| Plan
    Plan -->|"Specification"| Run
    Run -->|"Results"| Exp
    Run -->|"Results"| Art
    Run -->|"Outputs"| Research
    Exp -->|"Configs"| Manifest
    Manifest -->|"Validated"| Deploy

    subgraph ISOLATION["ISOLATION BOUNDARY"]
        Plan
        Run
    end

    style INPUT fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    style PLANNING fill:#fff8e1,stroke:#fbc02d,stroke-width:2px
    style EXECUTION fill:#fff8e1,stroke:#fbc02d,stroke-width:2px
    style EXPORT fill:#fff8e1,stroke:#fbc02d,stroke-width:2px
    style ANALYTICS fill:#e8f5e9,stroke:#388e3c,stroke-width:2px
    style DEPLOY fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
    style ISOLATION fill:none,stroke:#c62828,stroke-width:3px,stroke-dasharray: 5 5
```

---

## Layer Dependency Matrix (Strict)

```mermaid
flowchart TB
    subgraph ALLOWED["Allowed Paths (Downward Only)"]
        L5["L5: External Consumers<br/>━━━━━━━━━━━━━━━<br/>CLI, SDK, UI, Partners"]
        L4["L4: Gateway + Simulation<br/>━━━━━━━━━━━━━━━<br/>Platform, Sim Repos"]
        L3["L3: Consolidation Cores<br/>━━━━━━━━━━━━━━━<br/>ALL Business Logic"]
        L2["L2: Services<br/>━━━━━━━━━━━━━━━<br/>Shared + Scoped"]
        L1["L1: State Substrate<br/>━━━━━━━━━━━━━━━<br/>RuvVector, Storage<br/>NO LOGIC"]

        L5 -->|"✓ HTTPS"| L4
        L4 -->|"✓ Dispatch"| L3
        L3 -->|"✓ Compose"| L2
        L3 -->|"✓ Access"| L1
        L2 -->|"✓ Use"| L1
    end

    subgraph FORBIDDEN["Forbidden Paths (Upward)"]
        direction LR
        X1["L1 ✕→ L2"]
        X2["L2 ✕→ L3"]
        X3["L3 ✕→ L4"]
        X4["L4 ✕→ L5"]
    end

    subgraph SKIP["Forbidden Paths (Skip)"]
        direction LR
        Y1["L4 ✕→ L2"]
        Y2["L4 ✕→ L1"]
        Y3["L5 ✕→ L3"]
    end

    style ALLOWED fill:#e8f5e9,stroke:#388e3c,stroke-width:2px
    style FORBIDDEN fill:#ffebee,stroke:#c62828,stroke-width:2px
    style SKIP fill:#ffebee,stroke:#c62828,stroke-width:2px

    style L5 fill:#e3f2fd,stroke:#1976d2
    style L4 fill:#fff3e0,stroke:#f57c00
    style L3 fill:#e8f5e9,stroke:#388e3c
    style L2 fill:#fce4ec,stroke:#c2185b
    style L1 fill:#f3e5f5,stroke:#7b1fa2
```

---

## Infrastructure & Integration Constraints

```mermaid
flowchart TB
    subgraph INFRA["Infrastructure Repositories (infra-*)"]
        direction TB
        INFRA_CHAR["CHARACTERISTICS<br/>━━━━━━━━━━━━━━━<br/>✓ Provisioning Only<br/>✓ Declarative Configs<br/>✓ Cloud Agnostic<br/>━━━━━━━━━━━━━━━<br/>✕ No Application Logic<br/>✕ No Business Rules<br/>✕ No Runtime Dependencies<br/>✕ No Platform Imports"]

        INFRA_REPOS["Repositories<br/>• infra-kubernetes<br/>• infra-terraform<br/>• infra-monitoring<br/>• infra-secrets"]
    end

    subgraph INTEGRATIONS["Integration Repositories (integrations-*)"]
        direction TB
        INT_CHAR["CHARACTERISTICS<br/>━━━━━━━━━━━━━━━<br/>✓ Stateless Adapters<br/>✓ Protocol Translation<br/>✓ L4 API Passthrough<br/>━━━━━━━━━━━━━━━<br/>✕ No Persistent State<br/>✕ No Direct Infra Calls<br/>✕ No L1 Engine Access<br/>✕ No Service Imports"]

        INT_REPOS["Repositories<br/>• integrations-github<br/>• integrations-slack<br/>• integrations-jira<br/>• integrations-datadog"]
    end

    subgraph SUBSTRATE["State Substrate (L1)"]
        direction TB
        SUB_CHAR["CHARACTERISTICS<br/>━━━━━━━━━━━━━━━<br/>✓ Deterministic State<br/>✓ Data Persistence<br/>✓ Query Execution<br/>━━━━━━━━━━━━━━━<br/>✕ No Business Logic<br/>✕ No Domain Rules<br/>✕ No Upward Deps"]

        SUB_REPOS["Components<br/>• RuvVector<br/>• Storage Backends<br/>• Cache Infrastructure"]
    end

    style INFRA fill:#eceff1,stroke:#546e7a,stroke-width:2px
    style INTEGRATIONS fill:#e0f7fa,stroke:#00838f,stroke-width:2px
    style SUBSTRATE fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
```

---

## Cross-Class Dependency Matrix

```
From ↓ / To →       │ CLI │ Platform │ Cores │ infra-* │ services-* │ integrations-* │ simulation │ substrate │
────────────────────┼─────┼──────────┼───────┼─────────┼────────────┼────────────────┼────────────┼───────────│
CLI                 │  -  │    ◇     │   ✕   │    ✕    │     ✕      │       ✕        │     ✕      │     ✕     │
Platform            │  ✕  │    -     │   ✓   │    ✕    │     ✕      │       ✕        │     ✕      │     ✕     │
Cores               │  ✕  │    ✕     │   ✕   │    ✕    │     ✓      │       ✕        │     ✕      │     ✓     │
infra-*             │  ✕  │    ✕     │   ✕   │    ✓    │     ✕      │       ✕        │     ✕      │     ✕     │
services-*          │  ✕  │    ✕     │   ✕   │    ✕    │     ✓      │       ✕        │     ✕      │     ✓     │
integrations-*      │  ✕  │    ◇     │   ✕   │    ✕    │     ✕      │       ✓        │     ✕      │     ✕     │
simulation          │  ✕  │    ◇     │   ✕   │    ✕    │     ✕      │       △        │     ✓      │     ✕     │
substrate           │  ✕  │    ✕     │   ✕   │    ✕    │     ✕      │       ✕        │     ✕      │     -     │
────────────────────┴─────┴──────────┴───────┴─────────┴────────────┴────────────────┴────────────┴───────────┘

Legend:
  ✓  Allowed (within class or designated downward path)
  ✕  Forbidden (architectural violation)
  ◇  Allowed via Layer 4 API only (no direct import)
  △  Schema reference only (no runtime adapters)
  -  Self-reference (N/A)
```

---

## Diagram Source Files

| File | Format | Purpose |
|------|--------|---------|
| [`dependency-diagram.mmd`](dependency-diagram.mmd) | Mermaid | Full diagram source for tooling |
| This document | Markdown + Mermaid | GitHub-renderable diagrams |

---

## Rendering Instructions

### GitHub

GitHub renders Mermaid diagrams in Markdown files automatically. No additional tooling required.

### Local Rendering

```bash
# Install Mermaid CLI
npm install -g @mermaid-js/mermaid-cli

# Generate SVG
mmdc -i dependency-diagram.mmd -o dependency-diagram.svg

# Generate PNG
mmdc -i dependency-diagram.mmd -o dependency-diagram.png
```

### VS Code

Install the "Markdown Preview Mermaid Support" extension for live preview.

---

## Constraint Summary

| Component | Constraint | Enforcement |
|-----------|------------|-------------|
| CLI (`agentics-cli`) | Thin client, no core runtime imports | CI static analysis |
| Platform (`agentics-platform`) | Gateway only, no business logic | Code review |
| Cores (`LLM-*-Core`) | All business logic, no lateral imports | Build failure |
| Services (`services-*`) | No simulation imports | CI check |
| Substrate (L1) | State only, no logic, no upward deps | Static analysis |
| Simulation repos | Read-only API/schema consumers | Network isolation |
| Infrastructure (`infra-*`) | Provisioning only, no app logic | CI check |
| Integrations (`integrations-*`) | Stateless edge adapters, no state ownership | Code review |

---

## Document Governance

| Aspect | Policy |
|--------|--------|
| Canonical Source | [`DEPENDENCY_GRAPH.md`](DEPENDENCY_GRAPH.md) |
| Purpose | Visualization only; does not define rules |
| Updates | Must reflect DEPENDENCY_GRAPH.md changes |
| Ownership | Platform Architecture Team |

---

*This diagram visualizes rules defined in [`DEPENDENCY_GRAPH.md`](DEPENDENCY_GRAPH.md). It does not add or modify architectural rules. In case of discrepancy, DEPENDENCY_GRAPH.md governs.*
