# Identity Service Implementation

## Overview

The Identity Service has been successfully implemented for the Layer 4 Agentics Platform. This is one of the few services that Layer 4 owns directly - it does NOT route to Layer 3. All identity operations are handled within Layer 4.

## Components Implemented

### 1. Identity Store (`src/services/identity/store.ts`)
- ✅ InMemoryIdentityStore class for MVP
- ✅ User management (store, lookup, update)
- ✅ API key management (store, lookup, list, update)
- ✅ Efficient indexing for fast lookups
- ✅ Interface for future database implementation

### 2. API Key Service (`src/services/identity/api-keys.ts`)
- ✅ ApiKeyService class following SPARC pseudocode
- ✅ API key generation in format: `agentics_<base64_random_32_bytes>`
- ✅ Cryptographically secure token generation (32 bytes)
- ✅ Bcrypt hashing for secure storage
- ✅ createApiKey(userId, name, scopes, expiresAt)
- ✅ revokeApiKey(userId, keyId)
- ✅ listApiKeys(userId)
- ✅ lookupApiKey(keyValue) - validates and returns identity

### 3. Token Service (`src/services/identity/tokens.ts`)
- ✅ TokenService class for JWT operations
- ✅ RS256 (RSA + SHA-256) signing algorithm
- ✅ issueToken(userId, email, scopes)
- ✅ issueTokenPair(userId, email, scopes) - access + refresh tokens
- ✅ verifyToken(token) - validates signature and expiration
- ✅ refreshToken(token) - issues new token if valid
- ✅ Token claims: sub, email, scopes, exp, iat, type
- ✅ 24 hour expiration for access tokens
- ✅ 7 day expiration for refresh tokens

### 4. OAuth Service (`src/services/identity/oauth.ts`)
- ✅ OAuthService class for OAuth providers
- ✅ initiateOAuth(provider) - returns authorization URL with state
- ✅ handleCallback(provider, code, state) - exchanges code for user info
- ✅ createOrLinkUser(providerInfo) - creates/links account
- ✅ Providers: google, github (placeholder implementations for MVP)
- ✅ CSRF protection with state tokens
- ✅ Automatic account linking

### 5. Main Identity Service (`src/services/identity/index.ts`)
- ✅ IdentityService class orchestrating all operations
- ✅ authenticate(email, password | apiKey)
- ✅ validateApiKey(apiKey)
- ✅ validateToken(token)
- ✅ whoami(authHeader)
- ✅ createUser(email, password, name)
- ✅ refreshToken(refreshToken)
- ✅ Integration with all sub-services

### 6. HTTP Handlers (`src/handlers/identity.ts`)
- ✅ POST /v1/identity/register - Register new user
- ✅ POST /v1/identity/authenticate - Authenticate with email/password or API key
- ✅ POST /v1/identity/refresh - Refresh access token
- ✅ POST /v1/identity/api-keys - Create API key
- ✅ GET /v1/identity/api-keys - List API keys
- ✅ DELETE /v1/identity/api-keys/:id - Revoke API key
- ✅ GET /v1/identity/whoami - Get current user info
- ✅ GET /v1/identity/oauth/:provider - Initiate OAuth flow
- ✅ GET /v1/identity/oauth/:provider/callback - Handle OAuth callback
- ✅ All handlers follow SPARC API surface specification
- ✅ Consistent error handling and response format

### 7. Route Registration (`src/routes/identity.ts`)
- ✅ All identity routes registered with Fastify
- ✅ Auth middleware applied to protected routes
- ✅ Public routes: authenticate, register, refresh, OAuth
- ✅ Protected routes: whoami, api-keys (requires authentication)

## API Endpoints

### Public Endpoints
- `POST /v1/identity/register` - Register new user account
- `POST /v1/identity/authenticate` - Authenticate user
- `POST /v1/identity/refresh` - Refresh access token
- `GET /v1/identity/oauth/:provider` - Initiate OAuth flow
- `GET /v1/identity/oauth/:provider/callback` - Handle OAuth callback

