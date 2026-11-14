import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  persistenceBaseline,
  scanDirectPersistence,
  validateDirectPersistenceDebt,
} from "./direct-persistence.mts";

test("the current platform direct-persistence debt does not exceed its frozen baseline", () => {
  validateDirectPersistenceDebt(scanDirectPersistence());
  assert.equal(persistenceBaseline.totals.all_findings, 48);
});

test("new direct SQL files and increased query counts fail the ratchet", () => {
  const addedFile = structuredClone(persistenceBaseline);
  assert.throws(
    () =>
      validateDirectPersistenceDebt(
        {
          source_findings: {
            ...persistenceBaseline.source_findings,
            "packages/api/src/new-store.ts": {
              pg_imports: 1,
              database_url_reads: 0,
              query_calls: 1,
            },
          },
          manifest_findings: persistenceBaseline.manifest_findings,
        },
        addedFile,
      ),
    /New direct persistence source/,
  );

  const increased = structuredClone(persistenceBaseline.source_findings);
  increased["packages/api/src/routes/me.ts"].query_calls += 1;
  assert.throws(
    () =>
      validateDirectPersistenceDebt({
        source_findings: increased,
        manifest_findings: persistenceBaseline.manifest_findings,
      }),
    /debt increased/,
  );
});

test("removing direct persistence findings passes without weakening the baseline", () => {
  const reduced = structuredClone(persistenceBaseline.source_findings);
  delete reduced["packages/api/src/db.ts"];
  reduced["packages/api/src/routes/cli-auth.ts"].query_calls -= 1;
  validateDirectPersistenceDebt({
    source_findings: reduced,
    manifest_findings: { "packages/api/package.json": 1 },
  });
});

test("the scanner detects imports, database configuration, queries and runtime dependencies", () => {
  const root = mkdtempSync(join(tmpdir(), "agentics-persistence-"));
  try {
    mkdirSync(join(root, "packages/api/src"), { recursive: true });
    writeFileSync(
      join(root, "packages/api/src/store.ts"),
      "import type { Pool } from 'pg';\nconst url = process.env['DATABASE_URL'];\nclient.query('select 1');\n",
    );
    writeFileSync(join(root, "package.json"), '{"dependencies":{"pg":"1"}}');
    mkdirSync(join(root, "packages/api"), { recursive: true });
    writeFileSync(
      join(root, "packages/api/package.json"),
      '{"dependencies":{}}',
    );
    assert.deepEqual(scanDirectPersistence(root), {
      source_findings: {
        "packages/api/src/store.ts": {
          pg_imports: 1,
          database_url_reads: 1,
          query_calls: 1,
        },
      },
      manifest_findings: { "package.json": 1 },
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
