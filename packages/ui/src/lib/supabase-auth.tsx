'use client';

/**
 * Supabase Authentication Context
 *
 * Manages human authentication via Supabase Auth.
 * This is ONLY for UI login - API keys remain the sole machine auth mechanism.
 */

import { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Session, User, AuthChangeEvent } from '@supabase/supabase-js';

interface OrgInfo {
  user_id: string;
  org_id: string;
}

interface SupabaseAuthContextType {
  user: User | null;
  session: Session | null;
  orgInfo: OrgInfo | null;
  isLoading: boolean;
  isAuthReady: boolean; // True when auth AND org info are loaded
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGitHub: () => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const SupabaseAuthContext = createContext<SupabaseAuthContextType | undefined>(undefined);

// Lazy load Supabase client to avoid build-time errors
async function getSupabaseClient() {
  const { getSupabase } = await import('./supabase');
  return getSupabase();
}

export function SupabaseAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [orgInfo, setOrgInfo] = useState<OrgInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const router = useRouter();

  // Track initialization to prevent duplicate calls
  const initRef = useRef(false);
  const orgInfoLoadedForUserRef = useRef<string | null>(null);

  // Load user and org info on mount
  useEffect(() => {
    // Prevent double initialization in React Strict Mode
    if (initRef.current) return;
    initRef.current = true;

    let subscription: { unsubscribe: () => void } | null = null;
    let isMounted = true;

    const loadOrgInfo = async (accessToken: string, userId: string) => {
      // Skip if already loaded for this user
      if (orgInfoLoadedForUserRef.current === userId) {
        return;
      }

      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        console.log('[supabase-auth] loadOrgInfo called');
        console.log('[supabase-auth] apiUrl:', apiUrl);
        console.log('[supabase-auth] accessToken length:', accessToken?.length);
        console.log('[supabase-auth] userId:', userId);

        const response = await fetch(`${apiUrl}/v1/me`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });
        console.log('[supabase-auth] /v1/me response status:', response.status);

        if (!isMounted) return;

        if (response.ok) {
          const data = await response.json();
          setOrgInfo(data);
          orgInfoLoadedForUserRef.current = userId;
        } else {
          console.error('Failed to load org info:', response.status, response.statusText);
        }
      } catch (error) {
        if (!isMounted) return;
        console.error('Failed to load org info:', error);
      }
    };

    const initAuth = async () => {
      try {
        const supabase = await getSupabaseClient();

        // Get initial session
        const { data: { session: initialSession } } = await supabase.auth.getSession();

        if (!isMounted) return;

        setSession(initialSession);
        setUser(initialSession?.user ?? null);

        // Load org info for initial session
        if (initialSession?.access_token && initialSession.user) {
          await loadOrgInfo(initialSession.access_token, initialSession.user.id);
        }

        if (isMounted) {
          setIsLoading(false);
          setIsAuthReady(true);
        }

        // Listen for auth changes (sign in, sign out, token refresh)
        const { data } = supabase.auth.onAuthStateChange(
          async (event: AuthChangeEvent, newSession: Session | null) => {
            if (!isMounted) return;

            setSession(newSession);
            setUser(newSession?.user ?? null);

            // Only load org info on actual sign in, not token refresh
            if (event === 'SIGNED_IN' && newSession?.access_token && newSession.user) {
              // Reset the loaded user ref on new sign in
              orgInfoLoadedForUserRef.current = null;
              await loadOrgInfo(newSession.access_token, newSession.user.id);
            }

            if (event === 'SIGNED_OUT') {
              setOrgInfo(null);
              orgInfoLoadedForUserRef.current = null;
              router.push('/login');
            }
          }
        );
        subscription = data.subscription;
      } catch (error) {
        console.error('Supabase not configured:', error);
        if (isMounted) {
          setIsLoading(false);
          setIsAuthReady(true);
        }
      }
    };

    initAuth();

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, [router]);

  const signIn = async (email: string, password: string) => {
    const supabase = await getSupabaseClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw error;
    }
  };

  const signInWithGitHub = async () => {
    const supabase = await getSupabaseClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      throw error;
    }
  };

  const signUp = async (email: string, password: string) => {
    const supabase = await getSupabaseClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      throw error;
    }
  };

  const signOut = async () => {
    const supabase = await getSupabaseClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw error;
    }
    setOrgInfo(null);
  };

  return (
    <SupabaseAuthContext.Provider
      value={{
        user,
        session,
        orgInfo,
        isLoading,
        isAuthReady,
        isAuthenticated: !!user,
        signIn,
        signInWithGitHub,
        signUp,
        signOut,
      }}
    >
      {children}
    </SupabaseAuthContext.Provider>
  );
}

export function useSupabaseAuth() {
  const context = useContext(SupabaseAuthContext);
  if (context === undefined) {
    throw new Error('useSupabaseAuth must be used within a SupabaseAuthProvider');
  }
  return context;
}

/**
 * Protected Route Wrapper
 * Redirects to login if user is not authenticated
 * Waits for auth to be fully ready before redirecting
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isAuthReady } = useSupabaseAuth();
  const router = useRouter();

  useEffect(() => {
    // Only redirect after auth is fully ready
    if (isAuthReady && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isAuthReady, router]);

  // Show loading while auth is initializing
  if (!isAuthReady) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
