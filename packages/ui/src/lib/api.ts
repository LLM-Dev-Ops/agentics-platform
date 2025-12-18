/**
 * API Client for Agentics Platform
 * Handles all HTTP requests to the backend API
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/v1';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface UserProfile {
  id: string;
  email: string;
  name?: string;
  subscription: {
    plan: string;
    status: string;
  };
}

export interface AuthResponse {
  token: string;
  user: UserProfile;
}

export interface ApiKey {
  id: string;
  name: string;
  key?: string; // Only present on creation
  scopes: string[];
  createdAt: string;
  lastUsedAt?: string;
  expiresAt?: string;
}

export interface CreateApiKeyRequest {
  name: string;
  scopes: string[];
  expiresAt?: string;
}

export interface UsageSummary {
  periodStart: string;
  periodEnd: string;
  requests: number;
  tokens: number;
  compute: number;
  quotas: {
    requests: number;
    tokens: number;
    compute: number;
  };
}

export interface UsageHistory {
  date: string;
  requests: number;
  tokens: number;
  compute: number;
}

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
    // Load token from localStorage if available
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('auth_token');
    }
  }

  setToken(token: string | null) {
    this.token = token;
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('auth_token', token);
      } else {
        localStorage.removeItem('auth_token');
      }
    }
  }

  getToken(): string | null {
    return this.token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (options.headers) {
      Object.assign(headers, options.headers);
    }

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        let errorData: any;
        try {
          errorData = await response.json();
        } catch {
          errorData = { message: response.statusText };
        }

        throw new ApiError(
          response.status,
          errorData.code || 'UNKNOWN_ERROR',
          errorData.message || 'An error occurred',
          errorData.details
        );
      }

      // Handle 204 No Content
      if (response.status === 204) {
        return {} as T;
      }

      return await response.json();
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        0,
        'NETWORK_ERROR',
        error instanceof Error ? error.message : 'Network error occurred'
      );
    }
  }

  // Authentication
  async authenticate(email: string, password: string): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/identity/authenticate', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(response.token);
    return response;
  }

  async authenticateOAuth(provider: string, code: string): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/identity/oauth/callback', {
      method: 'POST',
      body: JSON.stringify({ provider, code }),
    });
    this.setToken(response.token);
    return response;
  }

  async whoami(): Promise<UserProfile> {
    return this.request<UserProfile>('/identity/whoami');
  }

  async logout(): Promise<void> {
    this.setToken(null);
  }

  // API Keys
  async listApiKeys(): Promise<ApiKey[]> {
    return this.request<ApiKey[]>('/identity/api-keys');
  }

  async createApiKey(data: CreateApiKeyRequest): Promise<ApiKey> {
    return this.request<ApiKey>('/identity/api-keys', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async revokeApiKey(keyId: string): Promise<void> {
    return this.request<void>(`/identity/api-keys/${keyId}`, {
      method: 'DELETE',
    });
  }

  // Usage
  async getCurrentUsage(): Promise<UsageSummary> {
    return this.request<UsageSummary>('/usage/current');
  }

  async getUsageHistory(
    startDate: string,
    endDate: string,
    granularity: 'daily' | 'weekly' | 'monthly' = 'daily'
  ): Promise<UsageHistory[]> {
    const params = new URLSearchParams({
      start: startDate,
      end: endDate,
      granularity,
    });
    return this.request<UsageHistory[]>(`/usage/history?${params}`);
  }

  async exportUsageCSV(startDate: string, endDate: string): Promise<Blob> {
    const params = new URLSearchParams({
      start: startDate,
      end: endDate,
    });
    const url = `${this.baseUrl}/usage/export?${params}`;
    const headers: HeadersInit = {
      'Authorization': `Bearer ${this.token}`,
    };

    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new ApiError(response.status, 'EXPORT_ERROR', 'Failed to export usage data');
    }
    return response.blob();
  }

  // Account Settings
  async updatePassword(currentPassword: string, newPassword: string): Promise<void> {
    return this.request<void>('/identity/password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  async getBillingPortalUrl(): Promise<{ url: string }> {
    return this.request<{ url: string }>('/billing/portal');
  }

  async deleteAccount(password: string): Promise<void> {
    return this.request<void>('/identity/account', {
      method: 'DELETE',
      body: JSON.stringify({ password }),
    });
  }
}

// Export singleton instance
export const apiClient = new ApiClient();
