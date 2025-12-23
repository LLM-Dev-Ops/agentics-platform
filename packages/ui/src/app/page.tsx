'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Home Page
 *
 * Protected by AuthGate - only renders when authenticated.
 * Redirects to the dashboard.
 */
export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/keys');
  }, [router]);

  return (
    <div className="flex items-center justify-center py-12">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
    </div>
  );
}
