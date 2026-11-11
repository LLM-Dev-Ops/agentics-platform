import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { topology } from "./topology.mts";

const sha = "a".repeat(40);
const dependencies = [
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

// Local command-boundary fixtures test promotion/rollback sequencing only.
// They do not authenticate to GCP or establish live deployment evidence.
function runRelease(mode: string) {
  const dir = mkdtempSync(join(tmpdir(), "agentics-release-test-"));
  const env = {
    ...process.env,
    PATH: `${dir}:${process.env.PATH}`,
    PROJECT_ID: "fixture-project",
    SOURCE_COMMIT: sha,
    STAGING_RUN_ID: mode === "missing-proof" ? "" : "123",
    FIXTURE_DIR: dir,
    FIXTURE_MODE: mode,
  };
  const fixture = {
    run: {
      head_sha: mode === "wrong-proof" ? "b".repeat(40) : sha,
      head_branch: "main",
      head_repository: { full_name: "LLM-Dev-Ops/agentics-platform" },
      path: ".github/workflows/stack-staging.yml",
      event: "workflow_dispatch",
      status: "completed",
      conclusion: "success",
      updated_at: new Date().toISOString(),
    },
    before: {
      spec: {
        template: {
          spec: {
            containers: [
              {
                env: Object.keys(topology.platform_runtime_dependencies).map(
                  (name) => ({ name, value: "https://fixture.run.app" }),
                ),
              },
            ],
          },
        },
      },
      status: {
        url: "https://service.run.app",
        traffic: [{ revisionName: "old-revision", percent: 100 }],
      },
    },
    ready: {
      status: "ready",
      services: dependencies.map((service) => ({ service, status: "healthy" })),
    },
  };
  writeFileSync(join(dir, "fixture.json"), JSON.stringify(fixture));
  writeFileSync(
    join(dir, "gcloud"),
    `#!/usr/bin/env python3
import json,os,sys
from pathlib import Path
p=Path(os.environ['FIXTURE_DIR']); f=json.loads((p/'fixture.json').read_text()); a=sys.argv[1:]
with (p/'commands').open('a') as log: log.write('gcloud '+ ' '.join(a)+'\\n')
if a[:3]==['run','services','describe']:
    if any('value(status.url)' in x for x in a): print('https://service.run.app')
    else:
        state=json.loads((p/'state').read_text()) if (p/'state').exists() else f['before']
        print(json.dumps(state))
elif a[:3]==['container','images','describe']: print('sha256:'+('c'*64))
elif a[:2]==['auth','print-identity-token']: print('fixture-id-token')
elif a[:2]==['run','deploy']:
    state=f['before']; state['status']['traffic'].append({'revisionName':'candidate-revision','tag':'candidate-${sha.slice(0, 12)}','url':'https://candidate.run.app','percent':0}); (p/'state').write_text(json.dumps(state))
elif a[:3]==['run','services','update-traffic']:
    value=a[a.index('--to-revisions')+1]; state=f['before']; state['status']['traffic']=[{'revisionName':x.split('=')[0],'percent':int(x.split('=')[1])} for x in value.split(',')]; (p/'state').write_text(json.dumps(state))
else: sys.exit(90)
`,
    { mode: 0o755 },
  );
  writeFileSync(
    join(dir, "curl"),
    `#!/usr/bin/env python3
import json,os,sys
from pathlib import Path
p=Path(os.environ['FIXTURE_DIR']); f=json.loads((p/'fixture.json').read_text()); a=sys.argv[1:]; url=a[-1]
with (p/'commands').open('a') as log: log.write('curl '+url+'\\n')
if 'api.github.com' in url: print(json.dumps(f['run']))
elif '-w' in a: print('403')
elif url.endswith('/health'): print(json.dumps({'status':'healthy','version':'${sha}'}))
elif url.endswith('/ready'):
    if (os.environ['FIXTURE_MODE']=='candidate-fail' and 'candidate.run.app' in url) or (os.environ['FIXTURE_MODE']=='post-promotion-fail' and 'service.run.app' in url): sys.exit(22)
    print(json.dumps(f['ready']))
else: sys.exit(90)
`,
    { mode: 0o755 },
  );
  try {
    const result = spawnSync("bash", ["scripts/deploy-platform-release.sh"], {
      cwd: resolve(import.meta.dirname, "../.."),
      env,
      encoding: "utf8",
      timeout: 15000,
    });
    let commands = "";
    try {
      commands = readFileSync(join(dir, "commands"), "utf8");
    } catch {}
    return {
      status: result.status,
      commands,
      output: result.stdout + result.stderr,
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("missing/wrong staging evidence never reaches a cloud deployment", () => {
  for (const mode of ["missing-proof", "wrong-proof"]) {
    const result = runRelease(mode);
    assert.notEqual(result.status, 0);
    assert.ok(!result.commands.includes("gcloud run deploy"));
  }
});
test("a failed candidate readiness check never receives production traffic", () => {
  const result = runRelease("candidate-fail");
  assert.notEqual(result.status, 0);
  assert.ok(result.commands.includes("--no-traffic"));
  assert.ok(!result.commands.includes("update-traffic"));
});
test("post-promotion failure restores the recorded traffic split", () => {
  const result = runRelease("post-promotion-fail");
  assert.notEqual(result.status, 0);
  assert.ok(result.commands.includes("--to-revisions candidate-revision=100"));
  assert.ok(result.commands.includes("--to-revisions old-revision=100"));
});
test("verified release deploys an immutable digest without widening IAM", () => {
  const result = runRelease("valid");
  assert.equal(result.status, 0, result.output);
  assert.ok(result.commands.includes("@sha256:" + "c".repeat(64)));
  assert.ok(!result.commands.includes("--allow-unauthenticated"));
  assert.ok(!result.output.includes("fixture-id-token"));
});
