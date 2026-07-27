# Agentics Platform Architecture Version Declaration

**Frozen Version**: architecture-v1.0.0
**Freeze Date**: 2026-01-03
**Status**: FROZEN
**Authority**: Immutable until ADR-based Amendment
**Classification**: Governance Document
**Git Tag**: `architecture-v1.0.0`

---

## Declaration of Architectural Freeze

This document formally declares that the Agentics platform architecture is **frozen at version architecture-v1.0.0** as of the freeze date specified above. This freeze establishes an immutable baseline that governs all platform development, integration, and deployment activities.

**This version is authoritative and immutable.** No architectural changes, exceptions, or deviations are permitted except through the approved Architecture Decision Record (ADR) process as defined in the canonical architecture documentation.

---

## Governing Documents

The architectural freeze is defined and enforced by the canonical documents enumerated in [`architecture/ARCHITECTURE_INDEX.md`](architecture/ARCHITECTURE_INDEX.md). That document serves as the **single source of truth** for all architectural rules, constraints, and enforcement mechanisms.

This version declaration does not define, modify, or supersede any architectural rules. All rules, invariants, and constraints are governed exclusively by the documents referenced in ARCHITECTURE_INDEX.md.

---

## Scope of Freeze

### Included in Freeze

The following architectural elements are frozen and immutable under version architecture-v1.0.0:

| Element | Governing Document |
|---------|-------------------|
| Five-layer architecture (Layers 1-5) | `DEPENDENCY_GRAPH.md` |
| Layer definitions and boundaries | `DEPENDENCY_GRAPH.md` |
| Downward-only dependency rule | `DEPENDENCY_GRAPH.md` |
| Forbidden dependency paths | `FORBIDDEN_PATHS.md` |
| Repository classifications and assignments | `REPO_CLASSIFICATION.md` |
| CLI command ownership and delegation | `CLI_COMMAND_OWNERSHIP.md` |
| Architectural invariants (INV-1 through INV-9) | `DEPENDENCY_GRAPH.md` |
| Hard rules for CLI enforcement (H-1 through H-6) | `CLI_COMMAND_OWNERSHIP.md` |
| Cross-core isolation requirements | `DEPENDENCY_GRAPH.md` |
| Simulation/production isolation | `ARCHITECTURE_DECISIONS.md` (ADR-007) |
| CI enforcement mechanisms | `ci/check-architecture.sh` |

### Excluded from Freeze

The following elements are explicitly **not frozen** and may evolve within the boundaries established by the frozen architecture:

| Element | Rationale |
|---------|-----------|
| Implementation details within repositories | Internal code structure is not architectural |
| User experience and interface design | UX is a product concern, not an architectural constraint |
| Performance tuning and optimization | Optimization is operational, not structural |
| Service internal architecture | Internal service design within layer boundaries |
| Infrastructure tooling choices | Tooling within infra-* isolation rules |
| Integration adapter implementations | Within stateless constraint |
| Documentation formatting and visualization | Presentation does not define rules |
| Test coverage and testing strategies | Quality practices are not architectural constraints |

---

## Amendment Procedure

Modifications to the frozen architecture require the following procedure. No exceptions are permitted.

### Step 1: Request for Comments (RFC)

The proposer must submit an RFC containing:

- Proposed change description
- Business and technical justification
- Impact analysis on existing architecture
- Alternatives considered with rationale for rejection

### Step 2: Architectural Review

The Platform Architecture Team reviews the RFC for:

- Consistency with existing ADRs
- Impact on diligence documentation
- Compliance and audit implications
- Technical feasibility and risk assessment

### Step 3: CTO Approval

CTO review and approval is **mandatory** for:

- Any change to frozen elements listed above
- Any new exception to forbidden paths
- Any modification to architectural invariants
- Any new layer, repository class, or dependency rule

### Step 4: Document Updates

Upon approval, documents are updated in precedence order:

