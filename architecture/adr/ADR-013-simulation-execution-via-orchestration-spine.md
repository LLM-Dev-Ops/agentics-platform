# ADR-013: Simulation Execution Routes Through the Orchestration Spine

**Status**: Proposed
**Date**: 2026-07-27
**Category**: Platform Architecture / Fleet Integration
**Relates to**: ADR-002, ADR-005, ADR-007, ADR-008, ADR-009, ADR-011
**External references**: `agentics-enforcement` ADR-005, ADR-006

---

## Context

Layer 4 (`agentics-platform`, implemented as `@agentics/api` in `packages/api`) exposes the
platform's public simulation API. It declares that it delegates all execution downstream. The
service header states this explicitly:

> `packages/api/src/services/simulation/index.ts:6`
> `* Layer 4 does NOT execute simulations - all execution happens in LLM-Research-Core.`

> `packages/api/src/handlers/simulate.ts:7-9`
> `* CRITICAL: This handler implements NO simulation execution logic.`
> `* It only compiles inputs and forwards to Layer 3 Research Core.`

The claim is architecturally correct and the compile/validate logic in
`packages/api/src/services/simulation/` (`schema.ts`, `compiler.ts`, `interpreter.ts`, `index.ts`)
does exactly what it says: it normalizes `specification | cli_flags | prompt` into a validated
`SimulationSpecification` and executes nothing. **The problem is not that Layer 4 executes
simulations. The problem is where it forwards them.**

### Finding 1 — Layer 4's simulation forwarding target does not exist

`createSimulationHandler` forwards the compiled spec to the `research` core at path
`/simulations`:

> `packages/api/src/handlers/simulate.ts:66-73`
> ```ts
> const response = await forwardRequest('research', {
>   method: 'POST',
>   path: '/simulations',
>   body: { specification },
> ```

The route table binds both `/v1/research` and `/v1/simulate` to the same upstream:

> `packages/api/src/router/index.ts:66-69`
> ```ts
> '/v1/simulate': {
>   name: 'LLM-Research-Core',
>   url: config.layer3Endpoints.research,
> },
> ```

`config.layer3Endpoints.research` resolves to `RESEARCH_CORE_URL` (`packages/api/src/config.ts:77`).
The repository serving that URL in this fleet is `research-core` (npm name `@llm-research/core`).
Its complete HTTP surface is five routes:

> `research-core/src/server.ts:42-93` — `GET /health`, `GET /`, `GET /ready`,
> `POST /v1/research/ingest`, `POST /v1/events`
>
> `research-core/src/server.ts:113-117`
> ```ts
> // 404 for all other routes
> sendJson(res, 404, { error: 'Not Found', message: `Cannot ${method} ${url}` });
> ```

There is no `/simulations` handler. **Every one of Layer 4's four simulation operations —
`POST /v1/simulate`, `GET /v1/simulate/:id`, `GET /v1/simulate`, `DELETE /v1/simulate/:id`
(`handlers/simulate.ts:66`, `:123`, `:156`, `:198`) — forwards to a path that 404s.** The public
simulation API is not merely parallel to the fleet's execution spine; it is a dead pointer.

Meanwhile `research-core`'s real integration contract is with the spine, not with Layer 4:

> `research-core/src/lib.ts:111-115`
> `* Emits a hierarchical execution graph conforming to the`
> `* agentics-execution-engine contract:`
> `*   Core (research-core) └── Repo (llm-simulator) └── Agent`

Its entry point is an in-process `execute(request, parentSpanId): CoreExecutionResult`
(`research-core/src/lib.ts:126-129`) invoked *by* an execution engine that supplies a parent span —
not an HTTP `POST /simulations` invoked by an API gateway.

### Finding 2 — The live spine Layer 4 should be calling already serves a matching API

The spine repositories are deployed services with concrete, working endpoints:

