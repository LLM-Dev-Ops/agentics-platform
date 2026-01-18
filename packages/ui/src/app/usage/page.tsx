'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  UsageSummary,
  UsageHistory,
  UsageProxySummary,
  CommandUsageItem,
  DailyUsageItem,
  UserUsageItem,
  TimeRange,
  getUsageCurrent,
  getUsageHistory,
  getUsageSummary,
  getUsageByCommand,
  getUsageByDay,
  getUsageByUser,
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
import {
  UsageSummaryCards,
  CommandUsageBarChart,
  DailyUsageTimeSeries,
  UserUsageTable,
  TimeRangeSelector,
} from '@/components/usage-graphs';

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

  // New usage ledger states
  const [timeRange, setTimeRange] = useState<TimeRange>('30');
  const [usageSummary, setUsageSummary] = useState<UsageProxySummary | null>(null);
  const [commandUsage, setCommandUsage] = useState<CommandUsageItem[]>([]);
  const [dailyUsage, setDailyUsage] = useState<DailyUsageItem[]>([]);
  const [userUsage, setUserUsage] = useState<UserUsageItem[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(true);
  const [ledgerError, setLedgerError] = useState<string | null>(null);

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

  // Fetch usage ledger data (all endpoints in parallel)
  const fetchLedgerData = useCallback(async (range: TimeRange) => {
    try {
      setLedgerLoading(true);
      setLedgerError(null);

      const [summary, byCommand, byDay, byUser] = await Promise.all([
        getUsageSummary(range),
        getUsageByCommand(range),
        getUsageByDay(range),
        getUsageByUser(range),
      ]);

      setUsageSummary(summary);
      setCommandUsage(byCommand);
      setDailyUsage(byDay);
      setUserUsage(byUser);
    } catch (err) {
      if (err instanceof ApiError) {
        setLedgerError(err.message);
      } else {
        setLedgerError('Failed to load usage data from ledger.');
      }
      // Clear data on error
      setUsageSummary(null);
      setCommandUsage([]);
      setDailyUsage([]);
      setUserUsage([]);
    } finally {
      setLedgerLoading(false);
    }
  }, []);

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

  // Load usage ledger data
  useEffect(() => {
    fetchLedgerData(timeRange);
  }, [fetchLedgerData, timeRange]);

  const handleTimeRangeChange = (newRange: TimeRange) => {
    setTimeRange(newRange);
  };

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
        <TimeRangeSelector value={timeRange} onChange={handleTimeRangeChange} />
      </div>

      {/* Summary Cards - Real Data from Usage Ledger */}
      <UsageSummaryCards
        data={usageSummary}
        loading={ledgerLoading}
        error={ledgerError}
        timeRange={timeRange}
      />

      {/* Charts Row: Command Usage and Daily Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CommandUsageBarChart
          data={commandUsage}
          loading={ledgerLoading}
          error={ledgerError}
        />
        <DailyUsageTimeSeries
          data={dailyUsage}
          loading={ledgerLoading}
          error={ledgerError}
        />
      </div>

      {/* User Usage Table */}
      <UserUsageTable
        data={userUsage}
        loading={ledgerLoading}
        error={ledgerError}
      />

      {/* Divider */}
      <div className="border-t border-gray-200 pt-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Quota & Entitlements
        </h2>
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
