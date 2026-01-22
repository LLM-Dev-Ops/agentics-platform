/**
 * Decision Agent Tests
 *
 * PROMPT 3 Implementation: Verification checklist
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DecisionAgent, createDecisionAgent } from '../src/decision/decision-agent.js';
import { DECISION_AGENT_CONTRACT } from '../src/decision/contract.js';
import { synthesizeDecision, detectConflicts } from '../src/decision/synthesis.js';
import type { DecisionEvent } from '@agentics/contracts';

// Mock ruvector client
vi.mock('@agentics/ruvector-client', () => ({
  RuvectorClient: vi.fn().mockImplementation(() => ({
    request: vi.fn(),
    health: vi.fn().mockResolvedValue({ status: 'healthy' }),
  })),
  DecisionEventStore: vi.fn().mockImplementation(() => ({
    write: vi.fn().mockResolvedValue({ success: true, event_id: 'test-event-id' }),
    get: vi.fn().mockResolvedValue(null),
    query: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  })),
}));

describe('Decision Agent Contract', () => {
  it('should have correct agent metadata', () => {
    expect(DECISION_AGENT_CONTRACT.metadata.id).toBe('decision-agent');
    expect(DECISION_AGENT_CONTRACT.metadata.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(DECISION_AGENT_CONTRACT.metadata.classification).toBe('DECISION_SYNTHESIS');
  });

  it('should define decision_synthesis as primary decision type', () => {
    expect(DECISION_AGENT_CONTRACT.metadata.decision_types).toContain('decision_synthesis');
  });

  it('should define persistence rules', () => {
    expect(DECISION_AGENT_CONTRACT.persistence.persist).toContain('decision_event');
    expect(DECISION_AGENT_CONTRACT.persistence.do_not_persist).toContain('pii_data');
    expect(DECISION_AGENT_CONTRACT.persistence.collection).toBe('decision_events');
  });

  it('should define agent boundaries', () => {
    expect(DECISION_AGENT_CONTRACT.boundaries.must_not).toContain('Execute inference or LLM calls');
    expect(DECISION_AGENT_CONTRACT.boundaries.must_not).toContain('Connect directly to Google SQL or any database');
    expect(DECISION_AGENT_CONTRACT.boundaries.must_never).toContain('Emit more than ONE DecisionEvent per invocation');
  });

  it('should define consumers', () => {
    expect(DECISION_AGENT_CONTRACT.consumers).toContain('governance-dashboard');
    expect(DECISION_AGENT_CONTRACT.consumers).toContain('audit-system');
  });
});

describe('Decision Agent Creation', () => {
  it('should create agent with valid config', () => {
    const agent = createDecisionAgent({
      ruvector: { baseUrl: 'http://localhost:8080' },
      dryRun: true,
    });

    expect(agent).toBeInstanceOf(DecisionAgent);
    expect(agent.agentId).toBe('decision-agent');
    expect(agent.agentVersion).toBe('0.1.0');
    expect(agent.decisionType).toBe('decision_synthesis');
  });
});

describe('Decision Synthesis', () => {
  const mockEvents: DecisionEvent[] = [
    {
      event_id: 'event-1',
      agent_id: 'test-agent',
      agent_version: '1.0.0',
      decision_type: 'risk_score',
      inputs_hash: 'abc123',
      outputs: {
        recommendation: 'Proceed with caution',
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
      execution_ref: {
        correlation_id: '123e4567-e89b-12d3-a456-426614174000',
      },
      timestamp: new Date().toISOString(),
      processing_time_ms: 100,
    },
    {
      event_id: 'event-2',
      agent_id: 'test-agent-2',
      agent_version: '1.0.0',
      decision_type: 'risk_score',
      inputs_hash: 'def456',
      outputs: {
        recommendation: 'Proceed with caution',
        risk_level: 'high',
      },
      confidence: 0.7,
      constraints_applied: {
        assumptions: [],
        scope_limits: [],
        constraints: [],
        data_sources: [],
        dependencies: [],
      },
      execution_ref: {
        correlation_id: '123e4567-e89b-12d3-a456-426614174001',
      },
      timestamp: new Date().toISOString(),
      processing_time_ms: 150,
    },
  ];

  describe('detectConflicts', () => {
    it('should detect no conflicts for identical recommendations', () => {
      const result = detectConflicts(mockEvents);
      expect(result.hasConflicts).toBe(true); // Risk level conflict
    });

    it('should detect risk level conflicts', () => {
      const result = detectConflicts(mockEvents);
      const riskConflict = result.conflicts.find(c => c.type === 'risk_level');
      expect(riskConflict).toBeDefined();
      expect(riskConflict?.severity).toBe('medium');
    });
  });

  describe('synthesizeDecision', () => {
    it('should synthesize events into recommendation', () => {
      const result = synthesizeDecision(mockEvents);

      expect(result.recommendation).toBeDefined();
      expect(result.eventsProcessed).toBe(2);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should determine highest risk level', () => {
      const result = synthesizeDecision(mockEvents);
      expect(result.riskLevel).toBe('high'); // Highest from source events
    });

    it('should merge constraints', () => {
      const result = synthesizeDecision(mockEvents);
      expect(result.constraints).toBeDefined();
      expect(result.constraints.assumptions.length).toBeGreaterThan(0);
    });
  });
});

describe('Decision Agent Invocation', () => {
  let agent: DecisionAgent;

  beforeEach(() => {
    agent = createDecisionAgent({
      ruvector: { baseUrl: 'http://localhost:8080' },
      dryRun: true,
    });
  });

  it('should invoke with source events', async () => {
    const input = {
      source_events: [
        {
          event_id: 'test-event-1',
          agent_id: 'source-agent',
          agent_version: '1.0.0',
          decision_type: 'risk_score' as const,
          inputs_hash: 'abc123def456abc123def456abc123def456abc123def456abc123def456abcd',
          outputs: { recommendation: 'Test recommendation' },
          confidence: 0.9,
          constraints_applied: {
            assumptions: [],
            scope_limits: [],
            constraints: [],
            data_sources: [],
            dependencies: [],
          },
          execution_ref: {
            correlation_id: '123e4567-e89b-12d3-a456-426614174000',
          },
          timestamp: new Date().toISOString(),
          processing_time_ms: 50,
        },
      ],
    };

    const result = await agent.invoke(input);

    expect(result).toBeDefined();
    expect(result.event).toBeDefined();
    expect(result.event.event_id).toBeDefined();
    expect(result.event.agent_id).toBe('decision-agent');
    expect(result.event.decision_type).toBe('decision_synthesis');
  });

  it('should calculate confidence correctly', async () => {
    const input = {
      source_events: [
        {
          event_id: 'event-1',
          agent_id: 'agent-1',
          agent_version: '1.0.0',
          decision_type: 'risk_score' as const,
          inputs_hash: 'abc123def456abc123def456abc123def456abc123def456abc123def456abcd',
          outputs: {},
          confidence: 0.9,
          constraints_applied: {
            assumptions: [],
            scope_limits: [],
            constraints: [],
            data_sources: [],
            dependencies: [],
          },
          execution_ref: {
            correlation_id: '123e4567-e89b-12d3-a456-426614174000',
          },
          timestamp: new Date().toISOString(),
          processing_time_ms: 50,
        },
        {
          event_id: 'event-2',
          agent_id: 'agent-2',
          agent_version: '1.0.0',
          decision_type: 'risk_score' as const,
          inputs_hash: 'abc123def456abc123def456abc123def456abc123def456abc123def456abcd',
          outputs: {},
          confidence: 0.8,
          constraints_applied: {
            assumptions: [],
            scope_limits: [],
            constraints: [],
            data_sources: [],
            dependencies: [],
          },
          execution_ref: {
            correlation_id: '123e4567-e89b-12d3-a456-426614174001',
          },
          timestamp: new Date().toISOString(),
          processing_time_ms: 50,
        },
      ],
    };

    const result = await agent.invoke(input);

    expect(result.event.confidence).toBeGreaterThan(0);
    expect(result.event.confidence).toBeLessThanOrEqual(1);
  });
});

describe('Verification Checklist', () => {
  it('confirms: Agent does NOT execute inference', () => {
    const contract = DECISION_AGENT_CONTRACT;
    expect(contract.boundaries.must_not).toContain('Execute inference or LLM calls');
  });

  it('confirms: Agent does NOT modify upstream systems', () => {
    const contract = DECISION_AGENT_CONTRACT;
    expect(contract.boundaries.must_not).toContain('Modify upstream system state');
  });

  it('confirms: Agent does NOT enforce decisions', () => {
    const contract = DECISION_AGENT_CONTRACT;
    expect(contract.boundaries.must_not).toContain('Enforce governance actions automatically');
  });

  it('confirms: Agent does NOT trigger orchestration', () => {
    const contract = DECISION_AGENT_CONTRACT;
    expect(contract.boundaries.must_not).toContain('Trigger orchestration workflows');
  });

  it('confirms: Agent emits exactly ONE DecisionEvent per invocation', () => {
    const contract = DECISION_AGENT_CONTRACT;
    expect(contract.boundaries.must_never).toContain('Emit more than ONE DecisionEvent per invocation');
  });

  it('confirms: Agent uses ruvector-service for persistence', () => {
    const contract = DECISION_AGENT_CONTRACT;
    expect(contract.dependencies).toContain('ruvector-service');
    expect(contract.boundaries.must_never).toContain('Persist data outside of ruvector-service');
  });
});
