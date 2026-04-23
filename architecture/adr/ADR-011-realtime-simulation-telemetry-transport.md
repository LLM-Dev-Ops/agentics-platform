# ADR-011: Real-Time Simulation Telemetry Transport

**Status**: Accepted
**Date**: 2026-04-23
**Supersedes**: None
**Superseded by**: None

## Context

Today both the `agentics` CLI and the web UI observe simulation progress by **polling** `GET /v1/simulate/:id` at fixed intervals:

- CLI (`packages/cli/src/commands/simulate.ts`) polls every 2000 ms and updates a spinner from the coarse `{ status, progress, current_step }` fields on `SimulationStatus`.
- UI (`packages/ui`) has no simulation surface yet; when one is added it would inherit the same polling model.

This is adequate for a "did it finish?" check but cannot drive the telemetry console proposed in ADR-012, which needs event-level fidelity (per-step status, per-agent output, per-call metrics) at sub-second latency. Polling at higher frequency would amplify load on the API and Postgres without actually increasing resolution — the API is only informed at step boundaries of the underlying simulation runner.

The simulation runner (server-side, per ADR-006 "CLI as Thin Client") already observes fine-grained events internally: step start, step complete, agent output line, LLM call begin/end, artifact emitted, validation result. Those events are currently summarized into `progress` and `current_step` before being returned to polling clients. The information exists; the transport does not.

**Architectural constraint from ADR-004 (Five-Layer Architecture)**: simulations are executed by the **Research Core (Layer 3)**, not the API gateway (Layer 4). The Layer 4 handler at `packages/api/src/handlers/simulate.ts` uses `forwardRequest('research', …)` to delegate. The event source of truth is therefore Research Core, not the gateway. This ADR's rollout is accordingly two-phase:

- **Phase A (ship now)** — Layer 4 owns the SSE transport. An internal poller in the API gateway watches Research Core's existing `GET /simulations/:id` at a short interval, **diffs successive snapshots**, appends derived events to `simulation_events`, and fans them out to connected SSE clients via Postgres `LISTEN/NOTIFY`. No Research Core changes are required. This is sufficient to deliver the end-user experience (CLI-initiated simulation → live browser console) without coordinating a cross-service release.
- **Phase B (follow-on)** — Research Core is extended to emit events natively and write directly to `simulation_events` (or a Layer-3-owned equivalent queried by Layer 4). Layer 4 stops polling and the internal poller is retired. The public SSE contract (`/v1/simulations/:id/events`) is unchanged, so Phase B is transparent to clients.

Phase B is out of scope for this ADR's implementation; this ADR only commits to Phase A now and the contract that makes Phase B a drop-in replacement.

Forces:

- **Latency**: human operators watching a live console expect ≤500 ms end-to-end delay.
- **Replay / reconnect**: browser tabs sleep, Wi-Fi drops, CLI pipes into `tee` — clients must be able to resume without losing events.
- **Auth parity**: the transport must accept both Supabase JWTs (UI) and API keys (CLI) exactly as existing HTTP routes do (`packages/api/src/middleware/auth.ts`).
- **Fastify-native**: the API is Fastify 4.x; adding a second server (e.g. a dedicated WebSocket gateway) multiplies deployment surface for no gain.
- **Persistence**: audit, diligence (per ADR governance expectations), and replay all argue for events being durable, not purely in-memory fan-out.

## Decision

The platform will introduce a **durable append-only event log** for simulations, exposed to clients via **Server-Sent Events (SSE)** over the existing Fastify API.

1. **Storage** — new Postgres table `simulation_events`:

   | Column | Type | Notes |
   |---|---|---|
   | `id` | `bigserial` PK | Monotonic, used as SSE `id:` for reconnect |
   | `simulation_id` | `uuid` FK | Indexed `(simulation_id, id)` |
   | `seq` | `int` | Per-simulation sequence number (starts at 1) |
   | `ts` | `timestamptz` | Server insert time |
   | `kind` | `text` | Enum: see event catalog below |
   | `payload` | `jsonb` | Kind-specific shape, typed in `packages/contracts` |

   The runner (server-side) is the sole writer. Appends are within the same transaction as the status update so a client reconnecting after a crash cannot observe an event without its state implication.

2. **Phase A event producer**: a Layer 4 internal service (`packages/api/src/services/simulation-poller`) spawned per active simulation (or as a shared worker loop) that polls `GET /simulations/:id` on Research Core at 1 Hz, computes the diff between successive snapshots, and appends the derived events to `simulation_events`. Diff rules are deterministic (see `packages/contracts/src/simulation-events.ts` test suite). The poller stops and emits `simulation.completed | simulation.failed | simulation.cancelled` on terminal status.

3. **Event catalog** (initial; extensible):
   - `simulation.created`, `simulation.started`, `simulation.step.started`, `simulation.step.completed`, `simulation.log`, `simulation.metric`, `simulation.artifact`, `simulation.validation`, `simulation.completed`, `simulation.failed`, `simulation.cancelled`

   Each event's `payload` shape is defined as a TypeScript discriminated union in `packages/contracts/src/simulation-events.ts` and consumed by both CLI and UI.

4. **Transport** — new route:
   - `GET /v1/simulations/:id/events` — `Content-Type: text/event-stream`
   - Auth: existing `authMiddleware` (Supabase JWT **or** API key), scope `research:read`
   - Honours `Last-Event-ID` header (per SSE spec) to resume from the last-seen `id`; on connect the server replays rows `id > lastId` from Postgres, then subscribes to new inserts via Postgres `LISTEN/NOTIFY` on a `simulation_events_channel` (one notification per insert carrying `simulation_id` + `id`).
   - Heartbeat comments (`:\n\n`) every 15 s to defeat proxy idle timeouts.
   - Closes with `event: end` when the simulation reaches a terminal state.

