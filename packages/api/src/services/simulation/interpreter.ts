/**
 * Simulation Interpreter - Converts natural language prompts to SimulationSpecification
 *
 * Per SPARC: Layer 4 sends natural language prompts to LLM-Intelligence-Core
 * for interpretation with output_schema constraint. This module handles the
 * communication with the Intelligence Core.
 */

import {
  SimulationSpecification,
  SIMULATION_SPECIFICATION_SCHEMA
} from './schema.js';

/**
 * Configuration for Intelligence Core communication
 */
export interface IntelligenceCoreConfig {
  baseUrl: string;
  timeout?: number;
}

/**
 * Request structure for Intelligence Core interpretation
 */
interface InterpretationRequest {
  prompt: string;
  output_schema: typeof SIMULATION_SPECIFICATION_SCHEMA;
  system_instruction?: string;
}

/**
 * Response structure from Intelligence Core
 */
interface InterpretationResponse {
  specification: SimulationSpecification;
  confidence?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Error structure for interpretation failures
 */
export class InterpretationError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'InterpretationError';
  }
}

/**
 * Interprets a natural language prompt into a structured SimulationSpecification
 *
 * This function sends the prompt to LLM-Intelligence-Core with the
 * SIMULATION_SPECIFICATION_SCHEMA as an output constraint, ensuring
 * the LLM returns a properly structured specification.
 *
 * Example:
 *   Input: "Simulate production load with 1000 users for one hour"
 *   Output: {
 *     scenario: "production-load",
 *     parameters: { duration: 3600, users: 1000 }
 *   }
 *
 * @param prompt - Natural language description of the desired simulation
 * @param config - Configuration for communicating with Intelligence Core
 * @param correlationId - Optional correlation ID for request tracing
 * @returns Structured SimulationSpecification
 * @throws InterpretationError if interpretation fails
 */
export async function interpretPrompt(
  prompt: string,
  config: IntelligenceCoreConfig,
  correlationId?: string
): Promise<SimulationSpecification> {
  if (!prompt || prompt.trim().length === 0) {
    throw new InterpretationError(
      'Prompt cannot be empty',
      'INVALID_PROMPT'
    );
  }

  // Construct the interpretation request
  const request: InterpretationRequest = {
    prompt: prompt.trim(),
    output_schema: SIMULATION_SPECIFICATION_SCHEMA,
    system_instruction: `You are a simulation specification interpreter. Convert the user's natural language description into a structured simulation specification following the provided schema. Extract the scenario type, duration, user count, and any other relevant parameters. Be precise with numeric values and scenario names.`
  };

  try {
    // Forward request to LLM-Intelligence-Core
    const response = await fetch(
      `${config.baseUrl}/v1/intelligence/interpret`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(correlationId && { 'X-Correlation-Id': correlationId })
        },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(config.timeout || 30000)
      }
    );

    if (!response.ok) {
      const errorBody = await response.text();
      throw new InterpretationError(
        `Intelligence Core returned error: ${response.status}`,
        'UPSTREAM_ERROR',
        { status: response.status, body: errorBody }
      );
    }

    const result = await response.json() as InterpretationResponse;

    if (!result.specification) {
      throw new InterpretationError(
        'Intelligence Core did not return a specification',
        'INVALID_RESPONSE',
        { result }
      );
    }

    return result.specification;
  } catch (error) {
    if (error instanceof InterpretationError) {
      throw error;
    }

    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new InterpretationError(
        'Failed to connect to Intelligence Core',
        'CONNECTION_ERROR',
        { originalError: error.message }
      );
    }

    if (error instanceof Error && error.name === 'TimeoutError') {
      throw new InterpretationError(
        'Intelligence Core request timed out',
        'TIMEOUT',
        { timeout: config.timeout || 30000 }
      );
    }

    throw new InterpretationError(
      'Unexpected error during prompt interpretation',
      'UNKNOWN_ERROR',
      { originalError: error instanceof Error ? error.message : String(error) }
    );
  }
}

/**
 * Validates that the Intelligence Core is reachable and operational
 *
 * @param config - Configuration for communicating with Intelligence Core
 * @returns true if Intelligence Core is healthy, false otherwise
 */
export async function checkIntelligenceCoreHealth(
  config: IntelligenceCoreConfig
): Promise<boolean> {
  try {
    const response = await fetch(
      `${config.baseUrl}/health`,
      {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      }
    );

    return response.ok;
  } catch {
    return false;
  }
}
