import type { AgenticsClient } from '../client';

/**
 * Authentication credentials
 */
export interface AuthCredentials {
  email: string;
  password: string;
}

/**
 * Authentication result
 */
export interface AuthResult {
  token: string;
  expiresAt: string;
  user: Identity;
}

/**
 * User identity
 */
export interface Identity {
  id: string;
  email: string;
  name: string;
  organizationId: string;
  roles: string[];
  createdAt: string;
}

/**
 * API key
 */
export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  expiresAt?: string;
  lastUsedAt?: string;
}

/**
 * API key creation parameters
 */
export interface CreateApiKeyParams {
  name: string;
  expiresAt?: string;
}

/**
 * API keys resource
 */
export class ApiKeys {
  constructor(private client: AgenticsClient) {}

  /**
   * List all API keys
   */
  async list(): Promise<ApiKey[]> {
    return this.client.request<ApiKey[]>('GET', '/identity/api-keys');
  }

  /**
   * Create a new API key
   */
  async create(params: CreateApiKeyParams): Promise<ApiKey> {
    return this.client.request<ApiKey>('POST', '/identity/api-keys', params);
  }

  /**
   * Revoke an API key
   */
  async revoke(keyId: string): Promise<void> {
    await this.client.request<void>('DELETE', `/identity/api-keys/${keyId}`);
  }
}

/**
 * Identity resource
 */
export class Identity {
  public readonly apiKeys: ApiKeys;

  constructor(private client: AgenticsClient) {
    this.apiKeys = new ApiKeys(client);
  }

  /**
   * Authenticate with credentials
   */
  async authenticate(credentials: AuthCredentials): Promise<AuthResult> {
    return this.client.request<AuthResult>('POST', '/identity/authenticate', credentials);
  }

  /**
   * Get current authenticated identity
   */
  async whoami(): Promise<Identity> {
    return this.client.request<Identity>('GET', '/identity/whoami');
  }
}
