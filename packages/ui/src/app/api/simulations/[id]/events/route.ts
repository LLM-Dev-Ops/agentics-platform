/**
 * ADR-012 — Authenticated SSE proxy.
 *
 * Browser EventSource can't set an Authorization header, so the UI
 * opens a same-origin stream here. This route reads the Supabase
 * session server-side, opens an upstream SSE fetch against the Layer
 * 4 API with `Authorization: Bearer <jwt>`, and pipes the response
 * body back unchanged.
 *
 * The upstream owns event shape, Last-Event-ID replay, heartbeats,
 * and the `event: end` close; we are strictly a credential injector.
 */

import { NextRequest } from 'next/server';
import { getServerAccessToken } from '@/lib/supabase-server';

// Node runtime — Edge runtime does not reliably support long-lived
// streams of this form on Cloud Run.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UPSTREAM_ORIGIN =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const accessToken = await getServerAccessToken();
  if (!accessToken) {
    return new Response(
      JSON.stringify({ error: 'unauthenticated', code: 'UNAUTHENTICATED' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const simulationId = params.id;
  if (!simulationId) {
    return new Response(
      JSON.stringify({ error: 'simulation id required', code: 'INVALID_REQUEST' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const upstreamUrl = new URL(
    `/v1/simulations/${encodeURIComponent(simulationId)}/events`,
    UPSTREAM_ORIGIN
  );

  const headers: Record<string, string> = {
    Accept: 'text/event-stream',
    Authorization: `Bearer ${accessToken}`,
    'Cache-Control': 'no-cache',
  };
  const lastEventId = request.headers.get('last-event-id');
  if (lastEventId) headers['Last-Event-ID'] = lastEventId;

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      headers,
      // AbortSignal from the inbound request propagates cancellation so
      // when the browser closes its EventSource, we close the upstream.
      signal: request.signal,
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'upstream unreachable', code: 'UPSTREAM_UNREACHABLE' }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Forward non-stream errors (401/403/4xx) as JSON pass-through.
  const contentType = upstream.headers.get('content-type') ?? '';
  if (!upstream.ok || !contentType.includes('text/event-stream')) {
    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: {
        'Content-Type': contentType || 'application/json',
      },
    });
  }

  // Happy path: pipe the upstream SSE bytes straight through.
  return new Response(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
