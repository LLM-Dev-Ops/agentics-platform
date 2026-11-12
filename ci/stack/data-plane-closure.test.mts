import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dataPlaneClosure,
  validateDataPlaneClosure,
} from "./data-plane-closure.mts";

test("the measured direct-persistence closure remains explicitly blocked", () => {
  validateDataPlaneClosure(dataPlaneClosure);
  assert.equal(dataPlaneClosure.totals.findings, 101);
  assert.equal(dataPlaneClosure.migration_ready, false);
});

test("inventory evidence cannot be relabeled migration-ready", () => {
  const changed = structuredClone(dataPlaneClosure);
  changed.evidence_status = "MIGRATION_READY";
  changed.migration_ready = true;
  assert.throws(
    () => validateDataPlaneClosure(changed),
    /readiness|overstates/,
  );
});

test("routes alone cannot replace application tenant binding", () => {
  const changed = structuredClone(dataPlaneClosure);
  for (const gap of changed.contract_gaps) {
    gap.status = "READY";
    gap.provider_routes = [`/v1/${gap.capability}`];
    gap.implemented_semantics = [...gap.required_semantics];
  }
  changed.evidence_status = "MIGRATION_READY";
  changed.migration_ready = true;
  assert.throws(() => validateDataPlaneClosure(changed), /readiness/);
});

test("every direct-persistence consumer has an explicit contract closure", () => {
  const changed = structuredClone(dataPlaneClosure);
  changed.contract_gaps = changed.contract_gaps.filter(
    (gap) => !gap.consumers.includes("agentics-results-index"),
  );
  assert.throws(() => validateDataPlaneClosure(changed), /no contract closure/);
});

test("a component-validated provider candidate cannot become migration proof", () => {
  const changed = structuredClone(dataPlaneClosure);
  changed.provider.application_tenant_binding = true;
  changed.evidence_status = "MIGRATION_READY";
  changed.migration_ready = true;
  assert.throws(
    () => validateDataPlaneClosure(changed),
    /readiness|overstates/,
  );
});

test("ready route labels cannot replace merged reviewed dependency evidence", () => {
  const changed = structuredClone(dataPlaneClosure);
  changed.provider.application_tenant_binding = true;
  for (const gap of changed.contract_gaps) {
    gap.status = "READY";
    if (gap.provider_routes.length === 0)
      gap.provider_routes = [`/v1/${gap.capability}`];
    gap.implemented_semantics = [...gap.required_semantics];
  }
  changed.evidence_status = "MIGRATION_READY";
  changed.migration_ready = true;
  assert.throws(
    () => validateDataPlaneClosure(changed),
    /readiness|overstates/,
  );
});

test("merged dependencies require explicit approval and immutable commit evidence", () => {
  const changed = structuredClone(dataPlaneClosure);
  changed.promotion_evidence.provider.merge_status = "MERGED";
  assert.throws(
    () => validateDataPlaneClosure(changed),
    /lacks approval or commit evidence/,
  );
});

test("contract promotion evidence is pinned to the provider's semantic authority", () => {
  const changed = structuredClone(dataPlaneClosure);
  changed.promotion_evidence.contract_authority.semantic_revision = "a".repeat(
    40,
  );
  assert.throws(
    () => validateDataPlaneClosure(changed),
    /Contract authority promotion evidence is inconsistent/,
  );
});

test("live IAM cannot be verified without a trusted-main run and both tenant bindings", () => {
  const changed = structuredClone(dataPlaneClosure);
  changed.promotion_evidence.live_iam.status = "VERIFIED";
  changed.promotion_evidence.live_iam.workflow_on_main = true;
  changed.promotion_evidence.live_iam.trusted_main_run_id = 123;
  assert.throws(
    () => validateDataPlaneClosure(changed),
    /Verified live IAM evidence is incomplete/,
  );
});

test("provider candidate evidence is pinned to exact cross-repository revisions", () => {
  const changed = structuredClone(dataPlaneClosure);
  if (!changed.provider.candidate) throw new Error("candidate fixture missing");
  changed.provider.candidate.revision = "main";
  assert.throws(() => validateDataPlaneClosure(changed), /candidate revision/);
});

test("partial provider routes cannot overstate results-index capability", () => {
  const changed = structuredClone(dataPlaneClosure);
  const results = changed.contract_gaps.find(
    (gap) => gap.capability === "results_index",
  );
  if (!results) throw new Error("results-index fixture missing");
  results.status = "PROVIDER_CANDIDATE";
  results.implemented_semantics = results.implemented_semantics?.filter(
    (semantic) => semantic !== "summary_query",
  );
  assert.throws(
    () => validateDataPlaneClosure(changed),
    /capability is incomplete/,
  );
});
