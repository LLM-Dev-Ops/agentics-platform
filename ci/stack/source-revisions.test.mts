import { test } from "node:test";
import assert from "node:assert/strict";
import {
  sourceRevisions,
  validateSourceRevisions,
} from "./source-revisions.mts";

test("all runtime, contract and schema sources have immutable inventory pins", () => {
  validateSourceRevisions(sourceRevisions);
  assert.equal(sourceRevisions.pins.length, 15);
});

test("missing, duplicate and mutable source revisions fail", () => {
  const missing = structuredClone(sourceRevisions);
  missing.pins.pop();
  assert.throws(() => validateSourceRevisions(missing), /Missing source pin/);

  const duplicate = structuredClone(sourceRevisions);
  duplicate.pins.push(structuredClone(duplicate.pins[0]));
  assert.throws(
    () => validateSourceRevisions(duplicate),
    /Duplicate source pin/,
  );

  const mutable = structuredClone(sourceRevisions);
  mutable.pins[0].commit = "main";
  assert.throws(() => validateSourceRevisions(mutable), /not immutable/);
});
