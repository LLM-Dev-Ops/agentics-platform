'use client';

import { UsageSummary } from '@/lib/api-client';

interface UsageQuotaCardProps {
  data: UsageSummary | null;
  loading: boolean;
}

function formatNumber(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toLocaleString();
}

interface ProgressBarProps {
  label: string;
  used: number;
  limit: number | null;
  percentUsed: number | null;
  colorClass: string;
}

function ProgressBar({ label, used, limit, percentUsed, colorClass }: ProgressBarProps) {
  const percent = percentUsed ?? 0;
  const isUnlimited = limit === null;
  const isWarning = percent >= 80 && percent < 95;
  const isCritical = percent >= 95;

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <span className="text-sm text-gray-600">
          {formatNumber(used)} / {isUnlimited ? 'Unlimited' : formatNumber(limit!)}
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            isCritical ? 'bg-red-500' : isWarning ? 'bg-yellow-500' : colorClass
          }`}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
      <div className="flex justify-between items-center text-xs text-gray-500">
        <span>{percent}% used</span>
        {!isUnlimited && (
          <span>
            {formatNumber(limit! - used)} remaining
          </span>
        )}
      </div>
      {isCritical && (
        <p className="text-xs text-red-600 font-medium">
          Quota nearly exhausted. Consider upgrading your plan.
        </p>
      )}
      {isWarning && !isCritical && (
        <p className="text-xs text-yellow-600 font-medium">
          Approaching quota limit.
        </p>
      )}
    </div>
  );
}

export default function UsageQuotaCard({ data, loading }: UsageQuotaCardProps) {
  if (loading) {
    return (
      <div className="card animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/4 mb-6"></div>
        <div className="space-y-6">
          {[1, 2].map((i) => (
            <div key={i}>
              <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
              <div className="h-3 bg-gray-100 rounded-full"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="card">
        <p className="text-gray-500 text-center py-4">No quota data available.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Quota Status</h2>

      <div className="space-y-6">
        <ProgressBar
          label="API Requests"
          used={data.quota.requests.used}
          limit={data.quota.requests.limit}
          percentUsed={data.quota.requests.percentUsed}
          colorClass="bg-primary-500"
        />

        <ProgressBar
          label="Token Usage"
          used={data.quota.tokens.used}
          limit={data.quota.tokens.limit}
          percentUsed={data.quota.tokens.percentUsed}
          colorClass="bg-green-500"
        />
      </div>

      <div className="mt-6 pt-4 border-t border-gray-100">
        <p className="text-xs text-gray-500">
          Quotas reset at the beginning of each billing period.
          {data.tier === 'FREE' && (
            <span className="block mt-1">
              <a href="/billing" className="text-primary-600 hover:underline">
                Upgrade your plan
              </a>{' '}
              for higher limits.
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
