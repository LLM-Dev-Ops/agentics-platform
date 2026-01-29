/**
 * Lineage Tracking Service
 *
 * Implements ADR/DDD #005: Memory-Anchored Reality (Ruvector)
 *
 * Lineage is the chain of derivation that connects artifacts to their sources.
 * This service enables:
 * - Tracking artifact derivation chains
 * - Temporal comparison of states
 * - Replay and diffing as architectural primitives
 *
 * Memory is authoritative; projections are derived (INV-C4)
 */

import { randomUUID } from 'crypto';
import { createHash } from 'crypto';
import type {
  LineageRecord,
  ArtifactReference,
  DerivationOperation,
  GovernanceContext,
  StateSnapshot,
  StateDiff,
  Difference,
  DiffSummary,
} from '@agentics/shared';
import { ArtifactType } from '@agentics/shared';

/**
 * Configuration for lineage tracking
 */
export interface LineageTrackerConfig {
  /** Maximum lineage chain depth to traverse */
  maxChainDepth: number;
  /** Enable snapshot retention */
  retainSnapshots: boolean;
  /** Maximum number of snapshots to retain per artifact */
  maxSnapshotsPerArtifact: number;
}

/**
 * Lineage Tracking Service
 *
 * Manages the derivation history of artifacts and enables temporal comparison.
 */
export class LineageTracker {
  private readonly config: LineageTrackerConfig;
  private readonly lineageRecords: Map<string, LineageRecord> = new Map();
  private readonly artifactToLineage: Map<string, string[]> = new Map();
  private readonly snapshots: Map<string, StateSnapshot[]> = new Map();

  constructor(config: Partial<LineageTrackerConfig> = {}) {
    this.config = {
      maxChainDepth: 100,
      retainSnapshots: true,
      maxSnapshotsPerArtifact: 50,
      ...config,
    };
  }

  /**
   * Record a new lineage entry for an artifact
   *
   * @param artifact - The artifact being created
   * @param derivedFrom - Parent artifacts from which this was derived
   * @param operation - The operation that created the artifact
   * @param governanceContext - Governance rules in effect at creation
   * @param authorizedBy - User who authorized the creation
   * @param correlationId - Correlation ID for traceability
   */
  recordLineage(
    artifact: ArtifactReference,
    derivedFrom: ArtifactReference[],
    operation: DerivationOperation,
    governanceContext: GovernanceContext,
    authorizedBy: string,
    correlationId: string
  ): LineageRecord {
    const lineageId = randomUUID();

    const record: LineageRecord = {
      lineageId,
      artifact,
      derivedFrom,
      derivationOperation: operation,
      governanceContext,
      derivedAt: new Date().toISOString(),
      authorizedBy,
      correlationId,
    };

    // Store the record
    this.lineageRecords.set(lineageId, record);

    // Index by artifact ID
    const artifactKey = this.getArtifactKey(artifact);
    const existing = this.artifactToLineage.get(artifactKey) || [];
    existing.push(lineageId);
    this.artifactToLineage.set(artifactKey, existing);

    return record;
  }

  /**
   * Get the complete lineage chain for an artifact
   *
   * @param artifact - The artifact to trace
   * @param maxDepth - Maximum depth to traverse (default: config.maxChainDepth)
   */
  getLineageChain(
    artifact: ArtifactReference,
    maxDepth?: number
  ): LineageRecord[] {
    const depth = maxDepth ?? this.config.maxChainDepth;
    const chain: LineageRecord[] = [];
    const visited = new Set<string>();

    this.traverseLineage(artifact, chain, visited, depth);

    return chain;
  }

  /**
   * Get the most recent lineage record for an artifact
   */
  getLatestLineage(artifact: ArtifactReference): LineageRecord | undefined {
    const artifactKey = this.getArtifactKey(artifact);
    const lineageIds = this.artifactToLineage.get(artifactKey);

    if (!lineageIds || lineageIds.length === 0) {
      return undefined;
    }

    // Return the most recent (last) lineage record
    const latestId = lineageIds[lineageIds.length - 1];
    return this.lineageRecords.get(latestId);
  }

  /**
   * Get a specific lineage record by ID
   */
  getLineageRecord(lineageId: string): LineageRecord | undefined {
    return this.lineageRecords.get(lineageId);
  }

  /**
   * Get all lineage records for an artifact
   */
  getArtifactLineage(artifact: ArtifactReference): LineageRecord[] {
    const artifactKey = this.getArtifactKey(artifact);
    const lineageIds = this.artifactToLineage.get(artifactKey) || [];

    return lineageIds
      .map(id => this.lineageRecords.get(id))
      .filter((r): r is LineageRecord => r !== undefined);
  }

