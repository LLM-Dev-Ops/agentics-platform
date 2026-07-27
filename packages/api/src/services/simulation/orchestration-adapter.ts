/**
 * Orchestration Spine Adapter
 *
 * Translates between Layer 4's public simulation contract and the Layer 3.5
 * execution spine (ADR-013).
 *
 * Layer 4 speaks `SimulationSpecification` in and `{ simulation_id, status, ... }` out.
 * The spine speaks:
 *   - agentics-orchestration-engine  POST /v1/simulate   { scenario, config? }
 *   - agentics-results-index         GET  /api/v1/runs[/:id]
 *   - agentics-simulation-runner     POST /v1/runner/abort/:id
 *
 * This module performs the mapping. It executes nothing.
 */

import type { SimulationSpecification } from './schema.js';

/**
 * Layer 4's public simulation status vocabulary.
 */
export type SimulationStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface SimulationEnvelope {
  simulation_id: string | null;
  execution_id: string | null;
  status: SimulationStatus;
  progress?: number;
  results?: unknown;
  error?: unknown;
}

/**
 * agentics-orchestration-engine `execution_metadata.status`
 * (`agentics-orchestration-engine/src/server.ts` — `ExecutionMetadata`).
 */
const ORCHESTRATION_STATUS_MAP: Record<string, SimulationStatus> = {
  success: 'completed',
  partial_success: 'completed',
  failure: 'failed',
  error: 'failed',
  timeout: 'failed',
  cancelled: 'cancelled',
};

/**
 * agentics-results-index `VALID_STATUSES`
 * (`agentics-results-index/src/types/index.ts:7`).
 */
const RESULTS_INDEX_STATUS_MAP: Record<string, SimulationStatus> = {
  completed: 'completed',
  failed: 'failed',
  cancelled: 'cancelled',
  timeout: 'failed',
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * Build an orchestration-engine `SimulateRequest` from a compiled specification.
 *
 * Layer 4's `scenario` is a name; the spine's `scenario` is a structured object.
 * The engine's `normalizeRequest` fills in the remaining scenario fields with
 * defaults, so only the identifying and parameter-carrying fields are mapped here.
 */
export function toOrchestrationSimulateRequest(
  spec: SimulationSpecification
): { scenario: Record<string, unknown> } {
  const metadata = spec.metadata ?? {};

  const scenario: Record<string, unknown> = {
    scenarioId: spec.scenario,
    name: typeof metadata.name === 'string' ? metadata.name : spec.scenario,
    description: typeof metadata.description === 'string' ? metadata.description : '',
    tags: Array.isArray(metadata.tags) ? metadata.tags : [],
    defaultParameters: spec.parameters,
  };

  if (typeof spec.parameters.duration === 'number') {
    scenario.timeoutMs = spec.parameters.duration * 1000;
  }

  return { scenario };
}

/**
 * Normalize an orchestration-engine `POST /v1/simulate` response body.
 *
 * Success: `{ success: true, result, execution_id, execution_metadata }`
 * Error:   `{ error: { code, message, details }, execution_metadata }`
 */
export function fromOrchestrationSimulateResponse(body: unknown): SimulationEnvelope {
  const root = asRecord(body);
  const meta = asRecord(root.execution_metadata);

  const executionId = asString(root.execution_id) ?? asString(meta.execution_id);
  const simulationId = asString(meta.simulation_id) ?? executionId;

  if (root.error !== undefined) {
    return {
      simulation_id: simulationId,
      execution_id: executionId,
      status: ORCHESTRATION_STATUS_MAP[String(meta.status)] ?? 'failed',
      error: root.error,
    };
  }

  return {
    simulation_id: simulationId,
    execution_id: executionId,
    status: ORCHESTRATION_STATUS_MAP[String(meta.status)] ?? 'running',
    results: root.result,
  };
}

/**
 * Normalize an agentics-results-index `GET /api/v1/runs/:id` response body.
 *
 * Body: `{ data: SimulationExecutionResult, metadata: { requestId } }`
 */
export function fromResultsIndexRun(body: unknown): SimulationEnvelope {
  const run = asRecord(asRecord(body).data);
  return runToEnvelope(run);
}

/**
 * Normalize an agentics-results-index `GET /api/v1/runs` response body.
 *
 * Body: `{ result_packet: { results: [...], pagination, metadata } }`
 */
export function fromResultsIndexRunList(
  body: unknown
): { simulations: SimulationEnvelope[]; pagination?: unknown } {
  const packet = asRecord(asRecord(body).result_packet);
  const results = Array.isArray(packet.results) ? packet.results : [];

  return {
    simulations: results.map((run) => runToEnvelope(asRecord(run))),
    ...(packet.pagination !== undefined ? { pagination: packet.pagination } : {}),
  };
}

/**
 * Normalize an agentics-simulation-runner `POST /v1/runner/abort/:id` response body.
 *
 * Body: `{ success: true, result }` or `{ success: false, error }`
 */
export function fromRunnerAbortResponse(
  simulationId: string,
  body: unknown
): SimulationEnvelope {
  const root = asRecord(body);

  if (root.success === true) {
    return {
      simulation_id: simulationId,
      execution_id: simulationId,
      status: 'cancelled',
      results: root.result,
    };
  }

  return {
    simulation_id: simulationId,
    execution_id: simulationId,
    status: 'failed',
    error: root.error ?? 'Abort was rejected by agentics-simulation-runner',
  };
}

function runToEnvelope(run: Record<string, unknown>): SimulationEnvelope {
  const status = RESULTS_INDEX_STATUS_MAP[String(run.status)] ?? 'running';

  return {
    simulation_id: asString(run.simulation_id) ?? asString(run.run_id),
    execution_id: asString(run.execution_id) ?? asString(run.run_id),
    status,
    progress: status === 'completed' || status === 'failed' || status === 'cancelled' ? 100 : 0,
    results: run.result_summary,
  };
}
