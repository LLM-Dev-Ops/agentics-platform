# ADR-014: API Service Identity, Deployment Path, and Production Reachability

**Status**: Partially Implemented
**Date**: 2026-07-27
**Category**: Platform Architecture / Deployment & Release Engineering
**Relates to**: ADR-009, ADR-011, ADR-012, ADR-013
**Supersedes deployment guidance in**: `cloudbuild-api.yaml` (as committed)

> **Implementation status (2026-07-28).** Plan steps 1–4 are done and verified:
> the lockfile is resynced, the root Dockerfile builds green both locally and on
> real Cloud Build, `packages/api/Dockerfile` is deleted, and
> `cloudbuild-api.yaml` is corrected and renamed to `cloudbuild-platform.yaml`.
>
> Steps 5–9 are deliberately **not** done: no deploy to the live
> `agentics-platform` service, no IAM change, and **no `platform.agentics.dev`
> domain repoint**. Those touch production traffic and are tracked as follow-ups.
>
> Two corrections to the findings above, established during implementation:
>
> - **Finding 4 attributes `jose@5.10.0` to `@supabase/ssr` via `packages/ui`.
>   That is wrong.** `@supabase/ssr@0.8.0` depends only on `cookie@^1.0.2`. The
>   real requirer is `agentic-flow > fastmcp`, which needs `jose@^5.0.0`; the root
>   resolves `jose@6.1.3`, so a nested copy is required. The `packages/ui`
>   coupling described in Finding 4 does not exist.
> - **The failure is npm-version-dependent.** `npm ci` fails with
>   `Missing: jose@5.10.0` under npm 10 (`node:20-alpine`, what the Dockerfile
>   runs) but passes silently under npm 11. Reproducing it requires the build's
>   own npm.
>
> One blocker the ADR did not identify: `packages/shared/tsconfig.tsbuildinfo`
> and `packages/sdk/tsconfig.tsbuildinfo` were **committed**. With
> `composite: true`, a stale tsbuildinfo makes `tsc` skip emitting
> `dist/index.d.ts` while still emitting `dist/index.js`, so every `@agentics/shared`
> import in `packages/api` failed with `TS7016`. The root Dockerfile therefore did
> not build green after the lockfile fix alone. Both files are now removed from
> version control and `*.tsbuildinfo` is gitignored.

---

## Context

ADR-013 changed `packages/api/src/handlers/simulate.ts` to route simulation
execution through the orchestration spine. Shipping that change requires knowing
which Cloud Run service actually serves `packages/api`. The repository's build
configuration and the live infrastructure disagree, so this was investigated
directly against project `agentics-dev` / region `us-central1`.

### Finding 1 — `agentics-api` has never existed

`cloudbuild-api.yaml` builds `gcr.io/$PROJECT_ID/agentics-api:$COMMIT_SHA` and
deploys a Cloud Run service named `agentics-api`. None of it exists:

| Artifact referenced by `cloudbuild-api.yaml` | Actual state |
|---|---|
| Cloud Run service `agentics-api` | Does not exist (not in any region) |
| Image repo `gcr.io/agentics-dev/agentics-api` | `Listed 0 items.` — never pushed |
| Service account `agentics-api-sa@agentics-dev.iam...` | Does not exist |
| Secret `SUPABASE_URL` | Does not exist (actual: `NEXT_PUBLIC_SUPABASE_URL`) |
| Secret `AGENTICS_PLATFORM_URL` | Does not exist |
| Secret `STRIPE_SECRET_KEY` | Does not exist (actual: `stripe-secret-key`, lowercase) |
| Cloud Build trigger invoking this file | `gcloud builds triggers list` returns empty — **zero triggers in the project** |

`cloudbuild-api.yaml` is not a stale config for an abandoned service. It is a
config that has **never once executed successfully**.

### Finding 2 — `packages/api/Dockerfile` cannot build, and never could

`cloudbuild-api.yaml` builds with `-f packages/api/Dockerfile`. That Dockerfile
copies only `packages/shared` and `packages/api`. But `packages/api` declares and
imports two more workspaces:

```
$ grep -rhoE "@agentics/[a-z-]+" packages/api/src | sort | uniq -c
     15 @agentics/shared
      5 @agentics/agents
      4 @agentics/contracts
```