  /**
   * Take a snapshot of state for an artifact
   *
   * Snapshots enable temporal comparison - a core architectural primitive.
   */
  takeSnapshot(
    artifactId: string,
    stateType: string,
    state: Record<string, unknown>
  ): StateSnapshot {
    const snapshot: StateSnapshot = {
      snapshotId: randomUUID(),
      timestamp: new Date().toISOString(),
      hash: this.hashState(state),
      stateType,
      state,
    };

    if (this.config.retainSnapshots) {
      const existing = this.snapshots.get(artifactId) || [];
      existing.push(snapshot);

      // Trim old snapshots if over limit
      while (existing.length > this.config.maxSnapshotsPerArtifact) {
        existing.shift();
      }

      this.snapshots.set(artifactId, existing);
    }

    return snapshot;
  }

  /**
   * Get snapshots for an artifact
   */
  getSnapshots(artifactId: string): StateSnapshot[] {
    return this.snapshots.get(artifactId) || [];
  }

  /**
   * Get snapshot at a specific point in time
   */
  getSnapshotAt(artifactId: string, timestamp: string): StateSnapshot | undefined {
    const snapshots = this.getSnapshots(artifactId);
    const targetTime = new Date(timestamp).getTime();

    // Find the snapshot closest to but not after the target time
    let closest: StateSnapshot | undefined;
    for (const snapshot of snapshots) {
      const snapshotTime = new Date(snapshot.timestamp).getTime();
      if (snapshotTime <= targetTime) {
        if (!closest || snapshotTime > new Date(closest.timestamp).getTime()) {
          closest = snapshot;
        }
      }
    }

    return closest;
  }

  /**
   * Compare two states and produce a diff
   *
   * Diffing is an architectural primitive per ADR/DDD #005.
   */
  diffStates(baseline: StateSnapshot, comparison: StateSnapshot): StateDiff {
    const differences = this.computeDifferences(baseline.state, comparison.state);
    const summary = this.summarizeDiff(differences);

    return {
      diffId: randomUUID(),
      baseline,
      comparison,
      differences,
      summary,
      computedAt: new Date().toISOString(),
    };
  }

  /**
   * Compare current state against historical state
   */
  diffAgainstHistory(
    artifactId: string,
    currentState: Record<string, unknown>,
    historicalTimestamp: string
  ): StateDiff | undefined {
    const historicalSnapshot = this.getSnapshotAt(artifactId, historicalTimestamp);
    if (!historicalSnapshot) {
      return undefined;
    }

    const currentSnapshot: StateSnapshot = {
      snapshotId: randomUUID(),
      timestamp: new Date().toISOString(),
      hash: this.hashState(currentState),
      stateType: historicalSnapshot.stateType,
      state: currentState,
    };

    return this.diffStates(historicalSnapshot, currentSnapshot);
  }

  /**
   * Verify lineage integrity for an artifact
   *
   * Checks that the lineage chain is complete and consistent.
   */
  verifyLineageIntegrity(artifact: ArtifactReference): {
    valid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];
    const chain = this.getLineageChain(artifact);

    if (chain.length === 0) {
      issues.push('No lineage records found for artifact');
      return { valid: false, issues };
    }

    // Verify chain continuity
    for (let i = 0; i < chain.length - 1; i++) {
      const current = chain[i];
      const parent = chain[i + 1];

      // Check that parent artifacts are properly linked
      const parentReferenced = current.derivedFrom.some(
        (ref: ArtifactReference) =>
          ref.artifactId === parent.artifact.artifactId &&
          ref.artifactType === parent.artifact.artifactType
      );

      if (!parentReferenced && current.derivedFrom.length > 0) {
        issues.push(
          `Lineage gap: ${current.lineageId} references parent not found in chain`
        );
      }
    }

    // Verify governance context is present
    for (const record of chain) {
      if (!record.governanceContext || !record.governanceContext.adrVersion) {
        issues.push(
          `Missing governance context in lineage record: ${record.lineageId}`
        );
      }
    }

