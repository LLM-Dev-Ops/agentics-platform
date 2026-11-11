import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export interface Component {
  id: string;
  repository: string;
  product_group: string;
  required_members: string[];
}

export interface Topology {
  schema_version: number;
  data_plane: {
    service: string;
    backend: string;
    consumer_env: string;
    service_owned_databases: boolean;
  };
  components: Component[];
  platform_runtime_dependencies: Record<string, string>;
  gateway_routes: string[];
}

export const topology = JSON.parse(
  readFileSync(
    new URL("../../config/stack/topology.json", import.meta.url),
    "utf8",
  ),
) as Topology;

// Product grouping records the supplied architecture. It does not reclassify
// runtime layers or override the existing ADR-013 execution spine.
export function validateTopology(value: Topology): void {
  if (value.schema_version !== 1 || !Array.isArray(value.components))
    throw new Error("Unsupported topology");
  const ids = new Set(value.components.map((c) => c.id));
  if (ids.size !== value.components.length)
    throw new Error("Duplicate component");
  if (ids.size !== 54)
    throw new Error("All 54 architecture repositories must be accounted for");
  for (const c of value.components) {
    if (
      !/^[a-z][a-z0-9-]*$/.test(c.id) ||
      c.repository !== `LLM-Dev-Ops/${c.id}`
    )
      throw new Error(`Invalid repository: ${c.id}`);
    if (
      !Array.isArray(c.required_members) ||
      new Set(c.required_members).size !== c.required_members.length
    )
      throw new Error(`Invalid membership: ${c.id}`);
    for (const member of c.required_members)
      if (!ids.has(member)) throw new Error(`Unknown member: ${member}`);
  }
  const active = new Set<string>();
  const done = new Set<string>();
  const visit = (id: string) => {
    if (active.has(id)) throw new Error(`Composition cycle: ${id}`);
    if (done.has(id)) return;
    active.add(id);
    for (const dep of value.components.find((c) => c.id === id)!
      .required_members)
      visit(dep);
    active.delete(id);
    done.add(id);
  };
  for (const id of ids) visit(id);
  const data = value.data_plane;
  if (
    data.service !== "ruvector-service" ||
    data.consumer_env !== "RUVECTOR_SERVICE_URL" ||
    data.service_owned_databases !== false ||
    data.backend !== "Google Cloud SQL PostgreSQL"
  )
    throw new Error("Shared RuVector/Cloud SQL boundary changed");
  if (
    value.components.filter((c) => c.product_group === "core-bundle").length !==
    8
  )
    throw new Error("Eight core bundles required");
  for (const [env, id] of Object.entries(value.platform_runtime_dependencies)) {
    if (!/^[A-Z][A-Z0-9_]*_URL$/.test(env) || !ids.has(id))
      throw new Error("Invalid runtime binding");
  }
}

export function validateWiring(
  environment: Record<string, string | undefined>,
): void {
  for (const name of Object.keys(topology.platform_runtime_dependencies)) {
    const raw = environment[name];
    if (!raw) throw new Error(`Missing service binding: ${name}`);
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      throw new Error(`Invalid service binding: ${name}`);
    }
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      /^(localhost|127\.|0\.|\[?::1\]?)/i.test(url.hostname)
    )
      throw new Error(`Unsafe service binding: ${name}`);
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  validateTopology(topology);
  if (process.argv.includes("--wiring")) validateWiring(process.env);
  console.log(
    JSON.stringify({
      topology: "valid",
      repositories: topology.components.length,
      runtime_connectivity: "not_verified",
    }),
  );
}
