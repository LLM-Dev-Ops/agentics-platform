/**
 * Identity Service
 *
 * Main service class that orchestrates authentication and identity management.
 * This is one of the few services that Layer 4 owns - it does NOT route to Layer 3.
 */

import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';
import { InMemoryIdentityStore, type User } from './store.js';
import { ApiKeyService } from './api-keys.js';
import { TokenService } from './tokens.js';
import { OAuthService, type OAuthConfig } from './oauth.js';

const BCRYPT_ROUNDS = 10;

export interface AuthenticateRequest {
  email: string;
  password?: string;
  apiKey?: string;
}

export interface AuthenticateResponse {
  user: {
    id: string;
    email: string;
    name?: string;
  };
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface WhoamiResponse {
  user: {
    id: string;
    email: string;
    name?: string;
  };
  scopes: string[];
  authMethod: 'token' | 'apiKey';
}

export interface CreateUserRequest {
  email: string;
  password: string;
  name?: string;
}

/**
 * Identity Service
 *
 * Manages all authentication and identity operations for the platform.
 */
export class IdentityService {
  private store: InMemoryIdentityStore;
  private apiKeyService: ApiKeyService;
  private tokenService: TokenService;
  private oauthService: OAuthService;

  constructor(oauthConfig?: Partial<OAuthConfig>) {
    this.store = new InMemoryIdentityStore();
    this.apiKeyService = new ApiKeyService(this.store);
    this.tokenService = new TokenService();
    this.oauthService = new OAuthService(this.store, oauthConfig);
  }

  /**
   * Authenticate a user with email/password or API key
   */
  async authenticate(request: AuthenticateRequest): Promise<AuthenticateResponse> {
    let user: User;

    if (request.apiKey) {
      // Authenticate with API key
      const result = await this.apiKeyService.lookupApiKey(request.apiKey);
      user = result.user;
    } else if (request.email && request.password) {
      // Authenticate with email/password
      user = await this.authenticateWithPassword(request.email, request.password);
    } else {
      throw new Error('Either apiKey or email/password must be provided');
    }

    // Issue tokens
    const scopes = ['api:read', 'api:write']; // Default scopes
    const tokenPair = this.tokenService.issueTokenPair(user.id, user.email, scopes);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      accessToken: tokenPair.accessToken,
      refreshToken: tokenPair.refreshToken,
      expiresIn: tokenPair.expiresIn,
    };
  }

  /**
   * Authenticate with email and password
   */
  private async authenticateWithPassword(email: string, password: string): Promise<User> {
    const user = await this.store.lookupUser(email);
    if (!user) {
      throw new Error('Invalid credentials');
    }

    // For MVP, we'll store password hash in a user property
    // In production, this would be in a separate secure table
    const passwordHash = (user as any).passwordHash;
    if (!passwordHash) {
      throw new Error('Password authentication not configured for this user');
    }

    const valid = await bcrypt.compare(password, passwordHash);
    if (!valid) {
      throw new Error('Invalid credentials');
    }

    return user;
  }

  /**
   * Validate an API key and return user identity
   */
  async validateApiKey(apiKey: string): Promise<{ user: User; scopes: string[] }> {
    const result = await this.apiKeyService.lookupApiKey(apiKey);
    return {
      user: result.user,
      scopes: result.apiKey.scopes,
    };
  }

  /**
   * Validate a JWT token and return user identity
   */
  async validateToken(token: string): Promise<{ user: User; scopes: string[] }> {
    const result = this.tokenService.verifyToken(token);

    if (!result.valid || !result.claims) {
      throw new Error(result.error || 'Invalid token');
    }

    const user = await this.store.lookupUserById(result.claims.sub);
    if (!user) {
      throw new Error('User not found');
    }

    return {
      user,
      scopes: result.claims.scopes,
    };
  }

  /**
   * Get current user identity from token or API key
   */
  async whoami(authHeader: string): Promise<WhoamiResponse> {
    // Parse authorization header
    const parts = authHeader.split(' ');
    if (parts.length !== 2) {
      throw new Error('Invalid authorization header');
    }

    const [scheme, credentials] = parts;

    if (scheme.toLowerCase() === 'bearer') {
      // JWT token
      const { user, scopes } = await this.validateToken(credentials);
      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
        scopes,
        authMethod: 'token',
      };
    } else if (scheme.toLowerCase() === 'apikey') {
      // API key
      const { user, scopes } = await this.validateApiKey(credentials);
      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
        scopes,
        authMethod: 'apiKey',
      };
    } else {
      throw new Error('Unsupported authorization scheme');
    }
  }

  /**
   * Create a new user account
   */
  async createUser(request: CreateUserRequest): Promise<User> {
    // Check if user already exists
    const existing = await this.store.lookupUser(request.email);
    if (existing) {
      throw new Error('User already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(request.password, BCRYPT_ROUNDS);

    // Create user
    const user: User & { passwordHash?: string } = {
      id: uuidv4(),
      email: request.email,
      name: request.name,
      createdAt: new Date(),
      updatedAt: new Date(),
      passwordHash,
    };

    await this.store.storeUser(user);

    // Remove password hash from response
    const { passwordHash: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * Refresh an access token
   */
  async refreshToken(refreshToken: string): Promise<AuthenticateResponse> {
    const tokenPair = this.tokenService.refreshToken(refreshToken);
    if (!tokenPair) {
      throw new Error('Invalid refresh token');
    }

    // Get user from token
    const result = this.tokenService.verifyToken(tokenPair.accessToken);
    if (!result.valid || !result.claims) {
      throw new Error('Failed to issue new token');
    }

    const user = await this.store.lookupUserById(result.claims.sub);
    if (!user) {
      throw new Error('User not found');
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      accessToken: tokenPair.accessToken,
      refreshToken: tokenPair.refreshToken,
      expiresIn: tokenPair.expiresIn,
    };
  }

  /**
   * Get API key service for key management operations
   */
  getApiKeyService(): ApiKeyService {
    return this.apiKeyService;
  }

  /**
   * Get OAuth service for OAuth operations
   */
  getOAuthService(): OAuthService {
    return this.oauthService;
  }

  /**
   * Get token service for token operations
   */
  getTokenService(): TokenService {
    return this.tokenService;
  }
}

// Export types and services
export * from './store.js';
export * from './api-keys.js';
export * from './tokens.js';
export * from './oauth.js';
