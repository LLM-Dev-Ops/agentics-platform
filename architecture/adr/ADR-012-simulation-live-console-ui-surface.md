# ADR-012: Simulation Live Console UI Surface

**Status**: Accepted
**Date**: 2026-04-23
**Supersedes**: None
**Superseded by**: None

## Context

`app.agentics.dev` currently exposes authentication, API key management, settings, basic usage graphs, and a nascent coherence view. It does **not** render running simulations. Operators who start a simulation via `agentics simulate …` have no UI feedback beyond the CLI spinner; this is the gap the user has asked us to close.

With **ADR-010** establishing the brand/design-system primitives and **ADR-011** providing a real-time event transport, the remaining decision is the shape of the UI surface itself: which routes, which panels, how CLI-originated simulations appear in the browser, and how authentication is preserved across the CLI → UI hand-off.

Forces:

- Operators run simulations from the CLI (per ADR-006) but want to **watch** them in a rich UI. The browser session (Supabase JWT) and CLI session (API key) are distinct identities; the UI must show runs owned by the logged-in user regardless of which client started them.
- The telemetry reference mockup defines a six-panel grid language. Those panels are visual containers; their data bindings have not been defined.
- Latency, reconnect, and back-pressure behaviour are inherited from ADR-011; the UI must not re-invent them.
- Existing pages (`/login`, `/dashboard/keys`, `/settings`, `/usage`) continue to work unchanged.

## Decision

The platform will introduce a **Simulation Live Console** as a first-class surface in `packages/ui`, composed entirely of ADR-010 primitives and driven by ADR-011 SSE streams.

1. **Routes** (Next.js App Router, under `src/app`):
   - `/simulations` — list of the signed-in user's recent simulations (terminal + running), newest first, paginated. One row per simulation with status pill + elapsed time + link into the live console.
   - `/simulations/[id]` — the live console for one simulation. Auto-subscribes to `GET /v1/simulations/:id/events`.
   - The legacy `/dashboard/keys` route is unchanged; navigation gains a "Simulations" entry alongside it.

2. **Panel-to-data binding** (`/simulations/[id]` renders these six `<Panel>`s, all cyan-accented per ADR-010):

   | Reference panel | Binding |
   |---|---|
   | **Node Scan** (radar) | Active agent count + scenario identifier; radar sweeps while any agent is in `running` state, stills on `completed`/`failed`. |
   | **Thermal Core** (gauge) | Cumulative token usage as a percent of the run's configured budget. Label = token count. |
   | **System Logs** (table) | Live-appended rows from the SSE stream; `kind in {log, step.started, step.completed, validation}` rendered with per-kind status pill. Tail-follows by default; user can pin-scroll. |
   | **Deployment Tasks** (progress) | `completed_steps / total_steps` with the existing `pb-fill` animation; one sub-task row per `step.started` event, progress reconciled on `step.completed`. |
   | **Compute Usage** (bars) | Three bars = rolling averages of (a) LLM calls/min, (b) tokens/sec, (c) artifacts emitted/min. Counters below the bars: `active` = in-flight calls, `standby` = queued, `cleared` = completed calls. |
   | **Quantum Relay Uplink** (signal) | Latency indicator for the SSE connection itself; sweep animates on every received event, idle-dims when no events for 5 s, turns critical on disconnect. Shows the `Last-Event-ID` as `net.link/<id>` in the mockup's slot. |

3. **CLI → UI hand-off**:
   - When `agentics simulate` creates a simulation, the CLI prints a signed deep-link: `View live: https://app.agentics.dev/simulations/<id>`. No token is embedded in the URL.
   - Opening the link while signed-in to the UI renders the live console directly. Opening it while signed-out redirects through the existing Supabase login then back to the simulation.
   - The simulation is owned by the user account; the API enforces that the stream endpoint returns `403` if the Supabase JWT's user does not match the simulation's creator.
   - This preserves the separation of credentials (ADR-006): the CLI's API key is never exposed to the browser.

4. **State management**: a single `useSimulationEvents(id)` hook wraps `EventSource`, exposes a typed reducer over the ADR-011 event union, and feeds panel subcomponents via context. `@tanstack/react-query` (already a dependency) continues to own the initial fetch (`GET /v1/simulate/:id`) for hydration; the SSE stream patches state thereafter.

5. **Authenticated SSE via Next.js proxy route** (new; clarified for implementation):
   - The browser `EventSource` API **cannot set custom request headers**, so the UI cannot send `Authorization: Bearer <supabase_jwt>` directly. It also cannot consume the upstream SSE via the existing `next.config.mjs` rewrite, because the rewrite is header-transparent and the upstream requires the bearer token.
   - The UI therefore opens `EventSource` against a same-origin Next.js App Router server route: `packages/ui/src/app/api/simulations/[id]/events/route.ts`.
   - That route reads the Supabase session via `@supabase/ssr` server-side, extracts the access token, opens a `fetch` against the upstream `GET /v1/simulations/:id/events` with `Authorization: Bearer <jwt>` and `Accept: text/event-stream`, and streams the response body back to the browser **byte-for-byte** (including `id:`, `event:`, and heartbeat comments) using `ReadableStream` piping.
   - If the Supabase session is absent or expired, the route returns `401` and the client hook triggers a re-login redirect.
   - The route uses Node runtime (not Edge) so `ReadableStream` pass-through and long-lived connections behave consistently on Cloud Run.
   - This design keeps Bearer tokens server-side, reuses existing auth middleware on the upstream, and requires no change to ADR-011's transport contract.

