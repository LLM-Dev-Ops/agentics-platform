'use client';

import { useState } from 'react';
import { ApiKey } from '@/lib/api';

interface ApiKeyTableProps {
  apiKeys: ApiKey[];
  onRevoke: (keyId: string) => Promise<void>;
}

export default function ApiKeyTable({ apiKeys, onRevoke }: ApiKeyTableProps) {
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);

  const handleRevoke = async (keyId: string) => {
    setRevokingId(keyId);
    try {
      await onRevoke(keyId);
      setConfirmRevokeId(null);
    } finally {
      setRevokingId(null);
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

  if (apiKeys.length === 0) {
    return (
      <div className="card text-center py-12">
        <p className="text-gray-500">No API keys found. Create your first API key to get started.</p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden p-0">
      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Scopes</th>
            <th>Created</th>
            <th>Last Used</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {apiKeys.map((apiKey) => (
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
              <td>{formatDate(apiKey.createdAt)}</td>
              <td>{formatDate(apiKey.lastUsedAt)}</td>
              <td>
                {confirmRevokeId === apiKey.id ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleRevoke(apiKey.id)}
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
  );
}
