'use client';

/**
 * ADR-012 — React hook that owns the SSE connection for one simulation
 * and reduces the ADR-011 event union into a typed snapshot the panels
 * render from.
 *
 * Wiring:
 *   - opens EventSource against /api/simulations/:id/events (proxy route)
 *   - reducer reconciles steps, metrics, logs, status
 *   - streamState is one of 'connecting' | 'live' | 'disconnected' | 'ended'
 */

import { useEffect, useReducer, useRef } from 'react';
import type {
  SimulationEvent,
  SimulationEventKind,
} from '@agentics/contracts';

export type StreamState = 'connecting' | 'live' | 'disconnected' | 'ended';

export interface LogEntry {
  id: string;
  ref: string;
  operation: string;
  state: 'active' | 'stable' | 'pending' | 'warning' | 'critical' | 'idle';
  timestamp: string;
  kind?: 'ok' | 'warning' | 'pending';
}

export interface SimulationSnapshot {
  simulationId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  totalSteps?: number;
  completedSteps: number;
  currentStep?: string;
  tokensUsed: number;
  apiCalls: number;
  artifactsEmitted: number;
  eventsReceived: number;
  lastEventAt?: number;
  logs: LogEntry[];
  error?: string;
}

type Action =
  | { type: 'event'; event: SimulationEvent }
  | { type: 'reset' };

const INITIAL: SimulationSnapshot = {
  simulationId: '',
  status: 'pending',
  completedSteps: 0,
  tokensUsed: 0,
  apiCalls: 0,
  artifactsEmitted: 0,
  eventsReceived: 0,
  logs: [],
};

function log(entry: LogEntry): LogEntry { return entry; }

function tsOnly(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, '0').slice(0, 2)}`;
}

function reduce(state: SimulationSnapshot, action: Action): SimulationSnapshot {
  if (action.type === 'reset') return { ...INITIAL };
  const ev = action.event;
  const next: SimulationSnapshot = {
    ...state,
    simulationId: ev.simulation_id,
    eventsReceived: state.eventsReceived + 1,
    lastEventAt: Date.now(),
  };
  const payload: any = (ev as any).payload ?? {};

  switch (ev.kind) {
    case 'simulation.created':
      next.totalSteps = payload.total_steps ?? next.totalSteps;
      break;
    case 'simulation.started':
      next.status = 'running';
      break;
    case 'simulation.step.started':
      next.currentStep = payload.step;
      if (typeof payload.total === 'number') next.totalSteps = payload.total;
      next.status = 'running';
      next.logs = [
        log({
          id: ev.id,
          ref: `STEP-${String(payload.index ?? 0).padStart(3, '0')}`,
          operation: `Started: ${payload.step ?? '?'}`,
          state: 'active',
          timestamp: tsOnly(ev.ts),
          kind: 'pending',
        }),
        ...next.logs,
      ].slice(0, 200);
      break;
    case 'simulation.step.completed':
      next.completedSteps = Math.max(next.completedSteps, (payload.index ?? 0) + 1);
      next.logs = [
        log({
          id: ev.id,
          ref: `STEP-${String(payload.index ?? 0).padStart(3, '0')}`,
          operation: `Completed: ${payload.step ?? '?'}`,
          state: 'stable',
          timestamp: tsOnly(ev.ts),
          kind: 'ok',
        }),
        ...next.logs,
      ].slice(0, 200);
      break;
    case 'simulation.log':
      next.logs = [
        log({
          id: ev.id,
          ref: (payload.source ?? 'LOG').toString().slice(0, 8).toUpperCase(),
          operation: payload.message ?? '',
          state: payload.level === 'error' ? 'critical' : payload.level === 'warn' ? 'warning' : 'idle',
          timestamp: tsOnly(ev.ts),
          kind: payload.level === 'error' || payload.level === 'warn' ? 'warning' : 'ok',
        }),
        ...next.logs,
      ].slice(0, 200);
      break;
    case 'simulation.metric':
      if (payload.name === 'tokens_used') next.tokensUsed = payload.value;
      if (payload.name === 'api_calls')   next.apiCalls   = payload.value;
      break;
    case 'simulation.artifact':
      next.artifactsEmitted = next.artifactsEmitted + 1;
      next.logs = [
        log({
          id: ev.id,
          ref: 'ARTIFACT',
          operation: `Emitted: ${payload.name ?? payload.id ?? ''}`,
          state: 'stable',
          timestamp: tsOnly(ev.ts),
          kind: 'ok',
        }),
        ...next.logs,
      ].slice(0, 200);
      break;
    case 'simulation.validation':
      next.logs = [
        log({
          id: ev.id,
          ref: 'VALIDATE',
          operation: payload.check + (payload.message ? `: ${payload.message}` : ''),
          state: payload.passed ? 'stable' : 'warning',
          timestamp: tsOnly(ev.ts),
          kind: payload.passed ? 'ok' : 'warning',
        }),
        ...next.logs,
      ].slice(0, 200);
      break;
    case 'simulation.completed':
      next.status = 'completed';
      if (typeof payload.tokens_used === 'number') next.tokensUsed = payload.tokens_used;
      if (typeof payload.api_calls === 'number')   next.apiCalls   = payload.api_calls;
      break;
    case 'simulation.failed':
      next.status = 'failed';
      next.error = payload.error;
      break;
    case 'simulation.cancelled':
      next.status = 'cancelled';
      break;
  }
  return next;
}

export interface UseSimulationEventsResult {
  snapshot: SimulationSnapshot;
  streamState: StreamState;
}

export function useSimulationEvents(simulationId: string): UseSimulationEventsResult {
  const [snapshot, dispatch] = useReducer(reduce, { ...INITIAL, simulationId });
  const streamStateRef = useRef<StreamState>('connecting');
  const [, force] = useReducer((x: number) => x + 1, 0);

  function setStreamState(s: StreamState) {
    streamStateRef.current = s;
    force();
  }

  useEffect(() => {
    if (!simulationId) return;
    dispatch({ type: 'reset' });
    setStreamState('connecting');

    const url = `/api/simulations/${encodeURIComponent(simulationId)}/events`;
    const es = new EventSource(url, { withCredentials: true });

    const kinds: SimulationEventKind[] = [
      'simulation.created',
      'simulation.started',
      'simulation.step.started',
      'simulation.step.completed',
      'simulation.log',
      'simulation.metric',
      'simulation.artifact',
      'simulation.validation',
      'simulation.completed',
      'simulation.failed',
      'simulation.cancelled',
    ];

    const onKind = (e: MessageEvent) => {
      try {
        const parsed = JSON.parse(e.data) as SimulationEvent;
        dispatch({ type: 'event', event: parsed });
        setStreamState('live');
      } catch {
        /* drop malformed */
      }
    };

    kinds.forEach((k) => es.addEventListener(k, onKind as any));

    es.addEventListener('end', () => {
      setStreamState('ended');
      es.close();
    });

    es.onerror = () => {
      // Browser auto-reconnects. We just reflect the transient state.
      setStreamState('disconnected');
    };

    es.onopen = () => setStreamState('live');

    return () => {
      kinds.forEach((k) => es.removeEventListener(k, onKind as any));
      es.close();
    };
  }, [simulationId]);

  return { snapshot, streamState: streamStateRef.current };
}
