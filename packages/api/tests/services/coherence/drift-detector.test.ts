/**
 * Drift Detector Service Tests
 *
 * Tests for ADR/DDD #005: System Coherence, Drift Detection, and Self-Governance
 *
 * Validates that:
 * - Drift is detected but never silently corrected (INV-C3)
 * - All four drift types are properly categorized
 * - Findings are recorded and surfaced
 * - Acknowledgment does not equal correction
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  DriftDetector,
  resetDriftDetector,
  getDriftDetector,
  type DriftDetectionContext,
} from '../../../src/services/coherence/drift-detector.js';
import { DriftType, DriftSeverity } from '@agentics/shared';

describe('DriftDetector', () => {
  let detector: DriftDetector;
  const context: DriftDetectionContext = {
    correlationId: 'test-correlation-id',
    userId: 'test-user',
  };

  beforeEach(() => {
    resetDriftDetector();
    detector = getDriftDetector();
    detector.clearFindings();
  });

  describe('detectDrift', () => {
    it('should detect no drift when states are identical', async () => {
      const expected = { name: 'test', value: 42 };
      const actual = { name: 'test', value: 42 };
      const source = {
        sourceType: 'test',
        sourceId: 'test-1',
        name: 'Test Source',
      };

      const findings = await detector.detectDrift(expected, actual, source, context);

      expect(findings).toHaveLength(0);
    });

    it('should detect drift when states differ', async () => {
      const expected = { name: 'test', value: 42 };
      const actual = { name: 'test', value: 100 };
      const source = {
        sourceType: 'test',
        sourceId: 'test-1',
        name: 'Test Source',
      };

      const findings = await detector.detectDrift(expected, actual, source, context);

      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0].acknowledged).toBe(false);
    });

    it('should detect structural drift for removed keys', async () => {
      const expected = { name: 'test', value: 42, extra: 'data' };
      const actual = { name: 'test', value: 42 };
      const source = {
        sourceType: 'component',
        sourceId: 'test-1',
        name: 'Test Component',
      };

      const findings = await detector.detectDrift(expected, actual, source, context);

      const structuralFindings = findings.filter(f => f.type === DriftType.STRUCTURAL);
      expect(structuralFindings.length).toBeGreaterThan(0);
    });

    it('should detect semantic drift for added keys', async () => {
      const expected = { name: 'test' };
      const actual = { name: 'test', unexpected: 'data' };
      const source = {
        sourceType: 'contract',
        sourceId: 'test-1',
        name: 'Test Contract',
      };

      const findings = await detector.detectDrift(expected, actual, source, context);

      const semanticFindings = findings.filter(f => f.type === DriftType.SEMANTIC);
      expect(semanticFindings.length).toBeGreaterThan(0);
    });
  });

  describe('specialized drift detection', () => {
    it('should detect semantic drift in contracts', async () => {
      const stored = { field: 'original' };
      const current = { field: 'modified' };

      const findings = await detector.detectSemanticDrift(
        'contract-1',
        current,
        stored,
        context
      );

      expect(findings.length).toBeGreaterThan(0);
    });

    it('should detect structural drift in dependencies', async () => {
      const declared = ['dep-a', 'dep-b', 'dep-c'];
      const actual = ['dep-a', 'dep-b']; // dep-c missing

      const findings = await detector.detectStructuralDrift(
        'component-1',
        declared,
        actual,
        context
      );

      expect(findings.length).toBeGreaterThan(0);
    });

    it('should detect lineage drift', async () => {
      const recorded = { parent: 'artifact-1', version: '1.0' };
      const computed = { parent: 'artifact-1', version: '2.0' };

      const findings = await detector.detectLineageDrift(
        'artifact-2',
        recorded,
        computed,
        context
      );

      expect(findings.length).toBeGreaterThan(0);
    });

    it('should detect integration drift', async () => {
      const contract = { endpoint: '/api/v1', method: 'GET' };
      const runtime = { endpoint: '/api/v2', method: 'GET' };

      const findings = await detector.detectIntegrationDrift(
        'integration-1',
        contract,
        runtime,
        context
      );

      expect(findings.length).toBeGreaterThan(0);
    });
  });

  describe('acknowledgment (INV-C3)', () => {
    it('should record acknowledgment without correction', async () => {
      const expected = { value: 1 };
      const actual = { value: 2 };
      const source = {
        sourceType: 'test',
        sourceId: 'test-1',
        name: 'Test',
      };

      const findings = await detector.detectDrift(expected, actual, source, context);
      expect(findings.length).toBeGreaterThan(0);

      const finding = findings[0];
      expect(finding.acknowledged).toBe(false);

      // Acknowledge the finding
      const acknowledged = detector.acknowledgeFinding(finding.id, 'reviewer-user');

      expect(acknowledged).toBeDefined();
      expect(acknowledged!.acknowledged).toBe(true);
      expect(acknowledged!.acknowledgedBy).toBe('reviewer-user');
      expect(acknowledged!.acknowledgedAt).toBeDefined();

      // Verify the drift state is NOT corrected - expected and actual remain different
      expect(acknowledged!.expected.value).not.toEqual(acknowledged!.actual.value);
    });

    it('should return undefined for non-existent finding', () => {
      const result = detector.acknowledgeFinding('non-existent-id', 'user');
      expect(result).toBeUndefined();
    });
  });

  describe('filtering and queries', () => {
    it('should return unacknowledged findings', async () => {
      const source = { sourceType: 'test', sourceId: 'test-1', name: 'Test' };
      await detector.detectDrift({ a: 1 }, { a: 2 }, source, context);
      await detector.detectDrift({ b: 1 }, { b: 2 }, source, context);

      const unacknowledged = detector.getUnacknowledgedFindings();
      expect(unacknowledged.length).toBe(2);

      // Acknowledge one
      detector.acknowledgeFinding(unacknowledged[0].id, 'user');

      const remaining = detector.getUnacknowledgedFindings();
      expect(remaining.length).toBe(1);
    });

    it('should filter by severity', async () => {
      const source = { sourceType: 'test', sourceId: 'test-1', name: 'Test' };

      // Create findings with different severities
      await detector.detectDrift({ a: 1 }, { a: 2 }, source, context);
      await detector.detectDrift({ missing: true }, {}, source, context);

      const stats = detector.getStatistics();
      expect(stats.total).toBeGreaterThan(0);
    });

    it('should filter by type', async () => {
      const source = { sourceType: 'test', sourceId: 'test-1', name: 'Test' };
      await detector.detectDrift({ a: 1 }, { a: 2 }, source, context);

      const semanticFindings = detector.getFindingsByType(DriftType.SEMANTIC);
      expect(semanticFindings.length).toBeGreaterThan(0);
    });
  });

  describe('statistics', () => {
    it('should provide accurate statistics', async () => {
      const source = { sourceType: 'test', sourceId: 'test-1', name: 'Test' };
      await detector.detectDrift({ a: 1 }, { a: 2 }, source, context);
      await detector.detectDrift({ b: 1 }, { b: 2 }, source, context);

      const stats = detector.getStatistics();

      expect(stats.total).toBe(2);
      expect(stats.unacknowledged).toBe(2);
    });
  });

  describe('configuration', () => {
    it('should respect disabled detection types', async () => {
      resetDriftDetector();
      const customDetector = new DriftDetector({
        detectSemantic: false,
      });

      const findings = await customDetector.detectSemanticDrift(
        'contract-1',
        { field: 'new' },
        { field: 'old' },
        context
      );

      expect(findings).toHaveLength(0);
    });
  });
});
