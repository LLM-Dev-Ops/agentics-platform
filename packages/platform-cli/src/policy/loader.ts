/**
 * Policy loader - reads rules from architecture documents
 *
 * IMPORTANT: This module loads rules directly from architecture/*.md files.
 * Rules are NEVER re-encoded or duplicated in code.
 */

import { readFile, stat } from 'fs/promises';
import { join } from 'path';
import { createHash } from 'crypto';
import type { LoadedPolicy, PolicyRule, PolicyCacheEntry, PolicyRuleType, PolicySeverity } from './types.js';
import { ArchitectureParseError } from '../errors.js';

const ARCHITECTURE_DIR = 'architecture';
const POLICY_DOCS = [
  { name: 'DEPENDENCY_GRAPH.md', types: ['layer_boundary', 'dependency_rule'] as PolicyRuleType[] },
  { name: 'FORBIDDEN_PATHS.md', types: ['forbidden_path', 'integration_surface'] as PolicyRuleType[] },
  { name: 'REPO_CLASSIFICATION.md', types: ['repo_classification'] as PolicyRuleType[] },
];

// In-memory cache for parsed policies
const policyCache = new Map<string, PolicyCacheEntry>();

/**
 * Compute MD5 checksum of content
 */
function computeChecksum(content: string): string {
  return createHash('md5').update(content).digest('hex');
}

/**
 * Parse forbidden path rules from FORBIDDEN_PATHS.md
 */
function parseForbiddenPaths(content: string): PolicyRule[] {
  const rules: PolicyRule[] = [];

  // Parse tables with forbidden dependencies
  const tableRegex = /\|\s*`?([^`|]+)`?\s*\|\s*([^|]+)\s*\|/g;
  let match: RegExpExecArray | null;

  // Find sections for each repository class
  const sections = content.split(/^### \d+\./m);

  for (const section of sections) {
    const headerMatch = section.match(/^[^(]+\(`([^`]+)`\)/);
    const sourcePattern = headerMatch ? headerMatch[1] : 'unknown';

    // Reset regex for each section
    tableRegex.lastIndex = 0;

    while ((match = tableRegex.exec(section)) !== null) {
      const target = match[1]?.trim();
      const rationale = match[2]?.trim();

      // Skip header rows
      if (target === 'Forbidden Dependency' || target?.includes('---') || !target) {
        continue;
      }

      rules.push({
        id: `FP-${sourcePattern}-${target}`.replace(/[^a-zA-Z0-9-]/g, '-'),
        type: 'forbidden_path',
        pattern: `${sourcePattern} -> ${target}`,
        description: rationale ?? `${sourcePattern} must not depend on ${target}`,
        severity: determineSeverity(rationale ?? ''),
      });
    }
  }

  return rules;
}

/**
 * Parse layer boundary rules from DEPENDENCY_GRAPH.md
 */
function parseLayerBoundaries(content: string): PolicyRule[] {
  const rules: PolicyRule[] = [];

  // Parse forbidden upward/lateral dependencies
  const forbiddenPatterns = [
    { pattern: /Layer (\d) ───✕──→ Layer (\d)/g, severity: 'critical' as PolicySeverity },
    { pattern: /Layer 5 ───✕──→ Layer (\d)/g, severity: 'critical' as PolicySeverity },
  ];

  for (const { pattern, severity } of forbiddenPatterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content)) !== null) {
      const sourceLayer = parseInt(match[1] ?? '0', 10);
      const targetLayer = parseInt(match[2] ?? '0', 10);

      rules.push({
        id: `LB-L${sourceLayer}-L${targetLayer}`,
        type: 'layer_boundary',
        pattern: `Layer ${sourceLayer} -> Layer ${targetLayer}`,
        sourceLayer,
        targetLayer,
        description: `Layer ${sourceLayer} must not depend on Layer ${targetLayer}`,
        severity,
      });
    }
  }

  // Parse the dependency matrix
  const matrixMatch = content.match(/Layer 5 \(External\)\s*│\s*-\s*│\s*([✓✕])\s*│\s*([✓✕])/);
  if (matrixMatch) {
    if (matrixMatch[2] === '✕') {
      rules.push({
        id: 'LB-L5-L3-SKIP',
        type: 'layer_boundary',
        pattern: 'Layer 5 -> Layer 3 (direct)',
        sourceLayer: 5,
        targetLayer: 3,
        description: 'Layer 5 must not access Layer 3 directly (must route through Layer 4)',
        severity: 'critical',
      });
    }
  }

  return rules;
}

/**
 * Parse repository classification rules from REPO_CLASSIFICATION.md
 */
