'use client';

/**
 * Supabase Authentication Context
 *
 * Manages human authentication via Supabase Auth.
 * This is ONLY for UI login - API keys remain the sole machine auth mechanism.
 */

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
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
  const [isConfigured, setIsConfigured] = useState(false);
  const router = useRouter();

  const loadOrgInfo = useCallback(async (accessToken: string) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const response = await fetch(`${apiUrl}/v1/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setOrgInfo(data);
      } else {
        console.error('Failed to load org info:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Failed to load org info:', error);
    }
  }, []);

  // Load user and org info on mount and session change
  useEffect(() => {
    let subscription: { unsubscribe: () => void } | null = null;

    const initAuth = async () => {
      try {
        const supabase = await getSupabaseClient();
        setIsConfigured(true);

        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.access_token) {
          await loadOrgInfo(session.access_token);
        }

        // Listen for auth changes
        const { data } = supabase.auth.onAuthStateChange(
          async (event: AuthChangeEvent, session: Session | null) => {
            setSession(session);
            setUser(session?.user ?? null);

            if (session?.access_token) {
              await loadOrgInfo(session.access_token);
            } else {
              setOrgInfo(null);
            }

            if (event === 'SIGNED_OUT') {
              router.push('/login');
            }
          }
        );
        subscription = data.subscription;
      } catch (error) {
        console.error('Supabase not configured:', error);
        setIsConfigured(false);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();

    return () => {
      subscription?.unsubscribe();
    };
  }, [router, loadOrgInfo]);

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
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useSupabaseAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
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
