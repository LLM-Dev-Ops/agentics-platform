/**
 * Apex Agent Service Startup Configuration
 *
 * Implements startup hardening for Cloud Run deployment.
 * CRITICAL: Service MUST crash if Ruvector is unavailable.
 *
 * APEX-SPECIFIC ROLE:
 * - Apex agents coordinate, synthesize, and present
 * - Apex agents NEVER execute irreversible actions directly
 *
 * @module @agentics/agents/server/startup
 */

import { RuvectorClient } from '@agentics/ruvector-client';

// =============================================================================
// PERFORMANCE BUDGETS (NON-NEGOTIABLE)
// =============================================================================
export const PERFORMANCE_BUDGETS = {
  /** Maximum tokens per agent invocation */
  MAX_TOKENS: 3000,
  /** Maximum latency in milliseconds */
  MAX_LATENCY_MS: 6000,
  /** Maximum RuVector calls per run */
  MAX_CALLS_PER_RUN: 6,
} as const;

// =============================================================================
// APEX LAYER CONFIGURATION
// =============================================================================
export const APEX_CONFIG = {
  /** Agent phase identifier */
  AGENT_PHASE: 'apex',
  /** Agent layer in platform architecture */
  AGENT_LAYER: 'layer5',
  /** Service name */
  SERVICE_NAME: 'agentics-agents',
  /** Service version */
  SERVICE_VERSION: '0.1.0',
} as const;

// =============================================================================
// REQUIRED ENVIRONMENT VARIABLES
// =============================================================================
interface RequiredEnvVars {
  RUVECTOR_SERVICE_URL: string;
  RUVECTOR_API_KEY: string;
}

interface ApexEnvVars {
  AGENT_NAME: string;
  AGENT_PHASE: string;
  AGENT_LAYER: string;
}

interface StartupConfig {
  ruvector: {
    baseUrl: string;
    apiKey: string;
  };
  apex: {
    agentName: string;
    agentPhase: string;
    agentLayer: string;
  };
  service: {
    name: string;
    version: string;
    port: number;
    host: string;
  };
}

// =============================================================================
// STARTUP VALIDATION ERROR
// =============================================================================
export class StartupValidationError extends Error {
  constructor(
    message: string,
    public readonly missingVars?: string[],
    public readonly failedChecks?: string[]
  ) {
    super(message);
    this.name = 'StartupValidationError';
  }
}

// =============================================================================
// ENVIRONMENT VARIABLE ASSERTIONS
// =============================================================================

/**
 * Assert required environment variables are present.
 * FAILS FAST if any required variable is missing.
 */
function assertRequiredEnvVars(): RequiredEnvVars {
  const missing: string[] = [];

  const RUVECTOR_SERVICE_URL = process.env.RUVECTOR_SERVICE_URL;
  const RUVECTOR_API_KEY = process.env.RUVECTOR_API_KEY;

  if (!RUVECTOR_SERVICE_URL) {
    missing.push('RUVECTOR_SERVICE_URL');
  }

  if (!RUVECTOR_API_KEY) {
    missing.push('RUVECTOR_API_KEY');
  }

  if (missing.length > 0) {
    throw new StartupValidationError(
      `FATAL: Missing required environment variables: ${missing.join(', ')}. ` +
      `Secrets must be injected via Cloud Run --set-secrets from Google Secret Manager.`,
      missing
    );
  }

  return {
    RUVECTOR_SERVICE_URL: RUVECTOR_SERVICE_URL!,
    RUVECTOR_API_KEY: RUVECTOR_API_KEY!,
  };
}

/**
 * Assert Apex-specific environment variables.
 * Uses defaults for local development but enforces in production.
 */
function assertApexEnvVars(): ApexEnvVars {
  const isProduction = process.env.NODE_ENV === 'production';

  const AGENT_NAME = process.env.AGENT_NAME;
  const AGENT_PHASE = process.env.AGENT_PHASE;
  const AGENT_LAYER = process.env.AGENT_LAYER;

  // In production, these should be set
  if (isProduction) {
    const missing: string[] = [];

    if (!AGENT_NAME) missing.push('AGENT_NAME');
    if (AGENT_PHASE !== APEX_CONFIG.AGENT_PHASE) {
      console.warn(
        `AGENT_PHASE should be '${APEX_CONFIG.AGENT_PHASE}', got '${AGENT_PHASE || 'undefined'}'`
      );
    }
    if (AGENT_LAYER !== APEX_CONFIG.AGENT_LAYER) {
      console.warn(
        `AGENT_LAYER should be '${APEX_CONFIG.AGENT_LAYER}', got '${AGENT_LAYER || 'undefined'}'`
      );
    }

    if (missing.length > 0) {
      console.warn(`Missing recommended Apex env vars: ${missing.join(', ')}`);
    }
  }

  return {
    AGENT_NAME: AGENT_NAME || APEX_CONFIG.SERVICE_NAME,
    AGENT_PHASE: AGENT_PHASE || APEX_CONFIG.AGENT_PHASE,
    AGENT_LAYER: AGENT_LAYER || APEX_CONFIG.AGENT_LAYER,
  };
}

