/**
 * Risk Scoring Agent Module
 *
 * Exports all Risk Scoring Agent components.
 *
 * @module @agentics/agents/risk-scoring
 */

// Agent implementation
export {
  RiskScoringAgent,
  createRiskScoringAgent,
  type RiskScoringAgentInput,
  type RiskScoringAgentOutput,
} from './agent.js';

// Contract and registration
export {
  RISK_SCORING_AGENT_CONTRACT,
  RISK_SCORING_AGENT_NON_RESPONSIBILITIES,
  RISK_SCORING_AGENT_FAILURE_MODES,
  RISK_CATEGORIES,
  RISK_METHODOLOGIES,
  type RiskCategory,
  type RiskMethodology,
} from './contract.js';

// Agent identifiers
export const RISK_SCORING_AGENT_ID = 'risk-scoring-agent';
export const RISK_SCORING_AGENT_VERSION = '0.1.0';

// Registration metadata for platform
export const riskScoringAgentRegistration = {
  agent_id: RISK_SCORING_AGENT_ID,
  agent_version: RISK_SCORING_AGENT_VERSION,
  name: 'Risk Scoring Agent',
  classification: 'RISK_SCORING' as const,
  decision_types: ['risk_score', 'impact_assessment', 'tradeoff_analysis'] as const,
  status: 'active' as const,
  consumers: RISK_SCORING_AGENT_CONTRACT.consumers,
  boundaries: RISK_SCORING_AGENT_CONTRACT.boundaries,
};

// Re-export contract for convenience
import { RISK_SCORING_AGENT_CONTRACT } from './contract.js';
