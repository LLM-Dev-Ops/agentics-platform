/**
 * ADR-012 — Server-side Supabase client for Next.js App Router.
 *
 * Used by server routes (e.g. the SSE proxy) to read the Supabase
 * session from cookies without exposing service-role keys or the
 * user's JWT to the browser bundle.
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { SupabaseClient } from '@supabase/supabase-js';

export function getServerSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!url || !anon) {
    throw new Error('Supabase is not configured on the server.');
  }
  const cookieStore = cookies();
  return createServerClient(url, anon, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      // Route handlers are read-only for the SSE proxy; no-op setters
      // avoid accidentally mutating cookies on a long-lived stream.
      set() {},
      remove() {},
    },
  });
}

export async function getServerAccessToken(): Promise<string | null> {
  try {
    const supabase = getServerSupabase();
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}
