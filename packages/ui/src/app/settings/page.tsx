'use client';

import { useSupabaseAuth } from '@/lib/supabase-auth';

export default function SettingsPage() {
  const { user } = useSupabaseAuth();

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Account Settings</h1>

      <div className="card">
        <h2 className="text-xl font-semibold mb-4">Account Information</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={user?.email || ''}
              className="input bg-gray-50"
              disabled
              readOnly
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              User ID
            </label>
            <input
              type="text"
              value={user?.id || ''}
              className="input bg-gray-50 font-mono text-sm"
              disabled
              readOnly
            />
          </div>
        </div>
      </div>
    </div>
  );
}
