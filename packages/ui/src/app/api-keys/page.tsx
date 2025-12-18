'use client';

import { useState, useEffect } from 'react';
import { ProtectedRoute } from '@/lib/auth';
import { apiClient, ApiKey, ApiError } from '@/lib/api';
import ApiKeyTable from '@/components/api-key-table';

const AVAILABLE_SCOPES = [
  'simulation:read',
  'simulation:write',
  'workflow:read',
  'workflow:write',
  'usage:read',
];

export default function ApiKeysPage() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  useEffect(() => {
    loadApiKeys();
  }, []);

  const loadApiKeys = async () => {
    try {
      setIsLoading(true);
      const keys = await apiClient.listApiKeys();
      setApiKeys(keys);
      setError('');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to load API keys');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedScopes.length === 0) {
      setError('Please select at least one scope');
      return;
    }

    setIsCreating(true);
    setError('');
    try {
      const newKey = await apiClient.createApiKey({
        name: newKeyName,
        scopes: selectedScopes,
      });
      setCreatedKey(newKey.key || null);
      setApiKeys([newKey, ...apiKeys]);
      setNewKeyName('');
      setSelectedScopes([]);
      setShowCreateForm(false);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to create API key');
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleRevokeKey = async (keyId: string) => {
    try {
      await apiClient.revokeApiKey(keyId);
      setApiKeys(apiKeys.filter((key) => key.id !== keyId));
      setError('');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to revoke API key');
      }
    }
  };

  const handleCopyKey = () => {
    if (createdKey) {
      navigator.clipboard.writeText(createdKey);
      // Could add a toast notification here
    }
  };

  const toggleScope = (scope: string) => {
    if (selectedScopes.includes(scope)) {
      setSelectedScopes(selectedScopes.filter((s) => s !== scope));
    } else {
      setSelectedScopes([...selectedScopes, scope]);
    }
  };

  return (
    <ProtectedRoute>
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">API Keys</h1>
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
          <div className="mb-6 card bg-green-50 border-green-200">
            <h3 className="text-lg font-semibold text-green-900 mb-2">
              API Key Created Successfully
            </h3>
            <p className="text-sm text-green-800 mb-3">
              Make sure to copy your API key now. You won't be able to see it again!
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 bg-white border border-green-300 rounded font-mono text-sm">
                {createdKey}
              </code>
              <button onClick={handleCopyKey} className="btn btn-secondary">
                Copy
              </button>
            </div>
            <button
              onClick={() => setCreatedKey(null)}
              className="mt-3 text-sm text-green-700 hover:text-green-900"
            >
              I've saved my key
            </button>
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
                  placeholder="My API Key"
                  required
                  disabled={isCreating}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Scopes
                </label>
                <div className="space-y-2">
                  {AVAILABLE_SCOPES.map((scope) => (
                    <label key={scope} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={selectedScopes.includes(scope)}
                        onChange={() => toggleScope(scope)}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                        disabled={isCreating}
                      />
                      <span className="ml-2 text-sm text-gray-700">{scope}</span>
                    </label>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={isCreating || selectedScopes.length === 0}
              >
                {isCreating ? 'Creating...' : 'Create API Key'}
              </button>
            </form>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        ) : (
          <ApiKeyTable apiKeys={apiKeys} onRevoke={handleRevokeKey} />
        )}
      </div>
    </ProtectedRoute>
  );
}