Neither `@agentics/agents` nor `@agentics/contracts` is published to a registry
(`npm view @agentics/agents` → `E404 Not Found`), so they cannot be resolved from
outside the workspace. This was verified empirically, not inferred —
`docker build --target builder -f packages/api/Dockerfile .` fails:

```
src/services/simulation-events-store.ts(14,8): error TS2307:
    Cannot find module '@agentics/contracts' or its corresponding type declarations.
src/services/simulation-poller.ts(20,8): error TS2307:
    Cannot find module '@agentics/contracts' or its corresponding type declarations.
... error TS7016: Could not find a declaration file for module '@agentics/shared'
The command '/bin/sh -c npm run build --workspace=@agentics/api' returned a non-zero code: 2
```

The root `Dockerfile` copies exactly the correct closure — `shared`, `contracts`,
`ruvector-client`, `agents`, `api` — and its final stage runs
`CMD ["node", "dist/index.js"]` over `packages/api/dist`. **The root Dockerfile is
the API's real build definition.**

### Finding 3 — `agentics-platform` IS the `packages/api` service

The live service `agentics-platform`
(`https://agentics-platform-xx7kwyd5ra-uc.a.run.app`, image
`gcr.io/agentics-dev/agentics-platform:27a8754`) is the API. Probed with an
identity token:

```
GET /           200  {"name":"Agentics Platform API","version":"1.0.0",
                      "documentation":"https://platform.agentics.dev/docs"}
GET /health     200  {"status":"healthy",...}
GET /ready      200  {"ready":true,...}
GET /v1/simulate 404 {"error":{"code":"NOT_FOUND",
                      "message":"Route GET /v1/simulate not found",
                      "available_routes":["GET /health","GET /ready",
                        "POST /v1/cli/auth/sessions",
                        "GET /v1/cli/auth/sessions/:device_code",
                        "GET /v1/identity/whoami","POST /v1/identity/check-permission",
                        "POST /v1/simulate","POST /v1/manifests","POST /v1/plans",
                        "POST /v1/runner","POST /v1/roi","POST /v1/intent",
                        "POST /v1/exporters","POST /v1/dilige...
```

That route table is `packages/api`, including the `POST /v1/simulate` handler
ADR-013 modifies. Corroborating evidence: revision `agentics-platform-00006-bww`
runs image tag `0d2bd00`, which is a real commit in this repository
(`0d2bd00 Return real user email and payment status from CLI auth session poll`).
The `agentics-platform` image line is built from this repo, tagged with this
repo's short SHAs.

Deployment provenance is mixed, which explains the naming drift:

```
NAME                         CREATED      MANAGED-BY
agentics-platform-00007-ps2  2026-04-22   deploy-script     <- live
agentics-platform-00006-bww  2026-02-16   cloud-build
agentics-platform-00005-rwt  2026-02-15   cloud-build
agentics-platform-00004-ghj  2026-01-28   cloud-build
agentics-platform-00003-xbv  2026-01-28   deploy-script
agentics-platform-00002-52t  2026-01-26   deploy-script
agentics-platform-00001-j9q  2026-01-17   deploy-script
```

The live revision carries `managed-by: deploy-script` and has **no `SERVICE_NAME`
env var** (contrast `agentics-cli`, which has `managed-by: cloud-build` and
`SERVICE_NAME=agentics-cli`). The currently deployed tag `27a8754` is *not* a
commit in this repository (`git cat-file -t 27a8754` → `Not a valid object name`)
and its GCR timestamp is `1970-01-01`. The live production API was deployed
ad hoc from an unreproducible source state.

### Finding 4 — the root Dockerfile is currently broken by lockfile drift

`gcloud run deploy --source=.` cannot succeed today. The root Dockerfile's
`npm ci` fails:

```
npm error code EUSAGE
npm error `npm ci` can only install packages when your package.json and
npm error package-lock.json ... are in sync.
npm error Missing: jose@5.10.0 from lock file
```

This is not an artifact of the Dockerfile's reduced workspace set — a read-only
`npm ci --dry-run` against the committed `package.json` + `package-lock.json` for
the *whole* repo fails identically. `jose@5.10.0` is a transitive dependency of
`@supabase/ssr@0.8.0` (declared by `packages/ui`); the committed lockfile records
only `jose@6.1.3` and a nested `jose@4.15.9`. The working tree is clean, so this
drift is committed state: **`npm ci` is broken at HEAD for every consumer.**

