/**
 * Context types for org/env resolution
 */

/** Organization context */
export interface OrgContext {
  orgId: string;
  orgName?: string;
  tier?: 'free' | 'pro' | 'enterprise';
}

/** Environment context */
export interface EnvContext {
  envId: string;
  envName?: string;
  envType: 'development' | 'staging' | 'production';
}

/** Full execution context */
export interface ExecutionContext {
  org: OrgContext;
  env: EnvContext;
  correlationId: string;
  timestamp: string;
  dryRun: boolean;
}

/** Context source priority */
export type ContextSource = 'cli-flag' | 'env-var' | 'manifest' | 'stored-config';

/** Resolved context with source tracking */
export interface ResolvedContext {
  context: ExecutionContext;
  sources: {
    org: ContextSource;
    env: ContextSource;
  };
}
