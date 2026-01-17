'use client';

import { UsageSummary } from '@/lib/api-client';

interface UsageOverviewProps {
  data: UsageSummary | null;
  loading: boolean;
  error: string | null;
}

function formatNumber(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toLocaleString();
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function UsageOverview({ data, loading, error }: UsageOverviewProps) {
  if (loading) {
    return (
      <div className="card animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-gray-100 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card bg-red-50 border-red-200">
        <h3 className="text-lg font-semibold text-red-800">Error Loading Usage</h3>
        <p className="text-red-700 mt-1">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="card">
        <p className="text-gray-500 text-center py-4">No usage data available.</p>
      </div>
    );
  }

  const stats = [
    {
      label: 'Total Requests',
      value: formatNumber(data.usage.requests.total),
      sublabel: `${data.quota.requests.percentUsed ?? 0}% of quota`,
      color: 'text-primary-600',
    },
    {
      label: 'Total Tokens',
      value: formatNumber(data.usage.tokens.total),
      sublabel: `${data.quota.tokens.percentUsed ?? 0}% of quota`,
      color: 'text-green-600',
    },
    {
      label: 'Current Tier',
      value: data.tier,
      sublabel: 'Subscription plan',
      color: 'text-purple-600',
    },
  ];

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Usage Overview</h2>
        <span className="text-sm text-gray-500">
          {formatDate(data.period.start)} - {formatDate(data.period.end)}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-gray-50 rounded-lg p-4 border border-gray-100"
          >
            <p className="text-sm text-gray-600 mb-1">{stat.label}</p>
            <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-gray-500 mt-1">{stat.sublabel}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
