import type { AgenticsClient } from '../client';

/**
 * Workflow definition
 */
export interface Workflow {
  id: string;
  name: string;
  description: string;
  trigger: {
    type: 'manual' | 'schedule' | 'event' | 'webhook';
    config: Record<string, unknown>;
  };
  steps: Array<{
    id: string;
    type: string;
    name: string;
    config: Record<string, unknown>;
  }>;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Workflow creation parameters
 */
export interface CreateWorkflowParams {
  name: string;
  description: string;
  trigger: {
    type: 'manual' | 'schedule' | 'event' | 'webhook';
    config: Record<string, unknown>;
  };
  steps: Array<{
    type: string;
    name: string;
    config: Record<string, unknown>;
  }>;
  enabled?: boolean;
}

/**
 * Workflow run
 */
export interface WorkflowRun {
  id: string;
  workflowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: string;
  completedAt?: string;
  steps: Array<{
    id: string;
    name: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
    startedAt?: string;
    completedAt?: string;
    output?: unknown;
    error?: string;
  }>;
  output?: unknown;
  error?: string;
}

/**
 * Workflow status
 */
export interface WorkflowStatus {
  workflowId: string;
  enabled: boolean;
  lastRun?: {
    id: string;
    status: 'completed' | 'failed' | 'cancelled';
    startedAt: string;
    completedAt: string;
  };
  nextRun?: {
    scheduledAt: string;
  };
  statistics: {
    totalRuns: number;
    successfulRuns: number;
    failedRuns: number;
  };
}

/**
 * Workflows sub-resource
 */
export class Workflows {
  constructor(private client: AgenticsClient) {}

  /**
   * List all workflows
   */
  async list(): Promise<Workflow[]> {
    return this.client.request<Workflow[]>('GET', '/automation/workflows');
  }

  /**
   * Create a new workflow
   */
  async create(params: CreateWorkflowParams): Promise<Workflow> {
    return this.client.request<Workflow>('POST', '/automation/workflows', params);
  }

  /**
   * Trigger a workflow execution
   */
  async trigger(workflowId: string, input?: Record<string, unknown>): Promise<WorkflowRun> {
    return this.client.request<WorkflowRun>(
      'POST',
      `/automation/workflows/${workflowId}/trigger`,
      input || {}
    );
  }

  /**
   * Get workflow status
   */
  async status(workflowId: string): Promise<WorkflowStatus> {
    return this.client.request<WorkflowStatus>('GET', `/automation/workflows/${workflowId}/status`);
  }
}

/**
 * Automation resource
 */
export class Automation {
  public readonly workflows: Workflows;

  constructor(private client: AgenticsClient) {
    this.workflows = new Workflows(client);
  }
}