| Repository | Endpoint | Citation |
|---|---|---|
| `agentics-orchestration-engine` | `POST /v1/simulate`, `POST /simulate` | `src/server.ts:790-793` (`isSimulatePath`) |
| `agentics-simulation-planner` | `POST /v1/plan`, `/plan`, `/plans` | `src/server.ts:542` |
| `agentics-simulation-runner` | `POST /v1/runner/execute`, `GET /v1/runner/status/:id`, `/v1/runner/result/:id`, `POST /v1/runner/abort/:id` | `src/server.ts:262, 502, 521, 540` |
| `agentics-execution-engine` | `POST /v1/execute` | `src/server.ts:126` |
| `agentics-results-index` | `GET /runs`, `GET /runs/:id`, `GET /results/latest`, `GET /summary` | `src/api/routes.ts:61-118` |

`agentics-orchestration-engine` describes itself as *"a conductor, not an engine… It does not
execute simulation logic, evaluate policies, compute costs, or generate artifacts internally"*
(`README.md`). Its `POST /v1/simulate` is a near-exact match for the path Layer 4 already exposes
publicly. The correct downstream target exists and is idiomatic; Layer 4 simply does not know
about it.

### Finding 3 — Four spine repositories are absent from this repo's own registry

`architecture/REPO_CLASSIFICATION.md` is the authoritative fleet registry and the input to CI
enforcement (`ci/check-architecture.sh:58`, which parses it into `SIMULATION_REPOS` at line 103).
Its Simulation section lists exactly five repositories:

> `architecture/REPO_CLASSIFICATION.md:88-92`
> `agentics-simulation-planner`, `agentics-simulation-runner`, `agentics-deployment-exporters`,
> `agentics-diligence-artifacts`, `agentics-org-manifests`
>
> `architecture/REPO_CLASSIFICATION.md:157` — `| Simulation | 5 | ... |`
> `architecture/REPO_CLASSIFICATION.md:163` — `| **Total** | **33** | |`

The following repositories exist in the fleet and are **never classified anywhere** in
`REPO_CLASSIFICATION.md`, `DEPENDENCY_GRAPH.md`, or `FORBIDDEN_PATHS.md`:

- `agentics-execution-engine`
- `agentics-orchestration-engine`
- `agentics-results-index`
- `agentics-usage-ledger`
- `agentics-deployment-intent`
- `agentics-contracts`
- `agentics-enforcement`

Because `ci/check-architecture.sh` derives its rule set *from* these documents, unclassified
repositories are not merely undocumented — they are **unenforceable**. Any dependency on them
passes CI by omission.

`agentics-usage-ledger` is the sharpest illustration: Layer 4 already depends on it in production
code (`packages/api/src/handlers/usage-proxy.ts:41` builds requests against `config.usageLedgerUrl`;
`packages/api/src/config.ts:113` defines it; `packages/api/src/routes/usage-proxy.ts:4-5` documents
the proxy) while the architecture registry does not acknowledge that the repository exists.

### Finding 4 — The freeze date precedes the repository's existence

> `ARCHITECTURE_VERSION.md:3-5`
> `**Frozen Version**: architecture-v1.0.0`
> `**Freeze Date**: 2025-01-03`
> `**Status**: FROZEN`

`agentics-platform`'s first commit is `b764443` dated **2025-12-18**. The declared freeze predates
the repository by roughly eleven months. The same `2025-01-0X` dating appears throughout the
governance set (`REPO_CLASSIFICATION.md:6` "2025-01-04", `DEPENDENCY_GRAPH.md:6` "2025-01-04",
`adr/README.md:6` "2025-01-03", `ADR-009:4` "2025-01-03"), while ADRs authored in the observable
git history carry real dates (ADR-011 and ADR-012 landed 2026-04-23). The `2025-01-0X` cohort is a
transposition of the intended `2026-01-0X`. This is not cosmetic: `ARCHITECTURE_VERSION.md:8`
claims git tag `architecture-v1.0.0`, `ARCHITECTURE_INDEX.md:23` requires CI to *"validate against
ARCHITECTURE_VERSION.md"* and *"fail with a blocking error"* otherwise, and a freeze baseline that
cannot be located in history is not auditable. A governance document whose own date is
demonstrably impossible cannot carry the diligence weight `adr/README.md` assigns it.

### Finding 5 — A third, incompatible architecture is being enforced elsewhere

`agentics-enforcement/plans/adr/` contains accepted ADRs describing a *different* topology —
"Tier-3 Cores", a Ruvector acceptance protocol, and an execution-graph hierarchy:

