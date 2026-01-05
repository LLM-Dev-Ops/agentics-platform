'use client';

/**
 * AuthGate Component
 *
 * Blocks ALL rendering until Supabase auth state is fully resolved.
 * Consumes auth state from SupabaseAuthProvider - single source of truth.
 *
 * Three states:
 * - initializing: Auth state unknown, render nothing (loading screen)
 * - authenticated: User has valid session, render children
 * - unauthenticated: No session, redirect to login
 */

import { useEffect, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSupabaseAuth } from '@/lib/supabase-auth';

// Routes that don't require authentication
// /cli/auth needs to be public so unauthenticated users can see the login form
// before being redirected - the page handles its own auth flow
const PUBLIC_ROUTES = ['/login', '/auth/callback', '/cli/auth'];

interface AuthGateProps {
  children: ReactNode;
}

export function AuthGate({ children }: AuthGateProps) {
  const { session, isAuthReady, isAuthenticated } = useSupabaseAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Derive auth state from provider
  const authState = !isAuthReady
    ? 'initializing'
    : isAuthenticated
      ? 'authenticated'
      : 'unauthenticated';

  // Check if current route is public
  const isPublicRoute = PUBLIC_ROUTES.some(route => pathname?.startsWith(route));

  // Handle redirects based on auth state
  useEffect(() => {
    if (authState === 'initializing') return;

    if (authState === 'unauthenticated' && !isPublicRoute) {
      router.push('/login');
    }

    if (authState === 'authenticated' && pathname === '/login') {
      router.push('/dashboard/keys');
    }
  }, [authState, isPublicRoute, pathname, router]);

  // CRITICAL: Block ALL rendering while initializing
  if (authState === 'initializing') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Allow public routes regardless of auth state
  if (isPublicRoute) {
    return <>{children}</>;
  }

  // For protected routes, only render if authenticated with valid token
  if (authState === 'authenticated' && session?.access_token) {
    return <>{children}</>;
  }

  // Unauthenticated on protected route - render nothing (redirect is happening)
  return null;
}

export default AuthGate;
