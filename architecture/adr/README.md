# Architecture Decision Records

**Version**: 1.0
**Status**: Canonical
**Classification**: Governance Documentation
**Last Updated**: 2025-01-03

---

## Purpose

Architecture Decision Records (ADRs) document significant architectural choices made during platform development. Each ADR captures the context, decision, rationale, and implications of a choice that affects the platform's structure, behavior, or constraints.

**ADRs serve three critical functions:**

1. **Governance**: ADRs establish architectural constraints that are enforced through CI pipelines and code review. They are not suggestions—they are rules.

2. **Diligence**: ADRs provide auditable documentation for PE technical review, acquisition due diligence, and compliance assessment. Every architectural choice has documented rationale.

3. **Continuity**: ADRs preserve institutional knowledge. When teams change, the reasoning behind architectural choices remains accessible and authoritative.

---

## ADR Authority

ADRs are authoritative documents within the platform's governance hierarchy:

```
┌─────────────────────────────────────────────────────────────────┐
│                      DOCUMENT HIERARCHY                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. DEPENDENCY_GRAPH.md          Supreme authority               │
│       ↓                                                          │
│  2. ARCHITECTURE_DECISIONS.md    ADR index (this directory)      │
│       ↓                                                          │
│  3. FORBIDDEN_PATHS.md           Derived prohibitions            │
│       ↓                                                          │
│  4. REPO_CLASSIFICATION.md       Repository assignments          │
│       ↓                                                          │
│  5. CLI_COMMAND_OWNERSHIP.md     CLI boundaries                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

When ADRs conflict with subordinate documents, ADRs govern. When ADRs conflict with `DEPENDENCY_GRAPH.md`, the dependency graph governs.

---

## ADR Lifecycle

### States

| State | Meaning |
|-------|---------|
| **Proposed** | Under review; not yet binding |
| **Accepted** | Binding; enforced by CI and code review |
| **Superseded** | Replaced by a newer ADR; retained for history |
| **Deprecated** | No longer applicable; retained for history |

### Creating an ADR

1. **Identify the Decision**: A significant choice affecting architecture, security, compliance, or value isolation
2. **Draft the ADR**: Use the template below
3. **Submit RFC**: Open a pull request with the ADR for architectural review
4. **Review**: Platform Architecture Team evaluates for consistency and completeness
5. **Approval**: CTO approval required for decisions affecting frozen architecture
6. **Enforcement**: Update CI rules and enforcement scripts as needed

---

## ADR Template

```markdown
# ADR-XXX: [Title]

**Status**: Proposed | Accepted | Superseded | Deprecated
**Date**: YYYY-MM-DD
**Supersedes**: ADR-XXX (if applicable)
**Superseded by**: ADR-XXX (if applicable)

## Context

[Describe the forces at play, including technical, business, and organizational factors. What problem or decision point prompted this ADR?]

## Decision

[State the decision clearly and unambiguously. Use "We will..." or "The platform will..." language.]

## Rationale

[Explain why this decision was made. Include business justification, technical reasoning, and diligence considerations.]

## Alternatives Considered

| Alternative | Reason Rejected |
|-------------|-----------------|
| [Option A] | [Why it was not chosen] |
| [Option B] | [Why it was not chosen] |

## Implications

[What are the consequences of this decision? What constraints does it create? What must change to comply?]

## Enforcement

[How is this decision enforced? CI checks, code review gates, runtime validation?]

## Traceability

