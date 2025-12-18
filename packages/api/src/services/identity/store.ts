/**
 * Identity Store - In-Memory Implementation for MVP
 *
 * This is a simple in-memory store for identity data.
 * In production, this would be replaced with a database implementation.
 */

export interface User {
  id: string;
  email: string;
  name?: string;
  createdAt: Date;
  updatedAt: Date;
  oauthProviders?: {
    provider: string;
    providerId: string;
    email: string;
  }[];
}

export interface ApiKey {
  id: string;
  userId: string;
  name: string;
  keyHash: string;
  scopes: string[];
  expiresAt?: Date;
  createdAt: Date;
  lastUsedAt?: Date;
  revoked: boolean;
}

export interface IdentityStoreInterface {
  // User operations
  storeUser(user: User): Promise<void>;
  lookupUser(email: string): Promise<User | null>;
  lookupUserById(userId: string): Promise<User | null>;
  updateUser(userId: string, updates: Partial<User>): Promise<void>;
  getAllUsers(): Promise<User[]>;

  // API Key operations
  storeApiKey(apiKey: ApiKey): Promise<void>;
  lookupApiKey(keyHash: string): Promise<ApiKey | null>;
  lookupApiKeyById(userId: string, keyId: string): Promise<ApiKey | null>;
  listApiKeys(userId: string): Promise<ApiKey[]>;
  listAllApiKeys(userId: string): Promise<ApiKey[]>; // Includes revoked keys
  updateApiKey(userId: string, keyId: string, updates: Partial<ApiKey>): Promise<void>;
}

export class InMemoryIdentityStore implements IdentityStoreInterface {
  private users: Map<string, User> = new Map();
  private usersByEmail: Map<string, string> = new Map(); // email -> userId
  private apiKeys: Map<string, ApiKey> = new Map(); // keyHash -> ApiKey
  private apiKeysById: Map<string, Map<string, ApiKey>> = new Map(); // userId -> keyId -> ApiKey

  async storeUser(user: User): Promise<void> {
    this.users.set(user.id, user);
    this.usersByEmail.set(user.email.toLowerCase(), user.id);
  }

  async lookupUser(email: string): Promise<User | null> {
    const userId = this.usersByEmail.get(email.toLowerCase());
    if (!userId) return null;
    return this.users.get(userId) || null;
  }

  async lookupUserById(userId: string): Promise<User | null> {
    return this.users.get(userId) || null;
  }

  async updateUser(userId: string, updates: Partial<User>): Promise<void> {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const updatedUser = { ...user, ...updates, updatedAt: new Date() };

    // If email changed, update the email index
    if (updates.email && updates.email !== user.email) {
      this.usersByEmail.delete(user.email.toLowerCase());
      this.usersByEmail.set(updates.email.toLowerCase(), userId);
    }

    this.users.set(userId, updatedUser);
  }

  async storeApiKey(apiKey: ApiKey): Promise<void> {
    // Store by hash for lookup during authentication
    this.apiKeys.set(apiKey.keyHash, apiKey);

    // Store by userId and keyId for management operations
    if (!this.apiKeysById.has(apiKey.userId)) {
      this.apiKeysById.set(apiKey.userId, new Map());
    }
    this.apiKeysById.get(apiKey.userId)!.set(apiKey.id, apiKey);
  }

  async lookupApiKey(keyHash: string): Promise<ApiKey | null> {
    return this.apiKeys.get(keyHash) || null;
  }

  async lookupApiKeyById(userId: string, keyId: string): Promise<ApiKey | null> {
    const userKeys = this.apiKeysById.get(userId);
    if (!userKeys) return null;
    return userKeys.get(keyId) || null;
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async listApiKeys(userId: string): Promise<ApiKey[]> {
    const userKeys = this.apiKeysById.get(userId);
    if (!userKeys) return [];
    return Array.from(userKeys.values()).filter(key => !key.revoked);
  }

  async listAllApiKeys(userId: string): Promise<ApiKey[]> {
    const userKeys = this.apiKeysById.get(userId);
    if (!userKeys) return [];
    return Array.from(userKeys.values());
  }

  async updateApiKey(userId: string, keyId: string, updates: Partial<ApiKey>): Promise<void> {
    const apiKey = await this.lookupApiKeyById(userId, keyId);
    if (!apiKey) {
      throw new Error('API key not found');
    }

    const updatedKey = { ...apiKey, ...updates };

    // Update both indexes
    this.apiKeys.set(apiKey.keyHash, updatedKey);
    this.apiKeysById.get(userId)!.set(keyId, updatedKey);
  }

  // Helper method to clear all data (useful for testing)
  async clear(): Promise<void> {
    this.users.clear();
    this.usersByEmail.clear();
    this.apiKeys.clear();
    this.apiKeysById.clear();
  }
}
