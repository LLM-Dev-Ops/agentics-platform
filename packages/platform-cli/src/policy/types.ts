/**
 * Policy types for architecture enforcement
 */

/** Policy rule types from architecture documents */
export type PolicyRuleType =
  | 'forbidden_path'
  | 'layer_boundary'
  | 'repo_classification'
  | 'dependency_rule'
  | 'integration_surface';

/** Severity levels for policy violations */
export type PolicySeverity = 'critical' | 'high' | 'medium';

/** A single parsed policy rule */
export interface PolicyRule {
  /** Unique rule identifier */
  id: string;
  /** Type of rule */
  type: PolicyRuleType;
  /** Pattern or path this rule applies to */
  pattern: string;
  /** Source layer (for layer boundary rules) */
  sourceLayer?: number;
  /** Target layer (for layer boundary rules) */
  targetLayer?: number;
  /** Repository class (for classification rules) */
  repoClass?: string;
  /** Human-readable description */
  description: string;
  /** Severity of violation */
  severity: PolicySeverity;
}

/** Loaded policy document */
export interface LoadedPolicy {
  /** Path to source document */
  source: string;
  /** Document name */
  documentName: string;
  /** Timestamp when loaded */
  loadedAt: string;
  /** MD5 checksum for cache invalidation */
  checksum: string;
  /** Parsed rules from document */
  rules: PolicyRule[];
}

/** Policy validation result */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** List of violations if any */
  violations: PolicyViolation[];
  /** Policies that were checked */
  checkedPolicies: string[];
}

/** A single policy violation */
export interface PolicyViolation {
  /** Rule that was violated */
  ruleId: string;
  /** Rule type */
  type: PolicyRuleType;
  /** Description of the violation */
  description: string;
  /** Source document */
  sourceDoc: string;
  /** Severity */
  severity: PolicySeverity;
  /** The path or pattern that caused the violation */
  violatingPath: string;
}

/** Cache entry for parsed policies */
export interface PolicyCacheEntry {
  policy: LoadedPolicy;
  fileModifiedAt: number;
}