> `agentics-enforcement/plans/adr/ADR-006-core-repository-assignment-model.md` (Accepted, 2026-02-12)
> *"Each Core has an immutable, statically-defined list of assigned foundational repositories."*
> Assignment map names `Security-Core`, `Governance-Core`, `Automation-Core`, `Data-Core` — four
> cores, versus the eight `LLM-*-Core` entries at `REPO_CLASSIFICATION.md:65-72`. It contains no
> `Research-Core` row at all, despite `research-core` being the target of Layer 4's simulation path.

> `agentics-enforcement/plans/adr/ADR-005-simulation-engine-demotion.md` (Accepted, 2026-02-12)
> *"agentics-simulation-engine is demoted to a pure delegation layer."* — scoped to
> `agentics-simulation-engine (#44)`, a repository that **does not exist in the fleet**.

Two ADR sets, both marked authoritative, disagree on the number of cores, their names, the
execution protocol, and the identity of the simulation engine. There is also a package-name
collision: `@agentics/contracts` v0.1.0 (`packages/contracts`, consumed at
`packages/api/src/services/simulation-events-store.ts:14`) and `@llm-dev-ops/contracts` v1.1.1
(the `agentics-contracts` repository) both define `events` and `execution` schemas.

### Finding 6 — Maturity and maintenance evidence

| Repository | Commits | First | Last |
|---|---|---|---|
| `agentics-platform` | 67 | 2025-12-18 | **2026-04-23** |
| `agentics-orchestration-engine` | 33 | 2026-01-04 | 2026-02-23 |
| `agentics-simulation-planner` | 19 | 2025-12-31 | 2026-02-18 |
| `agentics-results-index` | 18 | 2026-01-12 | 2026-02-16 |
| `agentics-deployment-intent` | 16 | 2025-12-31 | 2026-02-15 |
| `agentics-simulation-runner` | 15 | 2026-01-01 | 2026-02-18 |
| `agentics-execution-engine` | 9 | 2026-02-08 | 2026-02-23 |
| `agentics-contracts` | 9 | 2026-01-07 | 2026-02-23 |
| `agentics-usage-ledger` | 8 | 2026-01-12 | 2026-02-15 |
| `agentics-enforcement` | 4 | 2026-02-12 | 2026-02-13 |

`agentics-platform` has more commits than any two spine repositories combined and is the only one
with activity after 2026-02-23. It also carries the fleet's only real governance apparatus:
`architecture/` with a canonical document hierarchy, twelve prior ADRs, a release record, and
executable CI enforcement.

**The two facts must be held together.** `agentics-platform` is the best-maintained and
best-governed repository — *and* its simulation execution path has been broken since it was
written, because governance quality did not extend to verifying that its declared downstream
actually answers. Maturity is an argument for making `agentics-platform` the governance authority.
It is not an argument for making it the execution authority over services it has never
successfully called.

---

## Decision

**Option (a). `agentics-platform` will be brought into the spine. It remains the sole external
entry point and the fleet's governance authority; it will stop forwarding simulation work to
`LLM-Research-Core` and will instead delegate to `agentics-orchestration-engine`, the live
conductor that already serves `POST /v1/simulate`.**

Specifically, the platform will:

1. **Repoint simulation execution.** `POST /v1/simulate` forwards to
   `agentics-orchestration-engine` `POST /v1/simulate` instead of `research` `POST /simulations`.
   Read and cancel operations resolve against `agentics-results-index` and the orchestration
   engine respectively, not against `research`.

2. **Retain the compiler, retire the misdirection.** `packages/api/src/services/simulation/`
   keeps its role — Layer 4 remains the place where `specification | cli_flags | prompt` is
   normalized into a validated `SimulationSpecification`, and the natural-language hop to
   Intelligence Core is unchanged. Only the downstream target changes. Layer 4 still executes
   nothing, preserving ADR-008.

3. **Classify the spine.** `agentics-execution-engine`, `agentics-orchestration-engine`,
   `agentics-results-index`, `agentics-usage-ledger`, `agentics-deployment-intent`,
   `agentics-contracts`, and `agentics-enforcement` are added to `REPO_CLASSIFICATION.md` under a
   new **Execution Spine** class at Layer 3.5 — below Layer 4, above the Layer 3 cores they
   dispatch to — bringing them under `ci/check-architecture.sh` enforcement.

