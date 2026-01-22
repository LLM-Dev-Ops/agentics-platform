/**
 * Agent Registry Schema
 *
 * Defines the registry format for platform agent registration.
 */

import { z } from 'zod';
import { agentMetadataSchema, invocationModeSchema } from './agent-contract.js';

/**
 * Agent endpoint definition
 */
export const agentEndpointSchema = z.object({
  mode: invocationModeSchema,
  uri: z.string(),
  health_check: z.string().optional(),
  timeout_ms: z.number().int().positive().default(30000),
});
export type AgentEndpoint = z.infer<typeof agentEndpointSchema>;

/**
 * Registered agent entry
 */
export const registeredAgentSchema = z.object({
  metadata: agentMetadataSchema,
  endpoints: z.array(agentEndpointSchema),
  status: z.enum(['active', 'deprecated', 'disabled']),
  registered_at: z.string().datetime(),
  last_invocation: z.string().datetime().optional(),
  invocation_count: z.number().int().nonnegative().default(0),
});
export type RegisteredAgent = z.infer<typeof registeredAgentSchema>;

/**
 * Agent registry format
 */
export const agentRegistrySchema = z.object({
  version: z.string(),
  updated_at: z.string().datetime(),
  agents: z.record(registeredAgentSchema),
});
export type AgentRegistry = z.infer<typeof agentRegistrySchema>;

/**
 * Agent registration request
 */
export const agentRegistrationRequestSchema = z.object({
  metadata: agentMetadataSchema,
  endpoints: z.array(agentEndpointSchema),
});
export type AgentRegistrationRequest = z.infer<typeof agentRegistrationRequestSchema>;
