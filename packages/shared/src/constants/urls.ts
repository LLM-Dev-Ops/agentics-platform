/**
 * Canonical URL Configuration for Agentics Platform
 *
 * THIS IS THE SINGLE SOURCE OF TRUTH for all platform URLs.
 *
 * ARCHITECTURAL CONSTRAINT (ADR-XXX):
 * - All packages MUST use these constants or the getter functions
 * - NO package may hardcode domain names (agentics.dev, agentics.org, etc.)
 * - NO package may infer or default to a domain without explicit configuration
 * - Production deployments MUST set environment variables explicitly
 *
 * Environment Variables Required in Production:
 * - AGENTICS_PLATFORM_URL: The public-facing platform UI URL (https://app.agentics.dev)
 * - AGENTICS_API_URL: The public-facing API URL (https://api.agentics.dev/v1)
 *
 * @module @agentics/shared/constants/urls
 */

/**
 * Canonical production domain
 * This is the ONLY place the production domain should be defined
 */
export const AGENTICS_DOMAIN = 'agentics.dev';

/**
 * Production URL patterns
 * These define the expected URL structure but should NOT be used as defaults
 * in production - environment variables should be required instead
 */
export const URL_PATTERNS = {
  /** Platform UI URL pattern */
  PLATFORM: `https://app.${AGENTICS_DOMAIN}`,
  /** API URL pattern */
  API: `https://api.${AGENTICS_DOMAIN}/v1`,
  /** Marketing site URL pattern */
  SITE: `https://${AGENTICS_DOMAIN}`,
} as const;

/**
 * Environment variable names for URL configuration
 */
export const URL_ENV_VARS = {
  /** Environment variable for platform UI URL */
  PLATFORM_URL: 'AGENTICS_PLATFORM_URL',
  /** Environment variable for API URL */
  API_URL: 'AGENTICS_API_URL',
  /** Legacy environment variable names (for backwards compatibility) */
  LEGACY: {
    PLATFORM_URL: 'PLATFORM_URL',
    API_URL: 'AGENTICS_ENDPOINT',
    NEXT_PUBLIC_API_URL: 'NEXT_PUBLIC_API_URL',
  },
} as const;

/**
 * URL validation result
 */
export interface UrlValidationResult {
  valid: boolean;
  url?: string;
  error?: string;
}

/**
 * Validate a URL string
 *
 * @param urlString - URL string to validate
 * @param requireHttps - Whether to require HTTPS (default: true for production)
 * @returns Validation result with parsed URL or error message
 */
export function validateUrl(urlString: string, requireHttps = true): UrlValidationResult {
  try {
    const url = new URL(urlString);

    // Must be HTTP or HTTPS
    if (!['http:', 'https:'].includes(url.protocol)) {
      return {
        valid: false,
        error: `Invalid protocol: ${url.protocol}. Must be http or https.`,
      };
    }

    // Require HTTPS for non-localhost URLs
    if (requireHttps && url.protocol === 'http:' && !isLocalhost(url.hostname)) {
      return {
        valid: false,
        error: `Insecure HTTP not allowed for non-localhost URLs. Use HTTPS.`,
      };
    }

    return { valid: true, url: urlString };
  } catch (err) {
    return {
      valid: false,
      error: `Invalid URL format: ${err instanceof Error ? err.message : 'Unknown error'}`,
    };
  }
}

/**
 * Check if a hostname is localhost
 */
function isLocalhost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

/**
 * Check if running in development mode
 */
function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
}

/**
 * Get the platform UI URL with validation
 *
 * Priority:
 * 1. AGENTICS_PLATFORM_URL environment variable
 * 2. PLATFORM_URL environment variable (legacy)
 * 3. Default pattern ONLY in development mode
 *
 * In production, this will throw if no environment variable is set.
 *
 * @param options - Configuration options
 * @param options.required - If true, throws when URL is not configured (default: true in production)
 * @returns Platform URL string
 * @throws Error if URL is not configured and required is true
 */