4. **Correct and re-baseline the freeze.** The `2025-01-0X` dates in the governance set are
   corrected to `2026-01-0X`, and the architecture is re-frozen at `architecture-v1.1.0` with a
   freeze date that corresponds to a real, taggable commit.

5. **Resolve the ADR conflict by absorption, not by fiat.** `agentics-enforcement`'s accepted
   ADR-005 and ADR-006 are reconciled into this repository's ADR set. Where they describe live
   behavior (span hierarchy, Ruvector acceptance, `CoreExecutionResult`) they are adopted; where
   they reference non-existent artifacts (`agentics-simulation-engine`) they are marked
   Superseded. `agentics-enforcement/plans/adr/` becomes a pointer to `architecture/adr/`.

### Explicitly not decided here

The `@agentics/contracts` vs `@llm-dev-ops/contracts` collision, and the eight-core versus
four-core disagreement between `REPO_CLASSIFICATION.md:65-72` and `agentics-enforcement` ADR-006,
are real and blocking but are separate decisions. They are recorded in the Implementation Plan as
prerequisites requiring their own ADRs, not resolved by this one.

---

## Alternatives Considered

| Alternative | Reason Rejected |
|---|---|
| **(b) `agentics-platform` supersedes the spine; deprecate/merge the spine repos into it** | Superficially attractive on maintenance evidence (Finding 6), but inverts the actual capability gradient. Layer 4 has never successfully executed a simulation — its execution path 404s (Finding 1). The spine repositories hold the working implementations: an 8-stage planning pipeline, a deterministic runner with reproducibility proofs, span-hierarchy tracing, and a results index. Absorbing them means Layer 4 reimplements all of it, and directly violates its own ADR-008 ("Consolidation Cores Own All Business Logic") and the Layer 4 forbidden-dependency rule at `REPO_CLASSIFICATION.md:42`. Merging would also destroy the deployment boundary that makes simulation/production isolation (ADR-007) enforceable. |
| **Leave both paths; document the divergence** | The status quo is not two working paths — it is one working path (the spine) and one broken one (Layer 4's). Documenting a 404 as an architecture is not a decision. |
| **Point Layer 4 at `agentics-simulation-runner` `POST /v1/runner/execute` directly** | Skips planning and orchestration, so natural-language and `cli_flags` inputs would have no planner stage, and Ruvector acceptance would be bypassed. The orchestration engine exists precisely to sequence these. Reserved as a fallback only if the orchestration engine proves undeployable. |
| **Implement `POST /simulations` in `research-core` to match Layer 4's existing call** | Makes the dead pointer live, but installs a second execution entry point competing with the orchestration engine, and contradicts `research-core/src/lib.ts:111-115`, where the repository declares itself a *callee* of the execution engine with a parent span. Would deepen the divergence rather than close it. |
| **Adopt `agentics-enforcement`'s topology wholesale** | Its ADR-005 is scoped to a repository that does not exist, and its ADR-006 core map omits Research-Core entirely. It cannot be adopted as-written without first reconciling those gaps. |

---

## Consequences

### Positive

- The public simulation API works. This is currently not true.
- One execution path, one place to reason about failures, one place to instrument.
- Seven previously invisible repositories come under CI enforcement rather than passing by omission.
- `agentics-platform` keeps the roles it has earned — sole external entry point (ADR-005), governance authority — without claiming an execution role it has never exercised.
- The ADR-011 simulation telemetry work (`services/simulation-events-store.ts`, `simulation-poller.ts`) gains a real event source instead of polling an endpoint that 404s.
- The freeze baseline becomes auditable, restoring the diligence posture `adr/README.md` claims.

### Negative

- Requires touching frozen artifacts (`REPO_CLASSIFICATION.md`, `DEPENDENCY_GRAPH.md`, `ARCHITECTURE_VERSION.md`), which per `ARCHITECTURE_VERSION.md:65-80` and `adr/README.md` needs RFC plus CTO approval.
- Introduces a new layer tier (3.5), a genuine addition to the five-layer model that ADR-004 froze.
- The spine repositories have been dormant since 2026-02-23. Repointing production traffic at services with four months of no commits requires deployment verification before, not after, cutover.
- The response shape from `agentics-orchestration-engine` `POST /v1/simulate` is unlikely to match what Layer 4's current SDK/UI clients expect from the (never-exercised) research-core contract. An adapter will be needed.

### Risks

- **The orchestration engine may not be deployed.** Step 1 of the plan is to verify this, and the decision is contingent on it. If the service is not reachable, fall back to `agentics-simulation-runner` directly and open a separate ADR.
- **Renumbering/reclassification may break `ci/check-architecture.sh`,** which parses the markdown tables by regex (`ci/check-architecture.sh:318-386`). The parser must be validated against the edited documents before the documents are merged.
- **Correcting the freeze date is a governance action, not an edit.** It should be performed by whoever owns the freeze, with the correction recorded — not silently overwritten.

---

## Implementation Plan

Steps 1–3 are prerequisites. **No production traffic is repointed until step 3 passes.**

1. **Verify the orchestration engine is live and contract-compatible.** Probe the deployed
   `agentics-orchestration-engine` `GET /health` and `POST /v1/simulate` with a
   `SimulationSpecification` produced by `packages/api/src/services/simulation/compiler.ts`.
   Record the response shape. If the service is unreachable or rejects the spec, stop and revise
   this ADR before proceeding.

2. **Diff the specification contracts.** Compare Layer 4's `SimulationSpecification`
   (`packages/api/src/services/simulation/schema.ts`) against the orchestration engine's expected
   request body and against `SimulationPlan` in `agentics-simulation-planner`. Document every
   field mismatch. Decide per-field: map in Layer 4, or extend the spine contract.

3. **Write a failing integration test first.** Add a test asserting
   `POST /v1/simulate` returns a simulation ID from a real downstream. It must fail against the
   current `research` target (404) and pass only after step 4. This is the regression guard that
   was missing when the original path was written.

4. **Repoint the four simulation operations** in `packages/api/src/handlers/simulate.ts`:
   - `:66` `forwardRequest('research', POST /simulations)` → `forwardRequest('orchestration', POST /v1/simulate)`
   - `:123` `GET /simulations/:id` → `agentics-results-index` `GET /runs/:id`
   - `:156` `GET /simulations` → `agentics-results-index` `GET /runs`
   - `:198` `DELETE /simulations/:id` → `agentics-simulation-runner` `POST /v1/runner/abort/:id`

5. **Add the spine to routing and config.** Add `orchestration` and `resultsIndex` entries to
   `layer3Endpoints` in `packages/api/src/config.ts:70-79` (env `ORCHESTRATION_ENGINE_URL`,
   `RESULTS_INDEX_URL`) and to the route table in `packages/api/src/router/index.ts:37-74`. Remove
   the `/v1/simulate` → `LLM-Research-Core` binding at `:66-69`. Leave `/v1/research` → research
   core intact; that route is not implicated.

6. **Correct the misleading header comments** at
   `packages/api/src/services/simulation/index.ts:6`, `schema.ts:6`, `compiler.ts:5`,
   `handlers/simulate.ts:4`, and `routes/simulate.ts:10`. Layer 4 still does not execute
   simulations; the destination is now the orchestration spine, not LLM-Research-Core.

7. **Update `REPO_CLASSIFICATION.md`** (do not edit until steps 1–3 pass):
   - Add a **Execution Spine** class to the legend at `:19-33`.
   - Add a new section after Simulation Repositories (`:84-94`) classifying
     `agentics-orchestration-engine`, `agentics-execution-engine`, `agentics-results-index`,
     `agentics-usage-ledger`, `agentics-deployment-intent` at Layer 3.5, and `agentics-contracts`
     / `agentics-enforcement` as Shared/Governance.
   - Update the count table at `:151-163`: Simulation stays 5, new Execution Spine row = 5,
     Shared/Governance +2, **Total 33 → 40**.
   - Add `agentics-platform` → Execution Spine (HTTP) to the allowed dependencies at `:42`.
   - Add the Layer 3.5 tier to Layer Assignment Rules at `:194-206`.

8. **Update `DEPENDENCY_GRAPH.md` and `FORBIDDEN_PATHS.md`** for the 3.5 tier: Layer 4 → 3.5 → 3
   is permitted; Layer 4 → Layer 3 direct for *simulation* is now forbidden; 3.5 → Layer 4 remains
   forbidden under the downward-only rule (ADR-004).

9. **Update `ARCHITECTURE_VERSION.md`**: correct `Freeze Date` at `:4` from `2025-01-03` to the
   real date, bump `Frozen Version` at `:3` to `architecture-v1.1.0`, update the Git Tag at `:8`,
   and add an amendment-history entry recording that this ADR amended the v1.0.0 freeze and that
   the original date was a transposition. Apply the same `2025-01-0X` → `2026-01-0X` correction to
   `REPO_CLASSIFICATION.md:6`, `DEPENDENCY_GRAPH.md:6`, `FORBIDDEN_PATHS.md:6`,
   `ARCHITECTURE_INDEX.md:6`, `adr/README.md:6`, and `ADR-009:4`. Tag the resulting commit.

10. **Validate the CI parser** (`ci/check-architecture.sh`) against the edited documents —
    specifically `parse_repos_from_dependency_graph` (`:318`) and
    `parse_repos_from_forbidden_paths` (`:358`) — and extend it with an `EXECUTION_SPINE_REPOS`
    array alongside `SIMULATION_REPOS` (`:103`).

11. **Register this ADR**: add ADR-013 to the index table in `adr/README.md` and to
    `ARCHITECTURE_DECISIONS.md`.

12. **Reconcile `agentics-enforcement`.** Open a follow-up ADR adopting its ADR-009 (span tracing)
    and ADR-004 (execution-id minting) into this repository's set; mark its ADR-005 Superseded
    (`agentics-simulation-engine` does not exist) and its ADR-006 Superseded pending the core-count
    reconciliation below. Replace `agentics-enforcement/plans/adr/` with a pointer to
    `architecture/adr/`.

13. **Open two separate blocking ADRs** — not resolved here:
    - **ADR-014**: reconcile `@agentics/contracts` v0.1.0 and `@llm-dev-ops/contracts` v1.1.1 into
      a single contract authority.
    - **ADR-015**: reconcile the eight `LLM-*-Core` roster (`REPO_CLASSIFICATION.md:65-72`) with
      `agentics-enforcement` ADR-006's four Tier-3 Cores, and reconcile the documented core names
      with the actual fleet directories (`research-core`, `intelligence-core`, `security-core`, …),
      which do not match the `LLM-*-Core` names used throughout the governance set.

---

## Verification

This ADR is satisfied when all of the following hold:

1. **The execution path is live.**
   `POST /v1/simulate` against a running Layer 4 returns a simulation identifier originating from
   `agentics-orchestration-engine`, and `GET /v1/simulate/:id` returns that simulation's status
   from `agentics-results-index`. The step-3 integration test passes.

2. **No reference to the dead path remains.**
   ```
   grep -rn "LLM-Research-Core" agentics-platform/packages/api/src
   grep -rn "'/simulations'" agentics-platform/packages/api/src
   ```
   Both return zero hits.

3. **The spine is referenced.**
   ```
   grep -rniE "orchestration-engine|results-index" agentics-platform/packages/api/src
   ```
   Returns hits in `config.ts`, `router/index.ts`, and `handlers/simulate.ts`.

4. **The registry is complete.**
   Every directory matching `agentics-*` in the workspace appears in
   `architecture/REPO_CLASSIFICATION.md`. The count table totals 40 and matches the number of
   table rows.

5. **CI enforcement covers the spine.**
   `ci/check-architecture.sh` exits 0 against the edited documents, and its parsed
   `EXECUTION_SPINE_REPOS` array is non-empty.

6. **The freeze is auditable.**
   `git tag --list 'architecture-v*'` resolves `architecture-v1.1.0` to a commit whose author date
   matches the `Freeze Date` in `ARCHITECTURE_VERSION.md`. No governance document under
   `architecture/` carries a `Last Updated` date earlier than this repository's first commit
   (2025-12-18).

7. **No two accepted ADRs describe conflicting topologies.**
   `agentics-enforcement/plans/adr/` contains no Accepted ADR that contradicts
   `agentics-platform/architecture/adr/`.

---

*Findings in this ADR were verified against the working tree on 2026-07-27. Line citations refer to
that state and should be re-confirmed before acting on any individual step.*
