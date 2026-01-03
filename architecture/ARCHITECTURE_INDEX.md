# Architecture Index

**Version**: 1.1
**Status**: Canonical
**Classification**: Master Architecture Enforcement Document
**Last Updated**: 2025-01-03
**Architectural Freeze**: v1 (Immutable until ADR-based amendment)
**Authoritative Version Source**: [`ARCHITECTURE_VERSION.md`](../ARCHITECTURE_VERSION.md)

---

## Authoritative Version Declaration

The frozen architecture version is authoritatively declared in [`ARCHITECTURE_VERSION.md`](../ARCHITECTURE_VERSION.md) at the repository root. That document:

- Declares the canonical frozen version identifier (v1)
- Establishes the freeze date and immutability boundary
- Defines the scope of what is frozen versus excluded
- Specifies the ADR amendment procedure for changes

**All enforcement tooling must validate against ARCHITECTURE_VERSION.md.** CI pipelines that cannot locate or parse this document must fail with a blocking error.

---

## Document Purpose and Authority

This document is the **single source of truth** for platform architecture enforcement across the entire Agentics repository fleet. It serves as the canonical index and enforcement entry point for all architectural documentation.

**This document:**

- Enumerates and links to all authoritative architecture artifacts
- Establishes the conflict-resolution hierarchy for architectural decisions
- Defines the v1 architectural freeze boundary
- Specifies the amendment process for architectural changes

**This document does NOT:**

- Duplicate content from linked documents
- Introduce new architectural abstractions
- Modify or supersede existing architectural rules
- Create new dependency paths or exceptions

---

## Authoritative Architecture Artifacts

The following documents constitute the complete architectural specification for the Agentics platform. Each document has a defined purpose, scope, and precedence level.

### Primary Artifacts (Precedence Order)

| Precedence | Document | Purpose | Scope |
|------------|----------|---------|-------|
| **1** | [`DEPENDENCY_GRAPH.md`](DEPENDENCY_GRAPH.md) | Canonical dependency rules and layer definitions | All inter-repository and inter-layer dependencies |
| **2** | [`ARCHITECTURE_DECISIONS.md`](ARCHITECTURE_DECISIONS.md) | Architectural Decision Records (ADRs) | Closed architectural decisions with rationale |
| **3** | [`FORBIDDEN_PATHS.md`](FORBIDDEN_PATHS.md) | Explicit prohibition enumeration | Quick-reference enforcement checklist |
| **4** | [`REPO_CLASSIFICATION.md`](REPO_CLASSIFICATION.md) | Repository assignments and classifications | Per-repository class, layer, and dependency rules |
| **5** | [`CLI_COMMAND_OWNERSHIP.md`](CLI_COMMAND_OWNERSHIP.md) | CLI command ownership and delegation boundaries | CLI execution authority and enforcement |
| **6** | [`DEPENDENCY_DIAGRAM.md`](DEPENDENCY_DIAGRAM.md) | Visual representation of architecture | Diagram-only visualization (no rule definition) |

---

## Conflict Resolution Hierarchy

When architectural ambiguity or conflict arises, resolution follows this strict precedence order:

### Resolution Protocol

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CONFLICT RESOLUTION HIERARCHY                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Level 1: DEPENDENCY_GRAPH.md                                       │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━                                       │
│  The supreme authority. All other documents derive from and         │
│  must remain consistent with this document.                         │
│                                                                     │
│          ↓ In case of conflict, Level 1 governs                     │
│                                                                     │
│  Level 2: ARCHITECTURE_DECISIONS.md                                 │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━                                 │
│  ADRs record closed decisions. Conflicts between ADRs               │
│  and subordinate documents resolve in favor of ADRs.                │
│                                                                     │
│          ↓ In case of conflict, Level 2 governs                     │
│                                                                     │
│  Level 3: FORBIDDEN_PATHS.md                                        │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━                                        │
│  Derived from DEPENDENCY_GRAPH.md. If inconsistent with             │
│  Level 1, update FORBIDDEN_PATHS.md to match.                       │
│                                                                     │
│          ↓ In case of conflict, Level 3 governs                     │
│                                                                     │
│  Level 4: REPO_CLASSIFICATION.md                                    │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━                                     │
│  Repository-specific rules. Must not contradict higher              │
│  precedence documents.                                              │
│                                                                     │
│          ↓ In case of conflict, Level 4 governs                     │
│                                                                     │
│  Level 5: CLI_COMMAND_OWNERSHIP.md                                  │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━                                   │
│  CLI execution authority and delegation. Derives from               │
│  DEPENDENCY_GRAPH.md and ADR-006.                                   │
│                                                                     │
│          ↓ In case of conflict, Level 5 governs                     │
│                                                                     │
│  Level 6: DEPENDENCY_DIAGRAM.md                                     │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━                                      │
│  Visualization only. Does not define rules.                         │
│  If diagrams conflict with rules, diagrams are incorrect.           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Resolution Rules

