'use client';

/**
 * CLI Authentication Page
 *
 * This page handles browser-based authentication for CLI tools.
 * It mirrors the Claude.ai and GitHub CLI authentication experience:
 *
 * 1. CLI opens this page with ?code=<session_code>
 * 2. User authenticates with Supabase (if not already logged in)
 * 3. User reviews CLI details and approves access
 * 4. Platform generates an API key bound to user/org
 * 5. CLI polls and receives the key
 *
 * The user never needs to copy-paste the key - it's securely transmitted to CLI.
 */

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSupabaseAuth } from '@/lib/supabase-auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface CliSessionInfo {
  session_code: string;
  cli_name: string;
  cli_version?: string;
  hostname?: string;
  ip_address?: string;
  requested_scopes: string[];
  created_at: string;
  expires_at: string;
}

type PageState = 'loading' | 'session-not-found' | 'session-expired' | 'unauthenticated' | 'review' | 'authorizing' | 'success' | 'error' | 'cancelled';

export default function CliAuthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionCode = searchParams.get('code');

  const { session, isAuthenticated, isAuthReady, signIn, signInWithGitHub, signUp } = useSupabaseAuth();
  const hasFetchedRef = useRef(false);

  const [pageState, setPageState] = useState<PageState>('loading');
  const [sessionInfo, setSessionInfo] = useState<CliSessionInfo | null>(null);
  const [error, setError] = useState<string>('');
  const [keyName, setKeyName] = useState('');

  // Login form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  // Fetch session info when page loads
  useEffect(() => {
    if (!sessionCode) {
      setPageState('session-not-found');
      return;
    }

    if (!isAuthReady) {
      return;
    }

    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;

    const fetchSession = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/v1/cli/auth/sessions/verify/${sessionCode}`);

        if (!response.ok) {
          const errorData = await response.json();

          if (errorData.code === 'SESSION_NOT_FOUND') {
            setPageState('session-not-found');
            return;
          }

          if (errorData.code === 'SESSION_EXPIRED') {
            setPageState('session-expired');
            return;
          }

          throw new Error(errorData.error || 'Failed to verify session');
        }

        const data = await response.json() as CliSessionInfo;
        setSessionInfo(data);
        setKeyName(`CLI Key - ${data.cli_name} (${new Date().toLocaleDateString()})`);

        if (isAuthenticated) {
          setPageState('review');
        } else {
          setPageState('unauthenticated');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load session');
        setPageState('error');
      }
    };

    fetchSession();
  }, [sessionCode, isAuthReady, isAuthenticated]);

  // Handle login form submission
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    try {
      if (isSignUp) {
        await signUp(email, password);
        setAuthError('Check your email for a confirmation link.');
        setAuthLoading(false);
        return;
      }

      await signIn(email, password);
      // After login, the useEffect will detect isAuthenticated and update state
      hasFetchedRef.current = false; // Reset to refetch after auth
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGitHubLogin = async () => {
    setAuthError('');
    try {
      // Store the session code in localStorage so we can return to it after OAuth
      if (sessionCode) {
        localStorage.setItem('cli_auth_code', sessionCode);
      }
      await signInWithGitHub();
    } catch (err: any) {
      setAuthError(err.message || 'GitHub login failed');
    }
  };

  // Check for stored session code after OAuth redirect
  useEffect(() => {
    if (isAuthenticated && !sessionCode) {
      const storedCode = localStorage.getItem('cli_auth_code');
      if (storedCode) {
        localStorage.removeItem('cli_auth_code');
        router.push(`/cli/auth?code=${storedCode}`);
      }
    }
  }, [isAuthenticated, sessionCode, router]);

  // Authorize the CLI session
  const handleAuthorize = async () => {
    if (!sessionCode || !session?.access_token) return;

    setPageState('authorizing');

    try {
      const response = await fetch(`${API_BASE_URL}/v1/cli/auth/sessions/${sessionCode}/authorize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          key_name: keyName || `CLI Key (${new Date().toLocaleDateString()})`,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Authorization failed');
      }

      setPageState('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authorization failed');
      setPageState('error');
    }
  };

  // Cancel the CLI session
  const handleCancel = async () => {
    if (!sessionCode) return;

    try {
      await fetch(`${API_BASE_URL}/v1/cli/auth/sessions/${sessionCode}/cancel`, {
        method: 'POST',
      });
    } catch {
      // Ignore cancel errors
    }

    setPageState('cancelled');
  };

  // Format scopes for display
  const formatScope = (scope: string) => {
    const scopeLabels: Record<string, string> = {
      'platform:read': 'Read platform data',
      'platform:write': 'Write platform data',
      'admin': 'Full administrative access',
      'identity:read': 'Read identity info',
      'identity:write': 'Manage identity',
      'intelligence:read': 'Use AI services',
      'intelligence:write': 'Manage AI models',
    };
    return scopeLabels[scope] || scope;
  };

  // Calculate time remaining
  const getTimeRemaining = () => {
    if (!sessionInfo) return '';
    const expiresAt = new Date(sessionInfo.expires_at);
    const now = new Date();
    const diffMs = expiresAt.getTime() - now.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins <= 0) return 'Expired';
    return `${diffMins} minute${diffMins === 1 ? '' : 's'}`;
  };

  // Render login form
  const renderLoginForm = () => (
    <div className="space-y-4">
      <form onSubmit={handleLoginSubmit} className="space-y-4">
        {authError && (
          <div className={`p-3 rounded-md ${authError.includes('Check your email') ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <p className={`text-sm ${authError.includes('Check your email') ? 'text-green-800' : 'text-red-800'}`}>{authError}</p>
          </div>
        )}

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
            placeholder="you@example.com"
            required
            disabled={authLoading}
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
            placeholder="Enter your password"
            required
            disabled={authLoading}
            minLength={6}
          />
        </div>

        <button
          type="submit"
          className="btn btn-primary w-full"
          disabled={authLoading}
        >
          {authLoading ? 'Loading...' : isSignUp ? 'Create Account' : 'Sign in'}
        </button>
      </form>

      <div className="text-center">
        <button
          onClick={() => setIsSignUp(!isSignUp)}
          className="text-sm text-primary-600 hover:text-primary-800"
        >
          {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
        </button>
      </div>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-300"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-white text-gray-500">Or</span>
        </div>
      </div>

      <button
        onClick={handleGitHubLogin}
        className="btn btn-secondary w-full flex items-center justify-center"
        disabled={authLoading}
      >
        <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
          <path
            fillRule="evenodd"
            d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
            clipRule="evenodd"
          />
        </svg>
        GitHub
      </button>
    </div>
  );

  // Render based on page state
  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] p-4">
      <div className="card w-full max-w-md">
        {/* Loading */}
        {pageState === 'loading' && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading authentication session...</p>
          </div>
        )}

        {/* Session not found */}
        {pageState === 'session-not-found' && (
          <div className="text-center py-8">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
              <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="mt-4 text-xl font-semibold text-gray-900">Session Not Found</h2>
            <p className="mt-2 text-gray-600">
              This authentication link is invalid or has already been used.
            </p>
            <p className="mt-4 text-sm text-gray-500">
              Please run <code className="bg-gray-100 px-1.5 py-0.5 rounded">agentics login</code> again in your terminal.
            </p>
          </div>
        )}

        {/* Session expired */}
        {pageState === 'session-expired' && (
          <div className="text-center py-8">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100">
              <svg className="h-6 w-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="mt-4 text-xl font-semibold text-gray-900">Session Expired</h2>
            <p className="mt-2 text-gray-600">
              This authentication session has expired.
            </p>
            <p className="mt-4 text-sm text-gray-500">
              Please run <code className="bg-gray-100 px-1.5 py-0.5 rounded">agentics login</code> again in your terminal.
            </p>
          </div>
        )}

        {/* Unauthenticated - show login form */}
        {pageState === 'unauthenticated' && sessionInfo && (
          <>
            <div className="text-center mb-6">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100">
                <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="mt-4 text-xl font-semibold text-gray-900">Authenticate CLI</h2>
              <p className="mt-2 text-gray-600">
                Sign in to authorize <strong>{sessionInfo.cli_name}</strong>
              </p>
              <p className="mt-1 text-sm text-gray-500">
                Session expires in {getTimeRemaining()}
              </p>
            </div>
            {renderLoginForm()}
            <div className="mt-4 text-center">
              <button
                onClick={handleCancel}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
            </div>
          </>
        )}

        {/* Review - authenticated, ready to approve */}
        {pageState === 'review' && sessionInfo && (
          <>
            <div className="text-center mb-6">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100">
                <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h2 className="mt-4 text-xl font-semibold text-gray-900">Authorize CLI Access</h2>
              <p className="mt-2 text-gray-600">
                <strong>{sessionInfo.cli_name}</strong> is requesting access to your account
              </p>
            </div>

            {/* CLI Details */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Request Details</h3>
              <div className="space-y-2 text-sm">
                {sessionInfo.hostname && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Device:</span>
                    <span className="text-gray-900 font-mono">{sessionInfo.hostname}</span>
                  </div>
                )}
                {sessionInfo.cli_version && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Version:</span>
                    <span className="text-gray-900">{sessionInfo.cli_version}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">Session Code:</span>
                  <span className="text-gray-900 font-mono">{sessionInfo.session_code}</span>
                </div>
              </div>
            </div>

            {/* Requested Permissions */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Requested Permissions</h3>
              <ul className="space-y-2">
                {sessionInfo.requested_scopes.map((scope) => (
                  <li key={scope} className="flex items-center text-sm text-gray-600">
                    <svg className="h-4 w-4 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {formatScope(scope)}
                  </li>
                ))}
              </ul>
            </div>

            {/* API Key Name */}
            <div className="mb-6">
              <label htmlFor="keyName" className="block text-sm font-medium text-gray-700 mb-1">
                API Key Name
              </label>
              <input
                id="keyName"
                type="text"
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
                className="input"
                placeholder="Enter a name for this API key"
              />
            </div>

            {/* Security Notice */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-6">
              <div className="flex">
                <svg className="h-5 w-5 text-yellow-600 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="text-sm text-yellow-800">
                  <p className="font-medium">Security Notice</p>
                  <p className="mt-1">
                    Only authorize if you initiated this request from your terminal.
                    The API key will be securely transmitted to your CLI.
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleCancel}
                className="btn btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleAuthorize}
                className="btn btn-primary flex-1"
              >
                Authorize
              </button>
            </div>
          </>
        )}

        {/* Authorizing */}
        {pageState === 'authorizing' && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Generating API key...</p>
          </div>
        )}

        {/* Success */}
        {pageState === 'success' && (
          <div className="text-center py-8">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
              <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="mt-4 text-xl font-semibold text-gray-900">CLI Authorized!</h2>
            <p className="mt-2 text-gray-600">
              Your CLI has been successfully authenticated.
            </p>
            <p className="mt-4 text-sm text-gray-500">
              You can close this window and return to your terminal.
            </p>
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">
                Your API key has been securely sent to your CLI.
                It will be stored at <code className="bg-gray-200 px-1.5 py-0.5 rounded">~/.agentics/credentials.json</code>
              </p>
            </div>
          </div>
        )}

        {/* Cancelled */}
        {pageState === 'cancelled' && (
          <div className="text-center py-8">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-gray-100">
              <svg className="h-6 w-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="mt-4 text-xl font-semibold text-gray-900">Authorization Cancelled</h2>
            <p className="mt-2 text-gray-600">
              The CLI authentication request was cancelled.
            </p>
            <p className="mt-4 text-sm text-gray-500">
              You can close this window. Run <code className="bg-gray-100 px-1.5 py-0.5 rounded">agentics login</code> again if you want to try again.
            </p>
          </div>
        )}

        {/* Error */}
        {pageState === 'error' && (
          <div className="text-center py-8">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
              <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="mt-4 text-xl font-semibold text-gray-900">Something Went Wrong</h2>
            <p className="mt-2 text-gray-600">{error}</p>
            <p className="mt-4 text-sm text-gray-500">
              Please run <code className="bg-gray-100 px-1.5 py-0.5 rounded">agentics login</code> again in your terminal.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
