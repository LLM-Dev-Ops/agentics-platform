# Agentics Platform Architecture

**Audience**: Investors, PE firms, enterprise executives, and non-technical stakeholders
**Purpose**: Plain-language explanation of architectural decisions and their business value

---

## What This Architecture Achieves

The Agentics platform is built on a layered architecture that separates capabilities into independent, auditable components. This structure:

- **Protects component value** during acquisition or divestiture
- **Enables independent evolution** of features without breaking other parts
- **Simplifies compliance** by isolating sensitive operations
- **Reduces integration risk** for enterprise customers

---

## The Five Layers

The platform organizes all code into five layers, each with a distinct responsibility:

| Layer | Name | What It Does |
|-------|------|--------------|
| **5** | CLI (User Interface) | Where users interact with the platform via command line |
| **4** | Platform Gateway | Single entry point that handles authentication, routing, and governance |
| **3** | Consolidation Cores | Eight specialized engines (Intelligence, Security, Automation, etc.) |
| **2** | Services | Developer tools and specialized subsystems |
| **1** | Engines | Foundational compute and processing capabilities |

**Key principle**: Information flows downward only. Layer 5 talks to Layer 4, Layer 4 talks to Layer 3, and so on. No layer may reach upward or skip layers. This prevents tangled dependencies that would complicate audits, acquisitions, or compliance reviews.

For complete layer definitions, see [`DEPENDENCY_GRAPH.md`](DEPENDENCY_GRAPH.md).

---

## Why Certain Paths Are Forbidden

The architecture explicitly prohibits certain connections between components. These are not suggestions—they are enforced by automated tooling that blocks code that violates the rules.

**Why this matters to stakeholders:**

1. **Clean separation of value**: Each component (core, service, engine) can be valued independently because it does not have hidden dependencies on other components.

2. **Predictable risk**: When evaluating the platform for acquisition or investment, auditors can verify that no component secretly depends on another that might not be included in the transaction.

3. **Regulatory clarity**: Sensitive operations (security scanning, data governance) are isolated in specific layers, making it straightforward to demonstrate compliance boundaries.

For the complete list of prohibited paths, see [`FORBIDDEN_PATHS.md`](FORBIDDEN_PATHS.md).

---

## Why Simulations Are Abstracted

The platform includes simulation capabilities for testing deployments, load scenarios, and operational changes before they affect production systems.

**These simulations are deliberately abstract rather than enterprise-specific because:**

- **Portability**: The same simulation framework works for any customer without custom code
- **Isolation**: Simulations cannot accidentally modify production data—this is architecturally enforced, not just policy
- **Auditability**: Every simulation runs through the same controlled pathway, creating consistent audit trails
- **Scalability**: New simulation scenarios can be added without rewriting infrastructure

Simulations are owned by dedicated repositories (`agentics-simulation-planner`, `agentics-simulation-runner`) that the platform invokes through APIs. No CLI or user-facing tool ever runs simulation code directly.

For the rationale behind simulation isolation, see [`ARCHITECTURE_DECISIONS.md`](ARCHITECTURE_DECISIONS.md) (ADR-007).

---

## Why Everything Goes Through the Platform CLI

All human-initiated operations—deploying code, switching environments, promoting changes, running simulations—must go through a single command-line interface: `agentics-platform-cli`.

**This is not a limitation; it is a deliberate control:**

1. **Single audit point**: Every human action flows through one gateway, creating a complete record of who did what and when.

2. **Policy enforcement**: The CLI validates every operation against governance rules before executing. Operations that violate policies are blocked, not just logged.

3. **Consistent context**: The CLI maintains organizational and environment context, ensuring that a command run by one operator cannot accidentally affect another customer's environment.

4. **No backdoors**: By prohibiting other entry points, the architecture eliminates the risk of engineers creating shortcuts that bypass security or compliance controls.

For CLI ownership boundaries and enforcement rules, see [`CLI_COMMAND_OWNERSHIP.md`](CLI_COMMAND_OWNERSHIP.md).

---

## How This Is Enforced

Architectural rules are not documentation—they are automated gates:

- **CI Pipeline**: Every code change is validated against dependency rules before it can be merged
- **Forbidden Path Detection**: Static analysis blocks imports that cross layer boundaries
- **Version Locking**: The architecture is frozen at a specific version; changes require formal approval

The enforcement script (`ci/check-architecture.sh`) runs 19 automated checks on every commit. Violations cause build failures.

For the complete enforcement framework, see [`ARCHITECTURE_INDEX.md`](ARCHITECTURE_INDEX.md).

---

## Summary for Due Diligence

| Question | Answer |
|----------|--------|
| Are components independently valuable? | Yes. Layer boundaries prevent hidden dependencies. |
| Can we audit the separation? | Yes. Automated tooling validates every commit. |
| Is there a single control point? | Yes. All operations flow through the platform CLI. |
| Are simulations safe? | Yes. Architecturally isolated from production. |
| Can engineers bypass controls? | No. Forbidden paths are enforced by CI, not policy. |

---

## Document References

| Document | Purpose |
|----------|---------|
| [`ARCHITECTURE_INDEX.md`](ARCHITECTURE_INDEX.md) | Master index and conflict resolution hierarchy |
| [`DEPENDENCY_GRAPH.md`](DEPENDENCY_GRAPH.md) | Layer definitions and dependency rules |
| [`FORBIDDEN_PATHS.md`](FORBIDDEN_PATHS.md) | Explicit list of prohibited connections |
| [`CLI_COMMAND_OWNERSHIP.md`](CLI_COMMAND_OWNERSHIP.md) | CLI boundaries and enforcement rules |
| [`ARCHITECTURE_DECISIONS.md`](ARCHITECTURE_DECISIONS.md) | Rationale for key architectural choices |
| [`ARCHITECTURE_VERSION.md`](../ARCHITECTURE_VERSION.md) | Frozen version declaration |

---

*This document provides a stakeholder-friendly overview. For technical enforcement details, refer to the linked documents. For audit preparation, start with [`ARCHITECTURE_INDEX.md`](ARCHITECTURE_INDEX.md).*
