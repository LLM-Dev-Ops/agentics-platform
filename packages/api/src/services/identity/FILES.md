# Identity Service Files

This document lists all files created for the Identity Service implementation.

## Core Service Files

### /workspaces/agentics-platform/packages/api/src/services/identity/store.ts
In-memory identity store implementation.
- Interfaces: `User`, `ApiKey`, `IdentityStoreInterface`
- Class: `InMemoryIdentityStore`
- User operations: storeUser, lookupUser, updateUser, getAllUsers
- API key operations: storeApiKey, lookupApiKey, listApiKeys, updateApiKey

### /workspaces/agentics-platform/packages/api/src/services/identity/api-keys.ts
API key management service.
- Class: `ApiKeyService`
- Methods: createApiKey, revokeApiKey, listApiKeys, lookupApiKey
- API key format: `agentics_<base64_random_32_bytes>`
- Security: Bcrypt hashing, expiration checking, revocation support

### /workspaces/agentics-platform/packages/api/src/services/identity/tokens.ts
JWT token service.
- Class: `TokenService`
- Methods: issueToken, issueTokenPair, verifyToken, refreshToken
- Algorithm: RS256 (RSA + SHA-256)
- Expiration: 24 hours (access), 7 days (refresh)

### /workspaces/agentics-platform/packages/api/src/services/identity/oauth.ts
OAuth provider integration.
- Class: `OAuthService`
- Methods: initiateOAuth, handleCallback, createOrLinkUser
- Providers: Google, GitHub (placeholder implementations)
- Security: CSRF protection with state tokens

### /workspaces/agentics-platform/packages/api/src/services/identity/index.ts
Main Identity Service orchestrator.
- Class: `IdentityService`
- Methods: authenticate, validateApiKey, validateToken, whoami, createUser, refreshToken
- Exports all sub-services and types

## HTTP Layer Files

### /workspaces/agentics-platform/packages/api/src/handlers/identity.ts
HTTP request handlers for identity endpoints.
- Handlers:
  - authenticateHandler - POST /v1/identity/authenticate
  - registerHandler - POST /v1/identity/register
  - refreshTokenHandler - POST /v1/identity/refresh
  - createApiKeyHandler - POST /v1/identity/api-keys
  - listApiKeysHandler - GET /v1/identity/api-keys
  - revokeApiKeyHandler - DELETE /v1/identity/api-keys/:id
  - whoamiHandler - GET /v1/identity/whoami
  - initiateOAuthHandler - GET /v1/identity/oauth/:provider
  - oauthCallbackHandler - GET /v1/identity/oauth/:provider/callback
- Export: identityService singleton instance

### /workspaces/agentics-platform/packages/api/src/routes/identity.ts
Route registration for Fastify.
- Function: `registerIdentityRoutes(fastify)`
- Registers all identity endpoints
- Applies auth middleware to protected routes

## Documentation Files

### /workspaces/agentics-platform/packages/api/src/services/identity/README.md
Comprehensive documentation of the Identity Service.
- Architecture overview
- API endpoints with examples
- Authentication methods
- Security features
- Error handling
- MVP limitations
- Production recommendations

### /workspaces/agentics-platform/packages/api/IDENTITY_SERVICE.md
Implementation summary and status.
- Component checklist
- API endpoints overview
- Security features
- Integration points
- File structure
- Testing examples
- Production readiness checklist

### /workspaces/agentics-platform/packages/api/src/services/identity/FILES.md
This file - quick reference guide for all files.

## Integration with Existing Files

The Identity Service integrates with these existing files:

### /workspaces/agentics-platform/packages/api/src/middleware/auth.ts
Existing authentication middleware.
- Function: `authMiddleware` - validates credentials and sets request.identity
- Function: `extractCredentials` - parses Authorization header
- Function: `validateCredentials` - validates API keys and JWT tokens
- Integration: Identity Service provides validation logic

### /workspaces/agentics-platform/packages/api/src/config.ts
Existing configuration file.
- Used by Identity Service for:
  - jwtSecret - JWT signing secret
  - apiKeySalt - API key hashing salt
  - database.identityUrl - Future database connection

## File Tree

```
packages/api/
├── src/
│   ├── services/
│   │   └── identity/
│   │       ├── index.ts          (Main service)
│   │       ├── store.ts          (In-memory store)
│   │       ├── api-keys.ts       (API key service)
│   │       ├── tokens.ts         (JWT service)
│   │       ├── oauth.ts          (OAuth service)
│   │       ├── README.md         (Documentation)
│   │       └── FILES.md          (This file)
│   ├── handlers/
│   │   └── identity.ts           (HTTP handlers)
│   ├── routes/
│   │   └── identity.ts           (Route registration)
│   └── middleware/
│       └── auth.ts               (Existing - integration point)
└── IDENTITY_SERVICE.md           (Implementation summary)
```

## Usage Examples

### Import the Identity Service
```typescript
import { identityService } from '../handlers/identity.js';
```

### Import Sub-Services
```typescript
import { ApiKeyService } from '../services/identity/api-keys.js';
import { TokenService } from '../services/identity/tokens.js';
import { OAuthService } from '../services/identity/oauth.js';
```

### Import Types
```typescript
import type { User, ApiKey } from '../services/identity/store.js';
import type { TokenClaims } from '../services/identity/tokens.js';
import type { OAuthUserInfo } from '../services/identity/oauth.js';
```

### Register Routes
```typescript
import { registerIdentityRoutes } from './routes/identity.js';

// In your Fastify setup
await registerIdentityRoutes(fastify);
```

## Next Steps

To use this Identity Service:

1. Register the routes in your main server file
2. Ensure the auth middleware is properly configured
3. Test the endpoints using the examples in README.md
4. Plan for production database integration

## Notes

- All files use ES modules (`.js` imports)
- TypeScript strict mode compatible
- Follows Fastify best practices
- Designed for easy testing and extension