[Which other documents reference or depend on this ADR?]
```

---

## ADR Index

The canonical ADR index is maintained in [`ARCHITECTURE_DECISIONS.md`](../ARCHITECTURE_DECISIONS.md). Individual ADRs in this directory provide expanded rationale for decisions that require detailed documentation.

| ADR | Title | Status |
|-----|-------|--------|
| [ADR-001](../ARCHITECTURE_DECISIONS.md#adr-001-simulations-are-generic-not-company-specific) | Simulations Are Generic, Not Company-Specific | Accepted |
| [ADR-002](../ARCHITECTURE_DECISIONS.md#adr-002-intent--simulation--export--deploy-abstraction-boundary) | Intent → Simulation → Export → Deploy Abstraction Boundary | Accepted |
| [ADR-003](../ARCHITECTURE_DECISIONS.md#adr-003-infrastructure-services-and-integrations-strict-isolation) | Infrastructure, Services, and Integrations Strict Isolation | Accepted |
| [ADR-004](../ARCHITECTURE_DECISIONS.md#adr-004-five-layer-architecture-with-downward-only-dependencies) | Five-Layer Architecture with Downward-Only Dependencies | Accepted |
| [ADR-005](../ARCHITECTURE_DECISIONS.md#adr-005-layer-4-as-sole-external-entry-point) | Layer 4 as Sole External Entry Point | Accepted |
| [ADR-006](../ARCHITECTURE_DECISIONS.md#adr-006-cli-as-thin-client-without-runtime-embedding) | CLI as Thin Client Without Runtime Embedding | Accepted |
| [ADR-007](../ARCHITECTURE_DECISIONS.md#adr-007-simulation-repositories-isolated-from-production) | Simulation Repositories Isolated from Production | Accepted |
| [ADR-008](../ARCHITECTURE_DECISIONS.md#adr-008-consolidation-cores-own-all-business-logic) | Consolidation Cores Own All Business Logic | Accepted |
| [ADR-009](ADR-009-simulation-abstraction.md) | Simulation Abstraction and Organization-Agnostic Design | Accepted |
| [ADR-010](ADR-010-ui-brand-and-telemetry-design-system.md) | UI Brand and Telemetry Design System | Accepted |
| [ADR-011](ADR-011-realtime-simulation-telemetry-transport.md) | Real-Time Simulation Telemetry Transport | Accepted |
| [ADR-012](ADR-012-simulation-live-console-ui-surface.md) | Simulation Live Console UI Surface | Accepted |

### Domain-Driven Design (DDD) Framework ADRs

The following ADRs define the conceptual architecture and governance framework using Domain-Driven Design principles:

| ADR/DDD | Title | Status |
|---------|-------|--------|
| [ADR/DDD-005](ADR-DDD-005-system-coherence-drift-detection-self-governance.md) | System Coherence, Drift Detection, and Self-Governance | Accepted |
| [ADR/DDD-006](ADR-DDD-006-ui-control-surface-architecture.md) | UI Control Surface Architecture Aligned with Claude-Flow and Claude-Code | Accepted |

---

## Amendment Process

Modifying accepted ADRs requires:

1. **RFC Submission**: Propose the change with rationale
2. **Impact Analysis**: Document effects on other architectural artifacts
3. **Architectural Review**: Platform Architecture Team review
4. **CTO Approval**: Required for changes to frozen architecture elements
5. **Document Updates**: Update all affected documents in precedence order
6. **Enforcement Update**: Modify CI rules and validation scripts

**ADRs affecting frozen architecture (v1) require CTO approval.** See [`ARCHITECTURE_INDEX.md`](../ARCHITECTURE_INDEX.md) for the frozen element list.

---

## Diligence Considerations

ADRs are designed to satisfy due diligence requirements:

| Requirement | How ADRs Address It |
|-------------|---------------------|
| **Architectural clarity** | Each decision is explicitly documented with rationale |
| **Risk identification** | Alternatives considered reveal rejected risks |
| **Value isolation** | Decisions enforce clean component boundaries |
| **Compliance posture** | ADRs reference applicable regulations (SOC 2, HIPAA, etc.) |
| **Technical debt visibility** | Superseded/deprecated ADRs show evolution |

---

## Document Governance

| Aspect | Policy |
|--------|--------|
| Ownership | Platform Architecture Team |
| Amendment Authority | CTO (frozen elements), Architecture Team (non-frozen) |
| Review Cadence | Upon significant architectural change |
| Audit Preparation | Review prior to any transaction due diligence |
| Audience | CTOs, PE technical auditors, acquisition teams, engineering leads |

---

*This directory contains Architecture Decision Records that govern platform architecture. ADRs represent closed, intentional choices—not evolving experiments. The architecture is designed to be auditable, defensible, and transaction-ready.*
