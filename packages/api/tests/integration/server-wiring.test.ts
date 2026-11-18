import { createServer as createHttpServer } from "node:http";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { createServer } from "../../src/server.js";
import config from "../../src/config.js";
import { getRequiredScope } from "../../src/middleware/scope.js";

const original = { ...config.layer3Endpoints };
const originalCorsAllowedOrigins = [...config.corsAllowedOrigins];
let api: FastifyInstance;
let upstream: ReturnType<typeof createHttpServer>;
let healthy = true;
let calls = 0;

beforeEach(async () => {
  healthy = true;
  calls = 0;
  upstream = createHttpServer((_request, response) => {
    calls++;
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ status: healthy ? "healthy" : "degraded" }));
  });
  await new Promise<void>((resolve) =>
    upstream.listen(0, "127.0.0.1", resolve),
  );
  const address = upstream.address() as { port: number };
  for (const key of Object.keys(config.layer3Endpoints) as Array<
    keyof typeof config.layer3Endpoints
  >) {
    config.layer3Endpoints[key] = `http://127.0.0.1:${address.port}`;
  }
  config.corsAllowedOrigins = ["http://localhost:3000"];
  api = await createServer({ logger: false });
  await api.ready();
});

afterEach(async () => {
  await api?.close();
  upstream.closeAllConnections();
  await new Promise<void>((resolve) => upstream.close(() => resolve()));
  Object.assign(config.layer3Endpoints, original);
  config.corsAllowedOrigins = [...originalCorsAllowedOrigins];
});

describe("production server composition", () => {
  it("registers the actual simulation entry points", () => {
    for (const [method, url] of [
      ["POST", "/v1/simulate"],
      ["GET", "/v1/simulate"],
      ["GET", "/v1/simulate/:id"],
      ["DELETE", "/v1/simulate/:id"],
    ] as const) {
      expect(api.hasRoute({ method, url })).toBe(true);
    }
  });
  it("rejects unauthenticated simulation execution", async () => {
    const response = await api.inject({
      method: "POST",
      url: "/v1/simulate",
      payload: {},
    });
    expect(response.statusCode).toBe(401);
    expect(calls).toBe(0);
  });
  it("allows credentialed CORS only for configured origins", async () => {
    const allowed = await api.inject({
      method: "GET",
      url: "/health",
      headers: { origin: "http://localhost:3000" },
    });
    expect(allowed.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
    expect(allowed.headers["access-control-allow-credentials"]).toBe("true");

    const denied = await api.inject({
      method: "GET",
      url: "/health",
      headers: { origin: "https://attacker.invalid" },
    });
    expect(denied.headers["access-control-allow-origin"]).toBeUndefined();
    expect(denied.headers["access-control-allow-credentials"]).toBeUndefined();
  });
  it("checks all eleven real HTTP dependencies before becoming ready", async () => {
    const response = await api.inject({ method: "GET", url: "/ready" });
    expect(response.statusCode).toBe(200);
    expect(response.json().services).toHaveLength(11);
    expect(calls).toBe(11);
  });
  it("returns 503 even when HTTP succeeds but a dependency reports degraded", async () => {
    healthy = false;
    const response = await api.inject({ method: "GET", url: "/ready" });
    expect(response.statusCode).toBe(503);
    expect(response.json().status).toBe("not_ready");
  });
  it("requires research permissions for all simulation operations", () => {
    expect(getRequiredScope("POST /v1/simulate")).toBe("research:write");
    expect(getRequiredScope("GET /v1/simulate")).toBe("research:read");
    expect(getRequiredScope("GET /v1/simulate/a")).toBe("research:read");
    expect(getRequiredScope("DELETE /v1/simulate/a")).toBe("research:write");
  });
});
