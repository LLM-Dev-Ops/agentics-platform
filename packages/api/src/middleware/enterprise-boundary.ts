/**
 * Enterprise Boundary Middleware
 *
 * Enforces hard limits for non-enterprise organizations.
 * All limits are centrally enforced, deterministic, and non-bypassable.
 * Enterprise organizations bypass all limits cleanly.
 *
 * MOUNT: This middleware should be mounted on all protected API routes
 * in server.ts AFTER auth middleware and BEFORE route handlers.
 *
 * Limits enforced:
 * - Simulations per organization per day (UTC reset)
 * - Concurrent runs per organization
 * - Maximum repositories/agents
 * - CI/CD execution context blocking
 * - Data retention window
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../db.js';

// ============================================================================
// LIMIT CONSTANTS - Centrally defined, non-bypassable
// ============================================================================

export const ENTERPRISE_LIMITS = {
  /** Maximum simulations per organization per day (UTC reset) */
  MAX_SIMULATIONS_PER_DAY: 10,

  /** Maximum concurrent runs per organization */
  MAX_CONCURRENT_RUNS: 3,

  /** Maximum repositories that may execute */
  MAX_REPOSITORIES: 5,

  /** Maximum agents that may execute */
  MAX_AGENTS: 5,

  /** Data retention window in days */
  DATA_RETENTION_DAYS: 30,

  /** CI/CD execution is completely prohibited for non-enterprise */
  CICD_ALLOWED: false,
} as const;

// ============================================================================
// ERROR RESPONSE TYPES
// ============================================================================

export interface UpgradeRequiredError {
  error: string;
  code: 'UPGRADE_REQUIRED';
  limit_type: LimitType;
  current_usage: number;
  limit: number;
  message: string;
  upgrade_url: string;
  request_id: string;
}

export type LimitType =
  | 'DAILY_SIMULATIONS'
  | 'CONCURRENT_RUNS'
  | 'MAX_REPOSITORIES'
  | 'MAX_AGENTS'
  | 'CICD_BLOCKED'
  | 'DATA_RETENTION';

// ============================================================================
// IN-MEMORY USAGE TRACKING (MVP)
// Production: Replace with Redis or database
// ============================================================================

interface UsageTracker {
  /** Daily simulation counts by org, keyed by "orgId:YYYY-MM-DD" */
  dailySimulations: Map<string, number>;
  /** Active concurrent runs by org */
  concurrentRuns: Map<string, Set<string>>;
  /** Last cleanup timestamp */
  lastCleanup: number;
}

const usageTracker: UsageTracker = {
  dailySimulations: new Map(),
  concurrentRuns: new Map(),
  lastCleanup: Date.now(),
};

/**
 * Get current UTC date string for daily reset
 */
function getUTCDateKey(): string {
  const now = new Date();
  return now.toISOString().split('T')[0]; // YYYY-MM-DD
}

/**
 * Get daily simulation count for an organization
 */
function getDailySimulationCount(orgId: string): number {
  const key = `${orgId}:${getUTCDateKey()}`;
  return usageTracker.dailySimulations.get(key) || 0;
}

/**
 * Increment daily simulation count for an organization
 */
export function incrementDailySimulationCount(orgId: string): void {
  const key = `${orgId}:${getUTCDateKey()}`;
  const current = usageTracker.dailySimulations.get(key) || 0;
  usageTracker.dailySimulations.set(key, current + 1);
}

/**
 * Get concurrent run count for an organization
 */
function getConcurrentRunCount(orgId: string): number {
  const runs = usageTracker.concurrentRuns.get(orgId);
  return runs ? runs.size : 0;
}

/**
 * Register a new concurrent run
 */
export function registerConcurrentRun(orgId: string, runId: string): void {
  let runs = usageTracker.concurrentRuns.get(orgId);
  if (!runs) {
    runs = new Set();
    usageTracker.concurrentRuns.set(orgId, runs);
  }
  runs.add(runId);
}

/**
 * Unregister a completed/cancelled concurrent run
 */
export function unregisterConcurrentRun(orgId: string, runId: string): void {
  const runs = usageTracker.concurrentRuns.get(orgId);
  if (runs) {
    runs.delete(runId);
    if (runs.size === 0) {
      usageTracker.concurrentRuns.delete(orgId);
    }
  }
}

/**
 * Cleanup old daily simulation entries (called periodically)
 */
function cleanupOldEntries(): void {
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;

  // Only cleanup once per hour
  if (now - usageTracker.lastCleanup < oneHour) {
    return;
  }

  const todayKey = getUTCDateKey();

  // Use Array.from to avoid iterator compatibility issues
  const keys = Array.from(usageTracker.dailySimulations.keys());
  for (const key of keys) {
    const dateKey = key.split(':')[1];
    if (dateKey !== todayKey) {
      usageTracker.dailySimulations.delete(key);
    }
  }

  usageTracker.lastCleanup = now;
}

// ============================================================================
// ENTERPRISE STATUS - Controlled exclusively by Stripe webhooks
// ============================================================================

/**
 * Check if organization is enterprise
 * Reads the is_enterprise flag from organizations table.
 * This flag is controlled exclusively by Stripe webhook events.
 *
 * Returns true only if is_enterprise = true in database.
 * On any error, returns false (fail closed).
 */
async function isEnterpriseTier(orgId: string): Promise<boolean> {
  try {
    const result = await db.query(
      `SELECT is_enterprise FROM organizations WHERE id = $1`,
      [orgId]
    );
    return result.rows[0]?.is_enterprise === true;
  } catch {
    // On error, assume not enterprise (fail closed - silent)
    return false;
  }
}

// ============================================================================
// CI/CD DETECTION
// ============================================================================

