/**
 * ADR-011 Phase A — execution spine snapshot poller.
 *
 * Watches agentics-results-index `GET /api/v1/runs/:id` at 1 Hz (ADR-013),
 * diffs successive snapshots via the deterministic
 * `deriveEventsFromSnapshots` helper in @agentics/contracts, and
 * appends the derived events to `simulation_events`. Stops when the
 * upstream reports a terminal status.
 *
 * Phase B (future): retire this service in favor of the spine emitting
 * events natively. The SSE transport contract is unchanged.
 */

import type { Pool } from 'pg';
import {
  deriveEventsFromSnapshots,
  TERMINAL_KINDS,
  UpstreamSnapshotSchema,
  type UpstreamSnapshot,
} from '@agentics/contracts';
import { SimulationEventsStore } from './simulation-events-store.js';
import { fromResultsIndexRun } from './simulation/orchestration-adapter.js';
import config from '../config.js';

interface PollerLogger {
  info: (o: object, msg?: string) => void;
  warn: (o: object, msg?: string) => void;
  error: (o: object, msg?: string) => void;
}

interface ActivePoll {
  simulationId: string;
  timer: NodeJS.Timeout | null;
  cancelled: boolean;
  prev: UpstreamSnapshot | null;
}

export interface SimulationPollerOptions {
  intervalMs?: number;
  resultsIndexUrl?: string;
}

export class SimulationPoller {
  private readonly store: SimulationEventsStore;
  private readonly intervalMs: number;
  private readonly resultsIndexUrl: string;
  private readonly log: PollerLogger;
  private readonly active = new Map<string, ActivePoll>();

  constructor(
    pool: Pool,
    log: PollerLogger,
    opts: SimulationPollerOptions = {}
  ) {
    this.store = new SimulationEventsStore(pool);
    this.intervalMs = opts.intervalMs ?? 1000;
    this.resultsIndexUrl = opts.resultsIndexUrl ?? config.layer3Endpoints.resultsIndex;
    this.log = log;
  }

  /**
   * Ensure a poller is running for this simulation. Idempotent — calling
   * `watch` repeatedly for the same id is a no-op once active.
   */
  watch(simulationId: string, headers: Record<string, string> = {}): void {
    if (this.active.has(simulationId)) return;

    const state: ActivePoll = {
      simulationId,
      timer: null,
      cancelled: false,
      prev: null,
    };
    this.active.set(simulationId, state);

    const tick = async () => {
      if (state.cancelled) return;
      try {
        const next = await this.fetchSnapshot(simulationId, headers);
        if (!next) {
          // Upstream transient error; keep polling.
          state.timer = setTimeout(tick, this.intervalMs);
          return;
        }
        const derived = deriveEventsFromSnapshots(state.prev, next);
        if (derived.length > 0) {
          await this.store.appendEvents(
            derived.map((d) => ({
              simulation_id: simulationId,
              kind: d.kind,
              payload: d.payload,
            }))
          );
        }
        state.prev = next;

        const terminal = derived.some((d) => TERMINAL_KINDS.has(d.kind));
        if (terminal || ['completed', 'failed', 'cancelled'].includes(next.status)) {
          this.stop(simulationId);
          return;
        }
        state.timer = setTimeout(tick, this.intervalMs);
      } catch (err) {
        this.log.warn(
          { err: String(err), simulationId },
          'simulation-poller tick failed'
        );
        state.timer = setTimeout(tick, this.intervalMs);
      }
    };

    // Fire-and-forget first tick so `watch` stays non-blocking.
    void tick();
  }

  stop(simulationId: string): void {
    const s = this.active.get(simulationId);
    if (!s) return;
    s.cancelled = true;
    if (s.timer) clearTimeout(s.timer);
    this.active.delete(simulationId);
  }

  /** How many simulations are currently being polled. */
  size(): number {
    return this.active.size;
  }

  private async fetchSnapshot(
    simulationId: string,
    headers: Record<string, string>
  ): Promise<UpstreamSnapshot | null> {
    try {
      const res = await fetch(
        `${this.resultsIndexUrl}/api/v1/runs/${encodeURIComponent(simulationId)}`,
        { headers: { Accept: 'application/json', ...headers } }
      );
      if (!res.ok) return null;
      const body = (await res.json()) as unknown;
      const envelope = fromResultsIndexRun(body);
      const parsed = UpstreamSnapshotSchema.safeParse({
        simulation_id: envelope.simulation_id ?? simulationId,
        status: envelope.status,
        progress: envelope.progress,
      });
      if (!parsed.success) {
        this.log.warn(
          { simulationId, issues: parsed.error.issues },
          'upstream snapshot failed schema validation'
        );
        return null;
      }
      return parsed.data;
    } catch (err) {
      this.log.warn(
        { err: String(err), simulationId },
        'upstream snapshot fetch failed'
      );
      return null;
    }
  }
}

/** Singleton accessor — a single poller covers the whole API process. */
let singleton: SimulationPoller | null = null;

export function getSimulationPoller(
  pool: Pool,
  log: PollerLogger,
  opts?: SimulationPollerOptions
): SimulationPoller {
  if (!singleton) singleton = new SimulationPoller(pool, log, opts);
  return singleton;
}