    // Verify authorization is present (INV-C1: traceability)
    for (const record of chain) {
      if (!record.authorizedBy) {
        issues.push(
          `Missing authorization in lineage record: ${record.lineageId}`
        );
      }
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  /**
   * Get statistics about lineage tracking
   */
  getStatistics(): {
    totalRecords: number;
    totalArtifacts: number;
    totalSnapshots: number;
    averageChainDepth: number;
  } {
    const artifacts = this.artifactToLineage.size;
    let totalSnapshots = 0;
    for (const snapshotList of this.snapshots.values()) {
      totalSnapshots += snapshotList.length;
    }

    // Calculate average chain depth
    let totalDepth = 0;
    let chainCount = 0;
    for (const lineageIds of this.artifactToLineage.values()) {
      if (lineageIds.length > 0) {
        const record = this.lineageRecords.get(lineageIds[0]);
        if (record) {
          const chain = this.getLineageChain(record.artifact, 10);
          totalDepth += chain.length;
          chainCount++;
        }
      }
    }

    return {
      totalRecords: this.lineageRecords.size,
      totalArtifacts: artifacts,
      totalSnapshots,
      averageChainDepth: chainCount > 0 ? totalDepth / chainCount : 0,
    };
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Generate a unique key for an artifact
   */
  private getArtifactKey(artifact: ArtifactReference): string {
    return `${artifact.artifactType}:${artifact.artifactId}:${artifact.version}`;
  }

  /**
   * Hash a state value for comparison
   */
  private hashState(state: Record<string, unknown>): string {
    const normalized = JSON.stringify(state, Object.keys(state).sort());
    return createHash('sha256').update(normalized).digest('hex').substring(0, 16);
  }

  /**
   * Recursively traverse the lineage chain
   */
  private traverseLineage(
    artifact: ArtifactReference,
    chain: LineageRecord[],
    visited: Set<string>,
    remainingDepth: number
  ): void {
    if (remainingDepth <= 0) {
      return;
    }

    const artifactKey = this.getArtifactKey(artifact);
    if (visited.has(artifactKey)) {
      return; // Avoid cycles
    }
    visited.add(artifactKey);

    const lineage = this.getLatestLineage(artifact);
    if (!lineage) {
      return;
    }

    chain.push(lineage);

    // Traverse parents
    for (const parent of lineage.derivedFrom) {
      this.traverseLineage(parent, chain, visited, remainingDepth - 1);
    }
  }

  /**
   * Compute differences between two states
   */
  private computeDifferences(
    baseline: Record<string, unknown>,
    comparison: Record<string, unknown>,
    path: string = ''
  ): Difference[] {
    const differences: Difference[] = [];
    const baselineKeys = new Set(Object.keys(baseline));
    const comparisonKeys = new Set(Object.keys(comparison));

    // Check for added keys
    for (const key of comparisonKeys) {
      if (!baselineKeys.has(key)) {
        differences.push({
          path: path ? `${path}.${key}` : key,
          differenceType: 'added',
          comparisonValue: comparison[key],
        });
      }
    }

    // Check for removed keys
    for (const key of baselineKeys) {
      if (!comparisonKeys.has(key)) {
        differences.push({
          path: path ? `${path}.${key}` : key,
          differenceType: 'removed',
          baselineValue: baseline[key],
        });
      }
    }

    // Check for modified values
    for (const key of baselineKeys) {
      if (comparisonKeys.has(key)) {
        const baselineValue = baseline[key];
        const comparisonValue = comparison[key];

        if (
          typeof baselineValue === 'object' &&
          baselineValue !== null &&
          typeof comparisonValue === 'object' &&
          comparisonValue !== null &&
          !Array.isArray(baselineValue) &&
          !Array.isArray(comparisonValue)
        ) {
          // Recursively compare objects
          const nestedPath = path ? `${path}.${key}` : key;
          differences.push(
            ...this.computeDifferences(
              baselineValue as Record<string, unknown>,
              comparisonValue as Record<string, unknown>,
              nestedPath
            )
          );
        } else if (JSON.stringify(baselineValue) !== JSON.stringify(comparisonValue)) {
          differences.push({
            path: path ? `${path}.${key}` : key,
            differenceType: 'modified',
            baselineValue,
            comparisonValue,
          });
        }
      }
    }

    return differences;
  }

  /**
   * Summarize differences
   */
  private summarizeDiff(differences: Difference[]): DiffSummary {
    let additions = 0;
    let removals = 0;
    let modifications = 0;
    const changedPaths: string[] = [];

    for (const diff of differences) {
      changedPaths.push(diff.path);
      switch (diff.differenceType) {
        case 'added':
          additions++;
          break;
        case 'removed':
          removals++;
          break;
        case 'modified':
          modifications++;
          break;
      }
    }

    return {
      additions,
      removals,
      modifications,
      changedPaths,
      equivalent: differences.length === 0,
    };
  }

  /**
   * Clear all records (for testing)
   */
  clear(): void {
    this.lineageRecords.clear();
    this.artifactToLineage.clear();
    this.snapshots.clear();
  }
}

// Singleton instance
let lineageTrackerInstance: LineageTracker | null = null;

/**
 * Get the lineage tracker instance
 */
export function getLineageTracker(config?: Partial<LineageTrackerConfig>): LineageTracker {
  if (!lineageTrackerInstance) {
    lineageTrackerInstance = new LineageTracker(config);
  }
  return lineageTrackerInstance;
}

/**
 * Reset the lineage tracker (for testing)
 */
export function resetLineageTracker(): void {
  lineageTrackerInstance = null;
}
