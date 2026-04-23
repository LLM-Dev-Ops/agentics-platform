/**
 * ADR-011 — SSE route for live simulation telemetry.
 *
 *   GET /v1/simulations/:id/events
 *     Auth: Supabase JWT OR API key (research:read scope)
 *     Headers: Accept: text/event-stream, optional Last-Event-ID
 *     Response: text/event-stream
 *       event: <kind>
 *       id:    <bigserial>
 *       data:  <json envelope>
 *
 * Flow:
 *   1. authMiddleware runs
 *   2. ensure Phase A poller is watching this simulation
 *   3. replay rows > Last-Event-ID (if any)
 *   4. subscribe to pubsub; pull incremental rows on notification
 *   5. close with `event: end` on terminal kind
 *
 * A 15s heartbeat (`: ping\n\n`) keeps proxies from idling the connection.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import {
  formatSSE,
  TERMINAL_KINDS,
  type SimulationEvent,
} from '@agentics/contracts';
import { SimulationEventsStore } from '../services/simulation-events-store.js';
import { getSimulationEventsPubSub } from '../services/simulation-events-pubsub.js';
import { getSimulationPoller } from '../services/simulation-poller.js';

const HEARTBEAT_MS = 15_000;
const SERVER_MAX_MS = 55 * 60_000; // 55 minutes — reconnect before Cloud Run cap

async function handleEventsStream(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
): Promise<void> {
  const simulationId = request.params.id;
  if (!simulationId) {
    reply.code(400).send({ error: 'simulation id required', code: 'INVALID_REQUEST' });
    return;
  }

  // Auth context is attached by authMiddleware.
  const identity = (request as any).identity;
  const scopes: string[] = (identity?.scopes ?? []) as string[];
  if (!scopes.includes('research:read') && !scopes.includes('*')) {
    reply.code(403).send({ error: 'research:read scope required', code: 'FORBIDDEN' });
    return;
  }

  const store = new SimulationEventsStore(db);
  const pubsub = getSimulationEventsPubSub();
  const poller = getSimulationPoller(db, request.log as any);

  // Raw streaming — bypass Fastify's response serializer.
  const res = reply.raw;
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable proxy buffering
  reply.hijack(); // tell Fastify we own the socket now

  let closed = false;
  let lastId: string | undefined =
    (request.headers['last-event-id'] as string | undefined) ||
    (request.query as any)?.last_event_id ||
    undefined;

  const write = (frame: string) => {
    if (closed) return;
    try {
      res.write(frame);
    } catch {
      cleanup();
    }
  };
  const writeEvent = (ev: SimulationEvent) => {
    write(formatSSE(ev));
    if (TERMINAL_KINDS.has(ev.kind)) {
      write('event: end\ndata: {}\n\n');
      cleanup();
    }
    if (ev.id) lastId = ev.id;
  };

  const heartbeat = setInterval(() => write(': ping\n\n'), HEARTBEAT_MS);
  const maxTimer = setTimeout(() => {
    write('event: timeout\ndata: {"reason":"server-max"}\n\n');
    cleanup();
  }, SERVER_MAX_MS);

  let unsubscribe: (() => void) | null = null;

  const cleanup = () => {
    if (closed) return;
    closed = true;
    clearInterval(heartbeat);
    clearTimeout(maxTimer);
    if (unsubscribe) unsubscribe();
    try {
      res.end();
    } catch {
      /* ignore */
    }
  };

  res.on('close', cleanup);

  // Ensure upstream poller is watching this simulation (Phase A).
  const upstreamHeaders: Record<string, string> = {};
  const cliAuth = request.headers.authorization;
  if (cliAuth) upstreamHeaders.Authorization = cliAuth;
  poller.watch(simulationId, upstreamHeaders);

  try {
    await pubsub.start();

    // Replay any rows the client hasn't seen.
    const backlog = await store.replayAfter(simulationId, lastId);
    for (const ev of backlog) writeEvent(ev);
    if (closed) return;

    // Subscribe to live notifications. On each, pull deltas > lastId.
    let pulling = false;
    const pullDeltas = async () => {
      if (closed || pulling) return;
      pulling = true;
      try {
        const rows = await store.replayAfter(simulationId, lastId);
        for (const ev of rows) writeEvent(ev);
      } catch (err) {
        request.log.warn({ err: String(err), simulationId }, 'pullDeltas failed');
      } finally {
        pulling = false;
      }
    };

    unsubscribe = pubsub.subscribe(simulationId, () => {
      void pullDeltas();
    });

    // One defensive pull in case a notify raced us between replay and subscribe.
    void pullDeltas();
  } catch (err) {
    request.log.error({ err: String(err), simulationId }, 'SSE setup failed');
    write('event: error\ndata: {"code":"SSE_SETUP_FAILED"}\n\n');
    cleanup();
  }
}

export async function registerSimulationEventsRoutes(fastify: FastifyInstance) {
  fastify.get('/v1/simulations/:id/events', {
    onRequest: [authMiddleware],
    handler: handleEventsStream,
  });
}