1. **Explicit Over Implicit**: Explicit prohibitions take precedence over implicit permissions.

2. **Specific Over General**: Repository-specific rules in REPO_CLASSIFICATION.md apply when they do not conflict with general rules in DEPENDENCY_GRAPH.md.

3. **Prohibition Over Permission**: When documents conflict on whether a path is allowed, the prohibition governs.

4. **ADR Finality**: ADRs represent closed decisions. Reopening requires the full RFC and CTO approval process.

5. **Diagram Subordination**: Diagrams visualize rules but do not define them. Visual discrepancies are diagram errors.

---

## Architectural Freeze Boundary (v1)

### Freeze Definition

The v1 architectural freeze establishes an immutable baseline for the platform architecture. The following elements are frozen:

| Frozen Element | Reference |
|---------------|-----------|
| Five-layer architecture | DEPENDENCY_GRAPH.md §Layer Definitions |
| Downward-only dependency rule | DEPENDENCY_GRAPH.md §Dependency Rules |
| Single entry point (Layer 4) | ADR-005 in ARCHITECTURE_DECISIONS.md |
| Eight consolidation cores | ADR-008 in ARCHITECTURE_DECISIONS.md |
| Repository class boundaries | DEPENDENCY_GRAPH.md §Repository Classes |
| Simulation isolation requirements | ADR-007 in ARCHITECTURE_DECISIONS.md |
| CLI thin client constraint | ADR-006 in ARCHITECTURE_DECISIONS.md |
| Infrastructure/Services/Integrations isolation | ADR-003 in ARCHITECTURE_DECISIONS.md |
| Intent → Simulation → Export → Deploy boundary | ADR-002 in ARCHITECTURE_DECISIONS.md |

### Freeze Scope

**Frozen (No changes without ADR amendment):**

- Layer definitions and numbering
- Core-to-core isolation requirement
- Upward dependency prohibition
- Layer skip prohibition
- Simulation/production isolation
- Repository class dependency matrices
- Architectural invariants (INV-1 through INV-9)

**Not Frozen (May evolve within constraints):**

- Repository implementation details (code within allowed dependencies)
- Service internal architecture (within Layer 2 boundaries)
- Infrastructure tooling choices (within infra-* isolation rules)
- Integration adapter implementations (within stateless constraint)
- Visualization and documentation formatting

---

## Amendment Process

Architectural changes are permitted **only** through the ADR amendment process. This applies to:

- New layer additions or layer restructuring
- New repository class definitions
- Changes to dependency direction rules
- Exceptions to forbidden paths
- New consolidation core additions
- Modifications to architectural invariants

### Amendment Protocol

