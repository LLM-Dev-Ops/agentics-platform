/**
 * API Client with Supabase JWT Authentication
 *
 * Centralizes all API calls and automatically attaches the Supabase JWT
 * to every request. This client is used by the UI only.
 *
 * Security:
 * - UI NEVER sends API keys
 * - UI ONLY sends Supabase JWT
 * - Backend continues to accept both Supabase JWT (for humans) and API keys (for machines)
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * Get the current Supabase session access token
 * Returns null if no session exists
 */
async function getAccessToken(): Promise<string | null> {
  try {
    const { getSupabase } = await import('./supabase');
    const supabase = getSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  } catch (error) {
    console.error('[api-client] Failed to get Supabase session:', error);
    return null;
  }
}

/**
 * API Error class for structured error handling
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Make an authenticated API request
 * Automatically attaches the Supabase JWT to the Authorization header
 *
 * @throws ApiError if the request fails
 * @throws Error if no session exists (caller should redirect to login)
 */
async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    throw new Error('No active session');
  }

  const url = `${API_BASE_URL}${endpoint}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`,
  };

  const response = await fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers as Record<string, string> || {}),
    },
  });

  if (!response.ok) {
    let errorData: { error?: string; code?: string; message?: string } = {};
    try {
      errorData = await response.json();
    } catch {
      errorData = { error: response.statusText };
    }

    throw new ApiError(
      response.status,
      errorData.code || 'API_ERROR',
      errorData.error || errorData.message || 'An error occurred'
    );
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

// ============================================================================
// API Types
// ============================================================================

export interface OrgInfo {
  user_id: string;
  org_id: string;
  email?: string;
}

export interface ApiKey {
  id: string;
  name: string;
  scopes: string[];
  is_active: boolean;
  created_at: string;
  last_used_at?: string;
  revoked_at?: string;
}

export interface CreateKeyResponse {
  api_key: string; // Plaintext key - shown once
  id: string;
  name: string;
  scopes: string[];
  created_at: string;
}

// ============================================================================
// Usage Types - Consumed from agentics-usage-ledger
// ============================================================================

export interface UsagePeriod {
  type: 'current-month' | 'last-7-days' | 'last-30-days';
  start: string;
  end: string;
}

export interface UsageQuota {
  used: number;
  limit: number | null;
  remaining: number | null;
  percentUsed: number | null;
}

export interface UsageSummary {
  userId: string;
  tier: string;
  period: UsagePeriod;
  usage: {
    requests: {
      total: number;
      byEndpoint: Record<string, number>;
    };
    tokens: {
      total: number;
      byEndpoint: Record<string, number>;
    };
  };
  quota: {
    requests: UsageQuota;
    tokens: UsageQuota;
  };
}

export interface UsageDataPoint {
  timestamp: string;
  requests: number;
  tokens: number;
  endpointBreakdown: Record<string, { requests: number; tokens: number }>;
}

export interface UsageHistory {
  userId: string;
  granularity: 'hourly' | 'daily' | 'monthly';
  period: {
    start: string;
    end: string;
  };
  dataPoints: UsageDataPoint[];
  summary: {
    totalRequests: number;
    totalTokens: number;
    dataPointCount: number;
  };
}

export interface UsageCurrentResponse {
  success: boolean;
  data: UsageSummary;
}

export interface UsageHistoryResponse {
  success: boolean;
  data: UsageHistory;
}

export interface ListKeysResponse {
  keys: ApiKey[];
}

// ============================================================================
// Usage Proxy Types - From agentics-usage-ledger via proxy
// ============================================================================

export interface UsageProxySummary {
  org_id: string;
  period: {
    start_date: string;
    end_date: string;
  };
  totals: {
    executions: number;
    cost_usd: number;
    failures: number;
    tokens_used: number;
  };
  failure_rate: number;
}

export interface CommandUsageItem {
  command: string;
  executions: number;
  cost_usd: number;
  failures: number;
  avg_duration_ms: number;
}

export interface DailyUsageItem {
  date: string;
  executions: number;
  cost_usd: number;
  failures: number;
  tokens_used: number;
}

export interface UserUsageItem {
  principal: string;
  executions: number;
  cost_usd: number;
  failures: number;
}

// ============================================================================
// API Methods
// ============================================================================

/**
 * GET /v1/me
 * Get current user and organization info
 */
export async function getMe(): Promise<OrgInfo> {
  return request<OrgInfo>('/v1/me');
}

/**
 * GET /v1/keys
 * List all API keys for the current organization
 */
export async function listKeys(): Promise<ApiKey[]> {
  const response = await request<ListKeysResponse>('/v1/keys');
  return response.keys || [];
}

/**
 * POST /v1/keys
 * Create a new API key
 */
export async function createKey(name: string, scopes: string[]): Promise<CreateKeyResponse> {
  return request<CreateKeyResponse>('/v1/keys', {
    method: 'POST',
    body: JSON.stringify({ name, scopes }),
  });
}

/**
 * DELETE /v1/keys/:id
 * Revoke an API key
 */
export async function revokeKey(keyId: string): Promise<void> {
  await request<{ success: boolean; message: string }>(`/v1/keys/${keyId}`, {
    method: 'DELETE',
  });
}

// ============================================================================
// Usage API Methods - Data from agentics-usage-ledger
// ============================================================================

/**
 * GET /v1/usage/current
 * Get current usage summary for the authenticated user
 * Org scoping handled server-side via IAM
 */
export async function getUsageCurrent(
  period: 'current-month' | 'last-7-days' | 'last-30-days' = 'current-month'
): Promise<UsageSummary> {
  const response = await request<UsageCurrentResponse>(
    `/v1/usage/current?period=${period}`
  );
  return response.data;
}

/**
 * GET /v1/usage/history
 * Get historical usage data with specified granularity
 * Org scoping handled server-side via IAM
 */
export async function getUsageHistory(
  start: string,
  end: string,
  granularity: 'hourly' | 'daily' | 'monthly' = 'daily'
): Promise<UsageHistory> {
  const params = new URLSearchParams({ start, end, granularity });
  const response = await request<UsageHistoryResponse>(
    `/v1/usage/history?${params}`
  );
  return response.data;
}

// ============================================================================
// Usage Proxy API Methods - Data proxied from agentics-usage-ledger
// ============================================================================

export type TimeRange = '7' | '30' | '90';

function getDateRange(days: TimeRange): { start_date: string; end_date: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - parseInt(days));
  return {
    start_date: start.toISOString().split('T')[0],
    end_date: end.toISOString().split('T')[0],
  };
}

