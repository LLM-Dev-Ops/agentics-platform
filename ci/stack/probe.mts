import { createHash, randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";

export interface ProbeOptions {
  baseUrl: string;
  apiKey: string;
  otherTenantApiKey: string;
  scenario: string;
  identityToken?: string;
  expectedVersion?: string;
  timeoutMs?: number;
  pollMs?: number;
}

const dependencyNames = [
  "intelligence-core",
  "security-core",
  "automation-core",
  "governance-core",
  "data-core",
  "ecosystem-core",
  "research-core",
  "interface-core",
  "agentics-orchestration-engine",
  "agentics-results-index",
  "agentics-simulation-runner",
];
type Json = Record<string, any>;
class ProbeFailure extends Error {}
function fail(message: string): never {
  throw new ProbeFailure(message);
}

export function assertReady(body: Json): void {
  if (
    body.status !== "ready" ||
    !Array.isArray(body.services) ||
    body.services.length !== dependencyNames.length
  )
    fail("Readiness does not cover all runtime dependencies");
  const names = new Set(body.services.map((s: Json) => s.service));
  if (
    names.size !== dependencyNames.length ||
    dependencyNames.some((n) => !names.has(n)) ||
    body.services.some((s: Json) => s.status !== "healthy")
  )
    fail("A runtime dependency is missing or unhealthy");
}

export async function probeStack(options: ProbeOptions) {
  const base = new URL(options.baseUrl);
  if (
    base.username ||
    base.password ||
    base.search ||
    base.hash ||
    base.pathname !== "/"
  )
    fail("Gateway must be an origin URL");
  if (!options.apiKey || !options.otherTenantApiKey || !options.scenario)
    fail(
      "Two valid tenant credentials and an approved simulation scenario are required",
    );
  const timeout = options.timeoutMs ?? 90000;
  if (!Number.isInteger(timeout) || timeout < 1 || timeout > 120000)
    fail("Invalid bounded probe timeout");
  const deadline = Date.now() + timeout;
  const correlation = randomUUID();
  const receipts: Array<{
    method: string;
    path: string;
    status: number;
    digest: string;
  }> = [];
  async function request(
    path: string,
    key: string | null,
    method = "GET",
    body?: Json,
    allowed = [200],
  ): Promise<Json> {
    const remaining = deadline - Date.now();
    if (remaining <= 0) fail("Live probe deadline exceeded");
    const headers: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Request-Id": correlation,
    };
    if (key) headers["X-API-Key"] = key;
    // Cloud Run transport identity and application credentials remain separate.
    if (options.identityToken)
      headers["X-Serverless-Authorization"] = `Bearer ${options.identityToken}`;
    const response = await fetch(new URL(path, base), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      redirect: "error",
      signal: AbortSignal.timeout(Math.min(remaining, 15000)),
    });
    if (!allowed.includes(response.status))
      fail(`${method} ${path.split("?")[0]} returned HTTP ${response.status}`);
    const reader = response.body?.getReader();
    if (!reader) fail("Missing response body");
    const chunks: Uint8Array[] = [];
    let length = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 1048576) {
        await reader.cancel();
        fail("Probe response exceeds limit");
      }
      chunks.push(value);
    }
    const text = Buffer.concat(chunks).toString("utf8");
    receipts.push({
      method,
      path: path.replace(/\/v1\/simulate\/[^/]+/, "/v1/simulate/:id"),
      status: response.status,
      digest: createHash("sha256").update(text).digest("hex"),
    });
    let result: Json;
    try {
      result = JSON.parse(text);
    } catch {
      fail("Probe requires JSON, not an HTML health/fallback page");
    }
    if (!result || typeof result !== "object" || Array.isArray(result))
      fail("Invalid JSON response shape");
    return result;
  }
  const health = await request("/health", null);
  if (
    health.status !== "healthy" ||
    (options.expectedVersion && health.version !== options.expectedVersion)
  )
    fail("Gateway health/version mismatch");
  assertReady(await request("/ready", null));
  const session = await request("/v1/auth/session", options.apiKey);
  const other = await request("/v1/auth/session", options.otherTenantApiKey);
  if (
    session.authenticated !== true ||
    other.authenticated !== true ||
    typeof session.org_id !== "string" ||
    !session.org_id ||
    typeof other.org_id !== "string" ||
    !other.org_id ||
    session.org_id === other.org_id
  )
    fail("Tenant isolation needs two valid, distinct organizations");
  const permits = (identity: Json, action: string) =>
    Array.isArray(identity.scopes) &&
    identity.scopes.some((scope: string) =>
      ["admin:*", "research:*", `research:${action}`].includes(scope),
    );
  if (
    !permits(session, "read") ||
    !permits(session, "write") ||
    !permits(other, "read")
  )
    fail(
      "Both tenants need valid research-read access; the submitting tenant also needs research-write",
    );
  await request("/v1/simulate", null, "POST", {}, [401, 403]);
  const started = await request(
    "/v1/simulate",
    options.apiKey,
    "POST",
    {
      specification: {
        scenario: options.scenario,
        parameters: { duration: 1, users: 1, simulation_resolution: "micro" },
      },
    },
    [200, 201, 202],
  );
  if (
    typeof started.simulation_id !== "string" ||
    !started.simulation_id.trim() ||
    typeof started.execution_id !== "string" ||
    !started.execution_id.trim()
  )
    fail("Simulation did not return execution identifiers");
  const path = `/v1/simulate/${encodeURIComponent(started.simulation_id)}`;
  let result: Json;
  for (;;) {
    result = await request(path, options.apiKey);
    if (result.status === "completed") break;
    if (!["pending", "running"].includes(result.status))
      fail("Simulation failed or returned an unknown status");
    if (Date.now() + (options.pollMs ?? 1000) >= deadline)
      fail("Simulation did not complete before deadline");
    await new Promise((resolve) => setTimeout(resolve, options.pollMs ?? 1000));
  }
  if (
    result.simulation_id !== started.simulation_id ||
    result.execution_id !== started.execution_id ||
    !result.results ||
    typeof result.results !== "object" ||
    Array.isArray(result.results) ||
    Object.keys(result.results).length === 0 ||
    result.error
  )
    fail("Persisted results do not match the submitted execution");
  // Repeat the read: a successful creation or a health response is insufficient.
  const reread = await request(path, options.apiKey);
  if (
    reread.simulation_id !== result.simulation_id ||
    reread.execution_id !== result.execution_id ||
    reread.status !== "completed" ||
    !isDeepStrictEqual(reread.results, result.results)
  )
    fail("Persisted result readback changed");
  await request(path, options.otherTenantApiKey, "GET", undefined, [403, 404]);
  return {
    status: "validated",
    scope: "gateway-spine-result-readback-and-tenant-isolation",
    correlation_id: correlation,
    receipts,
    whole_stack_operational: false,
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const url = process.env.STACK_GATEWAY_URL ?? "";
    if (new URL(url).protocol !== "https:") fail("Live gateway requires HTTPS");
    const report = await probeStack({
      baseUrl: url,
      apiKey: process.env.STACK_API_KEY ?? "",
      otherTenantApiKey: process.env.STACK_OTHER_TENANT_API_KEY ?? "",
      scenario: process.env.STACK_SIMULATION_SCENARIO ?? "",
      identityToken: process.env.STACK_ID_TOKEN,
      expectedVersion: process.env.STACK_EXPECTED_VERSION,
    });
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    // Upstream bodies and credential-bearing URLs must not leak into CI logs.
    console.error(
      error instanceof ProbeFailure
        ? error.message
        : "Live stack request failed; check staging wiring and identity.",
    );
    process.exitCode = 1;
  }
}
