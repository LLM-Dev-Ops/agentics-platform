'use client';

import { UserUsageItem } from '@/lib/api-client';

interface UserUsageTableProps {
  data: UserUsageItem[];
  loading: boolean;
  error: string | null;
}

function formatNumber(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toLocaleString();
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value);
}

function truncatePrincipal(principal: string, maxLength: number = 24): string {
  if (principal.length <= maxLength) return principal;
  return `${principal.slice(0, maxLength - 3)}...`;
}

export default function UserUsageTable({ data, loading, error }: UserUsageTableProps) {
  if (loading) {
    return (
      <div className="card">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-4 animate-pulse"></div>
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 bg-gray-100 rounded animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card bg-red-50 border-red-200">
        <h3 className="text-lg font-semibold text-red-800">Error Loading User Usage</h3>
        <p className="text-red-700 mt-1">{error}</p>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Usage by User</h2>
        <p className="text-gray-500 text-center py-8">No user usage data available.</p>
      </div>
    );
  }

  // Sort by executions descending
  const sortedData = [...data].sort((a, b) => b.executions - a.executions);

  return (
    <div className="card">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Usage by User</h2>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                Principal
              </th>
              <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">
                Executions
              </th>
              <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">
                Total Cost
              </th>
              <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">
                Failures
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedData.map((user, index) => (
              <tr
                key={user.principal}
                className={`border-b border-gray-100 ${
                  index % 2 === 0 ? 'bg-gray-50' : 'bg-white'
                } hover:bg-gray-100 transition-colors`}
              >
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                      <span className="text-sm font-medium text-primary-700">
                        {user.principal.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span
                      className="text-sm text-gray-900 font-mono"
                      title={user.principal}
                    >
                      {truncatePrincipal(user.principal)}
                    </span>
                  </div>
                </td>
                <td className="py-3 px-4 text-right">
                  <span className="text-sm font-medium text-gray-900">
                    {formatNumber(user.executions)}
                  </span>
                </td>
                <td className="py-3 px-4 text-right">
                  <span className="text-sm font-medium text-green-600">
                    {formatCurrency(user.cost_usd)}
                  </span>
                </td>
                <td className="py-3 px-4 text-right">
                  <span
                    className={`text-sm font-medium ${
                      user.failures > 0 ? 'text-red-600' : 'text-gray-500'
                    }`}
                  >
                    {formatNumber(user.failures)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-500 mt-4 text-center">
        Read-only view. User principals are derived from authentication tokens.
      </p>
    </div>
  );
}
