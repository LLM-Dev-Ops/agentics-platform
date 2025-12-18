import type { AgenticsClient } from '../client';

/**
 * Validation parameters
 */
export interface ValidateParams {
  target: {
    type: 'workflow' | 'agent' | 'model' | 'data';
    id?: string;
    config?: Record<string, unknown>;
  };
  policies?: string[];
  strict?: boolean;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  violations: Array<{
    policyId: string;
    policyName: string;
    severity: 'error' | 'warning' | 'info';
    rule: string;
    message: string;
    path?: string;
  }>;
  warnings: Array<{
    message: string;
    path?: string;
  }>;
  score: number;
  validatedAt: string;
}

/**
 * Governance policy
 */
export interface GovernancePolicy {
  id: string;
  name: string;
  description: string;
  version: string;
  scope: string[];
  rules: Array<{
    id: string;
    name: string;
    description: string;
    condition: string;
    severity: 'error' | 'warning' | 'info';
    enabled: boolean;
  }>;
  enforcement: 'strict' | 'advisory';
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Governance resource
 */
export class Governance {
  constructor(private client: AgenticsClient) {}

  /**
   * Validate against governance policies
   */
  async validate(params: ValidateParams): Promise<ValidationResult> {
    return this.client.request<ValidationResult>('POST', '/governance/validate', params);
  }

  /**
   * List governance policies
   */
  async policies(): Promise<GovernancePolicy[]> {
    return this.client.request<GovernancePolicy[]>('GET', '/governance/policies');
  }
}
