import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export interface SourceFinding {
  pg_imports: number;
  database_url_reads: number;
  query_calls: number;
}

export interface PersistenceBaseline {
  schema_version: number;
  source_findings: Record<string, SourceFinding>;
  manifest_findings: Record<string, number>;
  totals: SourceFinding & {
    runtime_pg_dependencies: number;
    all_findings: number;
  };
}

export interface PersistenceScan {
  source_findings: Record<string, SourceFinding>;
  manifest_findings: Record<string, number>;
}

const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../..",
);

export const persistenceBaseline = JSON.parse(
  readFileSync(
    new URL(
      "../../config/stack/direct-persistence-baseline.json",
      import.meta.url,
    ),
    "utf8",
  ),
) as PersistenceBaseline;

function countMatches(value: string, pattern: RegExp): number {
  return Array.from(value.matchAll(pattern)).length;
}

function sourceFiles(root: string): string[] {
  const directory = join(root, "packages/api/src");
  const visit = (path: string): string[] =>
    readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
      const child = join(path, entry.name);
      return entry.isDirectory()
        ? visit(child)
        : /\.(?:ts|tsx|mts|cts)$/.test(entry.name)
          ? [child]
          : [];
    });
  return visit(directory);
}

export function scanDirectPersistence(root = repositoryRoot): PersistenceScan {
  const source_findings: Record<string, SourceFinding> = {};
  for (const path of sourceFiles(root)) {
    const source = readFileSync(path, "utf8");
    const finding = {
      pg_imports: countMatches(source, /\bfrom\s+["']pg["']/g),
      database_url_reads: countMatches(
        source,
        /process\.env(?:\s*\.\s*DATABASE_URL|\[['"]DATABASE_URL['"]\])/g,
      ),
      query_calls: countMatches(source, /\.query\s*\(/g),
    };
    if (Object.values(finding).some((count) => count > 0))
      source_findings[relative(root, path)] = finding;
  }

  const manifest_findings: Record<string, number> = {};
  for (const path of ["package.json", "packages/api/package.json"]) {
    const manifest = JSON.parse(readFileSync(join(root, path), "utf8")) as {
      dependencies?: Record<string, string>;
    };
    if (manifest.dependencies?.pg) manifest_findings[path] = 1;
  }
  return { source_findings, manifest_findings };
}

export function validateDirectPersistenceDebt(
  scan: PersistenceScan,
  baseline = persistenceBaseline,
): void {
  if (baseline.schema_version !== 1)
    throw new Error("Unsupported persistence baseline");
  const sourceTotals: SourceFinding = {
    pg_imports: 0,
    database_url_reads: 0,
    query_calls: 0,
  };
  for (const finding of Object.values(baseline.source_findings))
    for (const key of Object.keys(sourceTotals) as Array<keyof SourceFinding>)
      sourceTotals[key] += finding[key];
  const runtimeDependencies = Object.values(baseline.manifest_findings).reduce(
    (total, count) => total + count,
    0,
  );
  const allFindings =
    Object.values(sourceTotals).reduce((total, count) => total + count, 0) +
    runtimeDependencies;
  if (
    sourceTotals.pg_imports !== baseline.totals.pg_imports ||
    sourceTotals.database_url_reads !== baseline.totals.database_url_reads ||
    sourceTotals.query_calls !== baseline.totals.query_calls ||
    runtimeDependencies !== baseline.totals.runtime_pg_dependencies ||
    allFindings !== baseline.totals.all_findings
  )
    throw new Error("Persistence baseline totals are inconsistent");

  for (const [path, finding] of Object.entries(scan.source_findings)) {
    const allowed = baseline.source_findings[path];
    if (!allowed) throw new Error(`New direct persistence source: ${path}`);
    for (const key of Object.keys(sourceTotals) as Array<keyof SourceFinding>)
      if (finding[key] > allowed[key])
        throw new Error(`Direct persistence debt increased: ${path} ${key}`);
  }
  for (const [path, count] of Object.entries(scan.manifest_findings)) {
    const allowed = baseline.manifest_findings[path];
    if (allowed === undefined)
      throw new Error(`New direct persistence dependency: ${path}`);
    if (count > allowed)
      throw new Error(`Direct persistence dependency increased: ${path}`);
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const scan = scanDirectPersistence();
  validateDirectPersistenceDebt(scan);
  console.log(
    JSON.stringify({
      direct_persistence: "ratchet_passed",
      baseline_findings: persistenceBaseline.totals.all_findings,
      migration_complete: false,
    }),
  );
}
