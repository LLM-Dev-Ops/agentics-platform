import { test } from "node:test";
import assert from "node:assert/strict";
import { topology, validateTopology, validateWiring } from "./topology.mts";

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
