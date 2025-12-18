'use client';

import { useState, useEffect } from 'react';
import { ProtectedRoute } from '@/lib/auth';
import { apiClient, UsageSummary, UsageHistory, ApiError } from '@/lib/api';
import UsageChart from '@/components/usage-chart';

type Granularity = 'daily' | 'weekly' | 'monthly';
type Metric = 'requests' | 'tokens' | 'compute';

export default function UsagePage() {
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [history, setHistory] = useState<UsageHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [granularity, setGranularity] = useState<Granularity>('daily');
  const [selectedMetric, setSelectedMetric] = useState<Metric>('requests');
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    loadUsageData();
  }, [granularity]);

  const loadUsageData = async () => {
    try {
      setIsLoading(true);
      setError('');

      const [summaryData, historyData] = await Promise.all([
        apiClient.getCurrentUsage(),
        apiClient.getUsageHistory(
          getStartDate(),
          new Date().toISOString(),
          granularity
        ),
      ]);

      setSummary(summaryData);
      setHistory(historyData);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to load usage data');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const getStartDate = () => {
    const now = new Date();
    switch (granularity) {
      case 'daily':
        now.setDate(now.getDate() - 30);
        break;
      case 'weekly':
        now.setDate(now.getDate() - 90);
        break;
      case 'monthly':
        now.setFullYear(now.getFullYear() - 1);
        break;
    }
    return now.toISOString();
  };

  const handleExport = async () => {
    try {
      setIsExporting(true);
      const blob = await apiClient.exportUsageCSV(
        getStartDate(),
        new Date().toISOString()
      );

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `usage-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to export usage data');
      }
    } finally {
      setIsExporting(false);
    }
  };

  const getPercentage = (used: number, quota: number) => {
    if (quota === 0) return 0;
    return Math.min((used / quota) * 100, 100);
  };

  const getProgressBarColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 75) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  if (isLoading) {
    return (
      <ProtectedRoute>
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Usage Dashboard</h1>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="btn btn-secondary"
          >
            {isExporting ? 'Exporting...' : 'Export CSV'}
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {summary && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Current Period Summary</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="card">
                <h3 className="text-sm font-medium text-gray-500 mb-1">Requests</h3>
                <p className="text-3xl font-bold text-gray-900 mb-2">
                  {summary.requests.toLocaleString()}
                </p>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${getProgressBarColor(
                      getPercentage(summary.requests, summary.quotas.requests)
                    )}`}
                    style={{
                      width: `${getPercentage(summary.requests, summary.quotas.requests)}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {summary.quotas.requests.toLocaleString()} quota
                </p>
              </div>

              <div className="card">
                <h3 className="text-sm font-medium text-gray-500 mb-1">Tokens</h3>
                <p className="text-3xl font-bold text-gray-900 mb-2">
                  {summary.tokens.toLocaleString()}
                </p>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${getProgressBarColor(
                      getPercentage(summary.tokens, summary.quotas.tokens)
                    )}`}
                    style={{
                      width: `${getPercentage(summary.tokens, summary.quotas.tokens)}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {summary.quotas.tokens.toLocaleString()} quota
                </p>
              </div>

              <div className="card">
                <h3 className="text-sm font-medium text-gray-500 mb-1">Compute</h3>
                <p className="text-3xl font-bold text-gray-900 mb-2">
                  {summary.compute.toLocaleString()}
                </p>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${getProgressBarColor(
                      getPercentage(summary.compute, summary.quotas.compute)
                    )}`}
                    style={{
                      width: `${getPercentage(summary.compute, summary.quotas.compute)}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {summary.quotas.compute.toLocaleString()} quota
                </p>
              </div>
            </div>
            <p className="text-sm text-gray-600">
              Period: {new Date(summary.periodStart).toLocaleDateString()} -{' '}
              {new Date(summary.periodEnd).toLocaleDateString()}
            </p>
          </div>
        )}

        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Usage History</h2>
            <div className="flex gap-4">
              <div className="flex gap-2">
                <button
                  onClick={() => setGranularity('daily')}
                  className={`px-3 py-1 rounded-md text-sm font-medium ${
                    granularity === 'daily'
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Daily
                </button>
                <button
                  onClick={() => setGranularity('weekly')}
                  className={`px-3 py-1 rounded-md text-sm font-medium ${
                    granularity === 'weekly'
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Weekly
                </button>
                <button
                  onClick={() => setGranularity('monthly')}
                  className={`px-3 py-1 rounded-md text-sm font-medium ${
                    granularity === 'monthly'
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Monthly
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedMetric('requests')}
                  className={`px-3 py-1 rounded-md text-sm font-medium ${
                    selectedMetric === 'requests'
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Requests
                </button>
                <button
                  onClick={() => setSelectedMetric('tokens')}
                  className={`px-3 py-1 rounded-md text-sm font-medium ${
                    selectedMetric === 'tokens'
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Tokens
                </button>
                <button
                  onClick={() => setSelectedMetric('compute')}
                  className={`px-3 py-1 rounded-md text-sm font-medium ${
                    selectedMetric === 'compute'
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Compute
                </button>
              </div>
            </div>
          </div>

          <UsageChart data={history} metric={selectedMetric} />
        </div>
      </div>
    </ProtectedRoute>
  );
}
