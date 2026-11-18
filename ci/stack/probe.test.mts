import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { assertReady, probeStack } from "./probe.mts";

const services = [
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
].map((service) => ({ service, status: "healthy" }));

test("HTTP 200 or duplicate service names cannot establish readiness", () => {
  assert.throws(() => assertReady({ status: "ready" }));
  assert.throws(() =>
    assertReady({ status: "ready", services: Array(11).fill(services[0]) }),
  );
  assert.throws(() =>
    assertReady({
      status: "ready",
      services: services.map((s, i) => (i ? s : { ...s, status: "degraded" })),
    }),
  );
});

// Real local HTTP fixtures exercise the probe's negative controls. They are not
// presented as evidence that the deployed Agentics stack works.
async function fixture(
  mode: string,
  run: (baseUrl: string, contacts: string[]) => Promise<void>,
) {
  const contacts: string[] = [];
  const server = createServer(async (req, res) => {
    contacts.push(`${req.method} ${req.url}`);
    res.setHeader("content-type", "application/json");
    const send = (status: number, body: unknown) => {
      res.statusCode = status;
      res.end(JSON.stringify(body));
    };
    if (req.url === "/health")
      return send(200, { status: "healthy", version: "abc" });
    if (req.url === "/ready") return send(200, { status: "ready", services });
    const key = req.headers["x-api-key"];
    if (req.url === "/v1/auth/session")
      return send(200, {
        authenticated: true,
        org_id: key === "primary" || mode === "same-tenant" ? "a" : "b",
        scopes:
          mode === "unscoped-tenant" ? [] : ["research:read", "research:write"],
      });
    if (!key) return send(401, { error: "auth required" });
    if (req.method === "POST") {
      if (mode === "redirect") {
        res.writeHead(307, { location: "/credential-leak" });
        return res.end();
      }
      return send(
        200,
        mode === "health-fallback"
          ? { status: "ok" }
          : { simulation_id: "s", execution_id: "e", status: "completed" },
      );
    }
    if (key === "other" && mode !== "tenant-leak")
      return send(404, { error: "not found" });
    return send(200, {
      simulation_id: "s",
      execution_id: mode === "mismatched-result" ? "wrong" : "e",
      status: "completed",
      results: { score: 1 },
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as { port: number };
  try {
    await run(`http://127.0.0.1:${address.port}`, contacts);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

test("positive probe requires identity, downstream readiness, persisted readback and tenant denial", async () => {
  await fixture("valid", async (baseUrl) => {
    const report = await probeStack({
      baseUrl,
      apiKey: "primary",
      otherTenantApiKey: "other",
      scenario: "approved-fixture",
      timeoutMs: 3000,
    });
    assert.equal(report.status, "validated");
    assert.equal(report.whole_stack_operational, false);
    assert.equal(report.receipts.length, 9);
    assert.ok(!JSON.stringify(report).includes("primary"));
  });
});

for (const mode of [
  "health-fallback",
  "same-tenant",
  "unscoped-tenant",
  "tenant-leak",
  "mismatched-result",
  "redirect",
]) {
  test(`probe rejects ${mode}`, async () => {
    await fixture(mode, async (baseUrl, contacts) => {
      await assert.rejects(
        probeStack({
          baseUrl,
          apiKey: "primary",
          otherTenantApiKey: "other",
          scenario: "approved-fixture",
          timeoutMs: 3000,
        }),
      );
      assert.ok(!contacts.some((p) => p.includes("credential-leak")));
    });
  });
}
