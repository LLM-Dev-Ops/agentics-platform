/**
 * @agentics/agents
 *
 * Decision synthesis, executive reporting, and risk scoring agents
 * for the agentics-dev-platform.
 *
 * REPOSITORY ROLE (from Constitution):
 * agentics-dev-platform is the PRIMARY EXECUTIVE DECISIONING, SYNTHESIS,
 * AND PLATFORM GOVERNANCE layer.
 *
 * These agents:
 * - Aggregate DecisionEvents across repositories
 * - Synthesize system-level insights, risks, and recommendations
 * - Produce executive-grade decision artifacts
 * - Support human decision-making and governance workflows
 * - Act as the canonical control-plane intelligence for the platform
 *
 * These agents MUST NOT:
 * - Execute inference
 * - Modify prompts or responses
 * - Route requests
 * - Trigger orchestration
 * - Apply optimizations
 * - Enforce governance actions automatically
 * - Connect directly to Google SQL
 * - Execute SQL
 *
 * @packageDocumentation
 */

// Base agent infrastructure
export * from './base/index.js';

// Decision Agent - DECISION SYNTHESIS
export * from './decision/index.js';

// Services
export * from './services/index.js';

// Executive Summary Agent - EXECUTIVE REPORTING
export * from './executive-summary/index.js';

// Risk Scoring Agent - RISK SCORING
export * from './risk-scoring/index.js';

// Decision Memo Agent - EXECUTIVE REPORTING
export * from './decision-memo/index.js';
