'use client';

interface BlockedExecution {
  id: string;
  timestamp: string;
  endpoint: string;
  reason: 'quota_exceeded' | 'rate_limit' | 'permission_denied' | 'suspended';
  details?: string;
}

interface UsageBlockedListProps {
  data: BlockedExecution[];
  loading: boolean;
}

function getReasonLabel(reason: string): string {
  const labels: Record<string, string> = {
    quota_exceeded: 'Quota Exceeded',
    rate_limit: 'Rate Limited',
    permission_denied: 'Permission Denied',
    suspended: 'Account Suspended',
  };
  return labels[reason] || reason;
}

function getReasonDescription(reason: string): string {
  const descriptions: Record<string, string> = {
    quota_exceeded:
      'Your usage has exceeded the allocated quota for this billing period. Upgrade your plan or wait for the next billing cycle.',
    rate_limit:
      'Too many requests in a short period. Implement exponential backoff or reduce request frequency.',
    permission_denied:
      'Your API key or account does not have permission to access this resource. Check your key scopes or contact support.',
    suspended:
      'Your account has been suspended. Please contact support for assistance.',
  };
  return descriptions[reason] || 'Request was blocked.';
}

function getReasonBadgeColor(reason: string): string {
  const colors: Record<string, string> = {
    quota_exceeded: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    rate_limit: 'bg-orange-100 text-orange-800 border-orange-200',
    permission_denied: 'bg-red-100 text-red-800 border-red-200',
    suspended: 'bg-red-100 text-red-800 border-red-200',
  };
  return colors[reason] || 'bg-gray-100 text-gray-800 border-gray-200';
}

function formatTimestamp(timestamp: string): string {
  return new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function UsageBlockedList({ data, loading }: UsageBlockedListProps) {
  if (loading) {
    return (
      <div className="card animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-100 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900">Blocked Executions</h2>
        {data.length > 0 && (
          <span className="px-2.5 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-800">
            {data.length} blocked
          </span>
        )}
      </div>

      {data.length === 0 ? (
        <div className="text-center py-8">
          <svg
            className="mx-auto h-12 w-12 text-green-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="mt-2 text-gray-500">No blocked executions</p>
          <p className="text-sm text-gray-400">All requests are processing normally.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.map((item) => (
            <div
              key={item.id}
              className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`px-2 py-0.5 text-xs font-medium rounded border ${getReasonBadgeColor(
                        item.reason
                      )}`}
                    >
                      {getReasonLabel(item.reason)}
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatTimestamp(item.timestamp)}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {item.endpoint}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    {item.details || getReasonDescription(item.reason)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {data.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
            <h4 className="text-sm font-medium text-blue-800 mb-1">
              Why was this blocked?
            </h4>
            <p className="text-xs text-blue-700">
              Requests may be blocked due to quota limits, rate limiting, or permission issues.
              Review the reason above and take appropriate action. For quota issues, consider
              upgrading your plan. For rate limits, implement backoff strategies in your code.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
