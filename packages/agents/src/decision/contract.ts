/**
 * Decision Agent Contract
 *
 * PROMPT 1 Implementation: Complete agent contract definition.
 */

import type { AgentContract } from '@agentics/contracts';

/**
 * Decision Agent Contract
 *
 * Classification: DECISION SYNTHESIS
 *
 * Purpose:
 * Synthesize multiple DecisionEvents into a single actionable
 * platform-level decision recommendation.
 *
 * Scope:
 * - Aggregate upstream DecisionEvents
 * - Resolve conflicts and tradeoffs
 * - Emit a final decision recommendation
 */
export const DECISION_AGENT_CONTRACT: AgentContract = {
  metadata: {
    id: 'decision-agent',
    version: '0.1.0',
    name: 'Decision Agent',
    description:
      'Synthesizes multiple DecisionEvents into a single actionable platform-level decision recommendation. Aggregates upstream events, resolves conflicts and tradeoffs, and emits final recommendations.',
    classification: 'DECISION_SYNTHESIS',
    decision_types: ['decision_synthesis', 'conflict_resolution', 'consensus_building'],
    created_at: '2025-01-21T00:00:00.000Z',
    updated_at: '2025-01-21T00:00:00.000Z',
  },

  capabilities: [
    {
      name: 'aggregate',
      description: 'Aggregate multiple DecisionEvents from upstream sources',
      input_schema: 'DecisionEventQuery',
      output_schema: 'AggregatedEvents',
    },
    {
      name: 'synthesize',
      description: 'Synthesize aggregated events into a decision recommendation',
      input_schema: 'SynthesisInput',
      output_schema: 'SynthesisOutput',
    },
    {
      name: 'resolve_conflicts',
      description: 'Resolve conflicts between divergent upstream events',
      input_schema: 'ConflictResolutionInput',
      output_schema: 'ResolvedDecision',
    },
  ],

  invocation_modes: ['cli', 'cloud_run', 'cloud_job'],

  persistence: {
    persist: ['decision_event', 'summary', 'recommendation'],
    do_not_persist: [
      'raw_source_data',
      'intermediate_calculations',
      'debug_traces',
      'pii_data',
      'credentials',
    ],
    retention_days: 365,
    collection: 'decision_events',
  },

  boundaries: {
    must_not: [
      'Execute inference or LLM calls',
      'Modify prompts or responses in other systems',
      'Route requests to other services',
      'Trigger orchestration workflows',
      'Apply optimizations to live systems',
      'Enforce governance actions automatically',
      'Connect directly to Google SQL or any database',
      'Execute SQL queries',
      'Modify upstream system state',
      'Make decisions without human oversight',
    ],
    must_never: [
      'Execute code in production environments',
      'Access secrets or credentials directly',
      'Bypass authentication or authorization',
      'Delete or modify historical DecisionEvents',
      'Emit more than ONE DecisionEvent per invocation',
      'Persist data outside of ruvector-service',
    ],
  },

  consumers: [
    'governance-dashboard',
    'audit-system',
    'executive-reporting',
    'human-decision-workflow',
    'compliance-monitoring',
  ],

  dependencies: [
    'ruvector-service',
    'research-lab', // MAY consume outputs
    'analytics-hub', // MAY consume outputs
    'costops', // MAY consume outputs
  ],
};

/**
 * Decision Agent Explicit Non-Responsibilities
 *
 * The Decision Agent EXPLICITLY does NOT:
 */
export const DECISION_AGENT_NON_RESPONSIBILITIES = [
  'Execute inference or call LLMs',
  'Make real-time decisions',
  'Enforce policies or governance rules',
  'Route traffic or requests',
  'Optimize system configurations',
  'Modify code or configurations',
  'Access production databases directly',
  'Trigger automated workflows',
  'Make decisions without human review',
  'Store data outside ruvector-service',
];

/**
 * Decision Agent Failure Modes
 */
export const DECISION_AGENT_FAILURE_MODES = [
  {
    mode: 'SOURCE_EVENT_UNAVAILABLE',
    description: 'Unable to retrieve source DecisionEvents from ruvector-service',
    recovery: 'Retry with exponential backoff, fail gracefully with partial data',
  },
  {
    mode: 'CONFLICT_UNRESOLVABLE',
    description: 'Conflicting source events cannot be automatically resolved',
    recovery: 'Flag for human review, emit low-confidence recommendation',
  },
  {
    mode: 'PERSISTENCE_FAILURE',
    description: 'Unable to persist DecisionEvent to ruvector-service',
    recovery: 'Retry with backoff, return event without persistence, alert operators',
  },
  {
    mode: 'VALIDATION_FAILURE',
    description: 'Input validation fails against contract schemas',
    recovery: 'Return validation errors, do not process',
  },
  {
    mode: 'TIMEOUT',
    description: 'Processing exceeds timeout threshold',
    recovery: 'Return partial results with low confidence, log timeout event',
  },
];
