/**
 * Decision Memo Agent Tests
 */

import { describe, it, expect, vi } from 'vitest';
import {
  calculateConfidence,
  confidenceToRiskLevel,
  generateDecisionMemo,
  AGENT_ID,
  AGENT_VERSION,
  DECISION_TYPE,
  DECISION_MEMO_CONTRACT,
} from '../src/decision-memo/index.js';
import type { DecisionEvent } from '@agentics/contracts';

describe('Decision Memo Agent', () => {
  describe('Agent Metadata', () => {
    it('should have correct agent ID', () => {
      expect(AGENT_ID).toBe('decision-memo-agent');
    });

    it('should have correct version format', () => {
      expect(AGENT_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it('should have correct decision type', () => {
      expect(DECISION_TYPE).toBe('governance_memo');
    });

    it('should have valid contract', () => {
      expect(DECISION_MEMO_CONTRACT.metadata.id).toBe(AGENT_ID);
      expect(DECISION_MEMO_CONTRACT.metadata.classification).toBe('EXECUTIVE_REPORTING');
      expect(DECISION_MEMO_CONTRACT.invocation_modes).toContain('cli');
      expect(DECISION_MEMO_CONTRACT.invocation_modes).toContain('cloud_run');
    });

    it('should have correct boundaries defined', () => {
      expect(DECISION_MEMO_CONTRACT.boundaries.must_not).toContain('Execute inference or LLM calls');
      expect(DECISION_MEMO_CONTRACT.boundaries.must_not).toContain('Connect directly to Google SQL');
      expect(DECISION_MEMO_CONTRACT.boundaries.must_never).toContain('Execute workflows');
    });
  });

  describe('Confidence Calculation', () => {
    const mockMemo = {
      memo_id: '123',
      title: 'Test Memo',
      executive_summary: 'Test summary',
      sections: [
        {
          title: 'Test Section',
          content: 'Test content',
          evidence: [
            { source_event_id: 'e1', excerpt: 'excerpt', relevance: 0.8 },
          ],
        },
      ],
      recommendations: [
        { id: 'r1', action: 'action', rationale: 'rationale', priority: 'high' as const },
      ],
      risk_summary: {
        overall_level: 'medium' as const,
        key_risks: [],
        mitigations: [],
      },
      metadata: {
        generated_at: new Date().toISOString(),
        source_event_count: 1,
      },
    };

    const mockEvents: DecisionEvent[] = [
      {
        event_id: 'e1',
        agent_id: 'test-agent',
        agent_version: '1.0.0',
        decision_type: 'risk_score',
        inputs_hash: 'abc123',
        outputs: {
          summary: 'Test action summary',
          recommendation: 'Test action',
          risk_level: 'medium',
        },
        confidence: 0.8,
        constraints_applied: {
          assumptions: [],
          scope_limits: [],
          constraints: [],
          data_sources: [],
          dependencies: [],
        },
        execution_ref: { correlation_id: 'c1' },
        timestamp: new Date().toISOString(),
        processing_time_ms: 100,
      },
    ];

    it('should calculate confidence with all components', () => {
      const result = calculateConfidence({
        sourceEvents: mockEvents,
        processedCount: 1,
        filteredCount: 0,
        totalCount: 1,
        memo: mockMemo,
      });

      expect(result.overall).toBeGreaterThan(0);
      expect(result.overall).toBeLessThanOrEqual(1);
      expect(result.components).toHaveProperty('coverage');
      expect(result.components).toHaveProperty('source_quality');
      expect(result.components).toHaveProperty('evidence_strength');
      expect(result.components).toHaveProperty('recommendation_support');
      expect(result.components).toHaveProperty('recency');
      expect(result.explanation).toBeDefined();
    });

    it('should handle empty source events', () => {
      const result = calculateConfidence({
        sourceEvents: [],
        processedCount: 0,
        filteredCount: 0,
        totalCount: 0,
        memo: mockMemo,
      });

      expect(result.overall).toBe(0.1); // 0.5 * 0.20 for evidence = 0.1
    });
  });

  describe('Confidence to Risk Level', () => {
    it('should return low for high confidence', () => {
      expect(confidenceToRiskLevel(0.9)).toBe('low');
      expect(confidenceToRiskLevel(0.8)).toBe('low');
    });

    it('should return medium for moderate confidence', () => {
      expect(confidenceToRiskLevel(0.7)).toBe('medium');
      expect(confidenceToRiskLevel(0.6)).toBe('medium');
    });

    it('should return high for low confidence', () => {
      expect(confidenceToRiskLevel(0.5)).toBe('high');
      expect(confidenceToRiskLevel(0.4)).toBe('high');
    });

    it('should return critical for very low confidence', () => {
      expect(confidenceToRiskLevel(0.3)).toBe('critical');
      expect(confidenceToRiskLevel(0.1)).toBe('critical');
    });
  });

  describe('Memo Generation', () => {
    const mockEvents: DecisionEvent[] = [
      {
        event_id: 'e1',
        agent_id: 'test-agent',
        agent_version: '1.0.0',
        decision_type: 'risk_score',
        inputs_hash: 'abc123',
        outputs: {
          summary: 'High risk detected in authentication module',
          recommendation: 'Implement MFA immediately',
          risk_level: 'high',
        },
        confidence: 0.85,
        constraints_applied: {
          assumptions: [],
          scope_limits: [],
          constraints: [{ type: 'scope_limit', description: 'Limited to auth', impact: 'low', mitigation: 'Extend scope' }],
          data_sources: [],
          dependencies: [],
        },
        execution_ref: { correlation_id: 'c1' },
        timestamp: new Date().toISOString(),
        processing_time_ms: 100,
      },
      {
        event_id: 'e2',
        agent_id: 'test-agent',
        agent_version: '1.0.0',
        decision_type: 'compliance_check',
        inputs_hash: 'def456',
        outputs: {
          summary: 'Compliance gaps found in data handling',
          recommendation: 'Update data retention policy',
          risk_level: 'medium',
        },
        confidence: 0.75,
        constraints_applied: {
          assumptions: [],
          scope_limits: [],
          constraints: [],
          data_sources: [],
          dependencies: [],
        },
        execution_ref: { correlation_id: 'c2' },
        timestamp: new Date().toISOString(),
        processing_time_ms: 150,
      },
    ];

    it('should generate memo from source events', async () => {
      const result = await generateDecisionMemo(mockEvents, {
        title: 'Security Assessment',
        governance_category: 'security',
      });

      expect(result.memo).toBeDefined();
      expect(result.memo.title).toBe('Security Assessment');
      expect(result.memo.executive_summary).toBeDefined();
      expect(result.memo.sections.length).toBeGreaterThan(0);
      expect(result.memo.recommendations.length).toBeGreaterThan(0);
      expect(result.confidence).toBeDefined();
      expect(result.sourceReferences).toHaveLength(2);
      expect(result.stages).toBeDefined();
    });

    it('should filter events below confidence threshold', async () => {
      const result = await generateDecisionMemo(mockEvents, {
        min_confidence_threshold: 0.8,
      });

      // Only e1 with confidence 0.85 should pass
      expect(result.memo.metadata.source_event_count).toBe(1);
    });

    it('should limit recommendations', async () => {
      const result = await generateDecisionMemo(mockEvents, {
        max_recommendations: 1,
      });

      expect(result.memo.recommendations.length).toBeLessThanOrEqual(1);
    });

    it('should include evidence when requested', async () => {
      const result = await generateDecisionMemo(mockEvents, {
        include_evidence: true,
      });

      const hasEvidence = result.memo.sections.some(s => s.evidence && s.evidence.length > 0);
      expect(hasEvidence).toBe(true);
    });

    it('should exclude evidence when disabled', async () => {
      const result = await generateDecisionMemo(mockEvents, {
        include_evidence: false,
      });

      const hasEvidence = result.memo.sections.some(s => s.evidence && s.evidence.length > 0);
      expect(hasEvidence).toBe(false);
    });

    it('should handle empty source events', async () => {
      const result = await generateDecisionMemo([], {});

      expect(result.memo.metadata.source_event_count).toBe(0);
      expect(result.memo.sections).toHaveLength(0);
      expect(result.confidence.overall).toBeLessThan(0.5);
    });

    it('should track processing stages', async () => {
      const result = await generateDecisionMemo(mockEvents, {});

      expect(result.stages.length).toBeGreaterThan(0);
      expect(result.stages[0]).toHaveProperty('stage');
      expect(result.stages[0]).toHaveProperty('duration_ms');
      expect(result.stages[0]).toHaveProperty('items_processed');
    });
  });

  describe('Contract Boundaries', () => {
    it('should define what agent must not do', () => {
      const mustNot = DECISION_MEMO_CONTRACT.boundaries.must_not;

      expect(mustNot).toContain('Execute inference or LLM calls');
      expect(mustNot).toContain('Modify prompts or responses');
      expect(mustNot).toContain('Route requests to other services');
      expect(mustNot).toContain('Trigger orchestration workflows');
      expect(mustNot).toContain('Apply optimizations to systems');
      expect(mustNot).toContain('Enforce governance actions automatically');
      expect(mustNot).toContain('Connect directly to Google SQL');
      expect(mustNot).toContain('Execute SQL queries');
    });

    it('should define what agent must never do', () => {
      const mustNever = DECISION_MEMO_CONTRACT.boundaries.must_never;

      expect(mustNever).toContain('Intercept runtime traffic');
      expect(mustNever).toContain('Execute workflows');
      expect(mustNever).toContain('Route inference');
      expect(mustNever).toContain('Enforce policies automatically');
      expect(mustNever).toContain('Optimize live configurations');
      expect(mustNever).toContain('Invoke other agents directly');
    });
  });

  describe('Persistence Rules', () => {
    it('should define what to persist', () => {
      expect(DECISION_MEMO_CONTRACT.persistence.persist).toContain('decision_event');
      expect(DECISION_MEMO_CONTRACT.persistence.persist).toContain('summary');
      expect(DECISION_MEMO_CONTRACT.persistence.persist).toContain('recommendation');
    });

    it('should define what not to persist', () => {
      expect(DECISION_MEMO_CONTRACT.persistence.do_not_persist).toContain('raw_source_event_content');
      expect(DECISION_MEMO_CONTRACT.persistence.do_not_persist).toContain('intermediate_processing_state');
      expect(DECISION_MEMO_CONTRACT.persistence.do_not_persist).toContain('telemetry_events');
    });

    it('should specify persistence collection', () => {
      expect(DECISION_MEMO_CONTRACT.persistence.collection).toBe('decision_memos');
    });

    it('should specify retention period', () => {
      expect(DECISION_MEMO_CONTRACT.persistence.retention_days).toBe(365);
    });
  });

  describe('Consumer Systems', () => {
    it('should define authorized consumers', () => {
      const consumers = DECISION_MEMO_CONTRACT.consumers;

      expect(consumers).toContain('governance-dashboard');
      expect(consumers).toContain('audit-system');
      expect(consumers).toContain('executive-reporting-service');
      expect(consumers).toContain('compliance-tracker');
      expect(consumers).toContain('decision-archive');
    });
  });

  describe('Dependencies', () => {
    it('should depend on ruvector-service', () => {
      expect(DECISION_MEMO_CONTRACT.dependencies).toContain('ruvector-service');
    });
  });
});
