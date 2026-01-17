'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  UsageSummary,
  UsageHistory,
  getUsageCurrent,
  getUsageHistory,
  ApiError,
} from '@/lib/api-client';
import {
  UsageOverview,
  UsageQuotaCard,
  UsageByCategory,
  UsageTrends,
  UsageBlockedList,
  UsageFilters,
} from '@/components/usage';

type Period = 'current-month' | 'last-7-days' | 'last-30-days';
type Granularity = 'hourly' | 'daily' | 'monthly';

// Mock blocked executions - in production, this would come from the usage-ledger API
// This demonstrates the UI capability without requiring backend changes
const mockBlockedExecutions: never[] = [];

export default function UsagePage() {
  const [period, setPeriod] = useState<Period>('current-month');
  const [currentUsage, setCurrentUsage] = useState<UsageSummary | null>(null);
  const [usageHistory, setUsageHistory] = useState<UsageHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [granularity, setGranularity] = useState<Granularity>('daily');

  // Fetch current usage summary
  const fetchCurrentUsage = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getUsageCurrent(period);
      setCurrentUsage(data);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to load usage data. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [period]);

  // Fetch usage history
  const fetchUsageHistory = useCallback(
    async (start: string, end: string, gran: Granularity) => {
      try {
        setHistoryLoading(true);
        const data = await getUsageHistory(start, end, gran);
        setUsageHistory(data);
      } catch (err) {
        console.error('Failed to load usage history:', err);
        // Don't set error state - just log it
        setUsageHistory(null);
      } finally {
        setHistoryLoading(false);
      }
    },
    []
  );

  // Load initial data
  useEffect(() => {
    fetchCurrentUsage();
  }, [fetchCurrentUsage]);

  // Load history with default 30-day range
  useEffect(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 30);
    fetchUsageHistory(start.toISOString(), end.toISOString(), granularity);
  }, [fetchUsageHistory, granularity]);

  const handlePeriodChange = (newPeriod: Period) => {
    setPeriod(newPeriod);
  };

  const handleGranularityChange = (newGranularity: Granularity) => {
    setGranularity(newGranularity);
  };

  const handleDateRangeChange = (start: string, end: string) => {
    fetchUsageHistory(start, end, granularity);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Usage Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Monitor your platform usage and billing metrics
          </p>
        </div>
      </div>

      {/* Period Filter */}
      <UsageFilters period={period} onPeriodChange={handlePeriodChange} />

      {/* Top Row: Overview and Quota */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <UsageOverview data={currentUsage} loading={loading} error={error} />
        <UsageQuotaCard data={currentUsage} loading={loading} />
      </div>

      {/* Usage Trends Chart */}
      <UsageTrends
        data={usageHistory}
        loading={historyLoading}
        onGranularityChange={handleGranularityChange}
        onDateRangeChange={handleDateRangeChange}
        currentGranularity={granularity}
      />

      {/* Bottom Row: Category Breakdown and Blocked Executions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <UsageByCategory data={currentUsage} loading={loading} />
        <UsageBlockedList data={mockBlockedExecutions} loading={loading} />
      </div>

      {/* Finance/Exec Note */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-700 mb-2">
          About This Dashboard
        </h3>
        <p className="text-sm text-gray-600">
          This dashboard displays aggregated usage metrics from the platform. All data is
          read-only and sourced from the usage ledger service. Billing calculations are
          performed server-side to ensure accuracy. For detailed logs or raw data export,
          please contact your administrator.
        </p>
      </div>
    </div>
  );
}