// =============================================================================
// RUVECTOR HEALTH CHECK
// =============================================================================

/**
 * Perform Ruvector health check.
 * CRASHES if Ruvector is unavailable in production.
 */
async function assertRuvectorHealth(baseUrl: string, apiKey: string): Promise<void> {
  const client = new RuvectorClient({
    baseUrl,
    apiKey,
  });

  try {
    await client.health();
    console.log(`✓ Ruvector health check passed: ${baseUrl}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new StartupValidationError(
      `FATAL: Ruvector health check failed. Service URL: ${baseUrl}. ` +
      `Error: ${errorMessage}. ` +
      `Apex agents REQUIRE Ruvector for persistence.`,
      undefined,
      ['ruvector_health_check']
    );
  }
}

// =============================================================================
// STARTUP INITIALIZATION
// =============================================================================

/**
 * Initialize startup configuration with all validations.
 * This MUST be called before the server starts.
 * CRASHES on any validation failure.
 */
export async function initializeStartup(): Promise<StartupConfig> {
  console.log('='.repeat(60));
  console.log('AGENTICS APEX AGENT SERVICE - STARTUP INITIALIZATION');
  console.log('='.repeat(60));

  // Step 1: Assert required environment variables
  console.log('\n[1/4] Asserting required environment variables...');
  const requiredEnv = assertRequiredEnvVars();
  console.log('✓ Required environment variables present');

  // Step 2: Assert Apex-specific variables
  console.log('\n[2/4] Asserting Apex layer configuration...');
  const apexEnv = assertApexEnvVars();
  console.log(`✓ Agent Phase: ${apexEnv.AGENT_PHASE}`);
  console.log(`✓ Agent Layer: ${apexEnv.AGENT_LAYER}`);
  console.log(`✓ Agent Name: ${apexEnv.AGENT_NAME}`);

  // Step 3: Ruvector health check (CRITICAL)
  console.log('\n[3/4] Performing Ruvector health check...');
  await assertRuvectorHealth(requiredEnv.RUVECTOR_SERVICE_URL, requiredEnv.RUVECTOR_API_KEY);

  // Step 4: Build configuration
  console.log('\n[4/4] Building startup configuration...');
  const config: StartupConfig = {
    ruvector: {
      baseUrl: requiredEnv.RUVECTOR_SERVICE_URL,
      apiKey: requiredEnv.RUVECTOR_API_KEY,
    },
    apex: {
      agentName: apexEnv.AGENT_NAME,
      agentPhase: apexEnv.AGENT_PHASE,
      agentLayer: apexEnv.AGENT_LAYER,
    },
    service: {
      name: process.env.SERVICE_NAME || APEX_CONFIG.SERVICE_NAME,
      version: process.env.SERVICE_VERSION || APEX_CONFIG.SERVICE_VERSION,
      port: parseInt(process.env.PORT ?? '8080', 10),
      host: process.env.HOST ?? '0.0.0.0',
    },
  };

  // Log performance budgets
  console.log('\n[PERFORMANCE BUDGETS]');
  console.log(`  MAX_TOKENS: ${PERFORMANCE_BUDGETS.MAX_TOKENS}`);
  console.log(`  MAX_LATENCY_MS: ${PERFORMANCE_BUDGETS.MAX_LATENCY_MS}`);
  console.log(`  MAX_CALLS_PER_RUN: ${PERFORMANCE_BUDGETS.MAX_CALLS_PER_RUN}`);

  console.log('\n' + '='.repeat(60));
  console.log('STARTUP VALIDATION COMPLETE - ALL CHECKS PASSED');
  console.log('='.repeat(60) + '\n');

  return config;
}

/**
 * Get agent configuration for route handlers.
 * Uses the validated startup configuration.
 */
export function getAgentConfig(): {
  ruvector: { baseUrl: string; apiKey?: string };
  telemetry: { enabled: boolean; endpoint?: string };
} {
  const ruvectorUrl = process.env.RUVECTOR_SERVICE_URL;
  const ruvectorKey = process.env.RUVECTOR_API_KEY;

  if (!ruvectorUrl || !ruvectorKey) {
    throw new StartupValidationError(
      'Agent configuration requested before startup validation. Call initializeStartup() first.',
      ['RUVECTOR_SERVICE_URL', 'RUVECTOR_API_KEY']
    );
  }

  return {
    ruvector: {
      baseUrl: ruvectorUrl,
      apiKey: ruvectorKey,
    },
    telemetry: {
      enabled: true,
      endpoint: process.env.TELEMETRY_ENDPOINT,
    },
  };
}

/**
 * Exported startup configuration singleton.
 * Set after initializeStartup() completes.
 */
let _startupConfig: StartupConfig | null = null;

export function getStartupConfig(): StartupConfig {
  if (!_startupConfig) {
    throw new StartupValidationError(
      'Startup configuration not initialized. Call initializeStartup() first.'
    );
  }
  return _startupConfig;
}

export function setStartupConfig(config: StartupConfig): void {
  _startupConfig = config;
}
