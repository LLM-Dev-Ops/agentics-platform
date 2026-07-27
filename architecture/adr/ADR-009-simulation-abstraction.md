# ADR-009: Simulation Abstraction and Organization-Agnostic Design

**Status**: Accepted
**Date**: 2026-01-03
**Category**: Product Architecture
**Relates to**: ADR-001, ADR-002, ADR-007

---

## Context

The Agentics platform provides simulation capabilities for validating deployments, testing operational scenarios, and generating diligence artifacts. A fundamental design question arises:

**Should simulations model specific organizational structures (e.g., "Acme Corp with 500 employees and a HIPAA-regulated data pipeline") or remain abstract and organization-agnostic?**

This decision has significant implications for:

- **Business model**: How the platform is sold, deployed, and maintained
- **IP ownership**: Whether customer-specific logic exists in the codebase
- **Diligence posture**: How the platform is evaluated during acquisition
- **Operational scalability**: Maintenance burden across customer deployments

---

## Decision

**Simulations are abstract and organization-agnostic.** The platform provides parameterized simulation primitives that customers configure—it does not embed, ship, or maintain any "example enterprise" or reference organization.

### What This Means

1. **No embedded enterprise models**: The codebase contains no "ExampleCorp," "DemoCo," or fictional organization with predefined structure, data, or workflows.

2. **No industry-specific fixtures**: Simulations do not include pre-built "healthcare company" or "financial services firm" models. Industry applicability is achieved through parameterization, not embedded templates.

3. **No sample data with realistic semantics**: Test data is synthetic and semantically neutral. No "John Smith, SSN 123-45-6789" or "patient record for cardiac procedure." Data generation uses abstract patterns, not realistic personas.

4. **Parameterized primitives only**: Simulations expose configurable primitives (load profiles, failure modes, scaling factors, latency distributions) that customers configure to match their specific context.

---

## Rationale

### Business Rationale

| Factor | Impact |
|--------|--------|
| **Sales clarity** | The product is a platform, not a vertical solution. No confusion about "does it include our industry's workflows?" |
| **Pricing model** | Uniform pricing based on usage, not customization. No per-customer simulation development costs. |
| **Support scalability** | One simulation codebase serves all customers. No N-variant support burden. |
| **Upgrade path** | Platform upgrades apply uniformly. No customer-specific simulation migration. |

### Architectural Rationale

| Factor | Impact |
|--------|--------|
| **Codebase cleanliness** | No accumulated cruft from abandoned customer models or deprecated industry fixtures. |
| **Test determinism** | Abstract simulations produce reproducible results across environments. No "works in demo, fails in production" due to fixture drift. |
| **Portability** | Simulation artifacts are self-contained. They can be exported, versioned, and replayed anywhere without organizational context. |
| **Compliance boundaries** | No risk of customer data leaking into simulation fixtures. No "we found CompanyX's org chart in your demo database" discovery scenarios. |

### Diligence Rationale

| Factor | Impact |
|--------|--------|
| **IP entanglement** | Zero customer IP embedded in platform code. Clean acquisition boundary. |
| **Valuation clarity** | Platform value is the simulation engine, not accumulated customer configurations. No "but 60% of value is the FinServ template" debates. |
| **Data liability** | No PII, PHI, or customer-derived data in simulation artifacts. Reduces data protection scope. |
| **Reproducibility** | Any buyer can run the same simulations and observe the same results. No "you need access to CustomerX's environment to validate." |

---

## Alternatives Considered

| Alternative | Reason Rejected |
|-------------|-----------------|
| **Reference enterprise model** ("ExampleCorp") | Creates maintenance burden, confuses product positioning, embeds assumptions that may not generalize. Buyers question "why this specific model?" |
| **Industry-specific simulation packs** | Fragments codebase, requires domain expertise to maintain, creates versioning complexity. Customers expect packs to match their specific situation (they never do). |
| **Customer-derived simulation templates** | IP entanglement, data liability, maintenance burden. Departing customers leave orphaned templates. Acquisition creates data cleanup obligations. |
| **Realistic synthetic data** (fake but plausible names, addresses, SSNs) | Regulatory ambiguity (is synthetic PII still PII?), cultural assumptions embedded in name generation, localization burden. Abstract data avoids all these issues. |

---

## Implications

### For Product Development

- Simulation features are parameterized, not templated
- New simulation capabilities must work without organizational context
- Test suites use abstract scenarios, not "realistic" enterprise models
- Documentation shows parameter configuration, not pre-built examples

### For Customer Onboarding

- Customers provide their own organizational context via configuration
- No "here's a demo environment pre-loaded with your industry's typical setup"
- Onboarding focuses on parameterization, not customization
- Success metrics are platform adoption, not template fit

### For Diligence

- Simulation codebase is fully inspectable without customer NDAs
- No "we can't show you this module because it contains CustomerX's configuration"
- Artifact generation is deterministic and reproducible
- Buyers can validate simulation behavior independently

### For Operations

- Single simulation version deployed to all customers
- No per-customer simulation environment maintenance
- Upgrade cycles apply uniformly
- Support can reproduce any customer issue with abstract parameters

---

## Enforcement

This decision is enforced through:

1. **Code Review**: PRs introducing organization-specific fixtures, sample enterprises, or realistic test data are rejected

2. **CI Checks**: Static analysis flags:
   - String literals containing realistic names, addresses, or identifiers
   - File patterns suggesting industry-specific templates (`healthcare-*.yaml`, `finserv-*.json`)
   - Imports from customer-namespaced packages

3. **Architecture Review**: New simulation features require attestation of organization-agnostic design

4. **Data Governance**: Test data generation must use documented abstract patterns, not realistic synthesis

---

## Traceability

| Document | Reference |
|----------|-----------|
| DEPENDENCY_GRAPH.md | Simulation repositories in Layer 4 |
| FORBIDDEN_PATHS.md | Simulation isolation rules |
| REPO_CLASSIFICATION.md | Simulation repository classification |
| ADR-001 | Generic simulation decision |
| ADR-002 | Intent → Simulation → Export → Deploy boundary |
| ADR-007 | Simulation/production isolation |

---

## Summary for Buyer Scrutiny

| Question | Answer |
|----------|--------|
| Does the platform include customer-specific simulation logic? | **No.** Simulations are parameterized primitives. |
| Is there embedded IP from any customer? | **No.** The codebase is organization-agnostic. |
| Can I reproduce simulation results independently? | **Yes.** Abstract parameters yield deterministic results. |
| Is there PII or realistic data in test fixtures? | **No.** All test data is abstract and synthetic. |
| Will I inherit customer-specific maintenance burden? | **No.** One simulation codebase serves all deployments. |
| Can the simulation engine be evaluated in isolation? | **Yes.** No external organizational context required. |

---

*This ADR establishes that simulation abstraction is a deliberate architectural choice with clear business, technical, and diligence rationale. It is not a limitation—it is a feature that protects platform value and enables clean transaction boundaries.*
