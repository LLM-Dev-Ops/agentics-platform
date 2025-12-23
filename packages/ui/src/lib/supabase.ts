/**
 * Supabase Client
 *
 * Client-side Supabase instance for authentication.
 * Used ONLY for human login - NOT for API access.
 */

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Create a singleton client, handling the case where env vars are not set
let supabaseClient: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!supabaseClient && supabaseUrl && supabaseAnonKey) {
    supabaseClient = createBrowserClient(supabaseUrl, supabaseAnonKey);
  }
  if (!supabaseClient) {
    throw new Error('Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  }
  return supabaseClient;
}

// For backwards compatibility - lazy initialization
export const supabase = {
  get auth() {
    return getSupabase().auth;
  },
};
