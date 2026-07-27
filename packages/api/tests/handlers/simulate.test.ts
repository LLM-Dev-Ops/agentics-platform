/**
 * ADR-013 regression guard.
 *
 * The original simulation path forwarded to research-core `POST /simulations`,
 * which 404s — the public simulation API had never executed anything. The fake
 * fleet below reproduces that: it answers only the endpoints the spine actually
 * serves and 404s everything else, exactly as `research-core/src/server.ts:113`
 * does. These tests therefore fail against the pre-ADR-013 target and pass only
 * against the orchestration spine.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import {
  createSimulationHandler,
  getSimulationHandler,
  listSimulationsHandler,
  deleteSimulationHandler,
} from '../../src/handlers/simulate.js';
import config from '../../src/config.js';

const ORCHESTRATION = config.layer3Endpoints.orchestration;
const RESULTS_INDEX = config.layer3Endpoints.resultsIndex;
const RUNNER = config.layer3Endpoints.simulationRunner;

interface Call {
  method: string;
  url: string;
  body: unknown;
}

let calls: Call[] = [];

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/**
 * Stands in for the deployed fleet. Only real spine routes answer; anything
 * else 404s the way research-core does.
 */
async function fakeFleet(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = String(input);
  const method = init?.method ?? 'GET';
  const body = init?.body ? JSON.parse(String(init.body)) : undefined;
  calls.push({ method, url, body });

  if (method === 'POST' && url === `${ORCHESTRATION}/v1/simulate`) {
    return json(200, {
      success: true,
      result: { simulationId: 'sim-abc' },
      execution_id: 'exec-abc',
      execution_metadata: { simulation_id: 'sim-abc', status: 'success' },
    });
  }

  if (method === 'GET' && url.startsWith(`${RESULTS_INDEX}/api/v1/runs/`)) {
    return json(200, {
      data: {
        run_id: 'run-abc',
        simulation_id: 'sim-abc',
        execution_id: 'exec-abc',
        status: 'completed',
        result_summary: { assertions_passed: 2, assertions_failed: 0 },
      },
      metadata: { requestId: 'req-1' },
    });
  }

  if (method === 'GET' && url.startsWith(`${RESULTS_INDEX}/api/v1/runs`)) {
    return json(200, {
      result_packet: {
        results: [{ run_id: 'run-abc', simulation_id: 'sim-abc', status: 'completed' }],
        pagination: { total: 1, limit: 50, offset: 0 },
      },
    });
  }

  if (method === 'POST' && url.startsWith(`${RUNNER}/v1/runner/abort/`)) {
    return json(200, { success: true, result: { aborted: true } });
  }

  return json(404, { error: 'Not Found', message: `Cannot ${method} ${url}` });
}

function buildApp(): FastifyInstance {
  const app = Fastify();
  app.addHook('onRequest', async (request) => {
    (request as any).identity = { userId: 'user-1', scopes: ['research:write', 'research:read'] };
  });
  app.post('/v1/simulate', createSimulationHandler as any);
  app.get('/v1/simulate', listSimulationsHandler as any);
  app.get('/v1/simulate/:id', getSimulationHandler as any);
  app.delete('/v1/simulate/:id', deleteSimulationHandler as any);
  return app;
}

let app: FastifyInstance;

beforeEach(async () => {
  calls = [];
  vi.stubGlobal('fetch', vi.fn(fakeFleet));
  app = buildApp();
  await app.ready();
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await app.close();
});

describe('POST /v1/simulate', () => {
  it('returns a simulation identifier originating from the orchestration engine', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/simulate',
      payload: { specification: { scenario: 'production-load', parameters: { duration: 60 } } },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      simulation_id: 'sim-abc',
      execution_id: 'exec-abc',
      status: 'completed',
    });
  });

  it('targets agentics-orchestration-engine POST /v1/simulate, never research POST /simulations', async () => {
    await app.inject({
      method: 'POST',
      url: '/v1/simulate',
      payload: { specification: { scenario: 'production-load', parameters: {} } },
    });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(`${ORCHESTRATION}/v1/simulate`);
    expect(calls.some((c) => c.url.includes('/simulations'))).toBe(false);
    expect(calls.some((c) => c.url.startsWith(config.layer3Endpoints.research))).toBe(false);
  });

  it('sends a spine-shaped scenario object rather than the raw specification', async () => {
    await app.inject({
      method: 'POST',
      url: '/v1/simulate',
      payload: {
        specification: { scenario: 'production-load', parameters: { users: 10 } },
      },
    });

    expect(calls[0].body).toEqual({
      scenario: {
        scenarioId: 'production-load',
        name: 'production-load',
        description: '',
        tags: [],
        defaultParameters: { users: 10 },
      },
    });
  });

  it('compiles cli_flags before delegating', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/simulate',
      payload: { cli_flags: { scenario: 'stress-test', users: 5 } },
    });

    expect(res.statusCode).toBe(200);
    expect((calls[0].body as any).scenario.scenarioId).toBe('stress-test');
  });

  it('rejects an uncompilable input without calling the spine', async () => {
    const res = await app.inject({ method: 'POST', url: '/v1/simulate', payload: {} });

    expect(res.statusCode).toBe(400);
    expect(calls).toHaveLength(0);
  });
});

describe('GET /v1/simulate/:id', () => {
  it('resolves status against agentics-results-index', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/simulate/sim-abc' });

    expect(res.statusCode).toBe(200);
    expect(calls[0].url).toBe(`${RESULTS_INDEX}/api/v1/runs/sim-abc`);
    expect(res.json()).toMatchObject({
      simulation_id: 'sim-abc',
      status: 'completed',
      progress: 100,
    });
  });

  it('passes an upstream 404 through untranslated', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json(404, { error: { code: 'NOT_FOUND', message: 'no such run' } }))
    );

    const res = await app.inject({ method: 'GET', url: '/v1/simulate/missing' });

    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: { code: 'NOT_FOUND', message: 'no such run' } });
  });
});

describe('GET /v1/simulate', () => {
  it('lists runs from agentics-results-index', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/simulate' });

    expect(res.statusCode).toBe(200);
    expect(calls[0].url.startsWith(`${RESULTS_INDEX}/api/v1/runs`)).toBe(true);
    expect(res.json().simulations).toHaveLength(1);
  });
});

describe('DELETE /v1/simulate/:id', () => {
  it('aborts via agentics-simulation-runner', async () => {
    const res = await app.inject({ method: 'DELETE', url: '/v1/simulate/sim-abc' });

    expect(res.statusCode).toBe(200);
    expect(calls[0]).toMatchObject({
      method: 'POST',
      url: `${RUNNER}/v1/runner/abort/sim-abc`,
    });
    expect(res.json()).toMatchObject({ simulation_id: 'sim-abc', status: 'cancelled' });
  });
});

describe('the retired research-core path', () => {
  it('404s, which is why ADR-013 repointed it', async () => {
    const res = await fakeFleet(`${config.layer3Endpoints.research}/simulations`, {
      method: 'POST',
      body: JSON.stringify({ specification: {} }),
    });

    expect(res.status).toBe(404);
  });
});
