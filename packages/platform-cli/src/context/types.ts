/**
 * Internal types for context resolution
 */

import type { OrgContext, EnvContext, ContextSource } from '../types/context.js';

/** CLI flag overrides */
export interface CliFlags {
  org?: string;
  env?: string;
  dryRun?: boolean;
  format?: 'json' | 'table';
}

/** Manifest file structure */
export interface ManifestFile {
  version: '1.0';
  org?: {
    id: string;
    name?: string;
  };
  env?: {
    id: string;
    name?: string;
    type?: 'development' | 'staging' | 'production';
  };
  defaults?: {
    format?: 'json' | 'table';
  };
}

/** Stored configuration */
export interface StoredConfig {
  currentOrg?: OrgContext;
  currentEnv?: EnvContext;
  lastUpdated?: string;
}

/** Context resolution result */
export interface ResolutionResult<T> {
  value: T;
  source: ContextSource;
}
