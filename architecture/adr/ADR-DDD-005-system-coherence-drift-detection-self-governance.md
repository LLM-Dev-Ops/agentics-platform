# ADR / DDD #005: System Coherence, Drift Detection, and Self-Governance

**Status**: Accepted
**Date**: 2025-01-29
**Category**: Conceptual Architecture / Domain-Driven Design
**Classification**: Governance Framework
**Relates to**: ADR/DDD #001 (CLI Semantics), ADR/DDD #002 (Executable Governance), ADR/DDD #003 (CLI Control Plane DDD), ADR/DDD #004 (Enterprise Integration Architecture)

---

## Positioning Statement

> **Agentics does not self-correct decisions — it preserves coherence so humans can govern change safely.**

This principle is foundational. The platform exists to support enterprise decision-making, not to replace it. Self-management in Agentics refers to structural maintenance and observability — never to autonomous correction, silent remediation, or unsupervised mutation of system state.

---

## Context

The Agentics platform has established:

- **Governed CLI semantics and synthesis rules** (ADR/DDD #001): The CLI operates under explicit governance constraints, with synthesis occurring only within sanctioned boundaries.

- **Executable governance via schema, middleware, and CI** (ADR/DDD #002): Governance is not aspirational documentation but enforced through schema validation, middleware gates, and continuous integration checks.

- **DDD framing for the CLI control plane** (ADR/DDD #003): The control plane is modeled as a domain with bounded contexts, aggregates, and invariants that preserve structural integrity.

- **Enterprise integration and memory architecture** (ADR/DDD #004): Ruvector serves as the memory substrate, integrations provide external connectivity, and the ERP Surface declares intent contracts for enterprise system coordination.

What remains undefined is the conceptual model for how the platform:

1. **Detects incoherence** across simulations, integrations, ERP Surface contracts, and memory over time
2. **Preserves structural consistency** as the system accumulates proposals, decisions, and artifacts
3. **Supports governed self-management** without delegating judgment to automated processes

This ADR/DDD establishes that model.

---

## Domain Definitions

### 1. System Coherence Domain

**What coherence means in Agentics:**

Coherence is the property whereby all components of the platform — simulations, integrations, memory, proposals, artifacts, and governance rules — form a mutually consistent whole. A coherent system is one where:

- No integration contradicts a declared ERP Surface contract
- No simulation produces artifacts that violate governance invariants
- No memory state asserts facts that conflict with observable system behavior
- No proposal assumes capabilities that do not exist or dependencies that are forbidden

**Why coherence is architectural, not behavioral:**

Coherence is not measured by runtime behavior in isolation. A system may execute without errors yet be incoherent — for example, when a simulation plan references an integration that no longer exists, or when memory contains stale references to deprecated capabilities.

Coherence is a property of the system's structural relationships over time, not a snapshot of execution success. It is verified through comparison, lineage analysis, and invariant checking — not through operational metrics alone.

**Difference between local correctness and system coherence:**

Local correctness means a single component operates according to its specification. System coherence means all components, when considered together across their evolution, remain mutually consistent.

A component may be locally correct but contribute to system incoherence. For example:

- An integration adapter that correctly implements a deprecated contract
- A simulation that correctly executes a scenario based on outdated ERP Surface definitions
- A governance rule that correctly enforces a policy superseded by a newer ADR

Coherence requires evaluating the system as a temporal whole, not merely validating individual components in isolation.

---

### 2. Drift Domain

**What constitutes drift:**

Drift is the gradual divergence between intended system state and actual system state. In Agentics, drift manifests in four primary forms:

| Drift Type | Description |
|------------|-------------|
| **Semantic Drift** | The meaning attributed to contracts, capabilities, or artifacts changes without explicit acknowledgment. Terms acquire informal interpretations that diverge from documented definitions. |
| **Structural Drift** | The actual relationships between components diverge from the declared architecture. Dependencies form that are not sanctioned; boundaries become porous. |
| **Lineage Drift** | The historical record of how artifacts were derived becomes inconsistent, incomplete, or detached from current state. Provenance is lost or corrupted. |
| **Integration Drift** | External system connections evolve in ways that invalidate assumptions embedded in ERP Surface contracts or simulation scenarios. The integration surface no longer matches reality. |

**Why drift is inevitable in large systems:**

Drift is not a failure of discipline; it is an emergent property of complex systems operating over time. Contributors change. External systems evolve. Requirements shift. Documentation ages. Interpretations diverge.

The question is not whether drift will occur, but whether the system provides the means to detect it.

**Why detection matters more than prevention:**

Prevention assumes perfect foresight and complete control — neither of which exists in enterprise contexts. Drift will occur despite best intentions. What distinguishes a well-governed system is not the absence of drift but the presence of mechanisms to:

1. Detect drift when it occurs
2. Quantify the scope of divergence
3. Present findings to human decision-makers
4. Support remediation through governed workflows

The platform does not prevent drift through restriction; it preserves the ability to observe drift through architectural transparency.

---

### 3. Governed Self-Management Domain

**What "self-management" means in Agentics:**

Self-management refers to the platform's capacity to maintain its own structural hygiene without requiring constant human intervention for routine operations. This includes:

- Maintaining memory consistency as artifacts are created and retired
- Tracking lineage as simulations produce outputs and exports generate configurations
- Preserving references as components are versioned and deprecated
- Recording proposals, decisions, and their outcomes for future comparison

**What "self-management" does NOT mean:**

Self-management is not automation, autonomy, or self-correction.

| Term | Meaning in Agentics | What It Is NOT |
|------|---------------------|----------------|
| **Self-Governance** | The system maintains observable state and presents findings to humans for decision | The system making decisions on behalf of humans |
| **Automation** | Routine execution of human-defined workflows | Unsupervised decision-making or policy creation |
| **Autonomy** | (Not applicable) | Independent action without human oversight |

**Clear distinction: Self-governance vs. Automation vs. Autonomy**

- **Self-governance**: The system governs its own internal consistency, ensuring that what it reports is accurate and what it stores is coherent. It does not govern enterprise decisions.

- **Automation**: The system may automate execution of approved workflows, but the approval is human, the workflow is human-defined, and the outcomes are human-reviewed.

- **Autonomy**: Agentics explicitly rejects autonomy. The platform never acts independently to modify enterprise state, correct perceived errors, or optimize outcomes without explicit human authorization.

**Why Agentics must remain explainable and auditable:**

The platform serves enterprise contexts where accountability is non-negotiable. Every action taken, every artifact produced, every state change recorded must be:

- Traceable to a human-authorized trigger
- Explainable in terms of documented governance rules
- Auditable by external parties without platform-specific expertise
- Reproducible given the same inputs and governance context

Opacity is unacceptable. Magic is forbidden. The system must be legible to its operators, auditors, and the executives who bear responsibility for its outputs.

---

### 4. Memory-Anchored Reality (Ruvector)

**Conceptual role of memory in detecting drift:**

Ruvector serves as the authoritative memory substrate for the Agentics platform. Memory in this context is not caching or optimization — it is the system's record of truth.

When drift occurs, it manifests as divergence between:

- Current system state (what exists now)
- Memory state (what was recorded as truth)
- Governance expectations (what should exist according to ADRs and invariants)

Memory enables drift detection by preserving historical context. Without memory, each moment would be evaluated in isolation, making drift invisible.

**Why lineage enables comparison over time:**

Lineage is the chain of derivation that connects artifacts to their sources. In Agentics:

- Simulations derive from intent declarations and ERP Surface contracts
- Exports derive from validated simulation outputs
- Deployments derive from approved exports
- Decisions derive from proposals that reference prior decisions

Lineage enables the platform to answer questions such as:

- "What assumptions was this simulation based on?"
- "Which ERP Surface version did this export target?"
- "What governance rules were in effect when this proposal was approved?"

Without lineage, drift detection would require complete system re-evaluation. With lineage, drift detection becomes comparative analysis of known derivation paths.

**Why replay and diffing are architectural primitives:**

The ability to replay and diff are not features to be implemented later — they are architectural primitives that must be preserved from the beginning.

- **Replay**: Given a historical state and a sequence of operations, the system can reconstruct what the state should have become. Divergence between replayed state and actual state indicates drift.

- **Diffing**: Given two states (current vs. historical, or expected vs. actual), the system can produce a structured comparison that identifies specific points of divergence.

These capabilities require that:

- Memory stores sufficient context for reconstruction
- Operations are recorded with enough fidelity for replay
- State representations support meaningful comparison

If these capabilities are not architectural primitives, they cannot be reliably added later without risking the very drift they are meant to detect.

---

### 5. Human Oversight Boundary

**Where humans remain mandatory:**

The following decisions must always involve human judgment and cannot be delegated to automated processes:

| Decision Category | Why Human Oversight Is Required |
|-------------------|--------------------------------|
| **Enterprise policy changes** | Policy reflects organizational values and risk tolerance that cannot be algorithmically determined |
| **Governance rule modifications** | ADRs represent closed architectural decisions requiring explicit human approval |
| **Production deployment authorization** | Deployment affects live systems with real-world consequences |
| **Exception approval** | Exceptions require judgment about context, precedent, and unintended consequences |
| **Drift remediation strategy** | Correcting drift involves trade-offs that require human weighing of priorities |
| **ERP Surface contract evolution** | Enterprise system integration decisions have organizational implications beyond technical correctness |

**Why executive and operator judgment is preserved:**

The platform is designed to enhance human decision-making, not to replace it. Enhancement means:

- Presenting relevant information clearly
- Highlighting divergence and potential issues
- Providing historical context for current decisions
- Tracking the consequences of past decisions
- Offering structured options without mandating choices

Judgment remains with the humans who bear responsibility. The platform provides the substrate for informed judgment; it does not substitute for judgment itself.

**How the system supports humans without replacing them:**

The platform supports human oversight through:

1. **Observability**: Making system state visible and comprehensible
2. **Comparison**: Enabling before/after and expected/actual analysis
3. **Traceability**: Connecting current state to historical decisions
4. **Alerting**: Surfacing potential issues for human attention
5. **Structured workflows**: Guiding human decisions through governed processes
6. **Audit trails**: Recording what happened, when, and by whose authorization

At no point does the platform decide what should happen. It provides the information and structure for humans to decide.

---

## System-Level Invariants

The following invariants must hold across all operations, components, and time horizons. These are non-negotiable architectural truths that cannot be violated by any feature, optimization, or operational convenience.

### INV-C1: Decision Traceability

> Every enterprise decision must remain traceable over time.

No decision may exist without an auditable record of:
- When it was made
- By whose authorization
- Based on what information
- Under what governance rules
- With what intended consequences

Decisions that cannot be traced are architecturally invalid.

### INV-C2: Historical Context Requirement

> No integration or ERP proposal exists without historical context.

Every proposal referencing external systems must include:
- The ERP Surface contract version in effect at proposal time
- The known state of relevant integrations at proposal time
- The lineage connecting the proposal to prior decisions

Proposals that lack historical context cannot be evaluated for coherence.

### INV-C3: Drift Detection Without Silent Correction

> Drift may be detected but never silently corrected.

When drift is detected, the system must:
- Record the detection with full context
- Present the finding to authorized human operators
- Await human decision before any remediation

The system must never:
- Automatically correct detected drift
- Suppress drift findings to avoid human attention
- Modify state to align with expectations without authorization

### INV-C4: Memory Authoritativeness

> Memory is authoritative; projections are derived.

Ruvector memory represents the system's record of truth. All other views — dashboards, reports, summaries, caches — are projections derived from memory.

When projections diverge from memory:
- Memory governs
- Projections must be regenerated
- The divergence itself must be recorded

Projections may never override memory.

### INV-C5: Governance Bypass Prohibition

> Self-management never bypasses governance.

No self-management operation may:
- Modify state in ways that would require human approval if done directly
- Create, modify, or delete governance rules
- Authorize exceptions to architectural invariants
- Suppress governance checks for convenience or performance

Self-management operates within governance, not around it.

---

## Conceptual Lifecycle

This section describes — in prose only — how coherence and drift manifest across the system's temporal evolution.

### Accumulation Phase

As the platform operates over time, artifacts accumulate:

- Simulations are planned, executed, and their results stored
- Integrations are configured, tested, and their behaviors recorded
- ERP Surface contracts are declared, versioned, and referenced
- Proposals are submitted, evaluated, approved or rejected, and their outcomes documented
- Memory records grow, capturing the expanding history of system activity

This accumulation is not merely data growth; it is the construction of a temporal record that enables future comparison. Each artifact carries lineage that connects it to its origins and the governance context of its creation.

### Comparison Across Time

Memory enables the system to compare states across time:

- Current configuration versus configuration at a prior point
- Actual integration behavior versus declared ERP Surface contracts
- Simulation assumptions versus current system capabilities
- Proposal expectations versus observed outcomes

These comparisons are not automated judgments but inputs for human review. The system surfaces differences; humans interpret significance.

### Drift Observability

When comparison reveals divergence, drift becomes observable:

- A simulation references an ERP capability that no longer exists
- An integration behaves differently than its declared contract specifies
- A governance rule references a component that has been deprecated
- Memory contains references to artifacts that have been removed

Observability means the divergence is not hidden. It is recorded, categorized, and made available for review. The system does not evaluate whether drift is acceptable — that is a human judgment.

### Human Alerting and Review

When drift is detected, the system alerts human operators through governed channels:

- Notifications are recorded in audit trails
- Alerts are categorized by severity and scope
- Context is provided to enable informed review
- No action is taken until human authorization

Operators review the findings, assess the implications, and decide on appropriate response. The platform provides the information; operators provide the judgment.

### Governed Remediation

When humans decide to remediate drift, they do so through governed workflows:

- Remediation plans are documented before execution
- Approvals are recorded with full authorization context
- Changes are executed through the same governance gates as any other modification
- Outcomes are captured in memory for future comparison

Remediation is not a special mode that bypasses governance. It is a governed operation like any other, subject to the same traceability and oversight requirements.

---

## Relationship to Prior ADRs

This ADR/DDD is explicitly additive. It does not rewrite, replace, or contradict prior decisions.

### ADR/DDD #001: CLI Semantics and Synthesis Rules

ADR/DDD #001 establishes that CLI operations occur within governed boundaries. ADR/DDD #005 extends this by defining how the coherence of those operations is assessed over time. Drift detection applies to CLI-initiated state changes just as it applies to all system modifications.

### ADR/DDD #002: Executable Governance

ADR/DDD #002 establishes that governance is enforced through schema, middleware, and CI. ADR/DDD #005 complements this by defining the temporal dimension of governance — how governance rules themselves are tracked over time and how compliance is assessed against the governance context that was in effect when decisions were made.

### ADR/DDD #003: CLI Control Plane DDD

ADR/DDD #003 models the control plane as a domain with bounded contexts and invariants. ADR/DDD #005 extends this by introducing coherence as a cross-cutting concern that spans bounded contexts. Drift may occur within a context or across context boundaries; both must be observable.

### ADR/DDD #004: Enterprise Integration Architecture

ADR/DDD #004 establishes Ruvector as memory substrate, integrations as external connectors, and ERP Surface as intent declaration. ADR/DDD #005 builds on this foundation by defining:

- How memory enables drift detection through historical comparison
- How integration drift manifests when external systems evolve
- How ERP Surface contracts serve as reference points for coherence assessment

---

## Consequences

### For System Design

- **Lineage must be first-class**: Every artifact must carry derivation information sufficient for historical comparison.
- **Memory must be durable**: Ruvector data structures must support temporal queries and comparison operations.
- **Observation must be non-destructive**: Drift detection must not modify the state it is assessing.

### For Operations

- **Drift reports require human review**: Automated drift detection must surface to human operators, not trigger automated remediation.
- **Remediation follows governance**: Correcting drift is a governed operation requiring the same approvals as any modification.
- **Historical context is operational data**: Past state is not archival storage; it is active reference material for current decisions.

### For Governance

- **Governance rules are versioned**: ADRs and invariants must be tracked with the same temporal precision as system artifacts.
- **Compliance is contextual**: Artifacts are evaluated against the governance rules in effect when they were created, not only current rules.
- **Evolution is explicit**: Changes to governance require the same documentation and approval as any architectural modification.

### For Diligence

- **Auditors can assess coherence**: External parties can evaluate whether the system maintains consistency over time.
- **Drift history is auditable**: Past drift detections and their remediation are part of the audit record.
- **Self-management is transparent**: The boundary between automated maintenance and human decision is clear and documented.

---

## Explicit Non-Goals

The following are explicitly outside the scope of this ADR/DDD:

### Non-Goal: Automated Drift Correction

This ADR does not define or authorize any mechanism for the platform to automatically correct detected drift. All remediation requires human authorization.

### Non-Goal: Algorithm Specification

This ADR does not specify algorithms, heuristics, or computational methods for drift detection. It defines the conceptual architecture; implementation specifics are out of scope.

### Non-Goal: Schema or API Definition

This ADR does not define database schemas, API contracts, or data structures. Those belong to implementation artifacts governed by the architecture this document describes.

### Non-Goal: New CLI Commands

This ADR does not introduce CLI commands. CLI surface is governed by ADR/DDD #001 and CLI_COMMAND_OWNERSHIP.md.

### Non-Goal: Middleware or Job Definitions

This ADR does not define middleware components, background jobs, or execution pipelines. Those are implementation details.

### Non-Goal: Autonomous Optimization

This ADR explicitly rejects any form of autonomous optimization where the platform modifies its behavior or state to achieve outcomes without human direction.

---

## Anti-Patterns

The following patterns are explicitly prohibited as they violate the principles established in this ADR/DDD.

### Anti-Pattern: Silent Remediation

**Description**: The system detects drift and automatically corrects it without human notification or approval.

**Why it is dangerous**: Silent remediation destroys auditability. If the system can modify state without human authorization, there is no reliable audit trail. Past decisions may be invalidated without any record of when or why. Enterprise accountability requires that every state change be traceable to human decision.

**Correct approach**: Detect drift, record the detection, present findings to humans, await authorization before any modification.

### Anti-Pattern: Drift Suppression

**Description**: The system detects drift but suppresses the finding to avoid alerting operators, perhaps because drift is deemed minor or because alerts are frequent.

**Why it is dangerous**: Suppression creates hidden divergence. Minor drift accumulates into major incoherence. Frequent alerts indicate a deeper issue that must be addressed, not masked. Operators cannot govern what they cannot see.

**Correct approach**: Surface all detected drift with appropriate categorization. If alerts are too frequent, that is a signal to address root causes, not to suppress symptoms.

### Anti-Pattern: Self-Optimizing Configuration

**Description**: The system adjusts its own configuration to optimize performance, cost, or other metrics without explicit human authorization.

**Why it is dangerous**: Self-optimization is a form of autonomous decision-making. Configuration changes affect system behavior in ways that may have enterprise implications. Optimization targets encode value judgments that belong to humans, not systems.

**Correct approach**: The system may surface optimization opportunities with analysis and recommendations. Humans decide whether to implement optimizations.

### Anti-Pattern: Governance Bypass for Efficiency

**Description**: Self-management operations bypass governance checks because they are routine, internal, or performance-sensitive.

**Why it is dangerous**: Governance exists precisely for operations that might otherwise occur without oversight. Routine operations can accumulate to significant state changes. Internal operations still affect the state that humans rely upon. Performance concerns do not override accountability requirements.

**Correct approach**: Self-management operates within governance. If governance is too burdensome for necessary operations, governance must be evolved through the ADR process, not bypassed.

### Anti-Pattern: Predictive Correction

**Description**: The system predicts future drift and preemptively corrects state to prevent predicted divergence from occurring.

**Why it is dangerous**: Predictions are not facts. Preemptive correction based on prediction means modifying reality to match a model. If the prediction is wrong, the correction creates new drift. Enterprise systems must be grounded in observed reality, not speculative futures.

**Correct approach**: Predictions may inform human planning. Corrections respond to observed divergence, not predicted divergence.

### Anti-Pattern: Delegated Authority Accumulation

**Description**: Over time, the platform accumulates implicit authority to make increasingly significant decisions through precedent and convenience.

**Why it is dangerous**: Authority creep erodes the human oversight boundary. What begins as minor automation expands to consequential decision-making. By the time the scope is noticed, the pattern is entrenched and difficult to reverse.

**Correct approach**: Authority boundaries are explicit and static. Expanding self-management scope requires the same governance process as any architectural change.

---

## Conceptual Architecture Description

### Domains and Responsibilities

The conceptual architecture comprises five interrelated domains, each with distinct responsibilities:

**System Coherence Domain**
- Responsibility: Defining what coherence means and how it is assessed
- Concern: The mutual consistency of all system components over time
- Boundary: Does not execute corrections; only defines coherence criteria

**Drift Domain**
- Responsibility: Categorizing types of drift and their manifestations
- Concern: The divergence between intended and actual state
- Boundary: Does not evaluate severity; only identifies and categorizes divergence

**Governed Self-Management Domain**
- Responsibility: Maintaining structural hygiene within governance constraints
- Concern: Routine operations that preserve system integrity
- Boundary: Never exceeds the authority explicitly granted; never bypasses governance

**Memory-Anchored Reality Domain (Ruvector)**
- Responsibility: Serving as the authoritative record of system truth
- Concern: Historical state, lineage, and temporal comparison
- Boundary: Memory is read for comparison; modifications follow governance

**Human Oversight Domain**
- Responsibility: Ensuring human judgment governs consequential decisions
- Concern: The boundary between system capability and human authority
- Boundary: All decisions that affect enterprise outcomes require human authorization

### Separation of Concerns

Each domain operates independently yet interacts through defined channels:

- **Coherence informs Drift**: Coherence criteria define what constitutes drift
- **Drift surfaces to Oversight**: Detected drift is presented to humans for judgment
- **Oversight authorizes Self-Management**: Human decisions enable governed operations
- **Self-Management operates on Memory**: Authorized operations modify the authoritative record
- **Memory enables Coherence**: Historical state supports coherence assessment

At no point does information flow bypass human oversight for consequential decisions. The architecture ensures that detection, analysis, and presentation are separated from authorization and execution.

### Temporal Dimension

Unlike typical architectural diagrams that depict spatial relationships, this architecture has an essential temporal dimension:

- **Past**: Memory preserves what was decided, what existed, and under what governance
- **Present**: Current state is compared against past state and governance expectations
- **Future**: Proposals describe intended future state; they do not predict or preempt

The architecture treats time as a first-class concern. State is not merely current; it is historical. Decisions are not merely effective; they are contextual to their moment. Coherence is not merely structural; it is temporal.

---

## Summary for Diligence Review

| Question | Answer |
|----------|--------|
| Does the platform make enterprise decisions autonomously? | **No.** All consequential decisions require human authorization. |
| Can the platform correct detected problems automatically? | **No.** Drift detection surfaces findings to humans; remediation requires approval. |
| Is there a clear boundary between system capability and human authority? | **Yes.** The Human Oversight Domain explicitly defines where human judgment is mandatory. |
| Can auditors assess system coherence over time? | **Yes.** Memory-anchored reality and lineage support temporal audit. |
| Does self-management bypass governance? | **No.** Self-management operates within governance constraints, never around them. |
| Is drift hidden or suppressed? | **No.** All detected drift is recorded and surfaced for human review. |
| Can the platform's behavior be explained and traced? | **Yes.** Every action is traceable to human authorization and documented governance rules. |

---

## Document Governance

| Aspect | Policy |
|--------|--------|
| **Ownership** | Platform Architecture Team |
| **Amendment Authority** | CTO approval required for invariant changes |
| **Review Cadence** | Upon significant architectural change or quarterly review |
| **Audit Preparation** | Review prior to any transaction due diligence |
| **Audience** | CTOs, PE technical auditors, acquisition teams, enterprise architects |

---

*This ADR/DDD establishes the conceptual architecture for system coherence, drift detection, and self-governance in the Agentics platform. It is explicitly additive to prior ADRs and introduces no implementation artifacts, CLI commands, schemas, or automated behaviors. The architecture ensures that Agentics serves as a substrate for human decision-making, not a replacement for it. Coherence is preserved so humans can govern change safely.*
