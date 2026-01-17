'use client';

import { UsageSummary } from '@/lib/api-client';

interface UsageByCategoryProps {
  data: UsageSummary | null;
  loading: boolean;
}

function formatNumber(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toLocaleString();
}

// Map endpoints to user-friendly category names
function getCategoryName(endpoint: string): string {
  const categoryMap: Record<string, string> = {
    '/v1/intelligence': 'AI Intelligence',
    '/v1/security': 'Security',
    '/v1/automation': 'Automation',
    '/v1/governance': 'Governance',
    '/v1/data': 'Data Services',
    '/v1/ecosystem': 'Ecosystem',
    '/v1/research': 'Research',
    '/v1/interface': 'Interface',
    '/v1/keys': 'API Keys',
    '/v1/me': 'Identity',
    '/v1/usage': 'Usage',
    '/v1/billing': 'Billing',
  };

  // Match partial paths for categorization
  for (const [path, name] of Object.entries(categoryMap)) {
    if (endpoint.startsWith(path)) {
      return name;
    }
  }

  return endpoint;
}

// Assign colors to categories
function getCategoryColor(index: number): string {
  const colors = [
    'bg-primary-500',
    'bg-green-500',
    'bg-purple-500',
    'bg-orange-500',
    'bg-pink-500',
    'bg-cyan-500',
    'bg-indigo-500',
    'bg-teal-500',
  ];
  return colors[index % colors.length];
}

interface CategoryRowProps {
  category: string;
  requests: number;
  tokens: number;
  totalRequests: number;
  colorClass: string;
}

function CategoryRow({ category, requests, tokens, totalRequests, colorClass }: CategoryRowProps) {
  const percentage = totalRequests > 0 ? ((requests / totalRequests) * 100).toFixed(1) : '0';

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded ${colorClass}`} />
          <span className="font-medium text-gray-900">{category}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-right text-gray-600">
        {formatNumber(requests)}
      </td>
      <td className="px-4 py-3 text-right text-gray-600">
        {formatNumber(tokens)}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-2">
          <div className="w-16 bg-gray-200 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full rounded-full ${colorClass}`}
              style={{ width: `${percentage}%` }}
            />
          </div>
          <span className="text-sm text-gray-600 w-12 text-right">{percentage}%</span>
        </div>
      </td>
    </tr>
  );
}

export default function UsageByCategory({ data, loading }: UsageByCategoryProps) {
  if (loading) {
    return (
      <div className="card animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 bg-gray-100 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="card">
        <p className="text-gray-500 text-center py-4">No category data available.</p>
      </div>
    );
  }

  // Group endpoints by category and aggregate
  const categoryData: Record<string, { requests: number; tokens: number }> = {};

  Object.entries(data.usage.requests.byEndpoint).forEach(([endpoint, requests]) => {
    const category = getCategoryName(endpoint);
    if (!categoryData[category]) {
      categoryData[category] = { requests: 0, tokens: 0 };
    }
    categoryData[category].requests += requests;
  });

  Object.entries(data.usage.tokens.byEndpoint).forEach(([endpoint, tokens]) => {
    const category = getCategoryName(endpoint);
    if (!categoryData[category]) {
      categoryData[category] = { requests: 0, tokens: 0 };
    }
    categoryData[category].tokens += tokens;
  });

  // Sort by requests descending
  const sortedCategories = Object.entries(categoryData)
    .sort((a, b) => b[1].requests - a[1].requests);

  const totalRequests = data.usage.requests.total;

  if (sortedCategories.length === 0) {
    return (
      <div className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Usage by Category</h2>
        <div className="text-center py-8">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          <p className="mt-2 text-gray-500">No usage recorded yet.</p>
          <p className="text-sm text-gray-400">Usage will appear here after API calls are made.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Usage by Category</h2>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Category
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Requests
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Tokens
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Share
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sortedCategories.map(([category, stats], index) => (
              <CategoryRow
                key={category}
                category={category}
                requests={stats.requests}
                tokens={stats.tokens}
                totalRequests={totalRequests}
                colorClass={getCategoryColor(index)}
              />
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-300 bg-gray-50">
              <td className="px-4 py-3 font-semibold text-gray-900">Total</td>
              <td className="px-4 py-3 text-right font-semibold text-gray-900">
                {formatNumber(data.usage.requests.total)}
              </td>
              <td className="px-4 py-3 text-right font-semibold text-gray-900">
                {formatNumber(data.usage.tokens.total)}
              </td>
              <td className="px-4 py-3 text-right font-semibold text-gray-900">100%</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