```
┌─────────────────────────────────────────────────────────────────────┐
│                      ADR AMENDMENT PROCESS                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Step 1: RFC Submission                                             │
│  ━━━━━━━━━━━━━━━━━━━━━━                                             │
│  Author submits Request for Comments with:                          │
│  • Proposed change description                                      │
│  • Rationale and business justification                             │
│  • Impact analysis on existing architecture                         │
│  • Alternatives considered                                          │
│                                                                     │
│  Step 2: Architectural Review                                       │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━                                         │
│  Platform Architecture Team reviews for:                            │
│  • Consistency with existing ADRs                                   │
│  • Impact on diligence documentation                                │
│  • Compliance implications                                          │
│  • Technical feasibility                                            │
│                                                                     │
│  Step 3: CTO Approval                                               │
│  ━━━━━━━━━━━━━━━━━━━━                                                │
│  CTO reviews and approves/rejects. Approval required for:           │
│  • Any change to frozen elements                                    │
│  • Any new exceptions to forbidden paths                            │
│  • Any architectural invariant modifications                        │
│                                                                     │
│  Step 4: Document Updates                                           │
│  ━━━━━━━━━━━━━━━━━━━━━━━━                                            │
│  Upon approval, update in order:                                    │
│  1. ARCHITECTURE_DECISIONS.md (new ADR)                             │
│  2. DEPENDENCY_GRAPH.md (if rules change)                           │
│  3. FORBIDDEN_PATHS.md (if prohibitions change)                     │
│  4. REPO_CLASSIFICATION.md (if repository rules change)             │
│  5. DEPENDENCY_DIAGRAM.md (update visualizations)                   │
│  6. This index (if new artifacts added)                             │
│                                                                     │
│  Step 5: CI Enforcement Update                                      │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━                                        │
│  Update enforcement mechanisms:                                     │
│  • .github/workflows/architecture-enforcement.yml                   │
│  • Static analysis rules                                            │
│  • Pre-commit hooks                                                 │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Enforcement Entry Points

Architecture enforcement is applied at multiple stages. This index serves as the entry point for all enforcement activities.

### Enforcement Stages

| Stage | Mechanism | Primary Reference |
|-------|-----------|-------------------|
| Pre-commit | Import path analysis | FORBIDDEN_PATHS.md |
| CI Pipeline | Dependency graph validation | DEPENDENCY_GRAPH.md |
| Code Review | Architectural compliance review | This index → linked documents |
| Deployment | Network policy enforcement | DEPENDENCY_GRAPH.md §Invariants |
| Audit | Diligence documentation review | ARCHITECTURE_DECISIONS.md |

### Enforcement Workflow

1. **Violation Detection**: CI or reviewer identifies potential violation
2. **Classification**: Reference FORBIDDEN_PATHS.md for violation severity
3. **Root Document Lookup**: Trace to DEPENDENCY_GRAPH.md for authoritative rule
4. **ADR Verification**: Check ARCHITECTURE_DECISIONS.md for rationale
5. **Resolution**: Remediate or submit RFC for exception

---

## Document Cross-Reference Matrix

The following matrix shows how documents reference each other. All arrows point from referencing document to referenced document.

```
                            ┌─────────────────────┐
                            │ ARCHITECTURE_INDEX  │ ← You are here
                            │    (This Document)  │
                            └──────────┬──────────┘
                                       │
          ┌────────────────────────────┼────────────────────────────┐
          │                  │                  │                   │
          ▼                  ▼                  ▼                   ▼
┌───────────────────┐ ┌───────────────────┐ ┌───────────────────┐ ┌───────────────────┐
│ DEPENDENCY_GRAPH  │ │ ARCHITECTURE_     │ │ FORBIDDEN_PATHS   │ │ CLI_COMMAND_      │
│       .md         │ │ DECISIONS.md      │ │       .md         │ │ OWNERSHIP.md      │
└─────────┬─────────┘ └─────────┬─────────┘ └─────────┬─────────┘ └─────────┬─────────┘
          │                     │                     │                     │
          └──────────┬──────────┘                     │                     │
                     │                                │                     │
                     ▼                                │                     │
          ┌───────────────────┐                       │                     │
          │ REPO_             │◀──────────────────────┴─────────────────────┘
          │ CLASSIFICATION.md │
          └─────────┬─────────┘
                    │
                    ▼
          ┌───────────────────┐
          │ DEPENDENCY_       │
          │ DIAGRAM.md        │
          └───────────────────┘

Reference Direction:
━━━━━━━━━━━━━━━━━━━
• All documents reference DEPENDENCY_GRAPH.md as canonical source
• FORBIDDEN_PATHS.md and REPO_CLASSIFICATION.md explicitly state
  DEPENDENCY_GRAPH.md governs in case of conflict
