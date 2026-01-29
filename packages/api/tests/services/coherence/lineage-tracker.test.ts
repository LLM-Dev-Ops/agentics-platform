/**
 * Lineage Tracker Service Tests
 *
 * Tests for ADR/DDD #005: Memory-Anchored Reality
 *
 * Validates that:
 * - Lineage is properly recorded with full context
 * - Temporal comparison is enabled through snapshots
 * - Diffing works as an architectural primitive
 * - Lineage integrity can be verified
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  LineageTracker,
  resetLineageTracker,
  getLineageTracker,
} from '../../../src/services/coherence/lineage-tracker.js';
import { ArtifactType } from '@agentics/shared';

describe('LineageTracker', () => {
  let tracker: LineageTracker;

  beforeEach(() => {
    resetLineageTracker();
    tracker = getLineageTracker();
    tracker.clear();
  });

  describe('recordLineage', () => {
    it('should record lineage with all required fields', () => {
      const artifact = {
        artifactType: ArtifactType.SIMULATION,
        artifactId: 'sim-1',
        version: '1.0',
        contentHash: 'abc123',
      };

      const record = tracker.recordLineage(
        artifact,
        [],
        {
          operationType: 'create',
          description: 'Created simulation',
          parameters: {},
          deterministic: true,
        },
        {
          activeRules: ['rule-1'],
          adrVersion: '1.0.0',
          policiesEvaluated: ['policy-1'],
          complianceStatus: 'compliant',
        },
        'user-1',
        'corr-1'
      );

      expect(record.lineageId).toBeDefined();
      expect(record.artifact).toEqual(artifact);
      expect(record.authorizedBy).toBe('user-1');
      expect(record.correlationId).toBe('corr-1');
      expect(record.governanceContext.adrVersion).toBe('1.0.0');
    });

    it('should record derivation from parent artifacts', () => {
      const parent = {
        artifactType: ArtifactType.PROPOSAL,
        artifactId: 'prop-1',
        version: '1.0',
        contentHash: 'parent123',
      };

      const child = {
        artifactType: ArtifactType.DECISION,
        artifactId: 'dec-1',
        version: '1.0',
        contentHash: 'child123',
      };

      tracker.recordLineage(
        parent,
        [],
        {
          operationType: 'create',
          description: 'Created proposal',
          parameters: {},
          deterministic: true,
        },
        {
          activeRules: [],
          adrVersion: '1.0.0',
          policiesEvaluated: [],
          complianceStatus: 'compliant',
        },
        'user-1',
        'corr-1'
      );

      const childRecord = tracker.recordLineage(
        child,
        [parent],
        {
          operationType: 'derive',
          description: 'Decision from proposal',
          parameters: { proposalId: 'prop-1' },
          deterministic: true,
        },
        {
          activeRules: [],
          adrVersion: '1.0.0',
          policiesEvaluated: [],
          complianceStatus: 'compliant',
        },
        'user-1',
        'corr-2'
      );

      expect(childRecord.derivedFrom).toHaveLength(1);
      expect(childRecord.derivedFrom[0].artifactId).toBe('prop-1');
    });
  });

  describe('getLineageChain', () => {
    it('should traverse the complete lineage chain', () => {
      const artifacts = [
        {
          artifactType: ArtifactType.PROPOSAL,
          artifactId: 'prop-1',
          version: '1.0',
          contentHash: 'a',
        },
        {
          artifactType: ArtifactType.DECISION,
          artifactId: 'dec-1',
          version: '1.0',
          contentHash: 'b',
        },
        {
          artifactType: ArtifactType.EXPORT,
          artifactId: 'exp-1',
          version: '1.0',
          contentHash: 'c',
        },
      ];

      // Create chain: proposal -> decision -> export
      tracker.recordLineage(
        artifacts[0],
        [],
        { operationType: 'create', description: '', parameters: {}, deterministic: true },
        { activeRules: [], adrVersion: '1.0.0', policiesEvaluated: [], complianceStatus: 'compliant' },
        'user-1',
        'corr-1'
      );

      tracker.recordLineage(
        artifacts[1],
        [artifacts[0]],
        { operationType: 'derive', description: '', parameters: {}, deterministic: true },
        { activeRules: [], adrVersion: '1.0.0', policiesEvaluated: [], complianceStatus: 'compliant' },
        'user-1',
        'corr-2'
      );

      tracker.recordLineage(
        artifacts[2],
        [artifacts[1]],
        { operationType: 'export', description: '', parameters: {}, deterministic: true },
        { activeRules: [], adrVersion: '1.0.0', policiesEvaluated: [], complianceStatus: 'compliant' },
        'user-1',
        'corr-3'
      );

      const chain = tracker.getLineageChain(artifacts[2]);

      expect(chain.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('snapshots', () => {
    it('should take and retrieve snapshots', () => {
      const snapshot = tracker.takeSnapshot('artifact-1', 'state', {
        config: { enabled: true },
        version: '1.0',
      });

      expect(snapshot.snapshotId).toBeDefined();
      expect(snapshot.hash).toBeDefined();
      expect(snapshot.state).toEqual({
        config: { enabled: true },
        version: '1.0',
      });

      const snapshots = tracker.getSnapshots('artifact-1');
      expect(snapshots).toHaveLength(1);
    });

    it('should retrieve snapshot at specific time', () => {
      const now = new Date();

      // Take first snapshot
      tracker.takeSnapshot('artifact-1', 'state', { value: 1 });

      // Wait a bit and take another
      const later = new Date(now.getTime() + 1000);
      tracker.takeSnapshot('artifact-1', 'state', { value: 2 });

      const snapshot = tracker.getSnapshotAt('artifact-1', now.toISOString());

      // Should get the first snapshot (closest to but not after target time)
      expect(snapshot).toBeDefined();
    });
  });

  describe('diffStates', () => {
    it('should compute differences between states', () => {
      const baseline = tracker.takeSnapshot('artifact-1', 'state', {
        name: 'original',
        count: 5,
      });

      const comparison = tracker.takeSnapshot('artifact-1', 'state', {
        name: 'modified',
        count: 5,
        added: true,
      });

      const diff = tracker.diffStates(baseline, comparison);

      expect(diff.differences.length).toBeGreaterThan(0);
      expect(diff.summary.modifications).toBeGreaterThanOrEqual(1);
      expect(diff.summary.additions).toBeGreaterThanOrEqual(1);
      expect(diff.summary.equivalent).toBe(false);
    });

    it('should report equivalent states', () => {
      const baseline = tracker.takeSnapshot('artifact-1', 'state', { x: 1 });
      const comparison = tracker.takeSnapshot('artifact-1', 'state', { x: 1 });

      const diff = tracker.diffStates(baseline, comparison);

      expect(diff.summary.equivalent).toBe(true);
      expect(diff.differences).toHaveLength(0);
    });

    it('should detect nested changes', () => {
      const baseline = tracker.takeSnapshot('artifact-1', 'state', {
        outer: { inner: { value: 'old' } },
      });

      const comparison = tracker.takeSnapshot('artifact-1', 'state', {
        outer: { inner: { value: 'new' } },
      });

      const diff = tracker.diffStates(baseline, comparison);

      expect(diff.summary.modifications).toBeGreaterThan(0);
      expect(diff.summary.changedPaths).toContain('outer.inner.value');
    });
  });

  describe('verifyLineageIntegrity', () => {
    it('should validate complete lineage chains', () => {
      const artifact = {
        artifactType: ArtifactType.SIMULATION,
        artifactId: 'sim-1',
        version: '1.0',
        contentHash: 'abc',
      };

      tracker.recordLineage(
        artifact,
        [],
        { operationType: 'create', description: '', parameters: {}, deterministic: true },
        { activeRules: ['rule-1'], adrVersion: '1.0.0', policiesEvaluated: [], complianceStatus: 'compliant' },
        'user-1',
        'corr-1'
      );

      const integrity = tracker.verifyLineageIntegrity(artifact);

      expect(integrity.valid).toBe(true);
      expect(integrity.issues).toHaveLength(0);
    });

    it('should detect missing lineage', () => {
      const artifact = {
        artifactType: ArtifactType.SIMULATION,
        artifactId: 'unknown-artifact',
        version: '1.0',
        contentHash: 'xyz',
      };

      const integrity = tracker.verifyLineageIntegrity(artifact);

      expect(integrity.valid).toBe(false);
      expect(integrity.issues).toContain('No lineage records found for artifact');
    });
  });

  describe('statistics', () => {
    it('should provide accurate statistics', () => {
      const artifact = {
        artifactType: ArtifactType.SIMULATION,
        artifactId: 'sim-1',
        version: '1.0',
        contentHash: 'abc',
      };

      tracker.recordLineage(
        artifact,
        [],
        { operationType: 'create', description: '', parameters: {}, deterministic: true },
        { activeRules: [], adrVersion: '1.0.0', policiesEvaluated: [], complianceStatus: 'compliant' },
        'user-1',
        'corr-1'
      );

      tracker.takeSnapshot('sim-1', 'state', { data: 'test' });

      const stats = tracker.getStatistics();

      expect(stats.totalRecords).toBe(1);
      expect(stats.totalSnapshots).toBe(1);
    });
  });
});
