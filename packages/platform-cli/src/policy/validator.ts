/**
 * Policy validator - validates operations against loaded rules
 *
 * This module validates paths, dependencies, and operations against
 * rules loaded from architecture documents. It NEVER re-encodes rules.
 */

import type { PolicyRule, ValidationResult, PolicyViolation } from './types.js';
import { loadPolicies, getAllRules } from './loader.js';
import { PolicyViolationError } from '../errors.js';

/**
 * Check if a path matches a pattern (simple glob-like matching)
 */
function pathMatchesPattern(path: string, pattern: string): boolean {
  // Handle wildcards
  if (pattern.includes('*')) {
    const regexPattern = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*');
    return new RegExp(`^${regexPattern}$`).test(path);
  }

  // Exact match or prefix match
  return path === pattern || path.startsWith(pattern + '/') || path.startsWith(pattern + '-');
}

/**
 * Check if a dependency path is forbidden
 */
function checkForbiddenPath(
  source: string,
  target: string,
  rules: PolicyRule[]
): PolicyViolation | null {
  for (const rule of rules) {
    if (rule.type !== 'forbidden_path') continue;

    // Parse the pattern "source -> target"
    const [ruleSource, ruleTarget] = rule.pattern.split(' -> ').map(s => s.trim());

    if (pathMatchesPattern(source, ruleSource ?? '') && pathMatchesPattern(target, ruleTarget ?? '')) {
      return {
        ruleId: rule.id,
        type: rule.type,
        description: rule.description,
        sourceDoc: 'FORBIDDEN_PATHS.md',
        severity: rule.severity,
        violatingPath: `${source} -> ${target}`,
      };
    }
  }

  return null;
}

/**
 * Check if a layer boundary is violated
 */
function checkLayerBoundary(
  sourceLayer: number,
  targetLayer: number,
  rules: PolicyRule[]
): PolicyViolation | null {
  for (const rule of rules) {
    if (rule.type !== 'layer_boundary') continue;

    if (rule.sourceLayer === sourceLayer && rule.targetLayer === targetLayer) {
      return {
        ruleId: rule.id,
        type: rule.type,
        description: rule.description,
        sourceDoc: 'DEPENDENCY_GRAPH.md',
        severity: rule.severity,
        violatingPath: `Layer ${sourceLayer} -> Layer ${targetLayer}`,
      };
    }
  }

  return null;
}

/**
 * Check if a repository classification rule is violated
 */
function checkRepoClassification(
  repoName: string,
  dependency: string,
  rules: PolicyRule[]
): PolicyViolation | null {
  for (const rule of rules) {
    if (rule.type !== 'repo_classification') continue;

    if (pathMatchesPattern(repoName, rule.pattern)) {
      // Check if the dependency is forbidden for this repo
      if (rule.description.includes(dependency)) {
        return {
          ruleId: rule.id,
          type: rule.type,
          description: rule.description,
          sourceDoc: 'REPO_CLASSIFICATION.md',
          severity: rule.severity,
          violatingPath: `${repoName} -> ${dependency}`,
        };
      }
    }
  }

  return null;
}

/**
 * Validate a single path against all loaded policies
 */
export async function validatePath(
  path: string,
  baseDir: string = process.cwd()
): Promise<ValidationResult> {
  const policies = await loadPolicies(baseDir);
  const rules = getAllRules(policies);
  const violations: PolicyViolation[] = [];

  // Check against forbidden path patterns
  for (const rule of rules) {
    if (rule.type === 'forbidden_path' || rule.type === 'repo_classification') {
      // Extract source from pattern
      const patternSource = rule.pattern.split(' -> ')[0]?.trim() ?? '';

      if (pathMatchesPattern(path, patternSource)) {
        violations.push({
          ruleId: rule.id,
          type: rule.type,
          description: rule.description,
          sourceDoc: rule.type === 'forbidden_path' ? 'FORBIDDEN_PATHS.md' : 'REPO_CLASSIFICATION.md',
          severity: rule.severity,
          violatingPath: path,
        });
      }
    }
  }

  return {
    valid: violations.length === 0,
    violations,
    checkedPolicies: policies.map(p => p.documentName),
  };
}

/**
 * Validate a dependency relationship
 */
export async function validateDependency(
  source: string,
  target: string,
  baseDir: string = process.cwd()
): Promise<ValidationResult> {
  const policies = await loadPolicies(baseDir);
  const rules = getAllRules(policies);
  const violations: PolicyViolation[] = [];

  // Check forbidden paths
  const forbiddenViolation = checkForbiddenPath(source, target, rules);
  if (forbiddenViolation) {
    violations.push(forbiddenViolation);
  }

  // Check repo classification rules
  const classificationViolation = checkRepoClassification(source, target, rules);
  if (classificationViolation) {
    violations.push(classificationViolation);
  }

  return {
    valid: violations.length === 0,
    violations,
    checkedPolicies: policies.map(p => p.documentName),
  };
}

/**
 * Validate a layer transition
 */
export async function validateLayerTransition(
  sourceLayer: number,
  targetLayer: number,
  baseDir: string = process.cwd()
): Promise<ValidationResult> {
  const policies = await loadPolicies(baseDir);
  const rules = getAllRules(policies);
  const violations: PolicyViolation[] = [];

  const layerViolation = checkLayerBoundary(sourceLayer, targetLayer, rules);
  if (layerViolation) {
    violations.push(layerViolation);
  }

  return {
    valid: violations.length === 0,
    violations,
    checkedPolicies: policies.map(p => p.documentName),
  };
}

/**
 * Validate and throw if violations found
 */
export async function validateOrThrow(
  path: string,
  baseDir: string = process.cwd()
): Promise<void> {
  const result = await validatePath(path, baseDir);

  if (!result.valid) {
    throw new PolicyViolationError(
      `Path "${path}" violates architectural constraints`,
      result.violations.map(v => ({
        ruleId: v.ruleId,
        description: v.description,
        sourceDoc: v.sourceDoc,
        severity: v.severity,
      }))
    );
  }
}
