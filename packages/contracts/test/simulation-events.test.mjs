/**
 * ADR-011 — Phase A correctness test for deriveEventsFromSnapshots.
 *
 * Node's built-in test runner; imports the compiled dist so this stays
 * runtime-agnostic (works without ts-node/vitest in this workspace).
 * Run:  node --test test/simulation-events.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveEventsFromSnapshots,
  SimulationEventKind,
  SimulationEventSchema,
  formatSSE,
  TERMINAL_KINDS,
} from '../dist/simulation-events.js';

const baseSnap = {
  simulation_id: '11111111-1111-1111-1111-111111111111',
  status: 'pending',
};

test('first observation emits Created', () => {
  const events = deriveEventsFromSnapshots(null, { ...baseSnap, total_steps: 4 });
  assert.equal(events[0].kind, SimulationEventKind.Created);
  assert.equal(events[0].payload.total_steps, 4);
});

test('pending -> running emits Started', () => {
  const prev = { ...baseSnap, status: 'pending' };
  const next = { ...baseSnap, status: 'running', updated_at: '2026-04-23T00:00:00Z' };
  const events = deriveEventsFromSnapshots(prev, next);
  assert.ok(events.some((e) => e.kind === SimulationEventKind.Started));
});

test('step transition emits StepCompleted then StepStarted in order', () => {
  const prev = { ...baseSnap, status: 'running', current_step: 'parse', completed_steps: 0, total_steps: 3 };
  const next = { ...baseSnap, status: 'running', current_step: 'validate', completed_steps: 1, total_steps: 3 };
  const events = deriveEventsFromSnapshots(prev, next);
  assert.equal(events[0].kind, SimulationEventKind.StepCompleted);
  assert.equal(events[0].payload.step, 'parse');
  assert.equal(events[1].kind, SimulationEventKind.StepStarted);
  assert.equal(events[1].payload.step, 'validate');
  assert.equal(events[1].payload.index, 1);
});

test('metric deltas emit only on change', () => {
  const prev = { ...baseSnap, status: 'running', metrics: { tokens_used: 100, api_calls: 2 } };
  const next = { ...baseSnap, status: 'running', metrics: { tokens_used: 150, api_calls: 2 } };
  const events = deriveEventsFromSnapshots(prev, next);
  const metrics = events.filter((e) => e.kind === SimulationEventKind.Metric);
  assert.equal(metrics.length, 1);
  assert.equal(metrics[0].payload.name, 'tokens_used');
  assert.equal(metrics[0].payload.value, 150);
});

test('running -> completed emits Completed (terminal)', () => {
  const prev = { ...baseSnap, status: 'running', metrics: { tokens_used: 500, api_calls: 10, execution_time: 12.5 } };
  const next = { ...baseSnap, status: 'completed', metrics: { tokens_used: 500, api_calls: 10, execution_time: 12.5 } };
  const events = deriveEventsFromSnapshots(prev, next);
  const term = events.find((e) => e.kind === SimulationEventKind.Completed);
  assert.ok(term);
  assert.equal(term.payload.duration_ms, 12500);
  assert.ok(TERMINAL_KINDS.has(term.kind));
});

test('determinism: same input → same output', () => {
  const prev = { ...baseSnap, status: 'running', current_step: 'a', completed_steps: 0, total_steps: 3, metrics: { tokens_used: 1 } };
  const next = { ...baseSnap, status: 'running', current_step: 'b', completed_steps: 1, total_steps: 3, metrics: { tokens_used: 2 } };
  const a = deriveEventsFromSnapshots(prev, next);
  const b = deriveEventsFromSnapshots(prev, next);
  assert.deepEqual(a, b);
});

test('schema validates a framed SSE envelope', () => {
  const envelope = {
    id: '42',
    simulation_id: '11111111-1111-1111-1111-111111111111',
    seq: 1,
    ts: new Date().toISOString(),
    kind: SimulationEventKind.Created,
    payload: { total_steps: 3 },
  };
  const res = SimulationEventSchema.safeParse(envelope);
  assert.equal(res.success, true);
  const frame = formatSSE(envelope);
  assert.ok(frame.includes('event: simulation.created'));
  assert.ok(frame.includes('id: 42'));
});

test('terminal transition to failed carries error string', () => {
  const prev = { ...baseSnap, status: 'running' };
  const next = { ...baseSnap, status: 'failed', error: 'upstream oom' };
  const events = deriveEventsFromSnapshots(prev, next);
  const failed = events.find((e) => e.kind === SimulationEventKind.Failed);
  assert.ok(failed);
  assert.equal(failed.payload.error, 'upstream oom');
});
