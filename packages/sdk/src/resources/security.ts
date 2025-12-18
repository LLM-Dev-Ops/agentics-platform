import type { AgenticsClient } from '../client';

/**
 * Security scan parameters
 */
export interface ScanParams {
  target: {
    type: 'code' | 'prompt' | 'output' | 'workflow';
    content: string;
    metadata?: Record<string, unknown>;
  };
  checks?: string[];
}

/**
 * Security scan result
 */
export interface ScanResult {
  id: string;
  status: 'safe' | 'warning' | 'danger';
  findings: Array<{
    severity: 'low' | 'medium' | 'high' | 'critical';
    category: string;
    description: string;
    location?: {
      line?: number;
      column?: number;
      snippet?: string;
    };
    recommendation: string;
  }>;
  score: number;
  scannedAt: string;
}

/**
 * Threat information
 */
export interface Threat {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  indicators: string[];
  mitigations: string[];
  detectedAt: string;
  status: 'active' | 'mitigated' | 'resolved';
}

/**
 * Security policy
 */
export interface Policy {
  id: string;
  name: string;
  description: string;
  rules: Array<{
    id: string;
    condition: string;
    action: 'allow' | 'warn' | 'block';
  }>;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Security resource
 */
export class Security {
  constructor(private client: AgenticsClient) {}

  /**
   * Scan content for security issues
   */
  async scan(params: ScanParams): Promise<ScanResult> {
    return this.client.request<ScanResult>('POST', '/security/scan', params);
  }

  /**
   * List detected threats
   */
  async threats(): Promise<Threat[]> {
    return this.client.request<Threat[]>('GET', '/security/threats');
  }

  /**
   * List security policies
   */
  async policies(): Promise<Policy[]> {
    return this.client.request<Policy[]>('GET', '/security/policies');
  }
}
