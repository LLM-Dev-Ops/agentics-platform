import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { persistenceBaseline } from "./direct-persistence.mts";
import { sourceRevisions } from "./source-revisions.mts";

type Consumer = {
  component: string;
  revision?: string;
  revision_source?: "CURRENT_TREE";
  pg_imports: number;
  database_url_reads: number;
  query_calls: number;
  runtime_pg_dependencies: number;
  findings: number;
};

type ContractGap = {
  capability: string;
  consumers: string[];
  required_semantics: string[];
  provider_routes: string[];
  status: "BLOCKED_PROVIDER_CONTRACT" | "PROVIDER_CANDIDATE" | "READY";
};

export interface DataPlaneClosure {
  schema_version: number;
  captured_at: string;
  evidence_status: "BLOCKED_PROVIDER_CONTRACT" | "MIGRATION_READY";
  consumers: Consumer[];
  totals: Omit<Consumer, "component" | "revision" | "revision_source">;
  provider: {
    component: string;
    revision: string;
    transport_identity: "CLOUD_RUN_IAM";
    application_tenant_binding: boolean;
    candidate?: {
      revision: string;
      branch: string;
      pull_request: string;
      contract_authority_revision: string;
      contract_pull_request: string;
      application_tenant_binding: boolean;
      status: "COMPONENT_VALIDATED";
    };
  };
  contract_gaps: ContractGap[];
  migration_ready: boolean;
}

export const dataPlaneClosure = JSON.parse(
  readFileSync(
    new URL("../../config/stack/data-plane-closure.json", import.meta.url),
    "utf8",
  ),
) as DataPlaneClosure;

const findingKeys = [
  "pg_imports",
  "database_url_reads",
  "query_calls",
  "runtime_pg_dependencies",
] as const;

export function validateDataPlaneClosure(
  closure: DataPlaneClosure,
): void {
  if (closure.schema_version !== 1) throw new Error("Unsupported data-plane closure");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(closure.captured_at))
    throw new Error("Invalid data-plane capture date");

  const sourcePins = new Map(
    sourceRevisions.pins.map((pin) => [pin.component, pin.commit]),
  );
  const consumers = new Map<string, Consumer>();
  const computed = {
    pg_imports: 0,
    database_url_reads: 0,
    query_calls: 0,
    runtime_pg_dependencies: 0,
    findings: 0,
  };
  for (const consumer of closure.consumers) {
    if (consumers.has(consumer.component))
      throw new Error(`Duplicate data-plane consumer: ${consumer.component}`);
    consumers.set(consumer.component, consumer);
    if (consumer.component === "agentics-platform") {
      if (consumer.revision_source !== "CURRENT_TREE")
        throw new Error("Platform findings must describe the current tree");
      if (
        consumer.pg_imports !== persistenceBaseline.totals.pg_imports ||
        consumer.database_url_reads !== persistenceBaseline.totals.database_url_reads ||
        consumer.query_calls !== persistenceBaseline.totals.query_calls ||
        consumer.runtime_pg_dependencies !==
          persistenceBaseline.totals.runtime_pg_dependencies ||
        consumer.findings !== persistenceBaseline.totals.all_findings
      )
        throw new Error("Platform closure disagrees with the executable debt baseline");
    } else if (sourcePins.get(consumer.component) !== consumer.revision) {
      throw new Error(`Consumer revision is not the selected source pin: ${consumer.component}`);
    }
    const subtotal = findingKeys.reduce((sum, key) => sum + consumer[key], 0);
    if (subtotal !== consumer.findings)
      throw new Error(`Inconsistent finding total: ${consumer.component}`);
    for (const key of findingKeys) computed[key] += consumer[key];
    computed.findings += consumer.findings;
  }
  if (JSON.stringify(computed) !== JSON.stringify(closure.totals))
    throw new Error("Data-plane closure totals are inconsistent");
  if (sourcePins.get(closure.provider.component) !== closure.provider.revision)
    throw new Error("Provider revision is not the selected source pin");
  if (closure.provider.transport_identity !== "CLOUD_RUN_IAM")
    throw new Error("Provider transport identity must remain IAM-scoped");
  const candidate = closure.provider.candidate;
  if (candidate) {
    for (const [name, revision] of [
      ["provider", candidate.revision],
      ["contract authority", candidate.contract_authority_revision],
    ] as const) {
      if (!/^[0-9a-f]{40}$/.test(revision))
        throw new Error(`Invalid ${name} candidate revision`);
    }
    if (
      candidate.branch !== "integration/tenant-bound-data-plane-2026-11-12" ||
      candidate.pull_request !== "https://github.com/LLM-Dev-Ops/ruvector-service/pull/5" ||
      candidate.contract_pull_request !==
        "https://github.com/LLM-Dev-Ops/agentics-contracts/pull/1" ||
      !candidate.application_tenant_binding
    )
      throw new Error("Incomplete tenant-bound provider candidate evidence");
  }

  const covered = new Set<string>();
  for (const gap of closure.contract_gaps) {
    if (gap.required_semantics.length === 0)
      throw new Error(`Missing required semantics: ${gap.capability}`);
    for (const consumer of gap.consumers) {
      if (!consumers.has(consumer))
        throw new Error(`Unknown contract-gap consumer: ${consumer}`);
      covered.add(consumer);
    }
    if (gap.status === "READY" && gap.provider_routes.length === 0)
      throw new Error(`Ready capability has no provider routes: ${gap.capability}`);
    if (
      gap.status === "PROVIDER_CANDIDATE" &&
      (!candidate || gap.provider_routes.length === 0)
    )
      throw new Error(`Provider candidate has no pinned implementation: ${gap.capability}`);
  }
  for (const component of consumers.keys())
    if (!covered.has(component))
      throw new Error(`Consumer debt has no contract closure: ${component}`);

  const allCapabilitiesReady = closure.contract_gaps.every(
    (gap) => gap.status === "READY" && gap.provider_routes.length > 0,
  );
  const safeToMigrate =
    allCapabilitiesReady && closure.provider.application_tenant_binding;
  if (closure.migration_ready !== safeToMigrate)
    throw new Error("Migration readiness is inconsistent with provider contracts");
  const expectedEvidence = safeToMigrate
    ? "MIGRATION_READY"
    : "BLOCKED_PROVIDER_CONTRACT";
  if (closure.evidence_status !== expectedEvidence)
    throw new Error("Data-plane evidence status overstates contract readiness");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  validateDataPlaneClosure(dataPlaneClosure);
  console.log(
    JSON.stringify({
      data_plane_closure: "valid",
      evidence_status: dataPlaneClosure.evidence_status,
      direct_consumer_findings: dataPlaneClosure.totals.findings,
      migration_ready: dataPlaneClosure.migration_ready,
    }),
  );
}
