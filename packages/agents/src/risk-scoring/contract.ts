/**
 * Risk Scoring Agent Contract
 *
 * PROMPT 1 Implementation: Complete agent contract definition.
 *
 * Classification: RISK SCORING
 * Decision Type: risk_score
 */

import type { AgentContract } from '@agentics/contracts';

/**
 * Risk Scoring Agent Contract
 *
 * Purpose:
 * Assess and score platform-level risks based on aggregated operational,
 * financial, and technical signals.
 *
 * Scope:
 * - Evaluate risk signals
 * - Compute normalized risk scores
 * - Emit risk assessments
 */
export const RISK_SCORING_AGENT_CONTRACT: AgentContract = {
  metadata: {
    id: 'risk-scoring-agent',
    version: '0.1.0',
    name: 'Risk Scoring Agent',
    description:
      'Assess and score platform-level risks based on aggregated operational, financial, and technical signals. Evaluates risk signals, computes normalized risk scores, and emits risk assessments.',
    classification: 'RISK_SCORING',
    decision_types: ['risk_score', 'impact_assessment', 'tradeoff_analysis'],
    created_at: '2025-01-21T00:00:00.000Z',
    updated_at: '2025-01-21T00:00:00.000Z',
  },

  capabilities: [
    {
      name: 'score',
      description: 'Compute risk scores from aggregated signals',
      input_schema: 'RiskScoringInput',
      output_schema: 'RiskScoringOutput',
    },
    {
      name: 'assess_impact',
      description: 'Assess impact of specific risk factors',
      input_schema: 'ImpactAssessmentInput',
      output_schema: 'ImpactAssessmentOutput',
    },
    {
      name: 'analyze_tradeoffs',
      description: 'Analyze tradeoffs between risk mitigation strategies',
      input_schema: 'TradeoffInput',
      output_schema: 'TradeoffOutput',
    },
  ],

  invocation_modes: ['cli', 'cloud_run', 'cloud_job'],

  persistence: {
    persist: ['decision_event', 'score', 'summary', 'recommendation'],
    do_not_persist: [
      'raw_signal_data',
      'intermediate_calculations',
      'debug_traces',
      'pii_data',
      'credentials',
      'custom_weights_internal',
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
      'Intercept runtime traffic',
      'Mutate upstream systems',
    ],
    must_never: [
      'Execute code in production environments',
      'Access secrets or credentials directly',
      'Bypass authentication or authorization',
      'Delete or modify historical DecisionEvents',
      'Emit more than ONE DecisionEvent per invocation',
      'Persist data outside of ruvector-service',
      'Make automated risk mitigation decisions',
    ],
  },

  consumers: [
    'governance-dashboard',
    'audit-system',
    'executive-reporting',
    'alert-system',
    'human-decision-workflow',
    'compliance-monitoring',
    'decision-synthesis-agent',
  ],

  dependencies: [
    'ruvector-service',
    'research-lab', // MAY consume outputs
    'analytics-hub', // MAY consume outputs
    'costops', // MAY consume outputs
  ],
};

/**
 * Risk Scoring Agent Explicit Non-Responsibilities
 *
 * The Risk Scoring Agent EXPLICITLY does NOT:
 */
export const RISK_SCORING_AGENT_NON_RESPONSIBILITIES = [
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
  'Automatically mitigate risks',
  'Deploy changes to production',
  'Execute remediation actions',
];

/**
 * Risk Scoring Agent Failure Modes
 */
export const RISK_SCORING_AGENT_FAILURE_MODES = [
  {
    mode: 'RUVECTOR_UNAVAILABLE',
    description: 'ruvector-service is unreachable',
    recovery: 'Retry with exponential backoff, return error if persistence fails',
  },
  {
    mode: 'INVALID_INPUT',
    description: 'Input validation fails against contract schemas',
    recovery: 'Return validation errors, do not process',
  },
  {
    mode: 'NO_SIGNALS',
    description: 'No risk signals available for analysis',
    recovery: 'Return zero-risk assessment with low confidence, note absence of data',
  },
  {
    mode: 'AGGREGATION_FAILURE',
    description: 'Cannot aggregate source DecisionEvents',
    recovery: 'Return error with details about which events failed',
  },
  {
    mode: 'TIMEOUT',
    description: 'Processing exceeds timeout threshold',
    recovery: 'Return partial results if available with low confidence',
  },
  {
    mode: 'WEIGHT_VALIDATION_ERROR',
    description: 'Custom weights do not sum to 1.0 or are out of bounds',
    recovery: 'Normalize weights automatically and warn in constraints',
  },
];

/**
 * Risk Categories Supported
 */
export const RISK_CATEGORIES = [
  'security',
  'operational',
  'financial',
  'compliance',
  'technical_debt',
  'availability',
  'data_integrity',
] as const;

export type RiskCategory = typeof RISK_CATEGORIES[number];

/**
 * Risk Scoring Methodologies
 */
export const RISK_METHODOLOGIES = [
  'quantitative', // probability × impact
  'qualitative', // categorical assessment
  'hybrid', // weighted combination
] as const;

export type RiskMethodology = typeof RISK_METHODOLOGIES[number];
