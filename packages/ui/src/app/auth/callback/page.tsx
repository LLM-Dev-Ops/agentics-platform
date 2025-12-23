'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const supabase = getSupabase();
        const { error } = await supabase.auth.exchangeCodeForSession(
          window.location.href
        );

        if (error) {
          console.error('Auth callback error:', error);
          router.push('/login?error=callback_failed');
          return;
        }

        router.push('/dashboard/keys');
      } catch (err) {
        console.error('Auth callback error:', err);
        router.push('/login?error=callback_failed');
      }
    };

    handleCallback();
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Completing sign in...</p>
      </div>
    </div>
  );
}