Note the coupling: a `packages/ui` dependency breaks the API's build, because the
root Dockerfile copies the root `package-lock.json`.

### Finding 5 — the deployed fix would not be reachable by the UI

This is the finding that changes the scope of the work. `cloudbuild-ui.yaml`
bakes the API origin into the UI at build time:

```
--build-arg NEXT_PUBLIC_API_URL=https://platform.agentics.dev
```

But `platform.agentics.dev` does **not** resolve to `agentics-platform`:

```
$ gcloud beta run domain-mappings list --region=us-central1
DOMAIN                     ROUTE_NAME
platform.agentics.dev      platform-core      <-- not agentics-platform
app.agentics.dev           agentics-ui
```

There is no load balancer performing path-based routing — `url-maps`,
`backend-services`, and `forwarding-rules` all return `Listed 0 items.`, and
`platform.agentics.dev` resolves to `ghs.googlehosted.com`. A Cloud Run domain
mapping is all-or-nothing, so 100% of `platform.agentics.dev` traffic reaches
`platform-core`.

`platform-core` is a different codebase. It was source-deployed
(`run.googleapis.com/build-source-location: gs://run-sources-agentics-dev-.../platform-core/...`),
created 2025-12-19, now at generation 30, and serves an image from
`cloud-run-source-deploy/platform-core` — not `gcr.io/agentics-dev/agentics-platform`.
It exposes only liveness endpoints:

```
GET /health                 200  {"status":"healthy",...,"version":"0.1.0"}
GET /ready                  200  {"status":"ready",...}
GET /                       404  {"message":"Route GET:/ not found",...}
GET /v1/simulate            404
GET /v1/identity/whoami     404
GET /v1/cli/auth/sessions   404
GET /v1/plans               404
```

The 404 body shape is bare Fastify (`{"message":...,"error":...,"statusCode":...}`),
versus `agentics-platform`'s custom `{"error":{"code":"NOT_FOUND","available_routes":[...]}}`.
Different application, different version string (`0.1.0` vs `1.0.0`).

**Consequence: every `/v1/*` call the UI makes to `platform.agentics.dev` returns
404 today.** Deploying ADR-013's simulate fix to `agentics-platform` would be
correct but invisible — the UI would still 404 against `platform-core`.

### Finding 6 — `agentics-platform` is IAM-locked, contradicting `cloudbuild-api.yaml`

`cloudbuild-api.yaml` deploys with `--allow-unauthenticated` and documents at
length why the CLI device flow requires it. The live service does the opposite:

```
$ gcloud run services get-iam-policy agentics-platform
bindings:
- members:
  - serviceAccount:agentics-cli-invoker@agentics-dev.iam.gserviceaccount.com
  - user:sales@globalbusinessadvisors.co
  role: roles/run.invoker
```

There is no `allUsers` binding; unauthenticated requests get a Google frontend
`403 Forbidden` before reaching the app. Browser-originated UI traffic cannot
reach `agentics-platform` directly. This is consistent with Finding 5: the API is
currently reachable only by the CLI invoker service account and one user.

---

## Decision

**1. `agentics-platform` is the canonical Cloud Run service for `packages/api`.**
It is confirmed by route table, service banner, and image-tag-to-commit lineage.
The name is a historical accident, but it is the live production identity and
renaming it would break the `agentics-cli-invoker` IAM binding and the CLI. We
keep the name `agentics-platform` and treat `agentics-api` as a name that was
never real.

**2. Do not create an `agentics-api` service.** Option (b) is rejected:
`cloudbuild-api.yaml`'s pipeline cannot run — its Dockerfile does not compile,
its service account does not exist, three of its four secrets do not exist, and
no trigger invokes it. Standing up a second API service would fork production
traffic between two API surfaces while the existing one is already unreachable.

