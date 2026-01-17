'use client';

import { useState } from 'react';
import { UsageHistory, UsageDataPoint } from '@/lib/api-client';

interface UsageTrendsProps {
  data: UsageHistory | null;
  loading: boolean;
  onGranularityChange: (granularity: 'hourly' | 'daily' | 'monthly') => void;
  onDateRangeChange: (start: string, end: string) => void;
  currentGranularity: 'hourly' | 'daily' | 'monthly';
}

function formatNumber(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toLocaleString();
}

function formatDate(dateString: string, granularity: string): string {
  const date = new Date(dateString);
  switch (granularity) {
    case 'hourly':
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
      });
    case 'monthly':
      return date.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      });
    default:
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
  }
}

interface BarChartProps {
  dataPoints: UsageDataPoint[];
  metric: 'requests' | 'tokens';
  granularity: string;
}

function BarChart({ dataPoints, metric, granularity }: BarChartProps) {
  if (dataPoints.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-500">
        No data for selected period
      </div>
    );
  }

  const values = dataPoints.map((d) => d[metric]);
  const maxValue = Math.max(...values, 1);

  return (
    <div className="space-y-2">
      {dataPoints.map((point, index) => {
        const value = point[metric];
        const percentage = (value / maxValue) * 100;

        return (
          <div key={index} className="flex items-center gap-3">
            <div className="w-24 text-sm text-gray-600 text-right truncate">
              {formatDate(point.timestamp, granularity)}
            </div>
            <div className="flex-1 relative h-6 bg-gray-100 rounded overflow-hidden">
              <div
                className={`absolute left-0 top-0 h-full rounded transition-all ${
                  metric === 'requests' ? 'bg-primary-500' : 'bg-green-500'
                }`}
                style={{ width: `${percentage}%` }}
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-700">
                {formatNumber(value)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function UsageTrends({
  data,
  loading,
  onGranularityChange,
  onDateRangeChange,
  currentGranularity,
}: UsageTrendsProps) {
  const [metric, setMetric] = useState<'requests' | 'tokens'>('requests');
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('30d');

  const handleDateRangeChange = (range: '7d' | '30d' | '90d') => {
    setDateRange(range);
    const end = new Date();
    const start = new Date();

    switch (range) {
      case '7d':
        start.setDate(end.getDate() - 7);
        onGranularityChange('daily');
        break;
      case '30d':
        start.setDate(end.getDate() - 30);
        onGranularityChange('daily');
        break;
      case '90d':
        start.setDate(end.getDate() - 90);
        onGranularityChange('monthly');
        break;
    }

    onDateRangeChange(start.toISOString(), end.toISOString());
  };

  if (loading) {
    return (
      <div className="card animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="h-64 bg-gray-100 rounded"></div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Usage Trends</h2>

        <div className="flex flex-wrap gap-2">
          {/* Date Range Selector */}
          <div className="inline-flex rounded-md shadow-sm">
            {(['7d', '30d', '90d'] as const).map((range) => (
              <button
                key={range}
                onClick={() => handleDateRangeChange(range)}
                className={`px-3 py-1.5 text-sm font-medium border ${
                  dateRange === range
                    ? 'bg-primary-50 text-primary-700 border-primary-300'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                } ${
                  range === '7d' ? 'rounded-l-md' : range === '90d' ? 'rounded-r-md' : ''
                }`}
              >
                {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
              </button>
            ))}
          </div>

          {/* Metric Selector */}
          <div className="inline-flex rounded-md shadow-sm">
            <button
              onClick={() => setMetric('requests')}
              className={`px-3 py-1.5 text-sm font-medium border rounded-l-md ${
                metric === 'requests'
                  ? 'bg-primary-50 text-primary-700 border-primary-300'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              Requests
            </button>
            <button
              onClick={() => setMetric('tokens')}
              className={`px-3 py-1.5 text-sm font-medium border border-l-0 rounded-r-md ${
                metric === 'tokens'
                  ? 'bg-green-50 text-green-700 border-green-300'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              Tokens
            </button>
          </div>
        </div>
      </div>

      {data ? (
        <>
          <BarChart
            dataPoints={data.dataPoints}
            metric={metric}
            granularity={currentGranularity}
          />

          {data.summary && (
            <div className="mt-6 pt-4 border-t border-gray-100">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-sm text-gray-500">Total Requests</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {formatNumber(data.summary.totalRequests)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Tokens</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {formatNumber(data.summary.totalTokens)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Data Points</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {data.summary.dataPointCount}
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="flex items-center justify-center h-48 text-gray-500">
          Select a date range to view trends
        </div>
      )}
    </div>
  );
}
