/**
 * ADR-011 — Simulation events store.
 *
 * Single writer abstraction over `simulation_events`. Appends rows and
 * returns the persisted envelopes (id, seq, ts) ready to be framed as
 * SSE. All writers go through `appendEvents` so the sequence counter
 * stays monotonic per simulation.
 */

import type { Pool } from 'pg';
import {
  SimulationEventKind,
  type SimulationEvent,
} from '@agentics/contracts';

export interface AppendInput {
  simulation_id: string;
  kind: SimulationEventKind;
  payload: unknown;
}

export class SimulationEventsStore {
  constructor(private readonly pool: Pool) {}

  /**
   * Append a batch of events for one simulation in a single transaction.
   * Sequence numbers are assigned atomically from MAX(seq)+1. Returns the
   * persisted rows as fully-typed SimulationEvent envelopes.
   */
  async appendEvents(inputs: AppendInput[]): Promise<SimulationEvent[]> {
    if (inputs.length === 0) return [];

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const sim = inputs[0].simulation_id;
      if (inputs.some((i) => i.simulation_id !== sim)) {
        throw new Error('appendEvents batch must share simulation_id');
      }

      const { rows: seedRows } = await client.query<{ max: number | null }>(
        'SELECT MAX(seq) AS max FROM simulation_events WHERE simulation_id = $1',
        [sim]
      );
      let nextSeq = (seedRows[0]?.max ?? 0) + 1;

      const persisted: SimulationEvent[] = [];
      for (const input of inputs) {
        const { rows } = await client.query<{
          id: string;
          simulation_id: string;
          seq: number;
          ts: Date;
          kind: string;
          payload: unknown;
        }>(
          `INSERT INTO simulation_events (simulation_id, seq, kind, payload)
           VALUES ($1, $2, $3, $4)
           RETURNING id, simulation_id, seq, ts, kind, payload`,
          [input.simulation_id, nextSeq, input.kind, JSON.stringify(input.payload ?? {})]
        );
        nextSeq += 1;

        const row = rows[0];
        persisted.push({
          id: String(row.id),
          simulation_id: row.simulation_id,
          seq: row.seq,
          ts: row.ts.toISOString(),
          kind: row.kind as SimulationEvent['kind'],
          payload: row.payload,
        } as SimulationEvent);
      }

      await client.query('COMMIT');
      return persisted;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Replay rows above the given cursor, ordered by id. Used for SSE
   * reconnect (Last-Event-ID). `afterId` may be undefined to start at 0.
   */
  async replayAfter(
    simulation_id: string,
    afterId: string | undefined,
    limit = 10_000
  ): Promise<SimulationEvent[]> {
    const cursor = afterId ? BigInt(afterId) : 0n;
    const { rows } = await this.pool.query<{
      id: string;
      simulation_id: string;
      seq: number;
      ts: Date;
      kind: string;
      payload: unknown;
    }>(
      `SELECT id, simulation_id, seq, ts, kind, payload
         FROM simulation_events
        WHERE simulation_id = $1 AND id > $2
        ORDER BY id ASC
        LIMIT $3`,
      [simulation_id, cursor.toString(), limit]
    );
    return rows.map((row) => ({
      id: String(row.id),
      simulation_id: row.simulation_id,
      seq: row.seq,
      ts: row.ts.toISOString(),
      kind: row.kind as SimulationEvent['kind'],
      payload: row.payload,
    } as SimulationEvent));
  }
}
