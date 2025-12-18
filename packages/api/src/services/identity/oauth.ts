/**
 * OAuth Service
 *
 * Manages OAuth authentication flows for external providers.
 * Supports Google and GitHub OAuth (placeholder implementations for MVP).
 */

import { v4 as uuidv4 } from 'uuid';
import type { IdentityStoreInterface, User } from './store.js';

export interface OAuthProvider {
  name: string;
  clientId: string;
  clientSecret: string;
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scopes: string[];
}

export interface OAuthConfig {
  google?: OAuthProvider;
  github?: OAuthProvider;
  redirectUri: string;
}

export interface AuthorizationUrlResult {
  url: string;
  state: string;
}

export interface OAuthUserInfo {
  provider: string;
  providerId: string;
  email: string;
  name?: string;
  avatarUrl?: string;
}

export interface OAuthCallbackResult {
  user: User;
  isNewUser: boolean;
}

export class OAuthService {
  private config: OAuthConfig;
  private pendingStates: Map<string, { provider: string; expiresAt: Date }> = new Map();

  constructor(private store: IdentityStoreInterface, config?: Partial<OAuthConfig>) {
    this.config = {
      redirectUri: config?.redirectUri || 'http://localhost:3000/auth/callback',
      google: config?.google,
      github: config?.github,
    };
  }

  /**
   * Initiate OAuth flow by generating authorization URL
   */
  initiateOAuth(provider: 'google' | 'github'): AuthorizationUrlResult {
    const providerConfig = this.getProviderConfig(provider);
    if (!providerConfig) {
      throw new Error(`OAuth provider ${provider} not configured`);
    }

    // Generate state for CSRF protection
    const state = uuidv4();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store state
    this.pendingStates.set(state, { provider, expiresAt });

    // Build authorization URL
    const params = new URLSearchParams({
      client_id: providerConfig.clientId,
      redirect_uri: this.config.redirectUri,
      scope: providerConfig.scopes.join(' '),
      state,
      response_type: 'code',
    });

    const url = `${providerConfig.authorizationUrl}?${params.toString()}`;

    return { url, state };
  }

  /**
   * Handle OAuth callback after user authorizes
   */
  async handleCallback(
    provider: 'google' | 'github',
    code: string,
    state: string
  ): Promise<OAuthCallbackResult> {
    // Verify state
    const pendingState = this.pendingStates.get(state);
    if (!pendingState) {
      throw new Error('Invalid or expired state');
    }

    if (pendingState.provider !== provider) {
      throw new Error('Provider mismatch');
    }

    if (pendingState.expiresAt < new Date()) {
      this.pendingStates.delete(state);
      throw new Error('State has expired');
    }

    // Clean up state
    this.pendingStates.delete(state);

    // Exchange code for access token
    const accessToken = await this.exchangeCodeForToken(provider, code);

    // Get user info from provider
    const userInfo = await this.getUserInfo(provider, accessToken);

    // Create or link user account
    return this.createOrLinkUser(userInfo);
  }

  /**
   * Exchange authorization code for access token
   * Placeholder implementation for MVP
   */
  private async exchangeCodeForToken(provider: string, code: string): Promise<string> {
    // In production, this would make an HTTP request to the provider's token endpoint
    // For MVP, we'll return a mock token
    console.log(`[OAuth] Exchanging code for token with ${provider}`);
    return `mock_access_token_${provider}_${code}`;
  }

  /**
   * Get user information from OAuth provider
   * Placeholder implementation for MVP
   */
  private async getUserInfo(provider: string, accessToken: string): Promise<OAuthUserInfo> {
    // In production, this would make an HTTP request to the provider's user info endpoint
    // For MVP, we'll return mock data
    console.log(`[OAuth] Getting user info from ${provider} with token ${accessToken}`);

    return {
      provider,
      providerId: `mock_provider_id_${Date.now()}`,
      email: `user@${provider}.example.com`,
      name: `${provider} User`,
      avatarUrl: undefined,
    };
  }

  /**
   * Create a new user or link OAuth account to existing user
   */
  async createOrLinkUser(providerInfo: OAuthUserInfo): Promise<OAuthCallbackResult> {
    // Check if user exists by email
    let user = await this.store.lookupUser(providerInfo.email);
    let isNewUser = false;

    if (!user) {
      // Create new user
      user = {
        id: uuidv4(),
        email: providerInfo.email,
        name: providerInfo.name,
        createdAt: new Date(),
        updatedAt: new Date(),
        oauthProviders: [
          {
            provider: providerInfo.provider,
            providerId: providerInfo.providerId,
            email: providerInfo.email,
          },
        ],
      };

      await this.store.storeUser(user);
      isNewUser = true;
    } else {
      // Link OAuth account to existing user if not already linked
      const existingProvider = user.oauthProviders?.find(
        p => p.provider === providerInfo.provider && p.providerId === providerInfo.providerId
      );

      if (!existingProvider) {
        const oauthProviders = [
          ...(user.oauthProviders || []),
          {
            provider: providerInfo.provider,
            providerId: providerInfo.providerId,
            email: providerInfo.email,
          },
        ];

        await this.store.updateUser(user.id, { oauthProviders });
        user = { ...user, oauthProviders };
      }
    }

    return { user, isNewUser };
  }

  /**
   * Get provider configuration
   */
  private getProviderConfig(provider: 'google' | 'github'): OAuthProvider | undefined {
    return this.config[provider];
  }

  /**
   * Configure a provider
   */
  configureProvider(provider: 'google' | 'github', config: OAuthProvider): void {
    this.config[provider] = config;
  }

  /**
   * Clean up expired states (should be called periodically)
   */
  cleanupExpiredStates(): void {
    const now = new Date();
    for (const [state, data] of this.pendingStates.entries()) {
      if (data.expiresAt < now) {
        this.pendingStates.delete(state);
      }
    }
  }
}
