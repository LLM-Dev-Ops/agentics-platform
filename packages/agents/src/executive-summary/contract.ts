/**
 * Executive Summary Agent Contract
 *
 * PROMPT 1 Implementation: Complete agent contract definition.
 *
 * Classification: EXECUTIVE REPORTING
 *
 * Purpose:
 * Produce concise, executive-grade summaries of platform state, risks, and decisions.
 * Translate technical outputs into executive language.
 */

import type { AgentContract } from '@agentics/contracts';

/**
 * Executive Summary Agent Contract
 */
export const EXECUTIVE_SUMMARY_AGENT_CONTRACT: AgentContract = {
  metadata: {
    id: 'executive-summary-agent',
    version: '0.1.0',
    name: 'Executive Summary Agent',
    description:
      'Produces concise, executive-grade summaries of platform state, risks, and decisions. Translates technical outputs into executive language for governance and decision-making.',
    classification: 'EXECUTIVE_REPORTING',
    decision_types: ['executive_summary'],
    created_at: '2025-01-22T00:00:00.000Z',
    updated_at: '2025-01-22T00:00:00.000Z',
  },

  capabilities: [
    {
      name: 'summarize',
      description: 'Generate executive-grade summary from aggregated DecisionEvents',
      input_schema: 'ExecutiveSummaryInput',
      output_schema: 'ExecutiveSummaryOutput',
    },
    {
      name: 'assess_status',
      description: 'Assess overall platform status and health',
      input_schema: 'StatusAssessmentInput',
      output_schema: 'PlatformStatus',
    },
  ],

  invocation_modes: ['cli', 'cloud_run', 'cloud_job'],

  persistence: {
    persist: ['decision_event', 'summary'],
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
    'executive-reports',
    'audit-systems',
    'human-decision-makers',
    'compliance-monitoring',
  ],

  dependencies: [
    'ruvector-service',
    'decision-agent',
    'risk-scoring-agent',
  ],
};

/**
 * Executive Summary Agent Explicit Non-Responsibilities
 */
export const EXECUTIVE_SUMMARY_AGENT_NON_RESPONSIBILITIES = [
  'Execute inference or call LLMs',
  'Make real-time decisions',
  'Enforce policies or governance rules',
  'Route traffic or requests',
  'Optimize system configurations',
  'Modify code or configurations',
  'Access production databases directly',
  'Trigger automated workflows',
  'Store data outside ruvector-service',
];

/**
 * Executive Summary Agent Failure Modes
 */
export const EXECUTIVE_SUMMARY_AGENT_FAILURE_MODES = [
  {
    mode: 'SOURCE_EVENT_UNAVAILABLE',
    description: 'Unable to retrieve source DecisionEvents from ruvector-service',
    recovery: 'Retry with exponential backoff, fail gracefully with partial data',
  },
  {
    mode: 'INSUFFICIENT_DATA',
    description: 'Not enough data for meaningful summary generation',
    recovery: 'Return low-confidence summary with data availability warning',
  },
  {
    mode: 'PERSISTENCE_FAILURE',
    description: 'Unable to persist DecisionEvent to ruvector-service',
    recovery: 'Retry with backoff, return event without persistence, alert operators',
  },
  {
    mode: 'TIMEOUT',
    description: 'Processing exceeds timeout threshold',
    recovery: 'Return partial results with low confidence, log timeout event',
  },
];
