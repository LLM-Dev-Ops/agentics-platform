'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedRoute, useSupabaseAuth } from '@/lib/supabase-auth';
import { apiClient, ApiKey, ApiError } from '@/lib/api-client';

const AVAILABLE_SCOPES = [
  { value: 'platform:read', label: 'Platform Read' },
  { value: 'platform:write', label: 'Platform Write' },
  { value: 'admin', label: 'Admin' },
];

export default function DashboardKeysPage() {
  const { session, isAuthReady } = useSupabaseAuth();
  const router = useRouter();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<string[]>(['platform:read']);
  const [isCreating, setIsCreating] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  // Track if we've already fetched keys to prevent duplicate calls
  const hasFetchedRef = useRef(false);

  // Fetch keys once when auth is ready
  useEffect(() => {
    // Wait for auth to be fully ready
    if (!isAuthReady) return;

    // Only fetch once
    if (hasFetchedRef.current) return;

    // If no session after auth loaded, redirect will happen via ProtectedRoute
    if (!session?.access_token) {
      setIsLoading(false);
      return;
    }

    hasFetchedRef.current = true;

    const fetchKeys = async () => {
      try {
        setIsLoading(true);
        const fetchedKeys = await apiClient.listKeys();
        setKeys(fetchedKeys);
        setError('');
      } catch (err) {
        if (err instanceof ApiError) {
          if (err.status === 401) {
            // Session might be expired, redirect to login
            router.push('/login');
            return;
          }
          setError(err.message);
        } else if (err instanceof Error && err.message === 'No active session') {
          router.push('/login');
          return;
        } else {
          setError('Failed to load API keys');
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchKeys();
  }, [isAuthReady, session?.access_token, router]);

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!session?.access_token) {
      router.push('/login');
      return;
    }

    setIsCreating(true);
    setError('');

    try {
      const response = await apiClient.createKey(newKeyName, selectedScopes);
      setCreatedKey(response.api_key);
      setKeys([{
        id: response.id,
        name: response.name,
        scopes: response.scopes,
        is_active: true,
        created_at: response.created_at
      }, ...keys]);
      setNewKeyName('');
      setSelectedScopes(['platform:read']);
      setShowCreateForm(false);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          router.push('/login');
          return;
        }
        setError(err.message);
      } else if (err instanceof Error && err.message === 'No active session') {
        router.push('/login');
        return;
      } else {
        setError('Failed to create API key');
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleRevokeKey = async (keyId: string) => {
    if (!session?.access_token) {
      router.push('/login');
      return;
    }

    setRevokingId(keyId);

    try {
      await apiClient.revokeKey(keyId);
      setKeys(keys.filter(k => k.id !== keyId));
      setConfirmRevokeId(null);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          router.push('/login');
          return;
        }
        setError(err.message);
      } else if (err instanceof Error && err.message === 'No active session') {
        router.push('/login');
        return;
      } else {
        setError('Failed to revoke API key');
      }
    } finally {
      setRevokingId(null);
    }
  };

  const handleCopyKey = () => {
    if (createdKey) {
      navigator.clipboard.writeText(createdKey);
    }
  };

  const toggleScope = (scope: string) => {
    if (selectedScopes.includes(scope)) {
      setSelectedScopes(selectedScopes.filter(s => s !== scope));
    } else {
      setSelectedScopes([...selectedScopes, scope]);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <ProtectedRoute>
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">API Keys</h1>
            <p className="text-gray-600 mt-1">Manage your API keys for programmatic access</p>
          </div>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="btn btn-primary"
          >
            {showCreateForm ? 'Cancel' : 'Create New Key'}
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {createdKey && (
          <div className="mb-6 card bg-yellow-50 border-yellow-300">
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-yellow-900">
                  Save your API key now!
                </h3>
                <p className="text-sm text-yellow-800 mt-1">
                  This is the only time you'll see this key. Store it securely - you cannot retrieve it later.
                </p>
                <div className="flex items-center gap-2 mt-3">
                  <code className="flex-1 px-3 py-2 bg-white border border-yellow-400 rounded font-mono text-sm break-all">
                    {createdKey}
                  </code>
                  <button onClick={handleCopyKey} className="btn btn-secondary whitespace-nowrap">
                    Copy
                  </button>
                </div>
                <button
                  onClick={() => setCreatedKey(null)}
                  className="mt-3 text-sm text-yellow-700 hover:text-yellow-900"
                >
                  I've saved my key
                </button>
              </div>
            </div>
          </div>
        )}

        {showCreateForm && (
          <div className="mb-6 card">
            <h2 className="text-xl font-semibold mb-4">Create New API Key</h2>
            <form onSubmit={handleCreateKey} className="space-y-4">
              <div>
                <label htmlFor="keyName" className="block text-sm font-medium text-gray-700 mb-1">
                  Key Name
                </label>
                <input
                  id="keyName"
                  type="text"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  className="input"
                  placeholder="e.g., Production API Key"
                  required
                  disabled={isCreating}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Permissions
                </label>
                <div className="space-y-2">
                  {AVAILABLE_SCOPES.map((scope) => (
                    <label key={scope.value} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={selectedScopes.includes(scope.value)}
                        onChange={() => toggleScope(scope.value)}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                        disabled={isCreating}
                      />
                      <span className="ml-2 text-sm text-gray-700">{scope.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={isCreating || selectedScopes.length === 0 || !newKeyName.trim()}
              >
                {isCreating ? 'Creating...' : 'Create API Key'}
              </button>
            </form>
          </div>
        )}

        {isLoading || !isAuthReady ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        ) : keys.length === 0 ? (
          <div className="card text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No API keys</h3>
            <p className="mt-1 text-sm text-gray-500">Create your first API key to get started.</p>
          </div>
        ) : (
          <div className="card overflow-hidden p-0">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Permissions</th>
                  <th>Created</th>
                  <th>Last Used</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {keys.filter(k => k.is_active).map((apiKey) => (
                  <tr key={apiKey.id}>
                    <td className="font-medium">{apiKey.name}</td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {apiKey.scopes.map((scope) => (
                          <span
                            key={scope}
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary-100 text-primary-800"
                          >
                            {scope}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>{formatDate(apiKey.created_at)}</td>
                    <td>{formatDate(apiKey.last_used_at)}</td>
                    <td>
                      {confirmRevokeId === apiKey.id ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleRevokeKey(apiKey.id)}
                            disabled={revokingId === apiKey.id}
                            className="text-sm text-red-600 hover:text-red-800 font-medium"
                          >
                            {revokingId === apiKey.id ? 'Revoking...' : 'Confirm'}
                          </button>
                          <button
                            onClick={() => setConfirmRevokeId(null)}
                            disabled={revokingId === apiKey.id}
                            className="text-sm text-gray-600 hover:text-gray-800"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmRevokeId(apiKey.id)}
                          className="text-sm text-red-600 hover:text-red-800"
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
