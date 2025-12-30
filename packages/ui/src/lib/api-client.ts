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

export interface ListKeysResponse {
  keys: ApiKey[];
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

// Export for convenience
export const apiClient = {
  getMe,
  listKeys,
  createKey,
  revokeKey,
};