6. **Offline / idle behaviour**:
   - If the browser tab is hidden, the `EventSource` is kept open but panel animations pause (driven by the existing `useInViewAnimation` hook from ADR-010, now also listening to `document.visibilityState`).
   - If the stream errors, we show a `<StatusPill status="critical">Reconnecting</StatusPill>` on the Quantum Relay panel and rely on the browser's native SSE reconnect with `Last-Event-ID`.

7. **Out of scope for this ADR**: starting / cancelling simulations from the UI, editing scenario config, comparison views across simulations. Those become follow-on ADRs once the read surface is stable.

## Rationale

- **One route per concern.** A list page and a detail page are the minimum to make simulations navigable; bundling both into a single dashboard would couple filtering to observation and complicate deep-linking from the CLI.
- **Panels as data bindings, not decoration.** The reference is visually inspirational but carries no data semantics. Fixing each panel to a specific signal (steps, tokens, logs, latency, compute, signal health) makes the console information-dense rather than theatrical.
- **SSE without tokens in URLs.** Putting a short-lived token into the CLI's printed link would leak credentials into terminal history and shell multiplexers. Routing the user through a normal browser login is standard and preserves the audit trail.
- **React Query for hydration, SSE for updates.** Using both keeps the initial paint fast (cached list views, skeletons) while the stream handles deltas; neither alone is sufficient.
- **Pause animations on hidden tab.** Matches the reference's scroll-gated motion and avoids burning frames for an operator who Cmd-Tabbed away. This also reduces Cloud Run egress when many tabs are idle but connected.

## Alternatives Considered

| Alternative | Reason Rejected |
|-------------|-----------------|
| Bundle the list and live console into one `/dashboard` route with client-side switching | Breaks deep-linking from CLI; a shareable URL per simulation is a hard requirement |
| Render the reference's exact panels verbatim with mock data | Demoware; does not observe actual simulations and would decay immediately |
| Put a short-lived JWT in the CLI-printed URL | Leaks credentials into terminal history, shell history files, tmux buffers |
| Poll from the UI (`setInterval`) | Rejected by ADR-011 at the transport level; resolution too coarse for a live console |
| Hand-roll a WebSocket client in the UI | Contradicts ADR-011's SSE decision; duplicates transport work |
| Surface the simulation inside the CLI as a TUI instead of a web UI | Does not address the user's explicit requirement for a browser surface; TUI already exists as the spinner |

## Implications

- **New pages**: `packages/ui/src/app/simulations/page.tsx` and `packages/ui/src/app/simulations/[id]/page.tsx`.
- **New hook**: `packages/ui/src/lib/useSimulationEvents.ts`, returning a typed reducer state.
- **Navigation**: the primary nav gains a "Simulations" entry.
- **API authorization**: `GET /v1/simulate/:id` and `GET /v1/simulations/:id/events` must both enforce `simulation.owner_id = auth.user.id` (or equivalent org/tenant check when multi-tenant is reintroduced). This is an auth behaviour change that lands with ADR-011's stream endpoint.
- **CLI change**: `agentics simulate` prints the live-view URL after the `POST /v1/simulate` response. This is the only CLI behaviour change introduced by this ADR.
- **Hydration contract**: the shape returned by `GET /v1/simulate/:id` must be a superset of the derived state computable by replaying events. This is a runtime invariant worth a unit test (replay events → compare to `GET` payload).
- **Accessibility**: log-table rows must expose `aria-live="polite"` so screen readers announce new entries without hijacking focus; panel animations already respect `prefers-reduced-motion` via ADR-010.
- **Existing pages unaffected.** `/login`, `/dashboard/keys`, `/settings`, `/usage`, `/coherence` continue to render unchanged.

## Enforcement

- **Route ownership**: any new `/simulations/*` route is reviewed against this ADR's binding table; renderers that invent their own panel shells (rather than importing from `components/telemetry`) are rejected.
- **E2E test**: Playwright run — create a simulation via API, open `/simulations/<id>`, assert that at least one event appears in the log table within 2 s and the progress bar moves.
- **Authorization test**: integration test confirms `GET /v1/simulate/:id` returns `403` when the signed-in user is not the owner; same for the stream.
- **Accessibility test**: axe-core run on `/simulations/[id]` in CI; log table exposes `aria-live`.
- **No-poll lint**: an ESLint rule in `packages/ui/src/app/simulations/**` bans `setInterval` / `setTimeout` against simulation data; all updates must arrive through `useSimulationEvents`.

## Traceability

- Depends on **ADR-010** (UI Brand and Telemetry Design System) — all panels use those primitives.
- Depends on **ADR-011** (Real-Time Simulation Telemetry Transport) — consumes the SSE endpoint and event union.
- Respects **ADR-006** (CLI as Thin Client) — the CLI remains a thin observer; it only prints the live-view URL.
- Respects **ADR-005** (Layer 4 as Sole External Entry Point) — the UI reaches the platform only through the existing API.
- Aligns with **ADR/DDD-006** (UI Control Surface Architecture) — this is the simulation slice of that surface.
- Reference visual: `/workspaces/agentics-platform/animated-telemetry-dashboard-section (1).tsx`.
- Affects `packages/ui/src/app/simulations/`, `packages/ui/src/lib/useSimulationEvents.ts`, `packages/cli/src/commands/simulate.ts` (print URL), and `packages/api/src/routes/simulate.ts` (owner check parity).
