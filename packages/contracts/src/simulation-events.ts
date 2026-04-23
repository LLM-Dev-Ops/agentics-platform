/**
 * ADR-011 — Simulation telemetry event contracts.
 *
 * Discriminated union over every event the platform emits during a
 * simulation. Serialized to SSE as JSON in the `data:` field with
 * `event: <kind>`; durably stored in Postgres `simulation_events`.
 *
 * Both the Fastify API (producer, Phase A poller or Phase B native)
 * and every consumer (CLI, UI `useSimulationEvents` hook) import
 * from this file. Adding a new `kind` requires updating:
 *   - the union below
 *   - the SimulationEventKind enum
 *   - the Phase A poller diff logic (if derivable from upstream state)
 *   - the UI renderers that care about it.
 */

import { z } from 'zod';

/** Canonical set of event kinds. Extend, never rename. */
export const SimulationEventKind = {
  Created: 'simulation.created',
  Started: 'simulation.started',
  StepStarted: 'simulation.step.started',
  StepCompleted: 'simulation.step.completed',
  Log: 'simulation.log',
  Metric: 'simulation.metric',
  Artifact: 'simulation.artifact',
  Validation: 'simulation.validation',
  Completed: 'simulation.completed',
  Failed: 'simulation.failed',
  Cancelled: 'simulation.cancelled',
} as const;
export type SimulationEventKind =
  (typeof SimulationEventKind)[keyof typeof SimulationEventKind];

/** Terminal kinds close the SSE stream (server emits `event: end` after). */
export const TERMINAL_KINDS: ReadonlySet<SimulationEventKind> = new Set([
  SimulationEventKind.Completed,
  SimulationEventKind.Failed,
  SimulationEventKind.Cancelled,
]);

// ----------------------------------------------------------------------------
// Payload schemas — one per kind. Keep payloads small; put blobs in artifacts.
// ----------------------------------------------------------------------------

const CreatedPayload = z.object({
  name: z.string().optional(),
  scenario: z.string().optional(),
  total_steps: z.number().int().nonnegative().optional(),
});

const StartedPayload = z.object({
  started_at: z.string(),
});

const StepStartedPayload = z.object({
  step: z.string(),
  index: z.number().int().nonnegative(),
  total: z.number().int().nonnegative().optional(),
});

const StepCompletedPayload = z.object({
  step: z.string(),
  index: z.number().int().nonnegative(),
  duration_ms: z.number().nonnegative().optional(),
});

const LogPayload = z.object({
  level: z.enum(['debug', 'info', 'warn', 'error']),
  message: z.string(),
  source: z.string().optional(),
});

const MetricPayload = z.object({
  name: z.string(),
  value: z.number(),
  unit: z.string().optional(),
});

const ArtifactPayload = z.object({
  id: z.string(),
  name: z.string().optional(),
  bytes: z.number().int().nonnegative().optional(),
  content_type: z.string().optional(),
});

const ValidationPayload = z.object({
  passed: z.boolean(),
  check: z.string(),
  message: z.string().optional(),
});

const CompletedPayload = z.object({
  duration_ms: z.number().nonnegative().optional(),
  tokens_used: z.number().int().nonnegative().optional(),
  api_calls: z.number().int().nonnegative().optional(),
});

const FailedPayload = z.object({
  error: z.string(),
  code: z.string().optional(),
});

const CancelledPayload = z.object({
  reason: z.string().optional(),
});

// ----------------------------------------------------------------------------
// Base envelope: id (Postgres bigserial string), seq (per-sim), ts (ISO).
// `id` is the SSE Last-Event-ID cursor.
// ----------------------------------------------------------------------------

const Envelope = z.object({
  id: z.string(),
  simulation_id: z.string().uuid(),
  seq: z.number().int().positive(),
  ts: z.string(),
});

export const SimulationEventSchema = z.discriminatedUnion('kind', [
  Envelope.extend({ kind: z.literal(SimulationEventKind.Created),       payload: CreatedPayload }),
  Envelope.extend({ kind: z.literal(SimulationEventKind.Started),       payload: StartedPayload }),
  Envelope.extend({ kind: z.literal(SimulationEventKind.StepStarted),   payload: StepStartedPayload }),
  Envelope.extend({ kind: z.literal(SimulationEventKind.StepCompleted), payload: StepCompletedPayload }),
  Envelope.extend({ kind: z.literal(SimulationEventKind.Log),           payload: LogPayload }),
  Envelope.extend({ kind: z.literal(SimulationEventKind.Metric),        payload: MetricPayload }),
  Envelope.extend({ kind: z.literal(SimulationEventKind.Artifact),      payload: ArtifactPayload }),
  Envelope.extend({ kind: z.literal(SimulationEventKind.Validation),    payload: ValidationPayload }),
  Envelope.extend({ kind: z.literal(SimulationEventKind.Completed),     payload: CompletedPayload }),
  Envelope.extend({ kind: z.literal(SimulationEventKind.Failed),        payload: FailedPayload }),
  Envelope.extend({ kind: z.literal(SimulationEventKind.Cancelled),     payload: CancelledPayload }),
]);