function parseRepoClassification(content: string): PolicyRule[] {
  const rules: PolicyRule[] = [];

  // Parse the repository tables
  const repoTableRegex = /\|\s*`([^`]+)`\s*\|\s*(\w+)\s*\|\s*(\d+|N\/A)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|/g;
  let match: RegExpExecArray | null;

  while ((match = repoTableRegex.exec(content)) !== null) {
    const repoName = match[1];
    const repoClass = match[2];
    const layer = match[3];
    const forbidden = match[5]?.trim();

    if (!repoName || repoName.includes('---') || repoName === 'Repository') {
      continue;
    }

    // Parse forbidden dependencies
    if (forbidden && forbidden !== 'Forbidden Dependencies') {
      const forbiddenDeps = forbidden.split(',').map(d => d.trim());
      for (const dep of forbiddenDeps) {
        if (dep) {
          rules.push({
            id: `RC-${repoName}-${dep}`.replace(/[^a-zA-Z0-9-]/g, '-'),
            type: 'repo_classification',
            pattern: repoName,
            repoClass,
            description: `${repoName} (${repoClass}, Layer ${layer}) must not depend on ${dep}`,
            severity: 'high',
          });
        }
      }
    }
  }

  return rules;
}

/**
 * Parse integration surface rules from FORBIDDEN_PATHS.md
 */
function parseIntegrationSurfaceRules(content: string): PolicyRule[] {
  const rules: PolicyRule[] = [];

  // Find the Integration Surface section
  const surfaceSection = content.match(/### 9\. Integration Surface Repositories[^#]*/s);
  if (!surfaceSection) {
    return rules;
  }

  const sectionContent = surfaceSection[0];

  // Parse forbidden dependencies table
  const tableRegex = /\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|/g;
  let match: RegExpExecArray | null;

  while ((match = tableRegex.exec(sectionContent)) !== null) {
    const target = match[1]?.trim();
    const rationale = match[2]?.trim();

    // Skip header rows
    if (target === 'Forbidden Dependency' || target?.includes('---') || !target) {
      continue;
    }

    rules.push({
      id: `IS-erp-surface-${target}`.replace(/[^a-zA-Z0-9-]/g, '-'),
      type: 'integration_surface',
      pattern: `erp-surface -> ${target}`,
      description: rationale ?? `Integration surfaces must not depend on ${target}`,
      severity: 'critical',
    });
  }

  // Add explicit ERP mediation rule
  rules.push({
    id: 'IS-erp-mediation-required',
    type: 'integration_surface',
    pattern: 'ERP mediation via erp-surface',
    description: 'All ERP system references must be mediated through erp-surface. Direct references to ERP systems from simulation or deployment repositories are forbidden.',
    severity: 'critical',
  });

  return rules;
}

/**
 * Determine severity from description/rationale text
 */
function determineSeverity(text: string): PolicySeverity {
  const lowerText = text.toLowerCase();
  if (lowerText.includes('must never') || lowerText.includes('critical') || lowerText.includes('production')) {
    return 'critical';
  }
  if (lowerText.includes('must not') || lowerText.includes('forbidden')) {
    return 'high';
  }
  return 'medium';
}

/**
 * Parse rules from markdown content based on document type
 */
function parseRulesFromMarkdown(content: string, _docName: string, types: PolicyRuleType[]): PolicyRule[] {
  const rules: PolicyRule[] = [];

  for (const type of types) {
    switch (type) {
      case 'forbidden_path':
        rules.push(...parseForbiddenPaths(content));
        break;
      case 'layer_boundary':
      case 'dependency_rule':
        rules.push(...parseLayerBoundaries(content));
        break;
      case 'repo_classification':
        rules.push(...parseRepoClassification(content));
        break;
      case 'integration_surface':
        rules.push(...parseIntegrationSurfaceRules(content));
        break;
    }
  }

  return rules;
}

/**
 * Load a single policy document
 */
async function loadPolicyDocument(
  baseDir: string,
  docName: string,
  types: PolicyRuleType[]
): Promise<LoadedPolicy> {
  const path = join(baseDir, ARCHITECTURE_DIR, docName);

  try {
    const content = await readFile(path, 'utf-8');
    const rules = parseRulesFromMarkdown(content, docName, types);

    return {
      source: path,
      documentName: docName,
      loadedAt: new Date().toISOString(),
      checksum: computeChecksum(content),
      rules,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new ArchitectureParseError(path, 'File not found');
    }
    throw new ArchitectureParseError(
      path,
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
}

/**
 * Check if cached policy is still valid
 */
async function isCacheValid(docPath: string, cached: PolicyCacheEntry): Promise<boolean> {
  try {
    const stats = await stat(docPath);
    return stats.mtimeMs <= cached.fileModifiedAt;
  } catch {
    return false;
  }
}

/**
 * Load all policy documents from architecture directory
 * Uses caching with file modification timestamp invalidation
 */
export async function loadPolicies(baseDir: string = process.cwd()): Promise<LoadedPolicy[]> {
  const policies: LoadedPolicy[] = [];

  for (const doc of POLICY_DOCS) {
    const docPath = join(baseDir, ARCHITECTURE_DIR, doc.name);
    const cached = policyCache.get(docPath);

    // Check cache validity
    if (cached && await isCacheValid(docPath, cached)) {
      policies.push(cached.policy);
      continue;
    }

    // Load and cache
    const policy = await loadPolicyDocument(baseDir, doc.name, doc.types);
    const stats = await stat(docPath);

    policyCache.set(docPath, {
      policy,
      fileModifiedAt: stats.mtimeMs,
    });

    policies.push(policy);
  }

  return policies;
}

/**
 * Clear the policy cache
 */
export function clearPolicyCache(): void {
  policyCache.clear();
}

/**
 * Get all unique rules from loaded policies
 */
export function getAllRules(policies: LoadedPolicy[]): PolicyRule[] {
  const rules: PolicyRule[] = [];
  const seenIds = new Set<string>();

  for (const policy of policies) {
    for (const rule of policy.rules) {
      if (!seenIds.has(rule.id)) {
        seenIds.add(rule.id);
        rules.push(rule);
      }
    }
  }

  return rules;
}