**3. Correct `cloudbuild-api.yaml` in place rather than formalizing the ad hoc
deploys.** The ad hoc `deploy-script` path produced the current situation: a live
revision built from source state (`27a8754`) that does not exist in version
control. That is unauditable and must not become the standard. The corrected
config becomes the single deployment path, and it must:

   - deploy service **`agentics-platform`** (not `agentics-api`)
   - build with **`-f Dockerfile`** (root), not `packages/api/Dockerfile`
   - tag **`gcr.io/$PROJECT_ID/agentics-platform:$COMMIT_SHA`**
   - use secret names that exist: `DATABASE_URL`, `stripe-secret-key`,
     `PLATFORM_API_KEY`, `EXECUTION_HMAC_SECRET`, `RUVECTOR_SERVICE_URL`,
     `RUVECTOR_API_KEY`, `TELEMETRY_ENDPOINT`, `platform-env` — matching the env
     block already on the live service
   - drop `--service-account agentics-api-sa@...` (nonexistent) until a real SA
     is provisioned
   - set `SERVICE_NAME=agentics-platform,SERVICE_VERSION=$COMMIT_SHA` so future
     revisions are self-identifying
   - set label `managed-by=cloud-build`
   - **not** carry `--allow-unauthenticated`, which would silently widen the
     current IAM posture as a side effect of a routine deploy

   `cloudbuild-api.yaml` is left unmodified by this ADR; the correction is
   specified here and applied under the Implementation Plan.

**4. `packages/api/Dockerfile` is deleted.** It is dead, non-building code whose
only effect is to make `cloudbuild-api.yaml` look plausible. The root `Dockerfile`
is the API's build definition. (It should eventually move to
`packages/api/Dockerfile` with correct workspace copies, but that is a separate
change and must not be bundled with shipping ADR-013.)

**5. The lockfile must be resynced before any deploy.** `npm ci` fails at HEAD.
The fix is to run `npm install` and commit the updated `package-lock.json`. We do
**not** relax the root Dockerfile from `npm ci` to `npm install` — `npm ci` is
what makes the build reproducible, and reproducibility is exactly what was
missing from the `27a8754` deploy.

**6. Repointing `platform.agentics.dev` is in scope for shipping ADR-013.**
Deploying the simulate fix without fixing the domain mapping delivers nothing
observable. The mapping must move from `platform-core` to `agentics-platform`,
and `agentics-platform` must accept the traffic the UI and CLI send it. Because
this is the change with real blast radius, it is staged behind explicit
verification against the `run.app` URL first (see Implementation Plan), and
`platform-core` is left running and untouched so the mapping can be reverted.

**Deferred, filed separately, not resolved here:** `platform-core` carries a live
Stripe secret key, a Supabase JWT secret, and a Postgres connection string with
password as **plaintext Cloud Run env var values**, not secret references. Those
credentials should be treated as compromised and rotated. This ADR does not
change `platform-core`; it is flagged because the investigation surfaced it and
it must not be lost.

---

## Consequences

**Positive**

- The API has one auditable deployment path; every future revision is traceable
  to a commit SHA that exists in version control.
- `npm ci` works again repo-wide, unblocking any consumer of the root Dockerfile.
- ADR-013's simulate fix becomes reachable by the UI rather than shipping into a
  service nothing routes to.
- Deleting `packages/api/Dockerfile` and correcting `cloudbuild-api.yaml` removes
  the contradiction that caused this investigation.

**Negative / accepted risk**

- The service name `agentics-platform` remains a poor description of a service
  that is the API gateway. We accept the misnomer over a rename that breaks IAM
  bindings and CLI configuration.
- Moving the domain mapping is a user-visible cutover with brief propagation
  time, and it takes `platform.agentics.dev/health` from `platform-core`'s
  `version: 0.1.0` to `agentics-platform`'s `version: 1.0.0`. Any external
  monitor asserting on that payload will need updating.
- `platform-core` becomes orphaned of its domain. It is deliberately left running
  so the mapping can be reverted; its final disposition is a follow-up.
- Resyncing `package-lock.json` pulls in `jose@5.10.0` and whatever else has
  drifted. The lock diff must be reviewed, not rubber-stamped.

**Neutral**

- The root `Dockerfile` continues to depend on the root `package-lock.json`, so
  `packages/ui` dependency changes can still break the API build. Decoupling this
  is deferred.

---

## Implementation Plan