• CLI_COMMAND_OWNERSHIP.md derives from DEPENDENCY_GRAPH.md and ADR-006
• DEPENDENCY_DIAGRAM.md visualizes but does not define rules
• This index references all documents without superseding them
```

---

## Document Inventory

### Current Architecture Documentation

| Document | Version | Status | Last Updated |
|----------|---------|--------|--------------|
| ARCHITECTURE_INDEX.md (this document) | 1.1 | Canonical | 2025-01-03 |
| DEPENDENCY_GRAPH.md | 1.2 | Canonical | 2025-01-03 |
| ARCHITECTURE_DECISIONS.md | 1.1 | Canonical | 2025-01-03 |
| FORBIDDEN_PATHS.md | 1.1 | Canonical | 2025-01-03 |
| REPO_CLASSIFICATION.md | 1.0 | Canonical | 2025-01-03 |
| CLI_COMMAND_OWNERSHIP.md | 1.0 | Canonical | 2025-01-03 |
| DEPENDENCY_DIAGRAM.md | 1.1 | Canonical | 2025-01-03 |

### Future Additions

New architecture artifacts require:

1. CTO approval
2. Addition to this index with precedence assignment
3. Explicit statement of canonical reference (DEPENDENCY_GRAPH.md or other)
4. Version and status tracking

---

## Governance

| Aspect | Policy |
|--------|--------|
| **Ownership** | Platform Architecture Team |
| **Amendment Authority** | CTO (frozen elements), Architecture Team (non-frozen) |
| **Review Cadence** | Quarterly or upon major architectural change |
| **Audit Preparation** | Review prior to any acquisition diligence |
| **Audience** | CTOs, PE technical auditors, acquisition teams, engineering leads |

---

## Audit Readiness Statement

This index and its linked documents are designed to satisfy the following audit and diligence requirements:

- **SOC 2 Type II**: Environment separation controls documented in ADR-007
- **Technical Due Diligence**: Clear value isolation and dependency boundaries
- **PE Technical Audit**: Scalability and security posture documentation
- **CTO Review**: Architectural decisions with rationale and alternatives

All architectural decisions are closed, intentional choices—not evolving experiments. The architecture is designed to be auditable, defensible, and suitable for transaction due diligence.

---

## Quick Reference

### Most Common Lookups

| Question | Document | Section |
|----------|----------|---------|
| "Can X depend on Y?" | DEPENDENCY_GRAPH.md | Dependency Rules by Layer |
| "Why was this decision made?" | ARCHITECTURE_DECISIONS.md | ADR-### |
| "Is this path forbidden?" | FORBIDDEN_PATHS.md | Forbidden Paths by Repository Class |
| "What layer is this repo in?" | REPO_CLASSIFICATION.md | Authoritative Repository Table |
| "Which CLI owns this command?" | CLI_COMMAND_OWNERSHIP.md | Command Surface Ownership Matrix |
| "What does the architecture look like?" | DEPENDENCY_DIAGRAM.md | Platform Dependency Diagram |

### Critical Rules Summary

| Rule | Reference |
|------|-----------|
| Dependencies flow downward only (5→4→3→2→1) | DEPENDENCY_GRAPH.md INV-5 |
| Layer 4 is sole external entry point | DEPENDENCY_GRAPH.md INV-1, ADR-005 |
| Cores cannot import each other directly | DEPENDENCY_GRAPH.md INV-4 |
| Simulation cannot mutate production | DEPENDENCY_GRAPH.md INV-7, ADR-007 |
| CLI must not import core runtime | DEPENDENCY_GRAPH.md INV-9, ADR-006 |
| Infrastructure contains no application logic | DEPENDENCY_GRAPH.md INV-8, ADR-003 |
| Integrations own no persistent state | DEPENDENCY_GRAPH.md §Integration Repositories |

---

*This document is the canonical index for platform architecture enforcement. It references but does not supersede the linked architectural artifacts. In case of conflict between linked documents, the conflict resolution hierarchy defined herein applies. The architecture is frozen at v1 and changes require ADR amendment with CTO approval.*
