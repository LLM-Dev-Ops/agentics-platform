/**
 * Simulation Service - Unified simulation compilation service
 *
 * Per SPARC: This service compiles simulation inputs from various sources
 * (specification, cli_flags, prompt) into validated SimulationSpecifications.
 * Layer 4 does NOT execute simulations - all execution happens in the Layer 3.5
 * orchestration spine (agentics-orchestration-engine) per ADR-013.
 */

import {
  SimulationSpecification,
  ValidationError
} from './schema.js';
import {
  compileFromSpecification,
  compileFromCliFlags,
  validateSpecification,
  CliFlags,
  CompilationResult
} from './compiler.js';
import {
  interpretPrompt,
  IntelligenceCoreConfig,
  InterpretationError
} from './interpreter.js';

/**
 * Input types for simulation compilation
 */
export interface SimulationInput {
  specification?: unknown;
  cli_flags?: CliFlags;
  prompt?: string;
}

/**
 * Service error structure
 */
export class SimulationServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown> | ValidationError[]
  ) {
    super(message);
    this.name = 'SimulationServiceError';
  }
}

/**
 * Configuration for SimulationService
 */
export interface SimulationServiceConfig {
  intelligenceCore: IntelligenceCoreConfig;
}

/**
 * SimulationService - Main service class for simulation compilation
 *
 * This service provides a unified entry point for compiling simulations
 * from various input formats. It handles:
 * - Direct specification input (validates and returns)
 * - CLI flags (converts to specification)
 * - Natural language prompts (sends to Intelligence Core for interpretation)
 */
export class SimulationService {
  constructor(private config: SimulationServiceConfig) {}

  /**
   * Compiles a simulation from any input type
   *
   * Per SPARC pseudocode:
   * ```
   * FUNCTION compileSimulation(input):
   *     IF input.specification IS NOT NULL:
   *         RETURN validateSpecification(input.specification)
   *
   *     IF input.cli_flags IS NOT NULL:
   *         specification = {
   *             scenario: input.cli_flags.scenario,
   *             parameters: extractParameters(input.cli_flags)
   *         }
   *         RETURN validateSpecification(specification)
   *
   *     IF input.prompt IS NOT NULL:
   *         interpretationRequest = {
   *             prompt: input.prompt,
   *             output_schema: SIMULATION_SPECIFICATION_SCHEMA
   *         }
   *         interpretation = forwardRequest("LLM-Intelligence-Core", interpretationRequest)
   *         RETURN validateSpecification(interpretation.specification)
   *
   *     RETURN errorResponse(400, "INVALID_REQUEST", "No simulation input provided")
   * ```
   *
   * @param input - Input containing specification, cli_flags, or prompt
   * @param correlationId - Optional correlation ID for request tracing
   * @returns Validated SimulationSpecification
   * @throws SimulationServiceError if compilation fails
   */
  async compileSimulation(
    input: SimulationInput,
    correlationId?: string
  ): Promise<SimulationSpecification> {
    // Validate that exactly one input type is provided
    const inputTypes = [
      input.specification !== undefined,
      input.cli_flags !== undefined,
      input.prompt !== undefined
    ].filter(Boolean).length;

    if (inputTypes === 0) {
      throw new SimulationServiceError(
        'No simulation input provided. Provide specification, cli_flags, or prompt.',
        'INVALID_REQUEST'
      );
    }

    if (inputTypes > 1) {
      throw new SimulationServiceError(
        'Multiple input types provided. Provide only one of: specification, cli_flags, or prompt.',
        'INVALID_REQUEST'
      );
    }

    // Handle specification input
    if (input.specification !== undefined) {
      return this.compileFromSpecification(input.specification);
    }

    // Handle CLI flags input
    if (input.cli_flags !== undefined) {
      return this.compileFromCliFlags(input.cli_flags);
    }

    // Handle prompt input
    if (input.prompt !== undefined) {
      return this.compileFromPrompt(input.prompt, correlationId);
    }

    // This should never be reached due to the validation above
    throw new SimulationServiceError(
      'No valid simulation input provided',
      'INVALID_REQUEST'
    );
  }

  /**
   * Compiles from a structured specification
   * Validates and returns the specification if valid
   */
  private compileFromSpecification(spec: unknown): SimulationSpecification {
    const result = compileFromSpecification(spec);

    if (!result.success) {
      throw new SimulationServiceError(
        'Invalid simulation specification',
        'VALIDATION_FAILED',
        result.errors
      );
    }

    return result.specification!;
  }

  /**
   * Compiles from CLI flags
   * Converts flags to specification format and validates
   */
  private compileFromCliFlags(flags: CliFlags): SimulationSpecification {
    const result = compileFromCliFlags(flags);

    if (!result.success) {
      throw new SimulationServiceError(
        'Invalid CLI flags',
        'VALIDATION_FAILED',
        result.errors
      );
    }

    return result.specification!;
  }

  /**
   * Compiles from natural language prompt
   * Sends to Intelligence Core for interpretation, then validates
   */
  private async compileFromPrompt(
    prompt: string,
    correlationId?: string
  ): Promise<SimulationSpecification> {
    try {
      // Send to Intelligence Core for interpretation
      const specification = await interpretPrompt(
        prompt,
        this.config.intelligenceCore,
        correlationId
      );

      // Validate the interpreted specification
      const result = validateSpecification(specification);

      if (!result.success) {
        throw new SimulationServiceError(
          'Intelligence Core returned invalid specification',
          'INTERPRETATION_INVALID',
          result.errors
        );
      }

      return specification;
    } catch (error) {
      if (error instanceof InterpretationError) {
        throw new SimulationServiceError(
          error.message,
          error.code,
          error.details
        );
      }

      if (error instanceof SimulationServiceError) {
        throw error;
      }

      throw new SimulationServiceError(
        'Failed to interpret prompt',
        'INTERPRETATION_FAILED',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Validates a simulation specification
   * Public method for external validation without compilation
   */
  validateSpecification(spec: unknown): CompilationResult {
    return validateSpecification(spec);
  }
}

// Export all types and functions
export * from './schema.js';
export * from './compiler.js';
export * from './interpreter.js';