1. **Resync the lockfile.** From the repo root, run `npm install`. Review the
   `package-lock.json` diff — confirm it adds `jose@5.10.0` under
   `@supabase/ssr` and introduces no unexpected major-version moves. Commit the
   lockfile alone, so the deployment fix is bisectable independently of ADR-013.

2. **Verify the root Dockerfile builds green** before touching anything live:
   ```
   docker build -f Dockerfile -t agentics-platform:verify /workspace/agentics-dev/agentics-platform
   ```
   This must exit 0. Do not proceed otherwise.

3. **Delete `packages/api/Dockerfile`.** It does not build and nothing working
   references it.

4. **Rewrite `cloudbuild-api.yaml`** per Decision item 3. Rename the file to
   `cloudbuild-platform.yaml` to end the `agentics-api` naming confusion, and
   update its header comment block — the existing comments describe an
   `--allow-unauthenticated` posture that is not the deployed reality.

5. **Deploy the ADR-013 fix to `agentics-platform`**, tagged with a real commit
   SHA:
   ```
   gcloud builds submit --config=cloudbuild-platform.yaml \
     --substitutions=COMMIT_SHA=$(git rev-parse --short HEAD) \
     --project=agentics-dev /workspace/agentics-dev/agentics-platform
   ```
   Do not use `gcloud run deploy --source=.` — that path reintroduces the
   untracked-source problem this ADR exists to close.

6. **Verify the new revision against the `run.app` URL** (still IAM-gated, so the
   blast radius is zero) before any traffic move:
   ```
   TOK=$(gcloud auth print-identity-token)
   curl -H "Authorization: Bearer $TOK" \
     https://agentics-platform-xx7kwyd5ra-uc.a.run.app/health
   curl -X POST -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json' \
     https://agentics-platform-xx7kwyd5ra-uc.a.run.app/v1/simulate -d '{...}'
   ```
   Confirm `POST /v1/simulate` exercises the orchestration spine per ADR-013.
   Confirm the new revision reports `SERVICE_VERSION` equal to the deployed SHA.

7. **Decide and apply the IAM posture** for `agentics-platform`. The UI is a
   browser client and the CLI device flow is pre-authentication, so both need
   unauthenticated network reach with app-level `apiKeyGate` doing the real
   authorization — the rationale `cloudbuild-api.yaml` already documents. Adding
   the `allUsers` invoker binding is a deliberate, separately-approved step, not
   a side effect of a deploy. Confirm `apiKeyGate` is active on every `/v1/*`
   route before widening access.

8. **Cut `platform.agentics.dev` over** to `agentics-platform` only after steps
   6 and 7 pass. Keep `platform-core` running and unmodified for rollback.

9. **File the `platform-core` credential exposure** as a security incident:
   rotate the Stripe live key, Supabase JWT secret, and Postgres password, and
   convert those env vars to Secret Manager references. Track separately from
   this ADR.

---

## Verification

This ADR is satisfied when all of the following hold:

- [ ] `npm ci` completes successfully at the repo root (no `EUSAGE` / `Missing:
      jose@5.10.0`).
- [ ] `docker build -f Dockerfile .` exits 0.
- [ ] `packages/api/Dockerfile` no longer exists; no config references it.
- [ ] No file in the repo deploys, builds, or references a service or image named
      `agentics-api`.
- [ ] `gcloud run revisions list --service=agentics-platform` shows a new top
      revision with `managed-by: cloud-build` and an image tag that resolves via
      `git cat-file -t <sha>` in this repository.
- [ ] The live revision exposes `SERVICE_NAME=agentics-platform` and
      `SERVICE_VERSION=<deployed sha>`.
- [ ] `POST /v1/simulate` on `agentics-platform` executes through the
      orchestration spine per ADR-013's own verification criteria.
- [ ] `gcloud beta run domain-mappings describe --domain=platform.agentics.dev`
      reports `spec.routeName: agentics-platform` with condition `Ready=True`.
- [ ] `curl https://platform.agentics.dev/` returns
      `{"name":"Agentics Platform API",...}` — the API banner, not a 404.
- [ ] `curl https://platform.agentics.dev/v1/identity/whoami` returns `401`
      (app-level auth rejecting), not `403` (IAM rejecting) and not `404`
      (wrong service).
- [ ] The UI's simulations page loads live data from `/v1/simulate` against
      `platform.agentics.dev` without a 404.
