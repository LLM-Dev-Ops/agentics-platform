import { describe, it, expect } from 'vitest';
import {
  toOrchestrationSimulateRequest,
  fromOrchestrationSimulateResponse,
  fromResultsIndexRun,
  fromResultsIndexRunList,
  fromRunnerAbortResponse,
} from '../../../src/services/simulation/orchestration-adapter.js';
import type { SimulationSpecification } from '../../../src/services/simulation/schema.js';

const spec: SimulationSpecification = {
  scenario: 'production-load',
  parameters: { duration: 60, users: 250 },
  metadata: { name: 'Nightly load', description: 'soak', tags: ['nightly'] },
};

describe('toOrchestrationSimulateRequest', () => {
  it('maps the scenario name onto the spine scenario object', () => {
    const req = toOrchestrationSimulateRequest(spec);

    expect(req.scenario.scenarioId).toBe('production-load');
    expect(req.scenario.name).toBe('Nightly load');
    expect(req.scenario.description).toBe('soak');
    expect(req.scenario.tags).toEqual(['nightly']);
    expect(req.scenario.defaultParameters).toEqual({ duration: 60, users: 250 });
  });

  it('converts duration seconds to timeoutMs', () => {
    expect(toOrchestrationSimulateRequest(spec).scenario.timeoutMs).toBe(60_000);
  });

  it('falls back to the scenario name when metadata is absent', () => {
    const req = toOrchestrationSimulateRequest({
      scenario: 'stress-test',
      parameters: {},
    });

    expect(req.scenario.name).toBe('stress-test');
    expect(req.scenario.tags).toEqual([]);
    expect(req.scenario.timeoutMs).toBeUndefined();
  });

  it('produces a body the orchestration engine contract accepts', () => {
    // agentics-orchestration-engine `isValidSimulateRequest` requires an object `scenario`.
    const req = toOrchestrationSimulateRequest(spec);
    expect(typeof req.scenario).toBe('object');
    expect(req.scenario).not.toBeNull();
  });
});

describe('fromOrchestrationSimulateResponse', () => {
  it('extracts identifiers and maps success to completed', () => {
    const env = fromOrchestrationSimulateResponse({
      success: true,
      result: { simulationId: 'sim-1' },
      execution_id: 'exec-1',
      execution_metadata: { simulation_id: 'sim-1', status: 'success' },
    });

    expect(env).toMatchObject({
      simulation_id: 'sim-1',
      execution_id: 'exec-1',
      status: 'completed',
      results: { simulationId: 'sim-1' },
    });
  });

  it('maps partial_success to completed and failure/timeout to failed', () => {
    const status = (s: string) =>
      fromOrchestrationSimulateResponse({
        success: true,
        execution_id: 'e',
        execution_metadata: { status: s },
      }).status;

    expect(status('partial_success')).toBe('completed');
    expect(status('failure')).toBe('failed');
    expect(status('timeout')).toBe('failed');
    expect(status('cancelled')).toBe('cancelled');
  });

  it('surfaces the spine error envelope as failed', () => {
    const env = fromOrchestrationSimulateResponse({
      error: { code: 'CONTRACT_VIOLATION', message: 'bad scenario' },
      execution_metadata: { simulation_id: null, status: 'error' },
    });

    expect(env.status).toBe('failed');
    expect(env.error).toEqual({ code: 'CONTRACT_VIOLATION', message: 'bad scenario' });
  });

  it('defaults to running for an unrecognised upstream status', () => {
    expect(
      fromOrchestrationSimulateResponse({ execution_id: 'e', execution_metadata: {} }).status
    ).toBe('running');
  });

  it('falls back to execution_id when the spine omits simulation_id', () => {
    const env = fromOrchestrationSimulateResponse({
      success: true,
      execution_id: 'exec-9',
      execution_metadata: { status: 'success' },
    });

    expect(env.simulation_id).toBe('exec-9');
  });
});

describe('fromResultsIndexRun', () => {
  it('unwraps the { data } envelope onto the Layer 4 contract', () => {
    const env = fromResultsIndexRun({
      data: {
        run_id: 'run-1',
        simulation_id: 'sim-1',
        execution_id: 'exec-1',
        status: 'completed',
        result_summary: { assertions_passed: 3, assertions_failed: 0 },
      },
      metadata: { requestId: 'req-1' },
    });

    expect(env).toEqual({
      simulation_id: 'sim-1',
      execution_id: 'exec-1',
      status: 'completed',
      progress: 100,
      results: { assertions_passed: 3, assertions_failed: 0 },
    });
  });

  it('maps the results-index timeout status onto failed', () => {
    expect(fromResultsIndexRun({ data: { run_id: 'r', status: 'timeout' } }).status).toBe('failed');
  });

  it('falls back to run_id when canonical ids are missing', () => {
    const env = fromResultsIndexRun({ data: { run_id: 'run-legacy', status: 'failed' } });
    expect(env.simulation_id).toBe('run-legacy');
    expect(env.execution_id).toBe('run-legacy');
  });

  it('reports a non-terminal run as running with zero progress', () => {
    const env = fromResultsIndexRun({ data: { run_id: 'r', status: 'unknown-status' } });
    expect(env.status).toBe('running');
    expect(env.progress).toBe(0);
  });
});

describe('fromResultsIndexRunList', () => {
  it('unwraps result_packet.results and preserves pagination', () => {
    const out = fromResultsIndexRunList({
      result_packet: {
        results: [
          { run_id: 'r1', simulation_id: 's1', status: 'completed' },
          { run_id: 'r2', simulation_id: 's2', status: 'cancelled' },
        ],
        pagination: { total: 2, limit: 50, offset: 0 },
      },
    });

    expect(out.simulations).toHaveLength(2);
    expect(out.simulations[0].simulation_id).toBe('s1');
    expect(out.simulations[1].status).toBe('cancelled');
    expect(out.pagination).toEqual({ total: 2, limit: 50, offset: 0 });
  });

  it('returns an empty list for an empty result packet', () => {
    expect(fromResultsIndexRunList({ result_packet: { results: [] } })).toEqual({
      simulations: [],
    });
  });
});

describe('fromRunnerAbortResponse', () => {
  it('maps a successful abort to cancelled', () => {
    expect(fromRunnerAbortResponse('sim-1', { success: true, result: { aborted: true } })).toEqual({
      simulation_id: 'sim-1',
      execution_id: 'sim-1',
      status: 'cancelled',
      results: { aborted: true },
    });
  });

  it('maps a rejected abort to failed and keeps the runner error', () => {
    const env = fromRunnerAbortResponse('sim-1', { success: false, error: 'not running' });
    expect(env.status).toBe('failed');
    expect(env.error).toBe('not running');
  });
});
