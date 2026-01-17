'use client';

interface UsageFiltersProps {
  period: 'current-month' | 'last-7-days' | 'last-30-days';
  onPeriodChange: (period: 'current-month' | 'last-7-days' | 'last-30-days') => void;
}

export default function UsageFilters({ period, onPeriodChange }: UsageFiltersProps) {
  const periods = [
    { value: 'current-month' as const, label: 'This Month' },
    { value: 'last-7-days' as const, label: 'Last 7 Days' },
    { value: 'last-30-days' as const, label: 'Last 30 Days' },
  ];

  return (
    <div className="flex items-center gap-4 mb-6">
      <span className="text-sm font-medium text-gray-700">Period:</span>
      <div className="inline-flex rounded-md shadow-sm">
        {periods.map((p, index) => (
          <button
            key={p.value}
            onClick={() => onPeriodChange(p.value)}
            className={`px-4 py-2 text-sm font-medium border ${
              period === p.value
                ? 'bg-primary-50 text-primary-700 border-primary-300 z-10'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            } ${
              index === 0
                ? 'rounded-l-md'
                : index === periods.length - 1
                ? 'rounded-r-md border-l-0'
                : 'border-l-0'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
