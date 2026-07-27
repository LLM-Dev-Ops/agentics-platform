import type { AgenticsClient } from '../client';

/**
 * Simulation parameters
 */
export interface SimulateParams {
  model: string;
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  tools?: Array<{
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  }>;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
}

/**
 * Simulation result
 */
export interface SimulationResult {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  result?: {
    message: {
      role: 'assistant';
      content: string;
    };
    toolCalls?: Array<{
      id: string;
      name: string;
      arguments: Record<string, unknown>;
    }>;
    usage: {
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
    };
  };
  error?: string;
  createdAt: string;
  completedAt?: string;
}

/**
 * Simulation status
 */
export interface SimulationStatus {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress?: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Simulation event for streaming
 */
export interface SimulationEvent {
  type: 'start' | 'content' | 'tool_call' | 'complete' | 'error';
  data: unknown;
}

/**
 * Simulate resource
 */
export class Simulate {
  constructor(private client: AgenticsClient) {}

  /**
   * Run a simulation
   */
  async execute(params: SimulateParams): Promise<SimulationResult> {
    return this.client.request<SimulationResult>('POST', '/simulate', params);
  }

  /**
   * Get simulation status
   */
  async get(simulationId: string): Promise<SimulationStatus> {
    return this.client.request<SimulationStatus>('GET', `/simulate/${simulationId}`);
  }

  /**
   * Stream a simulation
   */
  async *stream(params: SimulateParams): AsyncIterable<SimulationEvent> {
    const stream = this.client.stream<SimulationEvent>('POST', '/simulate/stream', params);
    yield* stream;
  }
}
