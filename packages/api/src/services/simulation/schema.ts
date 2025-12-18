/**
 * Simulation Schema - JSON Schema for simulation specifications
 *
 * This module defines the schema for simulation specifications and provides
 * validation functions. Per SPARC, Layer 4 does NOT execute simulations,
 * only validates and compiles specifications for LLM-Research-Core.
 */

export interface SimulationSpecification {
  scenario: string;
  parameters: {
    duration?: number;
    users?: number;
    [key: string]: unknown;
  };
  metadata?: {
    name?: string;
    description?: string;
    tags?: string[];
    [key: string]: unknown;
  };
}

/**
 * JSON Schema for simulation specifications
 * Used for validation and as output_schema constraint for LLM interpretation
 */
export const SIMULATION_SPECIFICATION_SCHEMA = {
  type: 'object',
  required: ['scenario', 'parameters'],
  properties: {
    scenario: {
      type: 'string',
      description: 'Named scenario to execute',
      minLength: 1,
      examples: ['production-load', 'stress-test', 'integration-test']
    },
    parameters: {
      type: 'object',
      description: 'Scenario-specific parameters',
      properties: {
        duration: {
          type: 'number',
          description: 'Simulation duration in seconds',
          minimum: 1,
          maximum: 86400 // 24 hours
        },
        users: {
          type: 'number',
          description: 'Number of simulated users',
          minimum: 1,
          maximum: 100000
        }
      },
      additionalProperties: true
    },
    metadata: {
      type: 'object',
      description: 'Optional metadata for the simulation',
      properties: {
        name: {
          type: 'string',
          description: 'Human-readable name for the simulation'
        },
        description: {
          type: 'string',
          description: 'Description of the simulation purpose'
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tags for categorization'
        }
      },
      additionalProperties: true
    }
  },
  additionalProperties: false
} as const;

/**
 * Validation error structure
 */
export interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
}

/**
 * Validates a value against a JSON schema
 * Returns array of validation errors, empty if valid
 */
export function validateSchema(
  value: unknown,
  schema: typeof SIMULATION_SPECIFICATION_SCHEMA
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Basic type validation
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    errors.push({
      field: 'root',
      message: 'Value must be an object',
      value
    });
    return errors;
  }

  const obj = value as Record<string, unknown>;

  // Check required fields
  if (schema.required) {
    for (const field of schema.required) {
      if (!(field in obj)) {
        errors.push({
          field,
          message: `Required field '${field}' is missing`
        });
      }
    }
  }

  // Validate scenario
  if ('scenario' in obj) {
    if (typeof obj.scenario !== 'string') {
      errors.push({
        field: 'scenario',
        message: 'scenario must be a string',
        value: obj.scenario
      });
    } else if (obj.scenario.length === 0) {
      errors.push({
        field: 'scenario',
        message: 'scenario cannot be empty',
        value: obj.scenario
      });
    }
  }

  // Validate parameters
  if ('parameters' in obj) {
    if (typeof obj.parameters !== 'object' || obj.parameters === null || Array.isArray(obj.parameters)) {
      errors.push({
        field: 'parameters',
        message: 'parameters must be an object',
        value: obj.parameters
      });
    } else {
      const params = obj.parameters as Record<string, unknown>;

      // Validate duration if present
      if ('duration' in params) {
        if (typeof params.duration !== 'number') {
          errors.push({
            field: 'parameters.duration',
            message: 'duration must be a number',
            value: params.duration
          });
        } else if (params.duration < 1 || params.duration > 86400) {
          errors.push({
            field: 'parameters.duration',
            message: 'duration must be between 1 and 86400 seconds',
            value: params.duration
          });
        }
      }

      // Validate users if present
      if ('users' in params) {
        if (typeof params.users !== 'number') {
          errors.push({
            field: 'parameters.users',
            message: 'users must be a number',
            value: params.users
          });
        } else if (params.users < 1 || params.users > 100000) {
          errors.push({
            field: 'parameters.users',
            message: 'users must be between 1 and 100000',
            value: params.users
          });
        }
      }
    }
  }

  // Validate metadata if present
  if ('metadata' in obj && obj.metadata !== undefined) {
    if (typeof obj.metadata !== 'object' || obj.metadata === null || Array.isArray(obj.metadata)) {
      errors.push({
        field: 'metadata',
        message: 'metadata must be an object',
        value: obj.metadata
      });
    } else {
      const metadata = obj.metadata as Record<string, unknown>;

      if ('name' in metadata && typeof metadata.name !== 'string') {
        errors.push({
          field: 'metadata.name',
          message: 'metadata.name must be a string',
          value: metadata.name
        });
      }

      if ('description' in metadata && typeof metadata.description !== 'string') {
        errors.push({
          field: 'metadata.description',
          message: 'metadata.description must be a string',
          value: metadata.description
        });
      }

      if ('tags' in metadata) {
        if (!Array.isArray(metadata.tags)) {
          errors.push({
            field: 'metadata.tags',
            message: 'metadata.tags must be an array',
            value: metadata.tags
          });
        } else {
          for (let i = 0; i < metadata.tags.length; i++) {
            if (typeof metadata.tags[i] !== 'string') {
              errors.push({
                field: `metadata.tags[${i}]`,
                message: 'tags must be strings',
                value: metadata.tags[i]
              });
            }
          }
        }
      }
    }
  }

  return errors;
}

/**
 * Type guard to check if a value is a valid SimulationSpecification
 */
export function isSimulationSpecification(value: unknown): value is SimulationSpecification {
  return validateSchema(value, SIMULATION_SPECIFICATION_SCHEMA).length === 0;
}
