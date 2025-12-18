/**
 * Token Service
 *
 * Manages JWT token issuance, verification, and refresh.
 * Uses RS256 (RSA Signature with SHA-256) for signing.
 */

import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const TOKEN_EXPIRATION = '24h';
const REFRESH_TOKEN_EXPIRATION = '7d';

export interface TokenClaims {
  sub: string; // User ID
  email: string;
  scopes: string[];
  exp?: number;
  iat?: number;
  type?: 'access' | 'refresh';
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface VerifyResult {
  valid: boolean;
  claims?: TokenClaims;
  error?: string;
}

export class TokenService {
  private privateKey: string;
  private publicKey: string;

  constructor() {
    // Generate RSA key pair for MVP
    // In production, these would be loaded from secure storage/environment
    const { privateKey, publicKey } = this.generateKeyPair();
    this.privateKey = privateKey;
    this.publicKey = publicKey;
  }

  /**
   * Generate an RSA key pair for signing tokens
   * In production, use pre-generated keys from secure storage
   */
  private generateKeyPair(): { privateKey: string; publicKey: string } {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem',
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem',
      },
    });

    return { privateKey, publicKey };
  }

  /**
   * Issue a new access token for a user
   */
  issueToken(userId: string, email: string, scopes: string[]): string {
    const payload: TokenClaims = {
      sub: userId,
      email,
      scopes,
      type: 'access',
    };

    return jwt.sign(payload, this.privateKey, {
      algorithm: 'RS256',
      expiresIn: TOKEN_EXPIRATION,
    });
  }

  /**
   * Issue a refresh token for a user
   */
  private issueRefreshToken(userId: string, email: string, scopes: string[]): string {
    const payload: TokenClaims = {
      sub: userId,
      email,
      scopes,
      type: 'refresh',
    };

    return jwt.sign(payload, this.privateKey, {
      algorithm: 'RS256',
      expiresIn: REFRESH_TOKEN_EXPIRATION,
    });
  }

  /**
   * Issue both access and refresh tokens
   */
  issueTokenPair(userId: string, email: string, scopes: string[]): TokenPair {
    const accessToken = this.issueToken(userId, email, scopes);
    const refreshToken = this.issueRefreshToken(userId, email, scopes);

    return {
      accessToken,
      refreshToken,
      expiresIn: 24 * 60 * 60, // 24 hours in seconds
    };
  }

  /**
   * Verify a token and return its claims
   */
  verifyToken(token: string): VerifyResult {
    try {
      const claims = jwt.verify(token, this.publicKey, {
        algorithms: ['RS256'],
      }) as TokenClaims;

      return {
        valid: true,
        claims,
      };
    } catch (error) {
      let errorMessage = 'Invalid token';

      if (error instanceof jwt.TokenExpiredError) {
        errorMessage = 'Token has expired';
      } else if (error instanceof jwt.JsonWebTokenError) {
        errorMessage = 'Invalid token signature';
      } else if (error instanceof jwt.NotBeforeError) {
        errorMessage = 'Token not yet valid';
      }

      return {
        valid: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Refresh an access token using a valid refresh token
   */
  refreshToken(refreshToken: string): TokenPair | null {
    const result = this.verifyToken(refreshToken);

    if (!result.valid || !result.claims) {
      return null;
    }

    // Ensure it's a refresh token
    if (result.claims.type !== 'refresh') {
      return null;
    }

    // Issue new token pair
    return this.issueTokenPair(
      result.claims.sub,
      result.claims.email,
      result.claims.scopes
    );
  }

  /**
   * Decode a token without verifying (useful for debugging)
   */
  decodeToken(token: string): TokenClaims | null {
    try {
      return jwt.decode(token) as TokenClaims;
    } catch {
      return null;
    }
  }

  /**
   * Get the public key for external verification
   */
  getPublicKey(): string {
    return this.publicKey;
  }

  /**
   * Set keys from external source (for production use)
   */
  setKeys(privateKey: string, publicKey: string): void {
    this.privateKey = privateKey;
    this.publicKey = publicKey;
  }
}
