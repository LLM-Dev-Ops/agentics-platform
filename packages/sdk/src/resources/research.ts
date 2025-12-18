import type { AgenticsClient } from '../client';

/**
 * Experiment creation parameters
 */
export interface CreateExperimentParams {
  name: string;
  description: string;
  hypothesis: string;
  configuration: {
    baseline: {
      model: string;
      parameters: Record<string, unknown>;
    };
    variants: Array<{
      name: string;
      model: string;
      parameters: Record<string, unknown>;
    }>;
    testCases: Array<{
      id: string;
      input: unknown;
      expectedOutput?: unknown;
    }>;
    metrics: string[];
  };
  tags?: string[];
}

/**
 * Experiment
 */
export interface Experiment {
  id: string;
  name: string;
  description: string;
  hypothesis: string;
  status: 'draft' | 'running' | 'completed' | 'failed' | 'cancelled';
  configuration: {
    baseline: {
      model: string;
      parameters: Record<string, unknown>;
    };
    variants: Array<{
      name: string;
      model: string;
      parameters: Record<string, unknown>;
    }>;
    testCases: Array<{
      id: string;
      input: unknown;
      expectedOutput?: unknown;
    }>;
    metrics: string[];
  };
  progress?: {
    completed: number;
    total: number;
    percentage: number;
  };
  tags: string[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

/**
 * Experiment results
 */
export interface Results {
  experimentId: string;
  baseline: {
    name: string;
    metrics: Record<string, number>;
    samples: Array<{
      testCaseId: string;
      output: unknown;
      metrics: Record<string, number>;
      duration: number;
    }>;
  };
  variants: Array<{
    name: string;
    metrics: Record<string, number>;
    samples: Array<{
      testCaseId: string;
      output: unknown;
      metrics: Record<string, number>;
      duration: number;
    }>;
    comparison: {
      baselineDelta: Record<string, number>;
      statisticalSignificance: Record<string, boolean>;
    };
  }>;
  summary: {
    bestVariant: string;
    conclusions: string[];
    recommendations: string[];
  };
  generatedAt: string;
}

/**
 * Experiments sub-resource
 */
export class Experiments {
  constructor(private client: AgenticsClient) {}

  /**
   * Create a new experiment
   */
  async create(params: CreateExperimentParams): Promise<Experiment> {
    return this.client.request<Experiment>('POST', '/research/experiments', params);
  }

  /**
   * Get experiment details
   */
  async get(experimentId: string): Promise<Experiment> {
    return this.client.request<Experiment>('GET', `/research/experiments/${experimentId}`);
  }
}

/**
 * Research resource
 */
export class Research {
  public readonly experiments: Experiments;

  constructor(private client: AgenticsClient) {
    this.experiments = new Experiments(client);
  }

  /**
   * Get experiment results
   */
  async results(experimentId: string): Promise<Results> {
    return this.client.request<Results>('GET', `/research/experiments/${experimentId}/results`);
  }
}