export type SimulationEvent = z.infer<typeof SimulationEventSchema>;

// ----------------------------------------------------------------------------
// Upstream snapshot shape used by the Phase A poller. Kept minimal and lenient
// so it tracks whatever Research Core actually returns today.
// ----------------------------------------------------------------------------

export const UpstreamSnapshotSchema = z.object({
  simulation_id: z.string(),
  status: z.enum(['pending', 'running', 'completed', 'failed', 'cancelled']),
  progress: z.number().min(0).max(100).optional(),
  current_step: z.string().optional(),
  total_steps: z.number().int().nonnegative().optional(),
  completed_steps: z.number().int().nonnegative().optional(),
  error: z.string().optional(),
  metrics: z
    .object({
      tokens_used: z.number().optional(),
      api_calls: z.number().optional(),
      execution_time: z.number().optional(),
    })
    .partial()
    .optional(),
  updated_at: z.string().optional(),
});
export type UpstreamSnapshot = z.infer<typeof UpstreamSnapshotSchema>;

// ----------------------------------------------------------------------------
// Derive events from upstream snapshot diffs. Deterministic — given the same
// (prev, next) pair you always produce the same set of derived events. Used
// by the Phase A poller; covered by contract tests.
// ----------------------------------------------------------------------------

export interface DiffDerivedEvent {
  kind: SimulationEventKind;
  payload: unknown;
}

export function deriveEventsFromSnapshots(
  prev: UpstreamSnapshot | null,
  next: UpstreamSnapshot
): DiffDerivedEvent[] {
  const out: DiffDerivedEvent[] = [];

  // First observation: seed with Created (+ Started if already running).
  if (!prev) {
    out.push({
      kind: SimulationEventKind.Created,
      payload: { total_steps: next.total_steps },
    });
    if (next.status === 'running' || next.status === 'completed') {
      out.push({
        kind: SimulationEventKind.Started,
        payload: { started_at: next.updated_at ?? new Date().toISOString() },
      });
    }
  }

  if (prev && prev.status !== 'running' && next.status === 'running') {
    out.push({
      kind: SimulationEventKind.Started,
      payload: { started_at: next.updated_at ?? new Date().toISOString() },
    });
  }

  // Step transitions — current_step change implies the prior step completed
  // and the new one started. `completed_steps` gives us the index.
  const prevStep = prev?.current_step;
  const nextStep = next.current_step;
  if (nextStep && prevStep && nextStep !== prevStep) {
    const idx = next.completed_steps ?? 0;
    out.push({
      kind: SimulationEventKind.StepCompleted,
      payload: { step: prevStep, index: Math.max(0, idx - 1) },
    });
    out.push({
      kind: SimulationEventKind.StepStarted,
      payload: { step: nextStep, index: idx, total: next.total_steps },
    });
  } else if (nextStep && !prevStep) {
    out.push({
      kind: SimulationEventKind.StepStarted,
      payload: {
        step: nextStep,
        index: next.completed_steps ?? 0,
        total: next.total_steps,
      },
    });
  }

  // Metric deltas — emit only on change.
  if (
    next.metrics?.tokens_used !== undefined &&
    prev?.metrics?.tokens_used !== next.metrics.tokens_used
  ) {
    out.push({
      kind: SimulationEventKind.Metric,
      payload: { name: 'tokens_used', value: next.metrics.tokens_used, unit: 'tokens' },
    });
  }
  if (
    next.metrics?.api_calls !== undefined &&
    prev?.metrics?.api_calls !== next.metrics.api_calls
  ) {
    out.push({
      kind: SimulationEventKind.Metric,
      payload: { name: 'api_calls', value: next.metrics.api_calls, unit: 'calls' },
    });
  }

  // Terminal transitions.
  if (prev?.status !== next.status) {
    if (next.status === 'completed') {
      out.push({
        kind: SimulationEventKind.Completed,
        payload: {
          duration_ms: next.metrics?.execution_time
            ? Math.round(next.metrics.execution_time * 1000)
            : undefined,
          tokens_used: next.metrics?.tokens_used,
          api_calls: next.metrics?.api_calls,
        },
      });
    } else if (next.status === 'failed') {
      out.push({
        kind: SimulationEventKind.Failed,
        payload: { error: next.error ?? 'simulation failed' },
      });
    } else if (next.status === 'cancelled') {
      out.push({ kind: SimulationEventKind.Cancelled, payload: {} });
    }
  }

  return out;
}

/** Format a single event as an SSE message frame. */
export function formatSSE(event: SimulationEvent): string {
  return [
    `id: ${event.id}`,
    `event: ${event.kind}`,
    `data: ${JSON.stringify(event)}`,
    '',
    '',
  ].join('\n');
}
