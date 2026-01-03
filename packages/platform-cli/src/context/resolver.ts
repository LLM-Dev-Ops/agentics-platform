/**
 * Org/env context resolution
 *
 * Resolution priority (highest to lowest):
 * 1. CLI flags (--org, --env)
 * 2. Environment variables (AGENTICS_ORG, AGENTICS_ENV)
 * 3. Project manifest (.agentics-manifest.json)
 * 4. Stored configuration (~/.agentics/config.json)
 */

import { randomUUID } from 'crypto';
import Conf from 'conf';
import type { ExecutionContext, OrgContext, EnvContext, ResolvedContext } from '../types/context.js';
import type { CliFlags, StoredConfig, ResolutionResult } from './types.js';
import { getManifest } from './manifest.js';
import { ContextResolutionError } from '../errors.js';

const config = new Conf<StoredConfig>({
  projectName: 'agentics-platform',
  configName: 'context',
});

/**
 * Resolve org context from available sources
 */
async function resolveOrg(flags: CliFlags): Promise<ResolutionResult<OrgContext> | null> {
  // 1. CLI flags
  if (flags.org) {
    return {
      value: { orgId: flags.org },
      source: 'cli-flag',
    };
  }

  // 2. Environment variables
  const envOrg = process.env['AGENTICS_ORG'];
  if (envOrg) {
    return {
      value: { orgId: envOrg },
      source: 'env-var',
    };
  }

  // 3. Manifest
  const manifest = await getManifest();
  if (manifest?.org) {
    return {
      value: {
        orgId: manifest.org.id,
        orgName: manifest.org.name,
      },
      source: 'manifest',
    };
  }

  // 4. Stored config
  const storedOrg = config.get('currentOrg');
  if (storedOrg) {
    return {
      value: storedOrg,
      source: 'stored-config',
    };
  }

  return null;
}

/**
 * Resolve env context from available sources
 */
async function resolveEnv(flags: CliFlags): Promise<ResolutionResult<EnvContext> | null> {
  // 1. CLI flags
  if (flags.env) {
    return {
      value: { envId: flags.env, envType: 'development' },
      source: 'cli-flag',
    };
  }

  // 2. Environment variables
  const envEnv = process.env['AGENTICS_ENV'];
  if (envEnv) {
    return {
      value: { envId: envEnv, envType: 'development' },
      source: 'env-var',
    };
  }

  // 3. Manifest
  const manifest = await getManifest();
  if (manifest?.env) {
    return {
      value: {
        envId: manifest.env.id,
        envName: manifest.env.name,
        envType: manifest.env.type ?? 'development',
      },
      source: 'manifest',
    };
  }

  // 4. Stored config
  const storedEnv = config.get('currentEnv');
  if (storedEnv) {
    return {
      value: storedEnv,
      source: 'stored-config',
    };
  }

  return null;
}

/**
 * Resolve full execution context
 * @throws ContextResolutionError if required context is missing
 */
export async function resolveContext(flags: CliFlags): Promise<ResolvedContext> {
  const [orgResult, envResult] = await Promise.all([
    resolveOrg(flags),
    resolveEnv(flags),
  ]);

  if (!orgResult && !envResult) {
    throw new ContextResolutionError(
      'Organization and environment context required but not found.',
      'both'
    );
  }

  if (!orgResult) {
    throw new ContextResolutionError(
      'Organization context required but not found.',
      'org'
    );
  }

  if (!envResult) {
    throw new ContextResolutionError(
      'Environment context required but not found.',
      'env'
    );
  }

  const context: ExecutionContext = {
    org: orgResult.value,
    env: envResult.value,
    correlationId: randomUUID(),
    timestamp: new Date().toISOString(),
    dryRun: flags.dryRun ?? false,
  };

  return {
    context,
    sources: {
      org: orgResult.source,
      env: envResult.source,
    },
  };
}

/**
 * Store org context for future use
 */
export function storeOrgContext(org: OrgContext): void {
  config.set('currentOrg', org);
  config.set('lastUpdated', new Date().toISOString());
}

/**
 * Store env context for future use
 */
export function storeEnvContext(env: EnvContext): void {
  config.set('currentEnv', env);
  config.set('lastUpdated', new Date().toISOString());
}

/**
 * Get currently stored org context
 */
export function getStoredOrg(): OrgContext | undefined {
  return config.get('currentOrg');
}

/**
 * Get currently stored env context
 */
export function getStoredEnv(): EnvContext | undefined {
  return config.get('currentEnv');
}

/**
 * Clear all stored context
 */
export function clearStoredContext(): void {
  config.clear();
}
