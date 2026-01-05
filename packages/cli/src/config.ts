/**
 * Configuration Management for Agentics CLI
 *
 * Handles reading and writing CLI configuration including API keys,
 * endpoint settings, and user preferences using the 'conf' package.
 *
 * ARCHITECTURAL CONSTRAINT:
 * All URLs use the canonical agentics.dev domain. The domain is defined
 * in one place (AGENTICS_DOMAIN) to prevent misconfiguration.
 * See architecture/CLI_AUTH_FLOW.md for URL ownership and rationale.
 */

import Conf from 'conf';
import { homedir } from 'os';
import { join } from 'path';

/**
 * Configuration schema
 */
interface ConfigSchema {
  /** API key for authentication */
  apiKey?: string;
  /** API endpoint URL */
  endpoint?: string;
  /** Default output format */
  format?: 'json' | 'table';
  /** User identity cache */
  identity?: {
    user_id: string;
    email: string;
  };
}

/**
 * Canonical domain for Agentics Platform
 * This is the SINGLE SOURCE OF TRUTH for the production domain.
 * All URL defaults derive from this value.
 */
export const AGENTICS_DOMAIN = 'agentics.dev';

/**
 * Default API endpoint
 * Derives from the canonical domain to ensure consistency
 */
export const DEFAULT_ENDPOINT = `https://api.${AGENTICS_DOMAIN}/v1`;

/**
 * Default platform URL (UI)
 * Used for browser-based authentication flows
 */
export const DEFAULT_PLATFORM_URL = `https://app.${AGENTICS_DOMAIN}`;

/**
 * Config directory path
 */
export const CONFIG_DIR = join(homedir(), '.agentics');

/**
 * Configuration store instance
 */
const config = new Conf<ConfigSchema>({
  projectName: 'agentics',
  cwd: CONFIG_DIR,
  configName: 'credentials',
});

/**
 * Get the API key from environment variable or config file
 *
 * Priority:
 * 1. AGENTICS_API_KEY environment variable
 * 2. Stored API key in config file
 *
 * @returns API key if found, undefined otherwise
 */
export function getApiKey(): string | undefined {
  // Check environment variable first
  const envKey = process.env.AGENTICS_API_KEY;
  if (envKey) {
    return envKey;
  }

  // Fall back to config file
  return config.get('apiKey');
}

/**
 * Store an API key in the config file
 *
 * @param key - API key to store
 */
export function setApiKey(key: string): void {
  config.set('apiKey', key);
}

/**
 * Remove the stored API key
 */
export function clearApiKey(): void {
  config.delete('apiKey');
}

/**
 * Get the API endpoint URL
 *
 * Priority:
 * 1. AGENTICS_ENDPOINT environment variable
 * 2. Stored endpoint in config file
 * 3. Default endpoint
 *
 * @returns API endpoint URL
 */
export function getEndpoint(): string {
  // Check environment variable first
  const envEndpoint = process.env.AGENTICS_ENDPOINT;
  if (envEndpoint) {
    return envEndpoint;
  }

  // Fall back to config file, then default
  return config.get('endpoint') ?? DEFAULT_ENDPOINT;
}

/**
 * Set the API endpoint URL
 *
 * @param endpoint - API endpoint URL to store
 */
export function setEndpoint(endpoint: string): void {
  config.set('endpoint', endpoint);
}

/**
 * Get the default output format
 *
 * @returns Output format ('json' or 'table')
 */
export function getFormat(): 'json' | 'table' {
  return config.get('format') ?? 'table';
}

/**
 * Set the default output format
 *
 * @param format - Output format to store
 */
export function setFormat(format: 'json' | 'table'): void {
  config.set('format', format);
}

/**
 * Get cached user identity
 *
 * @returns Cached identity if available
 */
export function getIdentity(): { user_id: string; email: string } | undefined {
  return config.get('identity');
}

/**
 * Cache user identity
 *
 * @param identity - User identity to cache
 */
export function setIdentity(identity: { user_id: string; email: string }): void {
  config.set('identity', identity);
}

/**
 * Clear cached user identity
 */
export function clearIdentity(): void {
  config.delete('identity');
}

/**
 * Clear all configuration
 */
export function clearAll(): void {
  config.clear();
}

/**
 * Get all configuration as an object
 *
 * @returns All configuration values
 */
export function getAll(): ConfigSchema {
  return config.store;
}

/**
 * Check if user is authenticated
 *
 * @returns true if API key is available
 */
export function isAuthenticated(): boolean {
  return !!getApiKey();
}

/**
 * Get the path to the config file
 *
 * @returns Full path to config file
 */
export function getConfigPath(): string {
  return config.path;
}
