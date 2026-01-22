/**
 * Services Module
 *
 * Re-exports service clients from their canonical packages.
 *
 * @module @agentics/agents/services
 */

// RuVector client from @agentics/ruvector-client
export {
  RuvectorClient,
  RuvectorError,
  RuvectorAuthError,
  RuvectorNotFoundError,
  type RuvectorClientConfig,
} from '@agentics/ruvector-client';

// Note: Telemetry is exported from base/index.js
