'use client';

import { useState, useEffect } from 'react';
import { useSupabaseAuth } from '@/lib/supabase-auth';
import { getMe, OrgInfo, ApiError } from '@/lib/api-client';

export default function SettingsPage() {
  const { user } = useSupabaseAuth();
  const [orgInfo, setOrgInfo] = useState<OrgInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchOrgInfo() {
      try {
        const info = await getMe();
        setOrgInfo(info);
      } catch (error) {
        console.error('Failed to fetch org info:', error);
      } finally {
        setLoading(false);
      }
    }

    if (user) {
      fetchOrgInfo();
    } else {
      setLoading(false);
    }
  }, [user]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Organization ID
            </label>
            <input
              type="text"
              value={orgInfo?.org_id || ''}
              className="input bg-gray-50 font-mono text-sm"
              disabled
              readOnly
            />
          </div>
        </div>
      </div>

      {/* Stripe Metering Status - Read Only */}
      <div className="card">
        <h2 className="text-xl font-semibold mb-4">Platform Status</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b border-gray-100">
            <div>
              <p className="text-sm font-medium text-gray-900">Stripe Usage Metering</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Tracks API usage for billing purposes
              </p>
            </div>
            <div className="flex items-center gap-2">
              {loading ? (
                <span className="text-sm text-gray-400">Loading...</span>
              ) : orgInfo?.stripe_metering_enabled ? (
                <>
                  <span className="flex h-2.5 w-2.5 rounded-full bg-green-500"></span>
                  <span className="text-sm font-medium text-green-700">Active</span>
                </>
              ) : (
                <>
                  <span className="flex h-2.5 w-2.5 rounded-full bg-gray-300"></span>
                  <span className="text-sm font-medium text-gray-500">Inactive</span>
                </>
              )}
            </div>
          </div>
          <p className="text-xs text-gray-500">
            This is a read-only status indicator. Metering configuration is managed by platform administrators.
          </p>
        </div>
      </div>
    </div>
  );
}
