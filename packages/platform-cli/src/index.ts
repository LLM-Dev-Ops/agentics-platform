/**
 * @agentics/platform-cli
 *
 * Apex orchestration and governance CLI for the Agentics platform.
 *
 * This is the library entry point. The CLI binary (cli.ts) is a thin
 * wrapper that uses these exports.
 *
 * Architecture:
 * - Layer 5 consumer (external)
 * - Delegates to @agentics/cli via pure call-forwarding
 * - Policy enforcement reads from architecture/*.md
 * - All mutating commands support --dry-run
 */

// Types
export * from './types/index.js';

// Errors
export * from './errors.js';

// Context resolution
export * from './context/index.js';

// Policy enforcement
// Note: PolicyViolation is also exported from errors.ts - using the policy module's version
// with explicit exports to avoid conflict
export { loadPolicies, clearPolicyCache, getAllRules } from './policy/loader.js';
export { validatePath, validateDependency, validateLayerTransition, validateOrThrow } from './policy/validator.js';
export type {
  PolicyRuleType,
  PolicySeverity,
  PolicyRule,
  LoadedPolicy,
  ValidationResult,
  PolicyViolation as PolicyValidationViolation,
  PolicyCacheEntry,
} from './policy/types.js';

// Delegation
export * from './delegation/index.js';

// Routing
export * from './routing/index.js';

// Commands - Org
export * from './commands/org/index.js';

// Commands - Env
export * from './commands/env/index.js';

// Commands - Artifact
export * from './commands/artifact/index.js';

// Commands - Intent
export * from './commands/intent/index.js';

// Commands - Architecture
export * from './commands/architecture/index.js';

// Version info
export const VERSION = '0.1.0';
export const CLI_NAME = 'agentics-platform';
