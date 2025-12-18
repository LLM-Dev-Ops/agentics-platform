/**
 * API Key Service
 *
 * Manages API key generation, validation, and lifecycle.
 * API keys are in the format: agentics_<base64_random_32_bytes>
 */

import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import type { IdentityStoreInterface, ApiKey, User } from './store.js';

const BCRYPT_ROUNDS = 10;
const API_KEY_PREFIX = 'agentics_';
const API_KEY_BYTES = 32;

export interface CreateApiKeyRequest {
  userId: string;
  name: string;
  scopes: string[];
  expiresAt?: Date;
}

export interface ApiKeyResponse {
  id: string;
  name: string;
  key: string; // Only returned on creation
  scopes: string[];
  createdAt: Date;
  expiresAt?: Date;
}

export interface ApiKeyInfo {
  id: string;
  name: string;
  scopes: string[];
  createdAt: Date;
  expiresAt?: Date;
  lastUsedAt?: Date;
}

export interface LookupResult {
  user: User;
  apiKey: ApiKey;
}

export class ApiKeyService {
  constructor(private store: IdentityStoreInterface) {}

  /**
   * Generate a cryptographically secure random token
   */
  private generateSecureToken(bytes: number): string {
    return crypto.randomBytes(bytes).toString('base64url');
  }

  /**
   * Hash a token value using bcrypt
   */
  private async hashToken(value: string): Promise<string> {
    return bcrypt.hash(value, BCRYPT_ROUNDS);
  }

  /**
   * Verify a token against a hash
   */
  private async verifyToken(value: string, hash: string): Promise<boolean> {
    return bcrypt.compare(value, hash);
  }

  /**
   * Generate a new API key in the format: agentics_<base64_random_32_bytes>
   */
  private generateApiKey(): string {
    const token = this.generateSecureToken(API_KEY_BYTES);
    return `${API_KEY_PREFIX}${token}`;
  }

  /**
   * Create a new API key for a user
   */
  async createApiKey(request: CreateApiKeyRequest): Promise<ApiKeyResponse> {
    // Verify user exists
    const user = await this.store.lookupUserById(request.userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Generate the API key
    const keyValue = this.generateApiKey();
    const keyHash = await this.hashToken(keyValue);

    // Create the API key record
    const apiKey: ApiKey = {
      id: uuidv4(),
      userId: request.userId,
      name: request.name,
      keyHash,
      scopes: request.scopes,
      expiresAt: request.expiresAt,
      createdAt: new Date(),
      revoked: false,
    };

    // Store the API key
    await this.store.storeApiKey(apiKey);

    // Return the response (including the plaintext key - only time it's shown)
    return {
      id: apiKey.id,
      name: apiKey.name,
      key: keyValue,
      scopes: apiKey.scopes,
      createdAt: apiKey.createdAt,
      expiresAt: apiKey.expiresAt,
    };
  }

  /**
   * Revoke an API key
   */
  async revokeApiKey(userId: string, keyId: string): Promise<void> {
    const apiKey = await this.store.lookupApiKeyById(userId, keyId);
    if (!apiKey) {
      throw new Error('API key not found');
    }

    if (apiKey.userId !== userId) {
      throw new Error('Unauthorized');
    }

    await this.store.updateApiKey(userId, keyId, { revoked: true });
  }

  /**
   * List all API keys for a user
   */
  async listApiKeys(userId: string): Promise<ApiKeyInfo[]> {
    const apiKeys = await this.store.listApiKeys(userId);

    return apiKeys.map(key => ({
      id: key.id,
      name: key.name,
      scopes: key.scopes,
      createdAt: key.createdAt,
      expiresAt: key.expiresAt,
      lastUsedAt: key.lastUsedAt,
    }));
  }

  /**
   * Look up and validate an API key
   * Returns the user and API key if valid, throws error if invalid
   */
  async lookupApiKey(keyValue: string): Promise<LookupResult> {
    // Validate format
    if (!keyValue.startsWith(API_KEY_PREFIX)) {
      throw new Error('Invalid API key format');
    }

    // For in-memory store, we need to check all keys
    // In production with a database, we'd hash and lookup directly
    // For now, we'll implement a brute-force approach that works for MVP
    const users = await this.getAllUsers();

    for (const user of users) {
      const apiKeys = await this.store.listApiKeys(user.id);

      for (const apiKey of apiKeys) {
        // Check if this key matches
        const isValid = await this.verifyToken(keyValue, apiKey.keyHash);

        if (isValid) {
          // Check if key is revoked
          if (apiKey.revoked) {
            throw new Error('API key has been revoked');
          }

          // Check if key is expired
          if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
            throw new Error('API key has expired');
          }

          // Update last used timestamp
          await this.store.updateApiKey(user.id, apiKey.id, {
            lastUsedAt: new Date(),
          });

          // Return the lookup result
          return { user, apiKey };
        }
      }
    }

    throw new Error('Invalid API key');
  }

  /**
   * Helper method to get all users (needed for brute-force lookup)
   * In production, this would be handled by the database with proper indexing
   */
  private async getAllUsers(): Promise<User[]> {
    return this.store.getAllUsers();
  }
}
