import { test } from "node:test";
import assert from "node:assert/strict";
import { topology, validateTopology, validateWiring } from "./topology.mts";
import { validateCloudRunEnvironment } from "./cloud-run-env.mts";

function cloudRunEnvironment(
  overrides: Array<{ name: string; value?: string; valueFrom?: unknown }> = [],
) {
  const entries = Object.keys(topology.platform_runtime_dependencies).map(
    (name) => ({ name, value: "https://service.example.com" }),
  );
  for (const override of overrides) {
    const index = entries.findIndex((entry) => entry.name === override.name);
    if (index === -1) entries.push(override as (typeof entries)[number]);
    else entries[index] = override as (typeof entries)[number];
  }
  return {
    spec: { template: { spec: { containers: [{ env: entries }] } } },
  };
}

test("the supplied 54-repository architecture is internally consistent", () =>
  validateTopology(topology));
test("unknown core members and composition cycles fail", () => {
  const changed = structuredClone(topology);
  changed.components[26].required_members.push("missing-service");
  assert.throws(() => validateTopology(changed), /Unknown member/);
  changed.components[26].required_members = [changed.components[26].id];
  assert.throws(() => validateTopology(changed), /cycle/);
});
test("a service-owned database cannot become an accepted topology", () => {
  const changed = structuredClone(topology);
  changed.data_plane.service_owned_databases = true;
  assert.throws(() => validateTopology(changed), /RuVector/);
});
test("missing, local, credential-bearing and insecure release bindings fail", () => {
  const valid = Object.fromEntries(
    Object.keys(topology.platform_runtime_dependencies).map((name) => [
      name,
      "https://service.example.com",
    ]),
  );
  validateWiring(valid);
  for (const raw of [
    undefined,
    "http://service.example.com",
    "https://localhost",
    "https://user:secret@service.example.com",
  ]) {
    assert.throws(() =>
      validateWiring({ ...valid, RUVECTOR_SERVICE_URL: raw }),
    );
  }
});
test("the platform release candidate has auditable shared-service bindings", () => {
  assert.deepEqual(validateCloudRunEnvironment(cloudRunEnvironment()), {
    required_bindings: 13,
    direct_persistence_bindings: 0,
  });
  for (const override of [
    { name: "RUVECTOR_SERVICE_URL", value: "http://service.example.com" },
    { name: "RUVECTOR_SERVICE_URL", value: "https://localhost" },
    {
      name: "RUVECTOR_SERVICE_URL",
      valueFrom: { secretKeyRef: { name: "endpoint", key: "url" } },
    },
  ])
    assert.throws(
      () => validateCloudRunEnvironment(cloudRunEnvironment([override])),
      /binding/,
    );
});
test("the platform release candidate cannot own a direct database binding", () => {
  for (const name of [
    "DATABASE_URL",
    "PGHOST",
    "CLOUD_SQL_CONNECTION_NAME",
  ])
    assert.throws(
      () =>
        validateCloudRunEnvironment(
          cloudRunEnvironment([{ name, value: "forbidden" }]),
        ),
      /Direct persistence/,
    );
});
