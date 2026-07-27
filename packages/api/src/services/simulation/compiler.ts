/**
 * Simulation Compiler - Converts various input formats to SimulationSpecification
 *
 * Per SPARC: Layer 4 does NOT execute simulations, only compiles inputs into
 * validated specifications that are forwarded to agentics-orchestration-engine.
 */

import {
  SimulationSpecification,
  SIMULATION_SPECIFICATION_SCHEMA,
  validateSchema,
  ValidationError
} from './schema.js';

/**
 * CLI flags input structure
 */
export interface CliFlags {
  scenario?: string;
  duration?: number;
  users?: number;
  config?: string;
  [key: string]: unknown;
}

/**
 * Compilation result
 */
export interface CompilationResult {
  success: boolean;
  specification?: SimulationSpecification;
  errors?: ValidationError[];
}

/**
 * Compiles a simulation from a structured specification
 * Validates the specification and returns it if valid
 */
export function compileFromSpecification(
  spec: unknown
): CompilationResult {
  const errors = validateSchema(spec, SIMULATION_SPECIFICATION_SCHEMA);

  if (errors.length > 0) {
    return {
      success: false,
      errors
    };
  }

  return {
    success: true,
    specification: spec as SimulationSpecification
  };
}

/**
 * Compiles a simulation from CLI flags
 * Converts flags to structured specification format
 */
export function compileFromCliFlags(
  flags: CliFlags
): CompilationResult {
  // Extract scenario from flags
  if (!flags.scenario) {
    return {
      success: false,
      errors: [{
        field: 'scenario',
        message: 'scenario flag is required'
      }]
    };
  }

  // Build parameters object from known flags
  const parameters: Record<string, unknown> = {};

  if (flags.duration !== undefined) {
    parameters.duration = flags.duration;
  }

  if (flags.users !== undefined) {
    parameters.users = flags.users;
  }

  // Add any additional flags as parameters (excluding known non-parameter flags)
  const knownFlags = ['scenario', 'config', 'duration', 'users'];
  for (const [key, value] of Object.entries(flags)) {
    if (!knownFlags.includes(key) && value !== undefined) {
      parameters[key] = value;
    }
  }

  // Construct specification
  const specification: SimulationSpecification = {
    scenario: flags.scenario,
    parameters
  };

  // Validate the compiled specification
  return compileFromSpecification(specification);
}

/**
 * Validates a pre-compiled specification
 * Returns the specification if valid, or errors if invalid
 */
export function validateSpecification(
  spec: unknown
): CompilationResult {
  return compileFromSpecification(spec);
}

/**
 * Extracts parameters from CLI flags
 * Helper function used by compileFromCliFlags
 */
export function extractParameters(flags: CliFlags): Record<string, unknown> {
  const parameters: Record<string, unknown> = {};

  // Copy known parameter fields
  if (flags.duration !== undefined) {
    parameters.duration = flags.duration;
  }

  if (flags.users !== undefined) {
    parameters.users = flags.users;
  }

  // Add any additional flags as parameters
  const knownNonParameters = ['scenario', 'config'];
  for (const [key, value] of Object.entries(flags)) {
    if (!knownNonParameters.includes(key) && !['duration', 'users'].includes(key) && value !== undefined) {
      parameters[key] = value;
    }
  }

  return parameters;
}
