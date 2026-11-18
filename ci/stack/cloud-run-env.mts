import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { topology, validateWiring } from "./topology.mts";

interface CloudRunEnvironmentEntry {
  name?: string;
  value?: string;
  valueFrom?: unknown;
}

interface CloudRunService {
  spec?: {
    template?: {
      spec?: {
        containers?: Array<{ env?: CloudRunEnvironmentEntry[] }>;
      };
    };
  };
}

const directPersistenceNames = new Set([
  "DATABASE_URL",
  "DIRECT_URL",
  "POSTGRES_URL",
  "POSTGRESQL_URL",
  "PGHOST",
  "PGPORT",
  "PGDATABASE",
  "PGUSER",
  "PGPASSWORD",
  "PGSERVICE",
  "PGSSLMODE",
  "CLOUD_SQL_CONNECTION_NAME",
  "INSTANCE_CONNECTION_NAME",
]);

function isDirectPersistenceBinding(name: string): boolean {
  if (directPersistenceNames.has(name)) return true;
  return (
    /^(?:RESULTS|USAGE|IDENTITY|PLATFORM|AGENTICS|RUVECTOR)_DB(?:_|$)/.test(name) ||
    /^(?:RESULTS|USAGE|IDENTITY|PLATFORM|AGENTICS|RUVECTOR)_DATABASE(?:_|$)/.test(name) ||
    /^(?:DB|DATABASE)_(?:HOST|PORT|NAME|USER|PASSWORD|URL)$/.test(name)
  );
}

export function validateCloudRunEnvironment(
  service: CloudRunService,
): { required_bindings: number; direct_persistence_bindings: 0 } {
  const containers = service.spec?.template?.spec?.containers;
  if (!Array.isArray(containers) || containers.length === 0)
    throw new Error("Cloud Run service has no containers");
  const entries = containers[0].env ?? [];
  const byName = new Map<string, CloudRunEnvironmentEntry>();
  for (const entry of entries) {
    if (!entry.name) throw new Error("Cloud Run environment entry has no name");
    if (byName.has(entry.name))
      throw new Error(`Duplicate service binding: ${entry.name}`);
    byName.set(entry.name, entry);
    if (isDirectPersistenceBinding(entry.name))
      throw new Error(`Direct persistence binding is forbidden: ${entry.name}`);
  }

  const environment: Record<string, string | undefined> = {};
  for (const name of Object.keys(topology.platform_runtime_dependencies)) {
    const entry = byName.get(name);
    // Service URLs are configuration, not secrets. A literal value makes the
    // exact release candidate auditable without resolving or printing secrets.
    if (!entry || typeof entry.value !== "string" || entry.valueFrom)
      throw new Error(`Unverifiable service binding: ${name}`);
    environment[name] = entry.value;
  }
  validateWiring(environment);
  return {
    required_bindings: Object.keys(environment).length,
    direct_persistence_bindings: 0,
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const path = process.argv[2];
  if (!path) throw new Error("Cloud Run service JSON path is required");
  const result = validateCloudRunEnvironment(
    JSON.parse(readFileSync(path, "utf8")) as CloudRunService,
  );
  console.log(JSON.stringify({ environment: "valid", ...result }));
}