export function getPlatformUrl(options?: { required?: boolean }): string {
  const required = options?.required ?? !isDevelopment();

  // Check primary env var
  const primaryUrl = process.env[URL_ENV_VARS.PLATFORM_URL];
  if (primaryUrl) {
    const validation = validateUrl(primaryUrl, !isDevelopment());
    if (!validation.valid) {
      throw new Error(`Invalid ${URL_ENV_VARS.PLATFORM_URL}: ${validation.error}`);
    }
    return primaryUrl;
  }

  // Check legacy env var
  const legacyUrl = process.env[URL_ENV_VARS.LEGACY.PLATFORM_URL];
  if (legacyUrl) {
    const validation = validateUrl(legacyUrl, !isDevelopment());
    if (!validation.valid) {
      throw new Error(`Invalid ${URL_ENV_VARS.LEGACY.PLATFORM_URL}: ${validation.error}`);
    }
    return legacyUrl;
  }

  // In development, use default pattern
  if (isDevelopment()) {
    return URL_PATTERNS.PLATFORM;
  }

  // In production, require explicit configuration
  if (required) {
    throw new Error(
      `Platform URL not configured. ` +
      `Set ${URL_ENV_VARS.PLATFORM_URL} environment variable to the public platform URL ` +
      `(e.g., ${URL_PATTERNS.PLATFORM}). ` +
      `Implicit defaults are prohibited in production to prevent domain misconfiguration.`
    );
  }

  return URL_PATTERNS.PLATFORM;
}

/**
 * Get the API URL with validation
 *
 * Priority:
 * 1. AGENTICS_API_URL environment variable
 * 2. AGENTICS_ENDPOINT environment variable (legacy)
 * 3. NEXT_PUBLIC_API_URL environment variable (for UI package)
 * 4. Default pattern ONLY in development mode
 *
 * In production, this will throw if no environment variable is set.
 *
 * @param options - Configuration options
 * @param options.required - If true, throws when URL is not configured (default: true in production)
 * @returns API URL string
 * @throws Error if URL is not configured and required is true
 */
export function getApiUrl(options?: { required?: boolean }): string {
  const required = options?.required ?? !isDevelopment();

  // Check primary env var
  const primaryUrl = process.env[URL_ENV_VARS.API_URL];
  if (primaryUrl) {
    const validation = validateUrl(primaryUrl, !isDevelopment());
    if (!validation.valid) {
      throw new Error(`Invalid ${URL_ENV_VARS.API_URL}: ${validation.error}`);
    }
    return primaryUrl;
  }

  // Check legacy env vars
  const legacyUrl = process.env[URL_ENV_VARS.LEGACY.API_URL];
  if (legacyUrl) {
    const validation = validateUrl(legacyUrl, !isDevelopment());
    if (!validation.valid) {
      throw new Error(`Invalid ${URL_ENV_VARS.LEGACY.API_URL}: ${validation.error}`);
    }
    return legacyUrl;
  }

  // Check Next.js public env var
  const nextPublicUrl = process.env[URL_ENV_VARS.LEGACY.NEXT_PUBLIC_API_URL];
  if (nextPublicUrl) {
    // Strip /v1 suffix if present to normalize
    const normalized = nextPublicUrl.replace(/\/v1\/?$/, '');
    const validation = validateUrl(normalized, !isDevelopment());
    if (!validation.valid) {
      throw new Error(`Invalid ${URL_ENV_VARS.LEGACY.NEXT_PUBLIC_API_URL}: ${validation.error}`);
    }
    return nextPublicUrl;
  }

  // In development, use default pattern
  if (isDevelopment()) {
    return URL_PATTERNS.API;
  }

  // In production, require explicit configuration
  if (required) {
    throw new Error(
      `API URL not configured. ` +
      `Set ${URL_ENV_VARS.API_URL} environment variable to the public API URL ` +
      `(e.g., ${URL_PATTERNS.API}). ` +
      `Implicit defaults are prohibited in production to prevent domain misconfiguration.`
    );
  }

  return URL_PATTERNS.API;
}

/**
 * Validate that a URL belongs to the agentics.dev domain
 *
 * @param urlString - URL to validate
 * @returns true if URL is on agentics.dev domain
 */
export function isAgenticsDomain(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.hostname.endsWith(`.${AGENTICS_DOMAIN}`) || url.hostname === AGENTICS_DOMAIN;
  } catch {
    return false;
  }
}

/**
 * Create a CLI auth verification URL
 *
 * @param sessionCode - The session code to include in the URL
 * @returns Full verification URL
 * @throws Error if platform URL is not configured
 */
export function createCliAuthUrl(sessionCode: string): string {
  const platformUrl = getPlatformUrl();
  return `${platformUrl}/cli/auth?code=${encodeURIComponent(sessionCode)}`;
}
