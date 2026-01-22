/**
 * Agent Contract Schema
 *
 * Defines the complete contract for agentics-dev-platform agents.
 */

import { z } from 'zod';
import { decisionTypeSchema } from '../decision/decision-types.js';

/**
 * Agent capability definition
 */
export const agentCapabilitySchema = z.object({
  name: z.string(),
  description: z.string(),
  input_schema: z.string(), // JSON Schema reference
  output_schema: z.string(), // JSON Schema reference
});
export type AgentCapability = z.infer<typeof agentCapabilitySchema>;

/**
 * Agent metadata
 */
export const agentMetadataSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]*[a-z0-9]$/),
  version: z.string().regex(/^\d+\.\d+\.\d+(-[a-z0-9.]+)?$/i),
  name: z.string(),
  description: z.string(),
  classification: z.enum(['DECISION_SYNTHESIS', 'EXECUTIVE_REPORTING', 'RISK_SCORING']),
  decision_types: z.array(decisionTypeSchema),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type AgentMetadata = z.infer<typeof agentMetadataSchema>;

/**
 * Agent invocation modes
 */
export const invocationModeSchema = z.enum([
  'cli',           // CLI-invoked
  'cloud_run',     // Google Cloud Run service
  'cloud_job',     // Google Cloud Run job
  'edge_function', // Edge function (optional)
]);
export type InvocationMode = z.infer<typeof invocationModeSchema>;

/**
 * Agent persistence rules
 */
export const persistenceRulesSchema = z.object({
  // What MUST be persisted
  persist: z.array(z.enum([
    'decision_event',
    'summary',
    'score',
    'recommendation',
  ])),

  // What MUST NOT be persisted
  do_not_persist: z.array(z.string()),

  // Retention policy
  retention_days: z.number().int().positive().optional(),

  // ruvector-service collection
  collection: z.string(),
});
export type PersistenceRules = z.infer<typeof persistenceRulesSchema>;

/**
 * Agent boundaries - what the agent MUST NOT do
 */
export const agentBoundariesSchema = z.object({
  must_not: z.array(z.string()),
  must_never: z.array(z.string()),
});
export type AgentBoundaries = z.infer<typeof agentBoundariesSchema>;

/**
 * Complete agent contract
 */
export const agentContractSchema = z.object({
  metadata: agentMetadataSchema,
  capabilities: z.array(agentCapabilitySchema),
  invocation_modes: z.array(invocationModeSchema),
  persistence: persistenceRulesSchema,
  boundaries: agentBoundariesSchema,
  consumers: z.array(z.string()), // Systems that may consume this agent's output
  dependencies: z.array(z.string()), // Upstream agents/services
});
export type AgentContract = z.infer<typeof agentContractSchema>;

/**
 * Validate an agent contract
 */
export function validateAgentContract(contract: unknown): AgentContract {
  return agentContractSchema.parse(contract);
}