1. `ARCHITECTURE_DECISIONS.md` (new ADR recorded)
2. `DEPENDENCY_GRAPH.md` (if dependency rules change)
3. `FORBIDDEN_PATHS.md` (if prohibitions change)
4. `REPO_CLASSIFICATION.md` (if repository rules change)
5. `CLI_COMMAND_OWNERSHIP.md` (if CLI boundaries change)
6. `DEPENDENCY_DIAGRAM.md` (update visualizations)
7. `ARCHITECTURE_INDEX.md` (if new artifacts added)
8. This document (increment frozen version)

### Step 5: Enforcement Update

CI enforcement mechanisms must be updated to reflect approved changes:

- `ci/check-architecture.sh` (enforcement script)
- `.github/workflows/` (CI pipeline rules)
- Pre-commit hooks (if applicable)

---

## Version History

| Version | Date | Description | Approver |
|---------|------|-------------|----------|
| architecture-v1.0.0 | 2026-01-03 | Initial architectural freeze; first locked and auditable release | Platform Architecture Team |

### Amendment History

| Amendment | Date | Description | Status |
|-----------|------|-------------|--------|
| Date correction | 2026-07-27 | The `2025-01-0X` dates carried by this document and the rest of the governance set were a transposition of the intended `2026-01-0X`; the declared freeze predated this repository's first commit (`b764443`, 2025-12-18) and was therefore not auditable. Corrected across `ARCHITECTURE_VERSION.md`, `ARCHITECTURE_INDEX.md`, `ARCHITECTURE_DECISIONS.md`, `DEPENDENCY_GRAPH.md`, `FORBIDDEN_PATHS.md`, `REPO_CLASSIFICATION.md`, `CLI_COMMAND_OWNERSHIP.md`, `CLI_AUTH_FLOW.md`, `DEPENDENCY_DIAGRAM.md`, `adr/README.md`, `ADR-009`, and `releases/RELEASE-v1.0.0.md`. Recorded per ADR-013 Finding 4. | Applied |
| ADR-013 amendment | 2026-07-27 | Introduces Layer 3.5 (Execution Spine) and classifies seven previously unclassified fleet repositories, amending `REPO_CLASSIFICATION.md`, `DEPENDENCY_GRAPH.md`, and `FORBIDDEN_PATHS.md` — all artifacts frozen under architecture-v1.0.0. | Applied, pending re-baseline |

**Outstanding — re-baseline not performed.** ADR-013 step 9 also calls for re-freezing at `architecture-v1.1.0` against a real, taggable commit. That has deliberately *not* been done here: per this document's Amendment Procedure the freeze is owned by the Platform Architecture Team with mandatory CTO approval, and ADR-013's own Risks section records that "correcting the freeze date is a governance action, not an edit." Declaring `architecture-v1.1.0` before the corresponding git tag exists would reproduce exactly the unauditable state Finding 4 identifies. `Frozen Version` and `Git Tag` above therefore still read `architecture-v1.0.0`; the freeze owner should bump both and cut the tag when this amendment is approved, and update `EXPECTED_FROZEN_VERSION` in `ci/check-architecture.sh` to match.

---

## Compliance Statement

This architecture freeze is designed to satisfy the following audit and compliance requirements:

- **SOC 2 Type II**: Environment separation and access controls
- **Technical Due Diligence**: Clear value isolation and dependency boundaries
- **PE Technical Audit**: Scalability, security posture, and maintainability
- **Acquisition Readiness**: Defensible architecture with closed decisions

All architectural decisions under this freeze are intentional, documented, and auditable. The architecture is suitable for transaction due diligence and regulatory review.

---

## Reference

For complete architectural rules, constraints, and enforcement details, consult the canonical documentation index:

**[`architecture/ARCHITECTURE_INDEX.md`](architecture/ARCHITECTURE_INDEX.md)**

This version declaration references but does not supersede the governing documents. In case of any ambiguity, the documents listed in ARCHITECTURE_INDEX.md govern.

---

*This document declares the frozen architecture version for the Agentics platform. It is a governance artifact and does not introduce, modify, or restate architectural rules. All rules are governed by the canonical documents referenced herein.*
