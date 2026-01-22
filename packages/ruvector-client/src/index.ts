/**
 * @agentics/ruvector-client
 *
 * Client for ruvector-service - the persistence layer for DecisionEvents.
 *
 * IMPORTANT: agentics-dev-platform NEVER connects directly to Google SQL.
 * ALL persistence MUST go through this client.
 *
 * @packageDocumentation
 */

export { RuvectorClient, type RuvectorClientConfig } from './client.js';
export { DecisionEventStore } from './stores/decision-event.js';
export { AgentRegistryStore } from './stores/agent-registry.js';
export * from './errors.js';
export * from './types.js';
