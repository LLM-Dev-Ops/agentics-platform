'use client';

import { UsageProxySummary, TimeRange } from '@/lib/api-client';

interface UsageSummaryCardsProps {
  data: UsageProxySummary | null;
  loading: boolean;
  error: string | null;
  timeRange: TimeRange;
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
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function getTimeRangeLabel(range: TimeRange): string {
  switch (range) {
    case '7': return 'Last 7 days';
    case '30': return 'Last 30 days';
    case '90': return 'Last 90 days';
    default: return 'Selected period';
  }
}

export default function UsageSummaryCards({ data, loading, error, timeRange }: UsageSummaryCardsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="card animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-3"></div>
            <div className="h-8 bg-gray-200 rounded w-2/3 mb-2"></div>
            <div className="h-3 bg-gray-100 rounded w-1/3"></div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="card bg-red-50 border-red-200">
        <h3 className="text-lg font-semibold text-red-800">Error Loading Summary</h3>
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

  const cards = [
    {
      label: 'Total Executions',
      value: formatNumber(data.totals.executions),
      sublabel: getTimeRangeLabel(timeRange),
      color: 'text-primary-600',
      bgColor: 'bg-primary-50',
      borderColor: 'border-primary-100',
    },
    {
      label: 'Total Cost',
      value: formatCurrency(data.totals.cost_usd),
      sublabel: getTimeRangeLabel(timeRange),
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-100',
    },
    {
      label: 'Failure Rate',
      value: formatPercent(data.failure_rate),
      sublabel: `${formatNumber(data.totals.failures)} failures`,
      color: data.failure_rate > 0.05 ? 'text-red-600' : 'text-gray-600',
      bgColor: data.failure_rate > 0.05 ? 'bg-red-50' : 'bg-gray-50',
      borderColor: data.failure_rate > 0.05 ? 'border-red-100' : 'border-gray-100',
    },
    {
      label: 'Tokens Used',
      value: formatNumber(data.totals.tokens_used),
      sublabel: getTimeRangeLabel(timeRange),
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-100',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`card ${card.bgColor} ${card.borderColor} border`}
        >
          <p className="text-sm text-gray-600 mb-1">{card.label}</p>
          <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
          <p className="text-xs text-gray-500 mt-1">{card.sublabel}</p>
        </div>
      ))}
    </div>
  );
}
