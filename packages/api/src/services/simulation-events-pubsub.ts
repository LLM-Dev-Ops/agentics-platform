/**
 * ADR-011 — Postgres LISTEN/NOTIFY fan-out for simulation_events.
 *
 * A single connection holds `LISTEN simulation_events_channel`. Every
 * incoming notification is dispatched to subscribers keyed by
 * simulation_id. SSE handlers subscribe here and pull new rows from
 * SimulationEventsStore when notified.
 *
 * Using one connection keeps us below the Postgres connection cap
 * regardless of how many browser tabs are open.
 */

import { Client } from 'pg';

export interface NotifyPayload {
  simulation_id: string;
  id: string;
  kind: string;
}

type Listener = (payload: NotifyPayload) => void;

export class SimulationEventsPubSub {
  private client: Client | null = null;
  private readonly subs = new Map<string, Set<Listener>>();
  private starting: Promise<void> | null = null;

  constructor(private readonly connectionString: string) {}

  async start(): Promise<void> {
    if (this.client) return;
    if (this.starting) return this.starting;
    this.starting = (async () => {
      const c = new Client({
        connectionString: this.connectionString,
        ssl: { rejectUnauthorized: false },
      });
      c.on('notification', (msg) => {
        if (msg.channel !== 'simulation_events_channel' || !msg.payload) return;
        try {
          const parsed = JSON.parse(msg.payload) as NotifyPayload;
          const set = this.subs.get(parsed.simulation_id);
          set?.forEach((fn) => {
            try {
              fn(parsed);
            } catch {
              /* isolate per-listener errors */
            }
          });
        } catch {
          /* malformed notification — drop */
        }
      });
      c.on('error', () => {
        // On connection loss, tear down; next subscribe will restart.
        this.client = null;
      });
      await c.connect();
      await c.query('LISTEN simulation_events_channel');
      this.client = c;
    })();
    try {
      await this.starting;
    } finally {
      this.starting = null;
    }
  }

  async stop(): Promise<void> {
    const c = this.client;
    this.client = null;
    if (c) {
      try {
        await c.query('UNLISTEN simulation_events_channel');
      } catch {
        /* ignore */
      }
      await c.end().catch(() => {});
    }
    this.subs.clear();
  }

  subscribe(simulationId: string, fn: Listener): () => void {
    let set = this.subs.get(simulationId);
    if (!set) {
      set = new Set();
      this.subs.set(simulationId, set);
    }
    set.add(fn);
    return () => {
      set!.delete(fn);
      if (set!.size === 0) this.subs.delete(simulationId);
    };
  }
}

let singleton: SimulationEventsPubSub | null = null;

export function getSimulationEventsPubSub(): SimulationEventsPubSub {
  if (!singleton) {
    singleton = new SimulationEventsPubSub(process.env.DATABASE_URL || '');
  }
  return singleton;
}
