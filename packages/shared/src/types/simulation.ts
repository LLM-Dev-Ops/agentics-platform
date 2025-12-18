/**
 * Simulation Types for Layer 4 Agentics Platform
 *
 * Types for SPARC-based simulation engine that can generate
 * platform implementations from specifications.
 */

/**
 * Parameters for initiating a simulation
 * Supports multiple input formats: specification, prompt, or CLI flags
 */
export interface SimulateParams {
  /** SPARC specification document (JSON or YAML) */
  specification?: Record<string, unknown> | string;
  /** Natural language prompt describing the desired system */
  prompt?: string;
  /** CLI-style flags for quick simulations */
  cli_flags?: string[];
  /** Optional simulation name for tracking */
  name?: string;
  /** Whether to return detailed progress updates */
  verbose?: boolean;
}

/**
 * Structured simulation specification
 */
export interface SimulationSpecification {
  /** Scenario being simulated */
  scenario: {
    /** Description of the scenario */
    description: string;
    /** Type of simulation (e.g., 'api', 'workflow', 'system') */
    type: string;
    /** Target Layer 3 cores involved */
    cores?: string[];
  };
  /** Simulation parameters and configuration */
  parameters: {
    /** Duration or timeout for simulation */
    duration?: number;
    /** Number of iterations or steps */
    iterations?: number;
    /** Input data or test cases */
    inputs?: Record<string, unknown>[];
    /** Expected outputs or validation criteria */
    expected_outputs?: Record<string, unknown>[];
    /** Additional custom parameters */
    [key: string]: unknown;
  };
}

/**
 * Status of an ongoing or completed simulation
 */
export enum SimulationStatusEnum {
  /** Simulation is queued but not yet started */
  PENDING = 'pending',
  /** Simulation is currently running */
  RUNNING = 'running',
  /** Simulation completed successfully */
  COMPLETED = 'completed',
  /** Simulation failed with errors */
  FAILED = 'failed',
  /** Simulation was cancelled by user */
  CANCELLED = 'cancelled',
}

/**
 * Result of a completed simulation
 */
export interface SimulationResult {
  /** Unique identifier for this simulation */
  simulation_id: string;
  /** Final status of the simulation */
  status: SimulationStatusEnum;
  /** Simulation results and outputs */
  results: {
    /** Generated artifacts (code, configs, etc.) */
    artifacts?: Array<{
      /** Type of artifact (e.g., 'code', 'config', 'documentation') */
      type: string;
      /** File path or identifier */
      path: string;
      /** Content of the artifact */
      content: string;
    }>;
    /** Performance metrics */
    metrics?: {
      /** Total execution time in seconds */
      execution_time: number;
      /** Number of tokens consumed */
      tokens_used: number;
      /** Number of API calls made */
      api_calls: number;
      /** Success rate (0-1) */
      success_rate?: number;
    };
    /** Validation results */
    validation?: {
      /** Whether simulation passed validation */
      passed: boolean;
      /** Validation errors or warnings */
      issues?: Array<{
        /** Severity level */
        severity: 'error' | 'warning' | 'info';
        /** Issue description */
        message: string;
        /** Location of issue */
        location?: string;
      }>;
    };
    /** Additional custom results */
    [key: string]: unknown;
  };
  /** ISO 8601 timestamp when simulation was created */
  created_at: string;
  /** ISO 8601 timestamp when simulation started */
  started_at?: string;
  /** ISO 8601 timestamp when simulation completed */
  completed_at?: string;
  /** Error details if simulation failed */
  error?: {
    /** Error message */
    message: string;
    /** Error code */
    code: string;
    /** Additional error context */
    details?: Record<string, unknown>;
  };
}

/**
 * Status information for a running or completed simulation
 */
export interface SimulationStatus {
  /** Unique identifier for this simulation */
  simulation_id: string;
  /** Current status */
  status: SimulationStatusEnum;
  /** Progress percentage (0-100) */
  progress: number;
  /** Current step or phase description */
  current_step?: string;
  /** Partial results available so far */
  results?: Partial<SimulationResult['results']>;
  /** ISO 8601 timestamp of last update */
  updated_at: string;
}

/**
 * Request to cancel a running simulation
 */
export interface CancelSimulationParams {
  /** ID of the simulation to cancel */
  simulation_id: string;
}

/**
 * List simulations response
 */
export interface ListSimulationsResponse {
  /** Array of simulation results */
  simulations: SimulationResult[];
  /** Pagination metadata */
  total?: number;
}
