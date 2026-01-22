/**
 * CLI Contract Schema
 *
 * Defines the CLI invocation contract for agents.
 */

import { z } from 'zod';

/**
 * CLI command types
 */
export const cliCommandSchema = z.enum([
  'decide',     // Make a decision
  'summarize',  // Generate summary
  'score',      // Calculate score
  'inspect',    // Inspect state
]);
export type CliCommand = z.infer<typeof cliCommandSchema>;

/**
 * CLI input format
 */
export const cliInputSchema = z.object({
  command: cliCommandSchema,
  input_file: z.string().optional(),  // Path to input JSON
  input_stdin: z.boolean().default(false), // Read from stdin
  output_format: z.enum(['json', 'yaml', 'table']).default('json'),
  verbose: z.boolean().default(false),
  dry_run: z.boolean().default(false),

  // Decision-specific options
  source_events: z.array(z.string()).optional(), // Event IDs to synthesize
  time_range: z.object({
    start: z.string().datetime(),
    end: z.string().datetime(),
  }).optional(),

  // Filtering options
  decision_types: z.array(z.string()).optional(),
  agent_ids: z.array(z.string()).optional(),
  min_confidence: z.number().min(0).max(1).optional(),
});
export type CliInput = z.infer<typeof cliInputSchema>;

/**
 * CLI output format
 */
export const cliOutputSchema = z.object({
  success: z.boolean(),
  event_id: z.string().uuid().optional(),
  data: z.unknown().optional(),
  errors: z.array(z.object({
    code: z.string(),
    message: z.string(),
    field: z.string().optional(),
  })).optional(),
  metadata: z.object({
    execution_time_ms: z.number(),
    agent_id: z.string(),
    agent_version: z.string(),
    timestamp: z.string().datetime(),
  }),
});
export type CliOutput = z.infer<typeof cliOutputSchema>;

/**
 * Create success CLI output
 */
export function createCliSuccess<T>(
  data: T,
  eventId: string,
  agentId: string,
  agentVersion: string,
  executionTimeMs: number
): CliOutput {
  return {
    success: true,
    event_id: eventId,
    data,
    metadata: {
      execution_time_ms: executionTimeMs,
      agent_id: agentId,
      agent_version: agentVersion,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Create error CLI output
 */
export function createCliError(
  errors: Array<{ code: string; message: string; field?: string }>,
  agentId: string,
  agentVersion: string,
  executionTimeMs: number
): CliOutput {
  return {
    success: false,
    errors,
    metadata: {
      execution_time_ms: executionTimeMs,
      agent_id: agentId,
      agent_version: agentVersion,
      timestamp: new Date().toISOString(),
    },
  };
}