5. **Polling retained for compatibility.** `GET /v1/simulate/:id` continues to exist and returns the latest summarized status. CLI and UI migrate to SSE; third-party API consumers may stay on polling.

6. **Clients**:
   - **UI**: `EventSource` (native browser API), wrapped in a small `useSimulationEvents(id)` hook that exposes a typed event stream to React components. No new dependency.
   - **CLI**: use `undici` (already transitive) or `eventsource` (small dep) to consume SSE; CLI commands `agentics simulate --follow` and `agentics simulate status --follow` stream events instead of polling.

## Rationale

- **SSE over WebSocket.** This channel is unidirectional (server → client). SSE is one-line Fastify integration, traverses HTTP proxies and the existing Cloud Run setup cleanly, and reuses the `Authorization` header verbatim — WebSocket on Cloud Run requires upgrade-aware proxies and cookie-based auth (browsers cannot set custom headers on `WebSocket`), which would force a second auth path.
- **Postgres as the event bus.** The API already depends on Postgres (`packages/api/src/db.ts`); `LISTEN/NOTIFY` is free and ordered per-session. Introducing Redis / NATS / Kafka for this one feature would add operational surface (a second stateful dependency) that ADR-003 (Infrastructure Isolation) and ADR-004 (Five-Layer Architecture) argue against without strong justification.
- **Durability beats fan-out speed.** At our scale the dominant value is replay/audit, not throughput. An in-memory pub/sub is faster but loses events on restart, which a diligence-grade platform cannot accept.
- **Monotonic `id` aligns with SSE `Last-Event-ID`.** Using the row's `bigserial` as the SSE event id makes reconnect logic a one-line SQL `WHERE id > $1`; no custom resume cursor is needed.
- **Keeping polling endpoint alive.** Breaking third-party consumers for an internal UX win violates API hygiene. Polling stays; streaming is additive.

## Alternatives Considered

| Alternative | Reason Rejected |
|-------------|-----------------|
| WebSocket (`@fastify/websocket`) | Bidirectional not needed; browsers can't set Bearer headers on WS, forcing cookie/ticket auth and a second auth path |
| Long-poll with incrementing cursor | Round-trip overhead per event; still buffers unnecessarily; no latency win over SSE |
| Redis pub/sub as the bus | New runtime dependency; duplicates Postgres' durability; violates "isolation" bias in ADR-003 |
| NATS / Kafka | Same objection, larger scale; unjustified for current event volume |
| Keep polling at higher frequency (500 ms) | Doesn't increase resolution (API only knows what runner reports); multiplies DB load |
| In-memory pub/sub only (no DB append) | No replay across API restarts; no audit trail; incompatible with diligence posture |
| Separate streaming microservice | Violates ADR-005 (Layer 4 as Sole External Entry Point); adds deploy surface |

## Implications

- **Schema migration**: new table `simulation_events` and trigger / application-level `NOTIFY` on insert. Migration lives where existing simulation schema lives (to be determined; schema is not presently checked into the repo per the survey — this ADR forces the schema into version control).
- **Runner changes**: the simulation runner must be refactored to emit events at step boundaries rather than only mutating summary fields. Summary fields continue to be derived from the same writes (no divergence).
- **Contracts package**: `packages/contracts/src/simulation-events.ts` becomes the authoritative event shape. Both CLI and UI import it.
- **CLI migration**: `simulate.ts` gains a `follow` path using SSE; the polling path is retained behind `--poll` for air-gapped debugging.
- **Backpressure**: SSE has no native backpressure; a slow client that falls more than `N` events behind is disconnected with `event: overflow` and must reconnect with `Last-Event-ID` to resume from Postgres. Default `N = 10 000` events.
- **Scope enforcement**: `research:read` already exists; no new scope needed. API keys without that scope receive `403` on the stream endpoint.
- **Cloud Run**: request timeout must be raised from the default (~5 min) for the SSE route specifically, or the route must terminate and clients reconnect. We will set a 55-minute server-side max and rely on client reconnect for longer runs.
- **Operational observability**: per-connection metrics (connected clients per simulation, events/sec, disconnect reasons) must be added to the existing Pino logs.

## Enforcement

- **CI schema check**: migration for `simulation_events` must exist and be idempotent; a test boots the API against an ephemeral Postgres and verifies the `LISTEN/NOTIFY` path end-to-end.
- **Contract tests**: `packages/contracts` has tests asserting every runtime-emitted event validates against the discriminated union; runner code is linted to reject untyped `payload` construction.
- **Auth test**: `GET /v1/simulations/:id/events` returns `401` without credentials and `403` with credentials lacking `research:read`.
- **Reconnect test**: integration test kills the SSE connection mid-stream, reconnects with `Last-Event-ID`, and asserts no events are missed or duplicated.
- **Code review gate**: any new simulation event `kind` requires both a contracts-package update and a CLI/UI renderer in the same PR (prevents schema/UI drift).

## Traceability

- Refines **ADR-006** (CLI as Thin Client) — the CLI remains a thin observer; simulation execution stays server-side. Only the observation mechanism changes.
- Respects **ADR-005** (Layer 4 as Sole External Entry Point) — the stream endpoint is on the existing Layer 4 API; no new external entry point.
- Respects **ADR-003** (Infrastructure Isolation) — no new infrastructure dependency (Postgres already in use).
- Enables **ADR-012** (Simulation Live Console UI Surface) — the UI surface consumes this transport.
- Affects `packages/api/src/routes/simulate.ts`, `packages/api/src/db.ts`, `packages/cli/src/commands/simulate.ts`, `packages/contracts/src/simulation-events.ts` (new), and introduces a database migration for `simulation_events`.
