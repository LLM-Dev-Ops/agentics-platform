import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { topology, type Topology } from "./topology.mts";

export interface SourceRevisionManifest {
  schema_version: number;
  captured_at: string;
  evidence_status: string;
  pins: Array<{
    component: string;
    repository: string;
    branch: string;
    commit: string;
  }>;
}

export const sourceRevisions = JSON.parse(
  readFileSync(
    new URL("../../config/stack/source-revisions.json", import.meta.url),
    "utf8",
  ),
) as SourceRevisionManifest;

export function validateSourceRevisions(
  manifest: SourceRevisionManifest,
  stack: Topology = topology,
): void {
  if (
    manifest.schema_version !== 1 ||
    manifest.evidence_status !== "INVENTORY_ONLY"
  )
    throw new Error("Source revisions must remain inventory-only evidence");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(manifest.captured_at))
    throw new Error("Invalid source revision capture date");

  const required = new Set([
    ...Object.values(stack.platform_runtime_dependencies),
    "agentics-contracts",
    "schema-registry",
  ]);
  const components = new Map(
    stack.components.map((component) => [component.id, component]),
  );
  const seen = new Set<string>();
  for (const pin of manifest.pins) {
    if (seen.has(pin.component))
      throw new Error(`Duplicate source pin: ${pin.component}`);
    seen.add(pin.component);
    const component = components.get(pin.component);
    if (!required.has(pin.component) || !component)
      throw new Error(`Unexpected source pin: ${pin.component}`);
    if (pin.repository !== component.repository || pin.branch !== "main")
      throw new Error(`Invalid source identity: ${pin.component}`);
    if (!/^[0-9a-f]{40}$/.test(pin.commit))
      throw new Error(`Source revision is not immutable: ${pin.component}`);
  }
  for (const component of required)
    if (!seen.has(component))
      throw new Error(`Missing source pin: ${component}`);
  if (seen.size !== required.size)
    throw new Error("Source closure contains extra pins");
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  validateSourceRevisions(sourceRevisions);
  console.log(
    JSON.stringify({
      source_revisions: "valid",
      pins: sourceRevisions.pins.length,
      evidence_status: sourceRevisions.evidence_status,
    }),
  );
}
