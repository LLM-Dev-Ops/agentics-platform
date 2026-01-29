# ADR / DDD #006: UI Control Surface Architecture Aligned with Claude-Flow and Claude-Code

**Status**: Accepted
**Date**: 2025-01-29
**Category**: Conceptual Architecture / Domain-Driven Design
**Classification**: Governance Framework
**Relates to**: ADR/DDD #001 (CLI Semantics), ADR/DDD #002 (Executable Governance), ADR/DDD #003 (CLI Control Plane DDD), ADR/DDD #004 (Enterprise Integration Architecture), ADR/DDD #005 (System Coherence and Self-Governance)

---

## Positioning Statement

> **The Agentics UI is a governed control surface that stages intent — not a conversational interface that guesses intent.**

This principle is foundational. The UI exists as an alternative surface for the same governance model that governs the CLI. It provides structure and visibility, not flexibility and inference. Users interact with the system through explicit, typed declarations of intent — never through ambiguous natural language that requires interpretation.

The UI is to claude-flow as the CLI is to claude-code: a control mechanism that orchestrates governed actions, not a chat window that negotiates meaning.

---

## Context

The Agentics platform has established:

- **Governed CLI semantics and synthesis rules** (ADR/DDD #001): The CLI operates under explicit governance constraints, with synthesis occurring only within sanctioned boundaries.

- **Executable governance via schema, middleware, and CI** (ADR/DDD #002): Governance is not aspirational documentation but enforced through schema validation, middleware gates, and continuous integration checks.

- **DDD framing for the CLI control plane** (ADR/DDD #003): The control plane is modeled as a domain with bounded contexts, aggregates, and invariants that preserve structural integrity.

- **Enterprise integration and memory architecture** (ADR/DDD #004): Ruvector serves as the memory substrate, integrations provide external connectivity, and the ERP Surface declares intent contracts for enterprise system coordination.

- **System coherence and self-governance** (ADR/DDD #005): The platform preserves structural coherence, detects drift, and surfaces findings for human decision — never autonomously correcting state.

What remains undefined is the conceptual model for how users interact with the system through a visual interface in a manner that:

1. **Preserves governance integrity**: The same rules that govern CLI operations govern UI operations
2. **Maintains mental model parity**: Users understand that UI actions have the same weight and consequences as CLI commands
3. **Enforces explicit intent**: The UI requires structured, typed declarations rather than conversational approximations
4. **Supports deliberate decision-making**: Users are guided through governance-aware workflows, not expedited through shortcuts

This ADR/DDD establishes that interaction model.

---

## Domain Definitions

### 1. UI as Control Surface (Not a Chat Interface)

**What "control surface" means in Agentics:**

A control surface is an interface through which operators issue explicit commands to a governed system. In aviation, the control surface is the physical mechanism that translates pilot intent into aircraft behavior. In Agentics, the UI control surface translates user intent into governed platform operations.

The control surface metaphor emphasizes:

- **Precision over convenience**: Inputs must be exact and unambiguous
- **Consequences over responses**: Actions produce system state changes, not conversational replies
- **Structure over flexibility**: The interface constrains input to valid operations

**Why the UI is a typed command orchestrator:**

The UI presents users with structured forms, selections, and confirmations that map directly to typed command semantics. When a user configures a simulation through the UI, they are composing the equivalent of a CLI command with explicit parameters. The UI validates these parameters against the same schemas that govern CLI input.

This orchestration model ensures:

- Every UI action has a CLI equivalent
- No UI action can express intent that the CLI cannot express
- The UI cannot create "UI-only" operations that bypass the command model

**Why conversational ambiguity is forbidden:**

Conversational interfaces invite interpretation. When a user types "run my simulation," the system must infer which simulation, with what parameters, under what governance context. This inference introduces risk:

- Misinterpretation of user intent
- Inconsistent behavior across sessions
- Loss of auditability (what did the user actually mean?)
- Governance bypass through vague phrasing

The Agentics UI forbids conversational input for governed operations. Every action requires explicit, structured specification. The system never guesses what the user intended.

**UI as an intent declaration layer:**

The UI serves as a structured layer for declaring intent before execution. Users do not "ask" the system to do something; they "declare" what operation they intend, with what parameters, and the system either accepts or rejects the declaration based on governance rules.

This declaration model:

- Makes intent explicit before any action occurs
- Enables governance validation before execution
- Provides clear rejection with specific reasons when validation fails
- Creates auditable records of what the user intended, not what the system inferred

---

### 2. Intent Domain

**The three categories of intent:**

In Agentics, user intent falls into three distinct categories, each with different governance implications:

| Intent Type | Definition | Governance Requirement |
|-------------|------------|----------------------|
| **Observation Intent** | The user wishes to view, query, or understand current system state without modification | Minimal governance; read operations subject to access control only |
| **Synthesis Intent** | The user wishes to generate artifacts, plans, or proposals that do not yet modify committed state | Moderate governance; synthesis occurs within declared boundaries and produces reviewable artifacts |
| **Commitment Intent** | The user wishes to modify committed state, approve proposals, or execute actions with production consequences | Maximum governance; requires explicit approval workflows and human confirmation |

**Why intent must be explicit before action:**

The distinction between observing, synthesizing, and committing represents fundamentally different risk profiles. A user who wishes to "see what a deployment would look like" (observation/synthesis) has different intent than a user who wishes to "deploy to production" (commitment).

The UI must never conflate these categories. An observation cannot silently become a commitment. A synthesis cannot automatically execute. The user must explicitly transition between intent categories, and each transition is a governance checkpoint.

**Observation intent in detail:**

Observation intent encompasses all read operations: viewing simulations, querying memory, inspecting artifacts, reviewing proposals. These operations do not modify state, though they are still subject to:

- Access control (users see only what they are authorized to see)
- Audit logging (observations are recorded for compliance)
- Rate limiting (excessive observation may indicate automated scraping)

The UI presents observation operations distinctly from modification operations. Users should always know when they are observing versus when they are preparing to modify.

**Synthesis intent in detail:**

Synthesis intent encompasses generative operations that produce artifacts without committing them: planning simulations, drafting proposals, generating configurations, previewing exports. These operations:

- Create artifacts that exist in draft or proposed state
- Do not modify production systems or committed state
- Produce outputs that require explicit approval before commitment
- Operate within boundaries declared by governance rules

Synthesis is where the platform's generative capabilities operate. But synthesis is always bounded — the boundaries of what may be synthesized are governance constraints, not user preferences.

**Commitment intent in detail:**

Commitment intent encompasses all operations that modify committed state: approving proposals, executing simulations against live data, deploying configurations, modifying governance rules. These operations:

- Produce irreversible or consequential state changes
- Require explicit human confirmation
- Are subject to the full governance workflow (validation, approval, audit)
- Cannot be initiated through casual or ambiguous interaction

The UI must make commitment operations visibly distinct and require deliberate confirmation. A user should never accidentally commit when they intended only to observe or synthesize.

---

### 3. Claude-Flow Mental Model Parity

**How claude-flow stages actions:**

Claude-flow operates as an orchestration layer that stages actions for execution. It does not execute immediately upon receiving input; instead, it:

1. **Parses intent**: Understanding what the user has requested
2. **Validates against governance**: Ensuring the request complies with constraints
3. **Plans execution**: Determining the sequence of operations required
4. **Presents the plan for review**: Showing the user what will happen
5. **Awaits explicit approval**: Requiring confirmation before execution
6. **Executes with full audit**: Recording every action and its outcome
7. **Presents results for inspection**: Enabling review of what occurred

This staging model ensures that users understand consequences before they occur and that the system maintains a complete record of intent, plan, and execution.

**Why UI actions must map to the same stages:**

The UI is not an alternative to claude-flow; it is a visual representation of the same staging model. Every UI workflow must map to these stages:

- Configuration forms map to intent parsing
- Validation feedback maps to governance checking
- Preview screens map to plan presentation
- Confirmation dialogs map to approval gates
- Progress indicators map to execution tracking
- Result displays map to outcome inspection

If the UI skips a stage that claude-flow would require, governance parity is broken. The UI must be as deliberate as the CLI.

**How the UI mirrors plan → review → commit → inspect:**

The fundamental interaction pattern for any non-trivial operation in the UI is:

1. **Plan**: The user constructs a complete specification of their intended operation through structured forms. This is not a rough sketch; it is a fully specified declaration.

2. **Review**: The system presents what will happen if the operation proceeds. This includes affected resources, governance rules that apply, potential consequences, and any warnings. The user reviews this presentation.

3. **Commit**: The user explicitly confirms that the operation should proceed. This is not a casual "OK" button; it is a deliberate acknowledgment of consequences.

4. **Inspect**: After execution, the user can examine exactly what occurred, compare expected outcomes to actual outcomes, and understand any divergence.

This pattern applies whether the user is running a simulation, approving a proposal, or modifying configuration. The stages may vary in complexity, but the structure remains.

---

### 4. Governance Preservation

**Why the UI must never bypass ADR-defined rules:**

ADRs represent closed architectural decisions. They are not guidelines or best practices; they are rules that define what the platform may and may not do. The CLI enforces these rules through schema validation and middleware. The UI must enforce the same rules through the same mechanisms.

If the UI could bypass an ADR-defined rule, it would create a governance hole:

- Users would prefer the UI for operations the CLI would reject
- Audit trails would diverge between entry points
- The platform would have inconsistent behavior depending on how it was accessed

This is unacceptable. The UI is a surface over the same governed control plane that the CLI accesses.

**Why the UI cannot soften or auto-correct invalid inputs:**

When a user provides invalid input to the CLI, the CLI rejects it with an error. The UI must do the same. The UI may provide more context about why input is invalid, but it must never:

- Silently correct invalid values to valid ones
- Suggest alternatives and apply them without explicit selection
- Accept partial input and infer the remainder
- Allow operations to proceed with warnings that can be dismissed

"Helpful" autocorrection destroys auditability. If the system modified the user's input, the audit trail shows what the system did, not what the user intended. This creates liability and compliance risk.

**Why the UI must surface governance constraints, not hide them:**

Governance constraints exist to protect the enterprise. The UI must make these constraints visible:

- If an operation is forbidden, the UI explains why
- If an operation requires approval, the UI shows who must approve and under what policy
- If an operation has preconditions, the UI shows which preconditions are unmet
- If an operation has rate limits or quotas, the UI shows current usage against limits

The UI does not hide complexity to improve user experience. Hiding complexity means hiding consequences. In enterprise contexts, users need to understand constraints, not be shielded from them.

---

### 5. Human-in-the-Loop Boundary

**Where humans must confirm or approve:**

The following operations require explicit human confirmation through the UI, regardless of user role or context:

| Operation Category | Why Confirmation Required |
|-------------------|--------------------------|
| **Production deployment** | Irreversible changes to live systems with real-world impact |
| **Governance rule modification** | Changes to the constraints that govern all other operations |
| **External system integration changes** | Modifications that affect data flow to and from third-party systems |
| **Proposal approval** | Decisions that transition artifacts from proposed to committed state |
| **Exception authorization** | Deviations from standard governance that require explicit judgment |
| **Destructive operations** | Deletions, rollbacks, or state resets that cannot be automatically recovered |

For these operations, the UI must present a confirmation workflow that:

- Clearly states what will happen
- Requires affirmative action (not just dismissing a dialog)
- Records the confirmation in the audit trail
- Cannot be automated or scripted through the UI

**How the UI supports deliberate decision-making:**

Deliberate decision-making requires:

- **Sufficient information**: The user has access to all relevant context
- **Adequate time**: The interface does not pressure hasty decisions
- **Clear consequences**: The user understands what will happen
- **Explicit alternatives**: The user knows what other options exist
- **Reversibility clarity**: The user knows whether the action can be undone

The UI supports deliberation by providing this context without rushing the user. There are no countdown timers. There are no "are you sure?" dialogs that train users to click through. There are structured reviews that present information for considered judgment.

**Why "one-click automation" is dangerous in enterprise contexts:**

Consumer software celebrates one-click convenience. Enterprise software must resist it.

One-click automation means:

- Users take consequential actions without engaging deliberative judgment
- Muscle memory replaces conscious decision
- The path from intent to consequence is too short for governance to intercede
- Mistakes become easy to make and hard to detect

The Agentics UI intentionally creates friction for consequential operations. This friction is not a design flaw; it is a governance feature. Users who find the friction burdensome may be attempting operations they should reconsider.

---

## System-Level Invariants

The following invariants must hold across all UI interactions. These are non-negotiable architectural truths that cannot be violated by any feature, convenience enhancement, or user experience optimization.

### INV-U1: Entry Point Equivalence

> Every operation accessible through the UI must be accessible through the CLI with identical semantics.

The UI is a surface over the command layer. It cannot expose capabilities that the CLI lacks, nor restrict capabilities that the CLI provides. If an operation exists in the UI, its CLI equivalent must be documented and functional.

### INV-U2: Governance Uniformity

> The same governance rules apply regardless of entry point.

A user cannot succeed through the UI where they would fail through the CLI. Validation, authorization, approval workflows, and audit requirements are identical. The UI may present governance feedback more helpfully, but it cannot relax governance requirements.

### INV-U3: Intent Explicitness

> The UI must never infer or assume user intent.

If user input is ambiguous, the UI rejects it. If user input is incomplete, the UI requests completion. The UI does not fill gaps with inference. Every operation the system performs must be traceable to explicit user declaration.

### INV-U4: Commitment Confirmation

> Commitment-intent operations require explicit confirmation that cannot be bypassed or automated.

No commitment-intent operation may proceed without a confirmation step that:
- Presents the consequences explicitly
- Requires affirmative user action
- Records the confirmation with timestamp and user identity

Confirmation dialogs may not be suppressed, automated, or disabled.

### INV-U5: Governance Visibility

> The UI must surface, not conceal, governance constraints.

Forbidden operations show why they are forbidden. Required approvals show who must approve. Validation failures show what validation failed. The UI presents governance as informative structure, not obstructive error.

### INV-U6: Audit Completeness

> Every UI interaction that affects state must be captured in the audit trail.

This includes:
- What operation was attempted
- What parameters were specified
- What governance validations occurred
- What confirmations were provided
- What outcome resulted

The audit trail for UI operations must be indistinguishable in completeness from CLI audit trails.

---

## Conceptual Interaction Flow

This section describes how users interact with the Agentics UI through the lens of governed intent staging.

### Forming Intent

The user approaches the UI with a goal: to observe system state, to synthesize an artifact, or to commit a change. The UI does not ask the user to describe their goal in natural language. Instead, it presents structured pathways that correspond to the operations the user is authorized to perform.

The user selects a pathway. This selection is the first act of intent declaration — the user is stating, through structure rather than language, what category of operation they wish to perform. The system validates that the user has authorization for operations in this category.

### Specifying Intent

Within the selected pathway, the user provides structured input. Forms collect parameters. Selections constrain choices. The UI guides the user through the specification without permitting ambiguity.

As the user specifies intent, the system provides immediate feedback:

- Invalid values are rejected with explanation
- Incomplete specifications are indicated with guidance
- Governance constraints relevant to the specification are displayed
- Preview of consequences updates as specification changes

The user completes their specification. At this point, they have declared explicit intent: a fully specified operation that the system can evaluate.

### Validating Intent

The system evaluates the declared intent against governance rules. This validation is not hidden; its results are presented to the user.

If validation fails:
- The UI displays what rules were violated
- The UI explains why those rules exist
- The UI suggests what changes would satisfy the rules
- The user may modify their specification and re-validate

If validation succeeds:
- The UI indicates which governance rules were satisfied
- The UI presents any warnings that do not block execution
- The user may proceed to the next stage

Validation is not a gatekeeping moment to be rushed through. It is an informative step that builds user understanding of governance context.

### Reviewing Before Action

Before any commitment-intent operation executes, the UI presents a review. This review shows:

- Exactly what the operation will do
- What resources will be affected
- What governance rules authorize this operation
- What approvals, if any, are required
- What the expected outcome is
- What would be required to reverse the operation, if reversible

The user reviews this presentation. The UI does not rush the review. There is no timer. There is no "skip review" option for experienced users. The review is mandatory.

### Confirming Execution

After review, the user confirms execution. For observation-intent operations, confirmation may be minimal. For synthesis-intent operations, confirmation acknowledges that artifacts will be created. For commitment-intent operations, confirmation is explicit and recorded.

Confirmation is an affirmative act. The user does not dismiss a dialog to proceed; they actively confirm. The difference is intentional: dismissal is passive and habitual; confirmation is active and deliberate.

### Executing With Governance

Upon confirmation, the system executes the operation through the same pathway that CLI commands traverse. The UI provides visibility into execution:

- Progress is indicated without false precision
- Any governance checkpoints during execution are visible
- Any approvals required during execution (for multi-stage operations) are presented
- Errors during execution are surfaced with full context

Execution is not a black box. The user understands that the system is performing governed operations, not opaque processing.

### Inspecting Results

After execution completes, the UI presents results for inspection. Results include:

- What operation was performed
- What state changed as a result
- Whether the outcome matched expectations
- Any warnings or anomalies detected
- How to access the artifacts produced

Inspection is not a dismissible success message. It is a structured presentation that enables the user to verify that the operation achieved its intended effect.

If the outcome diverges from expectation, the UI supports investigation. Audit trails are accessible. State comparisons are available. The user can understand what happened.

---

## Relationship to Prior ADRs

This ADR/DDD is explicitly additive. It does not rewrite, replace, or contradict prior decisions.

### ADR/DDD #001: CLI Semantics and Synthesis Rules

ADR/DDD #001 establishes that CLI operations occur within governed boundaries with explicit synthesis rules. ADR/DDD #006 extends this by requiring that the UI operate as an alternative surface for the same governed operations. The synthesis rules that constrain CLI behavior constrain UI behavior identically.

### ADR/DDD #002: Executable Governance

ADR/DDD #002 establishes that governance is enforced through schema, middleware, and CI. ADR/DDD #006 requires that the UI present governance enforcement as informative structure rather than opaque rejection. The same schemas validate UI input; the UI makes schema requirements visible.

### ADR/DDD #003: CLI Control Plane DDD

ADR/DDD #003 models the control plane as a domain with bounded contexts and invariants. ADR/DDD #006 positions the UI as a presentation layer over this domain. The UI does not define its own domain concepts; it presents the control plane domain through visual structure.

### ADR/DDD #004: Enterprise Integration Architecture

ADR/DDD #004 establishes Ruvector as memory substrate, integrations as external connectors, and ERP Surface as intent declaration. ADR/DDD #006 requires that the UI present these concepts faithfully. The UI does not abstract away the ERP Surface or hide integration complexity; it presents them as the structured domains they are.

### ADR/DDD #005: System Coherence and Self-Governance

ADR/DDD #005 establishes that the platform preserves coherence and surfaces drift for human decision. ADR/DDD #006 requires that the UI support this model by presenting coherence findings, drift alerts, and remediation options through governed workflows. The UI is a channel through which humans exercise the oversight that ADR/DDD #005 reserves for them.

---

## Consequences

### For Interaction Design

- **Structure over flexibility**: UI interactions are structured pathways, not freeform input
- **Explicitness over inference**: User intent is declared through forms and selections, never inferred from language
- **Visibility over concealment**: Governance constraints are displayed, not hidden
- **Deliberation over speed**: Confirmation workflows create intentional friction for consequential operations

### For System Architecture

- **Single command layer**: The UI and CLI share a common command layer; the UI does not have separate APIs
- **Uniform governance enforcement**: Validation and authorization are identical regardless of entry point
- **Complete audit integration**: UI actions are captured in the same audit trail as CLI actions

### For User Experience

- **Steeper initial learning**: Users must understand governance context, not just click through interfaces
- **Higher confidence in consequences**: Users know what will happen before it happens
- **Reduced accidental operations**: Confirmation workflows prevent unintended commitments
- **Consistent mental model**: Users who learn the CLI understand the UI, and vice versa

### For Compliance

- **Audit trail completeness**: Regulators and auditors see identical records regardless of entry point
- **Governance transparency**: Compliance constraints are visible, not embedded in opaque logic
- **Human oversight verification**: Confirmation records demonstrate human involvement in consequential decisions

---

## Explicit Non-Goals

The following are explicitly outside the scope of this ADR/DDD:

### Non-Goal: UI Component Specification

This ADR does not specify UI components, layouts, styling, frameworks, or implementation details. Those are design artifacts governed by the interaction model this document describes.

### Non-Goal: API or Schema Definition

This ADR does not define API endpoints, request/response schemas, or data structures. The UI accesses the same APIs defined for CLI operations.

### Non-Goal: New CLI Commands

This ADR does not introduce CLI commands. CLI surface is governed by ADR/DDD #001 and CLI_COMMAND_OWNERSHIP.md.

### Non-Goal: Authentication or Authorization Implementation

This ADR assumes that authentication and authorization exist. It describes how authorization constraints are presented, not how they are implemented.

### Non-Goal: Conversational Interface Support

This ADR explicitly excludes conversational or chat-based interfaces for governed operations. Natural language interaction is out of scope.

### Non-Goal: Mobile or Platform-Specific Considerations

This ADR describes the conceptual interaction model without regard to platform, device, or form factor. Platform-specific considerations are implementation details.

---

## Conceptual Responsibility Map

### UI Responsibilities

The UI is responsible for:

- Presenting structured pathways for declaring intent
- Collecting complete, unambiguous specifications from users
- Displaying governance validation results with explanatory context
- Presenting operation previews before execution
- Requiring explicit confirmation for commitment-intent operations
- Displaying execution progress with governance visibility
- Presenting results for inspection after execution
- Surfacing governance constraints as informative structure
- Recording all interactions in the audit trail

The UI is not responsible for:

- Inferring user intent from ambiguous input
- Softening or auto-correcting invalid specifications
- Hiding governance complexity to improve experience
- Enabling shortcuts that bypass governance stages
- Providing conversational interaction patterns

### CLI Responsibilities

The CLI is responsible for:

- Providing the command layer that both CLI and UI access
- Defining the canonical semantics for all operations
- Enforcing governance through schema and middleware
- Maintaining parity: operations available in UI are available in CLI

The CLI is not responsible for:

- Providing UI-specific presentation logic
- Offering alternative semantics for UI access
- Relaxing governance for any entry point

### Governance Responsibilities

Governance is responsible for:

- Defining the rules that constrain operations
- Validating intent declarations against rules
- Requiring approvals for operations that demand human oversight
- Maintaining audit trails for all governed operations

Governance is not responsible for:

- Optimizing user experience
- Providing shortcuts for trusted users
- Adapting rules based on entry point

---

## Anti-Patterns

The following patterns are explicitly prohibited as they violate the principles established in this ADR/DDD.

### Anti-Pattern: Chat-Like UI Behavior

**Description**: The UI accepts natural language input and attempts to interpret user intent, using conversational patterns to negotiate meaning.

**Why it is dangerous**: Conversational interpretation introduces ambiguity. The system may misunderstand intent. Users may believe they requested one thing while the system performs another. Audit trails record what the system inferred, not what the user intended. Governance validation operates on interpreted intent, which may diverge from actual intent.

**Correct approach**: The UI presents structured pathways with explicit parameters. Users declare intent through forms and selections that eliminate ambiguity. The audit trail records exactly what the user specified.

### Anti-Pattern: Hidden Automation

**Description**: The UI performs operations automatically based on user context, history, or preferences without explicit specification or confirmation.

**Why it is dangerous**: Automation without visibility means users do not understand what the system is doing on their behalf. Automated operations may violate governance constraints in ways users cannot anticipate. Audit trails show automated actions but not why they occurred. Users cannot verify that automation aligns with their current intent.

**Correct approach**: Every operation requires explicit specification. If the UI pre-populates values based on context, users must review and confirm before execution. Automation operates only within explicitly defined workflows that users have consciously configured.

### Anti-Pattern: Soft Governance Bypasses

**Description**: The UI presents governance constraints but allows users to dismiss, ignore, or override them with minimal friction — treating governance as advisory rather than mandatory.

**Why it is dangerous**: Governance exists to protect the enterprise. If constraints can be casually bypassed, they provide no protection. Users develop habits of dismissing constraints without consideration. Audit trails show that warnings were displayed but not that they were heeded. Over time, governance becomes performative rather than effective.

**Correct approach**: Governance constraints that can be overridden require explicit exception authorization through the governance workflow defined in ADR/DDD #002. Constraints that cannot be overridden are enforced without dismissal option. The UI does not present false choice where governance allows no choice.

### Anti-Pattern: Over-Simplified "Magic" Buttons

**Description**: The UI provides high-level actions that abstract away complexity, performing multiple operations in sequence without user visibility into or control over intermediate steps.

**Why it is dangerous**: Magic buttons hide governance checkpoints. Users cannot verify that each step complies with their intent. If an intermediate step fails, users may not understand what succeeded and what failed. Audit trails show a single action where multiple distinct operations occurred. Rollback is complicated by the opacity of what actually happened.

**Correct approach**: Complex operations are presented as multi-step workflows with visibility into each step. Users confirm each governance checkpoint. If operations can be composed into higher-level workflows, this composition is explicit and configurable, not hidden.

### Anti-Pattern: Friction Elimination for Power Users

**Description**: The UI provides "expert mode" or "power user" options that reduce confirmation requirements, skip previews, or bypass review stages for users deemed experienced enough to not need them.

**Why it is dangerous**: Governance requirements exist for the operation, not for the user. An experienced user can still make mistakes, act under false assumptions, or cause unintended consequences. Reduced friction increases the likelihood of accidental commitment. "Expert mode" becomes the expected mode, eliminating deliberation for everyone who enables it. Audit trails diverge between modes, complicating compliance review.

**Correct approach**: Governance workflows apply uniformly. If workflows are too burdensome, the workflows themselves should be evaluated and potentially redesigned through the ADR process. The solution to excessive friction is better workflow design, not bypass mechanisms.

### Anti-Pattern: Conversational Error Recovery

**Description**: When operations fail, the UI engages in conversational negotiation to help users "fix" their intent, interpreting failure reasons and suggesting modifications in natural language.

**Why it is dangerous**: Error recovery through conversation reintroduces the ambiguity that structured interfaces are designed to eliminate. The system's interpretation of what went wrong may not match the user's understanding. Suggested fixes are inferred, not declared. Users may accept suggestions without fully understanding them.

**Correct approach**: Error feedback is structured and specific. The UI shows exactly what validation failed or what constraint was violated. The user modifies their specification through the same structured interface used for initial specification. The system validates the modification against the same rules.

---

## Summary for Diligence Review

| Question | Answer |
|----------|--------|
| Does the UI provide an alternative path that bypasses CLI governance? | **No.** The UI accesses the same governed command layer as the CLI with identical enforcement. |
| Can users interact conversationally with the system through the UI? | **No.** The UI requires structured, explicit intent declaration through forms and selections. |
| Does the UI hide governance complexity from users? | **No.** Governance constraints are presented as informative structure that users must understand and satisfy. |
| Can commitment-intent operations be performed without confirmation? | **No.** Explicit confirmation workflows are mandatory and cannot be bypassed or automated. |
| Does the UI create a separate audit trail from the CLI? | **No.** UI and CLI actions flow through the same audit system with identical completeness. |
| Can "power users" access reduced governance workflows? | **No.** Governance requirements are uniform regardless of user experience level. |
| Does the UI support one-click automation for consequential operations? | **No.** Deliberate friction is intentionally preserved for operations with significant consequences. |

---

## Document Governance

| Aspect | Policy |
|--------|--------|
| **Ownership** | Platform Architecture Team |
| **Amendment Authority** | CTO approval required for invariant changes |
| **Review Cadence** | Upon significant interaction model change or quarterly review |
| **Audit Preparation** | Review prior to any transaction due diligence |
| **Audience** | CTOs, PE technical auditors, acquisition teams, enterprise architects, UX leadership |

---

*This ADR/DDD establishes the conceptual interaction architecture for the Agentics UI as a governed control surface. It is explicitly additive to prior ADRs and introduces no implementation artifacts, UI components, schemas, or API definitions. The architecture ensures that the UI behaves conceptually and operationally like claude-flow inside claude-code: staging explicit intent through governed workflows rather than negotiating ambiguous meaning through conversation. Users are guided through structured decision-making, governance is preserved regardless of entry point, and the system remains explainable and auditable.*