/**
 * GET /v1/api/usage/summary
 * Get aggregated usage summary from usage ledger
 */
export async function getUsageSummary(days: TimeRange = '30'): Promise<UsageProxySummary> {
  const { start_date, end_date } = getDateRange(days);
  return request<UsageProxySummary>(
    `/v1/api/usage/summary?start_date=${start_date}&end_date=${end_date}`
  );
}

/**
 * GET /v1/api/usage/by-command
 * Get usage breakdown by command from usage ledger
 */
export async function getUsageByCommand(days: TimeRange = '30'): Promise<CommandUsageItem[]> {
  const { start_date, end_date } = getDateRange(days);
  const response = await request<{ data: CommandUsageItem[] }>(
    `/v1/api/usage/by-command?start_date=${start_date}&end_date=${end_date}`
  );
  return response.data || [];
}

/**
 * GET /v1/api/usage/by-day
 * Get daily usage breakdown from usage ledger
 */
export async function getUsageByDay(days: TimeRange = '30'): Promise<DailyUsageItem[]> {
  const { start_date, end_date } = getDateRange(days);
  const response = await request<{ data: DailyUsageItem[] }>(
    `/v1/api/usage/by-day?start_date=${start_date}&end_date=${end_date}`
  );
  return response.data || [];
}

/**
 * GET /v1/api/usage/by-user
 * Get usage breakdown by user from usage ledger
 */
export async function getUsageByUser(days: TimeRange = '30'): Promise<UserUsageItem[]> {
  const { start_date, end_date } = getDateRange(days);
  const response = await request<{ data: UserUsageItem[] }>(
    `/v1/api/usage/by-user?start_date=${start_date}&end_date=${end_date}`
  );
  return response.data || [];
}

// Export for convenience
export const apiClient = {
  getMe,
  listKeys,
  createKey,
  revokeKey,
  getUsageCurrent,
  getUsageHistory,
  getUsageSummary,
  getUsageByCommand,
  getUsageByDay,
  getUsageByUser,
};
