'use client';

import { CommandUsageItem } from '@/lib/api-client';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface CommandUsageBarChartProps {
  data: CommandUsageItem[];
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

interface TooltipPayload {
  payload: CommandUsageItem;
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload || !payload.length) return null;

  const item = payload[0].payload;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
      <p className="font-semibold text-gray-900 mb-2">{item.command}</p>
      <div className="space-y-1 text-sm">
        <p className="text-gray-600">
          Executions: <span className="font-medium text-gray-900">{formatNumber(item.executions)}</span>
        </p>
        <p className="text-gray-600">
          Cost: <span className="font-medium text-green-600">{formatCurrency(item.cost_usd)}</span>
        </p>
        <p className="text-gray-600">
          Failures: <span className={`font-medium ${item.failures > 0 ? 'text-red-600' : 'text-gray-900'}`}>
            {formatNumber(item.failures)}
          </span>
        </p>
        <p className="text-gray-600">
          Avg Duration: <span className="font-medium text-gray-900">{item.avg_duration_ms.toFixed(0)}ms</span>
        </p>
      </div>
    </div>
  );
}

const COLORS = [
  '#0ea5e9', // primary-500
  '#22c55e', // green-500
  '#a855f7', // purple-500
  '#f97316', // orange-500
  '#06b6d4', // cyan-500
  '#ec4899', // pink-500
  '#eab308', // yellow-500
  '#6366f1', // indigo-500
];

export default function CommandUsageBarChart({ data, loading, error }: CommandUsageBarChartProps) {
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
        <h3 className="text-lg font-semibold text-red-800">Error Loading Command Usage</h3>
        <p className="text-red-700 mt-1">{error}</p>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Usage by Command</h2>
        <p className="text-gray-500 text-center py-8">No command usage data available.</p>
      </div>
    );
  }

  // Sort by executions descending and take top 10
  const sortedData = [...data]
    .sort((a, b) => b.executions - a.executions)
    .slice(0, 10);

  return (
    <div className="card">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Usage by Command</h2>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={sortedData}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              type="number"
              tickFormatter={formatNumber}
              tick={{ fontSize: 12, fill: '#6b7280' }}
            />
            <YAxis
              type="category"
              dataKey="command"
              tick={{ fontSize: 12, fill: '#374151' }}
              width={90}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="executions" radius={[0, 4, 4, 0]}>
              {sortedData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
