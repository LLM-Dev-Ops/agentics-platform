'use client';

import { UsageHistory } from '@/lib/api';

interface UsageChartProps {
  data: UsageHistory[];
  metric: 'requests' | 'tokens' | 'compute';
}

export default function UsageChart({ data, metric }: UsageChartProps) {
  if (data.length === 0) {
    return (
      <div className="card text-center py-12">
        <p className="text-gray-500">No usage data available for the selected period.</p>
      </div>
    );
  }

  const maxValue = Math.max(...data.map((d) => d[metric]));
  const scale = maxValue > 0 ? 100 / maxValue : 1;

  const formatValue = (value: number) => {
    if (metric === 'tokens' || metric === 'compute') {
      if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
      if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    }
    return value.toLocaleString();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getMetricLabel = () => {
    switch (metric) {
      case 'requests':
        return 'Requests';
      case 'tokens':
        return 'Tokens';
      case 'compute':
        return 'Compute Units';
    }
  };

  return (
    <div className="card">
      <div className="mb-4">
        <h3 className="text-lg font-semibold">{getMetricLabel()} Over Time</h3>
      </div>

      <div className="space-y-2">
        {data.map((item, index) => (
          <div key={index} className="flex items-center gap-3">
            <div className="w-20 text-sm text-gray-600 text-right">
              {formatDate(item.date)}
            </div>
            <div className="flex-1 relative h-8">
              <div
                className="absolute left-0 top-0 h-full bg-primary-500 rounded transition-all hover:bg-primary-600"
                style={{ width: `${item[metric] * scale}%` }}
              >
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-white text-sm font-medium">
                  {formatValue(item[metric])}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {maxValue > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex justify-between text-sm text-gray-600">
            <span>0</span>
            <span>{formatValue(maxValue)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
