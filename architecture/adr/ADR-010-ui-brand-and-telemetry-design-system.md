# ADR-010: UI Brand and Telemetry Design System

**Status**: Accepted
**Date**: 2026-04-23
**Supersedes**: None
**Superseded by**: None

## Context

`app.agentics.dev` (`packages/ui`) today renders only login, API key management, and a minimal usage dashboard. There is no brand-consistent visual language: Tailwind's default palette is used ad hoc, components are raw Tailwind (no shadcn/ui or design system), and upcoming telemetry surfaces (ADR-012) have no shared primitives to build on.

The reference mockup (`animated-telemetry-dashboard-section (1).tsx`) establishes the visual target: a dense, dark "command-panel" grid with mono-uppercase labels, subtle panel gradients, and scroll-triggered micro-animations. The reference uses multi-hue accents (emerald / orange / indigo) that are not the Agentics brand.

Forces:

- The brand direction is **cyan `#28caeb`** (primary) on **near-black `#010101`** (surface) — two values, no variants.
- Every new dashboard surface (ADR-012 and follow-ons) needs the same panel, header, body, status-pill, and metric-value primitives.
- Ad-hoc Tailwind classes in `src/app` pages already drift; introducing telemetry without design tokens will compound the drift.
- Accessibility (`prefers-reduced-motion`, contrast) and performance (paused animations off-viewport) must not regress when we adopt a high-effects aesthetic.

## Decision

The platform will adopt a single telemetry-oriented design system in `packages/ui`, defined by:

1. **Brand tokens** extended into `tailwind.config.cjs` under `theme.extend.colors`:
   - `brand.cyan` = `#28caeb` (primary accent; all active/live/progress states)
   - `surface.base` = `#010101` (page background)
   - `surface.panel` = gradient tokens producing the `cmd-panel` glass effect
   - Neutrals retained from Tailwind's `zinc` scale; semantic `red-500` and `amber-500` retained **only** for critical/warning states (safety-critical signaling must remain hue-distinct from informational cyan).

2. **Primitive components** in `packages/ui/src/components/telemetry/`:
   - `<Panel>` / `<PanelHeader>` / `<PanelBody>` — the `cmd-panel` frame
   - `<StatusPill status="active|stable|warning|critical|pending">` — replaces hand-rolled badges
   - `<MetricValue>` — large-number display with mono-uppercase caption
   - `<RadarSweep>`, `<ProgressBar>`, `<SignalUplink>`, `<ComputeBars>`, `<EventLogTable>` — the six reference widgets as data-driven components
   - All animations gated by an `IntersectionObserver` hook (`useInViewAnimation`) that toggles a `data-in-view` attribute; CSS animations are bound to that attribute, so panels below the fold do not consume frames.

3. **Motion policy**: every animated primitive checks `prefers-reduced-motion`. When reduced, progress bars render at final state, sweeps render as static rings, and signal textures are static.

4. **Icon system**: `lucide-react` (already compatible with the reference's `lucide` usage) — not raw SVG.

5. **No shadcn/ui adoption at this stage.** The primitives above are sufficient for the telemetry surface; we will revisit a component library only if non-telemetry pages need complex form/dialog primitives.

## Rationale

- **One accent, not three.** The reference's emerald/orange/indigo scheme reads as a demo, not a product. Collapsing to `brand.cyan` for every "alive" state makes the product recognizable and keeps cognitive load low — operators scanning the console read colour semantically (cyan = live, amber = warning, red = critical) rather than decoratively.
- **Tokens over utility sprawl.** Defining `brand.cyan` and `surface.*` in Tailwind config lets us change the brand in one place. Today, `#28caeb` would otherwise scatter across dozens of className strings.
- **Primitives, not pages.** ADR-012 introduces multiple routes that will reuse the same panel language. Without primitives, each route re-implements the gradient, header, and motion behaviour — the exact drift that prompted this ADR.
- **Motion correctness.** The reference already solved the "animation plays before user scrolls" bug via `IntersectionObserver`. Codifying that as a hook prevents every widget author from rediscovering it.
- **Scope discipline.** Not adopting a full component library avoids a multi-week refactor of existing login/keys/settings pages. Those stay raw-Tailwind; only new telemetry surfaces are governed by the new system.

## Alternatives Considered

| Alternative | Reason Rejected |
|-------------|-----------------|
| Adopt shadcn/ui and rebuild all existing pages on top of it | Large scope; not required for telemetry; delays ADR-012 by weeks |
| Keep reference's multi-hue palette (emerald / orange / indigo) | Off-brand; semantically noisy; operators read three accents as three meanings |
| Define brand tokens as CSS variables only (no Tailwind extension) | Loses IntelliSense and purge benefits; fights the existing Tailwind workflow |
| Implement animations as JS (e.g. framer-motion) | Heavier runtime; reference's CSS-keyframe + `IntersectionObserver` approach is sufficient and cheaper |
| Skip the design system and inline the reference's raw HTML verbatim per-panel | Guarantees drift; negates reuse across ADR-012's panels |

## Implications

- `packages/ui/tailwind.config.cjs` gains a `theme.extend.colors` block and a short `theme.extend.backgroundImage` / `boxShadow` block for the panel glass effect.
- A new directory `packages/ui/src/components/telemetry/` is created. Telemetry widgets must live there and **must not** import from page-level directories.
- Any new page in `src/app` that renders a "live" or "dashboard" surface imports from `components/telemetry` rather than composing raw Tailwind.
- Existing pages (`/login`, `/dashboard/keys`, `/settings`, `/usage`) are **not** refactored as part of this ADR. They may be migrated opportunistically but are out of scope.
- The `brand.cyan` / `surface.base` values are the canonical source; any new hex literal for those colours outside `tailwind.config.cjs` is a violation.
- `lucide-react` is added as a dependency (replacing reference's CDN `lucide` script).

## Enforcement

- **Code review**: PRs introducing hex colour literals matching `#28caeb` or `#010101` outside two permitted sources are rejected. The permitted sources are (a) `packages/ui/tailwind.config.cjs` theme tokens, and (b) a single `:root` CSS custom-property declaration in `packages/ui/src/app/globals.css` that exposes `--brand-cyan` / `--surface-base` for contexts Tailwind utilities cannot reach (SVG `stroke`, inline `linear-gradient(...)`, `background` shorthand).
- **CI (lint rule)**: an ESLint rule in `packages/ui` bans hard-coded hex values matching the brand colours in `className`/`style` anywhere under `src/`; violations fail the build. The rule's ignore list contains exactly the two permitted sources above.
- **Architecture review**: new dashboard routes must use `<Panel>` primitives; review gate verifies imports from `components/telemetry`.
- **Storybook or `/ui-kit` preview route** (optional follow-up): renders every telemetry primitive at once so visual regressions are catchable by eye.
- **Accessibility check**: CI runs axe-core against `/ui-kit`; `prefers-reduced-motion` is exercised in at least one visual snapshot.

## Traceability

- Depends on **ADR/DDD-006** (UI Control Surface Architecture) — this ADR refines the visual language for that surface.
- Is a prerequisite for **ADR-012** (Simulation Live Console UI Surface) — ADR-012 consumes the primitives defined here.
- Does not affect **ADR-006** (CLI as Thin Client) — CLI is unchanged.
- Reference mockup: `/workspaces/agentics-platform/animated-telemetry-dashboard-section (1).tsx`.
- Brand tokens: `#28caeb` (HSL 190° 83% 54%) / `#010101` — originating from brand direction dated 2026-04-23.