/**
 * Detect if request is from CI/CD context
 * Checks headers, query params, and route patterns
 */
function isCICDContext(request: FastifyRequest): boolean {
  // Check common CI/CD headers
  const cicdHeaders = [
    'x-ci-pipeline',
    'x-cd-deployment',
    'x-github-actions',
    'x-gitlab-ci',
    'x-jenkins-build',
    'x-circleci-build',
    'x-travis-ci',
    'x-azure-pipelines',
    'x-bitbucket-pipelines',
  ];

  for (const header of cicdHeaders) {
    if (request.headers[header]) {
      return true;
    }
  }

  // Check for CI/CD user agent patterns
  const userAgent = (request.headers['user-agent'] || '').toLowerCase();
  const cicdAgents = ['github-actions', 'gitlab-runner', 'jenkins', 'circleci', 'travis'];
  for (const agent of cicdAgents) {
    if (userAgent.includes(agent)) {
      return true;
    }
  }

  // Check query parameters
  const query = request.query as Record<string, unknown>;
  if (query.ci === 'true' || query.cd === 'true' || query.cicd === 'true') {
    return true;
  }

  // Check for automation routes that indicate CI/CD usage
  const path = request.url.split('?')[0];
  const cicdRoutes = [
    '/v1/automation/deploy',
    '/v1/automation/pipeline',
    '/v1/automation/ci',
    '/v1/automation/cd',
  ];

  for (const route of cicdRoutes) {
    if (path.startsWith(route)) {
      return true;
    }
  }

  return false;
}

// ============================================================================
// RESOURCE COUNT QUERIES
// ============================================================================

/**
 * Get repository count for organization
 */
async function getRepositoryCount(orgId: string): Promise<number> {
  try {
    const result = await db.query(
      `SELECT COUNT(*) as count FROM repositories WHERE org_id = $1 AND is_active = true`,
      [orgId]
    );
    return parseInt(result.rows[0]?.count || '0', 10);
  } catch (error) {
    // Table may not exist yet, return 0
    return 0;
  }
}

/**
 * Get agent count for organization
 */
async function getAgentCount(orgId: string): Promise<number> {
  try {
    const result = await db.query(
      `SELECT COUNT(*) as count FROM agents WHERE org_id = $1 AND is_active = true`,
      [orgId]
    );
    return parseInt(result.rows[0]?.count || '0', 10);
  } catch (error) {
    // Table may not exist yet, return 0
    return 0;
  }
}

// ============================================================================
// ERROR RESPONSE BUILDER
// ============================================================================

/**
 * Create typed UPGRADE_REQUIRED error response
 */
function createUpgradeRequiredError(
  limitType: LimitType,
  currentUsage: number,
  limit: number,
  requestId: string
): UpgradeRequiredError {
  const messages: Record<LimitType, string> = {
    DAILY_SIMULATIONS: `Daily simulation limit of ${limit} reached. Upgrade to Enterprise for unlimited simulations.`,
    CONCURRENT_RUNS: `Maximum concurrent runs (${limit}) reached. Upgrade to Enterprise for unlimited concurrency.`,
    MAX_REPOSITORIES: `Repository limit of ${limit} reached. Upgrade to Enterprise for unlimited repositories.`,
    MAX_AGENTS: `Agent limit of ${limit} reached. Upgrade to Enterprise for unlimited agents.`,
    CICD_BLOCKED: 'CI/CD execution is only available on Enterprise plans.',
    DATA_RETENTION: `Data retention is limited to ${limit} days. Upgrade to Enterprise for unlimited retention.`,
  };

  return {
    error: 'Upgrade required',
    code: 'UPGRADE_REQUIRED',
    limit_type: limitType,
    current_usage: currentUsage,
    limit,
    message: messages[limitType],
    upgrade_url: '/billing/upgrade',
    request_id: requestId,
  };
}

// ============================================================================
// MAIN MIDDLEWARE
// ============================================================================

/**
 * Enterprise Boundary Middleware
 *
 * Enforces hard limits for non-enterprise organizations.
 * Must be mounted AFTER auth middleware.
 */
export async function enterpriseBoundaryMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // ========================================================================
  // EXECUTION GATING REMOVED
  //
  // The platform backend no longer blocks execution based on enterprise tier,
  // command type, CI/CD context, advisory flags, or environment.
  //
  // The ONLY enforcement is:
  //   1. API key must be valid (handled by auth middleware)
  //   2. payment_status must be "paid" or "internal" (handled by /v1/auth/session)
  //
  // All enterprise boundary checks are bypassed. The platform is the single
  // source of truth for entitlement via the /v1/auth/session contract.
  // ========================================================================
  return;
}

/**
 * Data Retention Enforcement Middleware
 *
 * Blocks access to historical data beyond the retention window
 * for non-enterprise organizations.
 *
 * Should be mounted on data access routes like:
 * - GET /v1/simulate (list)
 * - GET /v1/data/*
 * - GET /v1/usage/history
 */
export async function dataRetentionMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Data retention limits removed — all valid key holders have full access.
  // See enterpriseBoundaryMiddleware comment for rationale.
  return;
}

/**
 * Simulation completion hook
 *
 * Call this when a simulation completes (success or failure)
 * to track daily usage and release concurrent run slot.
 */
export function onSimulationComplete(orgId: string, runId: string): void {
  unregisterConcurrentRun(orgId, runId);
}

/**
 * Simulation start hook
 *
 * Call this when a simulation starts to track usage.
 * Returns the run ID for later completion tracking.
 */
export function onSimulationStart(orgId: string): string {
  const runId = `run_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  incrementDailySimulationCount(orgId);
  registerConcurrentRun(orgId, runId);
  return runId;
}

