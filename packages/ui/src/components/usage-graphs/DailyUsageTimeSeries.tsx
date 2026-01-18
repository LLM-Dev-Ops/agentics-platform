'use client';

import { DailyUsageItem } from '@/lib/api-client';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface DailyUsageTimeSeriesProps {
  data: DailyUsageItem[];
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

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface TooltipPayload {
  name: string;
  value: number;
  color: string;
  payload: DailyUsageItem;
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayload[]; label?: string }) {
  if (!active || !payload || !payload.length) return null;

  const item = payload[0].payload;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
      <p className="font-semibold text-gray-900 mb-2">
        {new Date(item.date).toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        })}
      </p>
      <div className="space-y-1 text-sm">
        <p className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-primary-500"></span>
          <span className="text-gray-600">Executions:</span>
          <span className="font-medium text-gray-900">{formatNumber(item.executions)}</span>
        </p>
        <p className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-green-500"></span>
          <span className="text-gray-600">Cost:</span>
          <span className="font-medium text-green-600">{formatCurrency(item.cost_usd)}</span>
        </p>
        {item.failures > 0 && (
          <p className="text-gray-600">
            Failures: <span className="font-medium text-red-600">{formatNumber(item.failures)}</span>
          </p>
        )}
      </div>
    </div>
  );
}

export default function DailyUsageTimeSeries({ data, loading, error }: DailyUsageTimeSeriesProps) {
  if (loading) {
    return (
      <div className="card">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-4 animate-pulse"></div>
        <div className="h-80 bg-gray-100 rounded animate-pulse"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card bg-red-50 border-red-200">
        <h3 className="text-lg font-semibold text-red-800">Error Loading Daily Usage</h3>
        <p className="text-red-700 mt-1">{error}</p>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Daily Usage Trend</h2>
        <p className="text-gray-500 text-center py-8">No daily usage data available.</p>
      </div>
    );
  }

  // Sort by date ascending
  const sortedData = [...data].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  return (
    <div className="card">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Daily Usage Trend</h2>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={sortedData}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              tick={{ fontSize: 12, fill: '#6b7280' }}
              interval="preserveStartEnd"
            />
            <YAxis
              yAxisId="left"
              tickFormatter={formatNumber}
              tick={{ fontSize: 12, fill: '#6b7280' }}
              label={{
                value: 'Executions',
                angle: -90,
                position: 'insideLeft',
                style: { textAnchor: 'middle', fill: '#6b7280', fontSize: 12 },
              }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tickFormatter={(v: number) => `$${v}`}
              tick={{ fontSize: 12, fill: '#6b7280' }}
              label={{
                value: 'Cost ($)',
                angle: 90,
                position: 'insideRight',
                style: { textAnchor: 'middle', fill: '#6b7280', fontSize: 12 },
              }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ paddingTop: '10px' }}
              formatter={(value: string) => (
                <span className="text-sm text-gray-600">{value}</span>
              )}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="executions"
              name="Executions"
              stroke="#0ea5e9"
              strokeWidth={2}
              dot={{ fill: '#0ea5e9', strokeWidth: 0, r: 3 }}
              activeDot={{ r: 5, strokeWidth: 0 }}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="cost_usd"
              name="Cost"
              stroke="#22c55e"
              strokeWidth={2}
              dot={{ fill: '#22c55e', strokeWidth: 0, r: 3 }}
              activeDot={{ r: 5, strokeWidth: 0 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
