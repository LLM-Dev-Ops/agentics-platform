import { afterEach, describe, expect, it, vi } from "vitest";
import { serviceIdentityHeaders } from "../../src/lib/service-identity.js";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("service-to-service transport identity", () => {
  it("does not contact metadata for a local development request", async () => {
    vi.stubEnv("K_SERVICE", "");
    vi.stubEnv("NODE_ENV", "test");
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    expect(await serviceIdentityHeaders("http://localhost:3001")).toEqual({});
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("requests an audience-bound metadata token and keeps application auth separate", async () => {
    vi.stubEnv("K_SERVICE", "platform");
    const fetcher = vi.fn(async () => new Response("header.payload.signature"));
    vi.stubGlobal("fetch", fetcher);
    expect(
      await serviceIdentityHeaders("https://identity-fixture.run.app"),
    ).toEqual({
      "X-Serverless-Authorization": "Bearer header.payload.signature",
    });
    const [url, init] = fetcher.mock.calls[0] as unknown as [URL, RequestInit];
    expect(url.hostname).toBe("metadata.google.internal");
    expect(url.searchParams.get("audience")).toBe(
      "https://identity-fixture.run.app",
    );
    expect(init.headers).toEqual({ "Metadata-Flavor": "Google" });
    expect(init.redirect).toBe("error");
  });
  it("never falls back to anonymous production access on token failure", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("denied", { status: 403 })),
    );
    await expect(
      serviceIdentityHeaders("https://denied-fixture.run.app"),
    ).rejects.toThrow("unavailable");
    await expect(
      serviceIdentityHeaders("http://localhost:3001"),
    ).rejects.toThrow("HTTPS");
  });
  it("rejects an HTML or malformed response from the identity boundary", async () => {
    vi.stubEnv("K_SERVICE", "platform");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<html>fallback</html>")),
    );
    await expect(
      serviceIdentityHeaders("https://malformed-fixture.run.app"),
    ).rejects.toThrow("Invalid metadata");
  });
});
