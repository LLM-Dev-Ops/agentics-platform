'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Redirect to new dashboard location
export default function ApiKeysRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/keys');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
    </div>
  );
}