### Protected Endpoints (Auth Required)
- `GET /v1/identity/whoami` - Get current user identity
- `POST /v1/identity/api-keys` - Create new API key
- `GET /v1/identity/api-keys` - List user's API keys
- `DELETE /v1/identity/api-keys/:id` - Revoke API key

## Authentication Methods

### 1. JWT Bearer Token
```
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 2. API Key
```
Authorization: ApiKey agentics_...
```

## Security Features

### API Keys
- Format: `agentics_<base64_random_32_bytes>`
- Bcrypt hashing (10 rounds)
- Expiration support
- Revocation tracking
- Last used timestamp

### JWT Tokens
- RS256 algorithm (RSA + SHA-256)
- 24 hour access token expiration
- 7 day refresh token expiration
- Signature verification
- Expiration validation

### OAuth
- CSRF protection with state tokens
- 10 minute state expiration
- Authorization code flow
- Automatic account linking

## Integration Points

### Existing Middleware
The Identity Service integrates with the existing auth middleware:
- Uses `request.identity` for user context
- Compatible with existing `authMiddleware`
- Follows existing authentication patterns

### Configuration
Uses existing config from `src/config.ts`:
- JWT secret
- API key salt
- Database URLs (for future use)
- Environment-based configuration

## File Structure

```
packages/api/src/
├── services/identity/
│   ├── index.ts          # Main IdentityService
│   ├── store.ts          # In-memory identity store
│   ├── api-keys.ts       # API key management
│   ├── tokens.ts         # JWT token operations
│   ├── oauth.ts          # OAuth provider integration
│   └── README.md         # Detailed documentation
├── handlers/
│   └── identity.ts       # HTTP request handlers
├── routes/
│   └── identity.ts       # Route registration
└── middleware/
    └── auth.ts           # Authentication middleware (existing)
```

## Testing

Example usage:

```typescript
import { identityService } from './handlers/identity.js';

// Register a user
const user = await identityService.createUser({
  email: 'test@example.com',
  password: 'secure_password',
  name: 'Test User'
});

// Authenticate
const auth = await identityService.authenticate({
  email: 'test@example.com',
  password: 'secure_password'
});

// Create API key
const apiKeyService = identityService.getApiKeyService();
const apiKey = await apiKeyService.createApiKey({
  userId: user.id,
  name: 'Test Key',
  scopes: ['api:read', 'api:write']
});

// Validate API key
const result = await identityService.validateApiKey(apiKey.key);
```

## MVP Limitations

Current implementation is designed for MVP:
1. In-memory storage (data lost on restart)
2. Single instance only (no distributed support)
3. Generated RSA keys (not persistent)
4. Mock OAuth integration
5. No password reset flow
6. No email verification
7. Basic scope system

## Production Readiness Checklist

For production deployment:
- [ ] Replace InMemoryIdentityStore with database implementation
- [ ] Load RSA keys from secure storage (KMS, Vault)
- [ ] Implement real OAuth provider integration
- [ ] Add password reset flow
- [ ] Add email verification
- [ ] Implement enhanced scope system
- [ ] Add rate limiting per user/API key
- [ ] Add audit logging for all auth events
- [ ] Implement session management and revocation
- [ ] Add multi-factor authentication (MFA)
- [ ] Implement key rotation policies
- [ ] Add comprehensive unit and integration tests
- [ ] Performance optimization and caching
- [ ] Security hardening and penetration testing

## Next Steps

1. **Database Integration**: Replace in-memory store with PostgreSQL
2. **OAuth Integration**: Implement real Google/GitHub OAuth flows
3. **Enhanced Features**: Password reset, email verification, MFA
4. **Testing**: Add comprehensive test suite
5. **Documentation**: API documentation with examples
6. **Security**: Security audit and hardening
7. **Monitoring**: Add metrics and logging
8. **Performance**: Optimize for scale

## Notes

- This implementation follows the SPARC specification closely
- Identity is owned by Layer 4 and does NOT route to Layer 3
- All authentication operations are handled within the API Gateway
- The service is designed to be easily extended for production use
- Integration with existing middleware ensures consistency
