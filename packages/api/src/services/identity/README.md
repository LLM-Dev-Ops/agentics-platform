# Identity Service

The Identity Service is one of the few services that Layer 4 owns directly. It handles all authentication and identity management for the Agentics Platform and does NOT route to Layer 3.

## Architecture

The Identity Service consists of several components:

### 1. Store (`store.ts`)
In-memory identity store for MVP. Manages:
- User accounts
- API keys
- Indexes for fast lookup

**Production Note**: Replace with database implementation (PostgreSQL recommended).

### 2. API Key Service (`api-keys.ts`)
Manages API key lifecycle:
- **Format**: `agentics_<base64_random_32_bytes>`
- **Generation**: Cryptographically secure random tokens
- **Storage**: Bcrypt hashed values
- **Validation**: Checks expiration and revocation status

**Key Methods**:
- `createApiKey(userId, name, scopes, expiresAt)` - Generate new API key
- `revokeApiKey(userId, keyId)` - Revoke an API key
- `listApiKeys(userId)` - List user's API keys
- `lookupApiKey(keyValue)` - Validate and return identity

### 3. Token Service (`tokens.ts`)
JWT token operations using RS256 signing:
- **Algorithm**: RS256 (RSA + SHA-256)
- **Expiration**: 24 hours for access tokens, 7 days for refresh tokens
- **Claims**: sub (userId), email, scopes, exp, iat

**Key Methods**:
- `issueToken(userId, email, scopes)` - Create access token
- `issueTokenPair(userId, email, scopes)` - Create access + refresh tokens
- `verifyToken(token)` - Validate token signature and expiration
- `refreshToken(refreshToken)` - Issue new token pair from valid refresh token

### 4. OAuth Service (`oauth.ts`)
OAuth provider integration (Google, GitHub):
- **Flow**: Authorization code flow with PKCE
- **Providers**: Google and GitHub (placeholder implementations for MVP)
- **Account Linking**: Automatically links OAuth accounts to existing users

**Key Methods**:
- `initiateOAuth(provider)` - Generate authorization URL
- `handleCallback(provider, code, state)` - Process OAuth callback
- `createOrLinkUser(providerInfo)` - Create or link user account

### 5. Main Service (`index.ts`)
Orchestrates all identity operations:
- `authenticate(email, password | apiKey)` - Authenticate user
- `validateApiKey(apiKey)` - Validate API key
- `validateToken(token)` - Validate JWT token
- `whoami(authHeader)` - Get current user identity
- `createUser(email, password, name)` - Register new user
- `refreshToken(refreshToken)` - Refresh access token

## API Endpoints

### Public Endpoints (No Authentication)

#### POST /v1/identity/register
Register a new user account.

**Request**:
```json
{
  "email": "user@example.com",
  "password": "secure_password",
  "name": "John Doe"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "John Doe"
    },
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "expiresIn": 86400
  }
}
```

#### POST /v1/identity/authenticate
Authenticate with email/password or API key.

**Request** (Email/Password):
```json
{
  "email": "user@example.com",
  "password": "secure_password"
}
```

**Request** (API Key):
```json
{
  "apiKey": "agentics_..."
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "John Doe"
    },
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "expiresIn": 86400
  }
}
```

#### POST /v1/identity/refresh
Refresh an access token.

**Request**:
```json
{
  "refreshToken": "eyJ..."
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "John Doe"
    },
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "expiresIn": 86400
  }
}
```

#### GET /v1/identity/oauth/:provider
Initiate OAuth flow.

**Parameters**:
- `provider`: "google" | "github"

**Response**:
```json
{
  "success": true,
  "data": {
    "url": "https://accounts.google.com/o/oauth2/v2/auth?...",
    "state": "uuid"
  }
}
```

#### GET /v1/identity/oauth/:provider/callback
Handle OAuth callback.

**Query Parameters**:
- `code`: Authorization code from provider
- `state`: State token for CSRF protection

**Response**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "John Doe"
    },
    "isNewUser": true,
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "expiresIn": 86400
  }
}
```

### Protected Endpoints (Authentication Required)

#### GET /v1/identity/whoami
Get current user information.

**Headers**:
- `Authorization: Bearer <token>` or `Authorization: ApiKey <api_key>`

**Response**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "John Doe"
    },
    "scopes": ["api:read", "api:write"],
    "authMethod": "token"
  }
}
```

#### POST /v1/identity/api-keys
Create a new API key.

**Headers**:
- `Authorization: Bearer <token>`

**Request**:
```json
{
  "name": "Production API Key",
  "scopes": ["api:read", "api:write"],
  "expiresAt": "2025-12-31T23:59:59Z"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Production API Key",
    "key": "agentics_...",
    "scopes": ["api:read", "api:write"],
    "createdAt": "2025-01-01T00:00:00Z",
    "expiresAt": "2025-12-31T23:59:59Z"
  }
}
```

**Important**: The `key` field is only returned once during creation.

#### GET /v1/identity/api-keys
List all API keys for current user.

**Headers**:
- `Authorization: Bearer <token>`

**Response**:
```json
{
  "success": true,
  "data": {
    "apiKeys": [
      {
        "id": "uuid",
        "name": "Production API Key",
        "scopes": ["api:read", "api:write"],
        "createdAt": "2025-01-01T00:00:00Z",
        "expiresAt": "2025-12-31T23:59:59Z",
        "lastUsedAt": "2025-01-02T12:00:00Z"
      }
    ]
  }
}
```

#### DELETE /v1/identity/api-keys/:id
Revoke an API key.

**Headers**:
- `Authorization: Bearer <token>`

**Parameters**:
- `id`: API key ID

**Response**:
```json
{
  "success": true,
  "data": {
    "message": "API key revoked successfully"
  }
}
```

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
- **Format**: `agentics_<base64_random_32_bytes>`
- **Hashing**: Bcrypt with 10 rounds
- **Validation**: Checks revocation and expiration
- **Last Used**: Tracks last usage timestamp

### JWT Tokens
- **Algorithm**: RS256 (RSA + SHA-256)
- **Key Pair**: Generated at startup (replace with persistent keys in production)
- **Expiration**: 24 hours for access tokens
- **Refresh**: 7 days for refresh tokens

### OAuth
- **CSRF Protection**: State tokens with 10-minute expiration
- **Flow**: Authorization code flow
- **Account Linking**: Automatic linking to existing accounts

## Error Handling

All errors follow consistent format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message"
  }
}
```

**Common Error Codes**:
- `AUTHENTICATION_FAILED` - Invalid credentials
- `UNAUTHORIZED` - Missing or invalid authentication
- `FORBIDDEN` - Insufficient permissions
- `INVALID_REQUEST` - Missing required fields
- `REGISTRATION_FAILED` - User registration error
- `TOKEN_REFRESH_FAILED` - Invalid refresh token
- `API_KEY_CREATION_FAILED` - API key creation error
- `API_KEY_REVOCATION_FAILED` - API key revocation error

## MVP Limitations

The current implementation is designed for MVP and has the following limitations:

1. **In-Memory Storage**: All data is stored in memory and lost on restart
2. **Single Instance**: Not designed for horizontal scaling
3. **Generated RSA Keys**: Keys are generated at startup instead of loaded from secure storage
4. **Mock OAuth**: OAuth providers return mock data instead of real integration
5. **No Password Reset**: Password reset flow not implemented
6. **No Email Verification**: Email verification not implemented
7. **Basic Scopes**: Simple scope system without hierarchical permissions

## Production Recommendations

For production deployment:

1. **Replace In-Memory Store**: Use PostgreSQL or similar database
2. **Persistent RSA Keys**: Load keys from secure storage (KMS, Vault, etc.)
3. **Implement OAuth**: Real OAuth integration with Google/GitHub
4. **Add Email Features**: Password reset, email verification
5. **Enhanced Scopes**: Implement hierarchical scope system
6. **Rate Limiting**: Add rate limiting per user/API key
7. **Audit Logging**: Log all authentication events
8. **Session Management**: Add session tracking and revocation
9. **MFA Support**: Multi-factor authentication
10. **Key Rotation**: Implement API key and JWT key rotation

## Integration with Existing Middleware

The Identity Service integrates with the existing auth middleware:
- Existing middleware in `middleware/auth.ts` validates credentials
- Identity Service provides the validation logic
- Request is augmented with `request.identity` containing user info
- Protected routes use `authMiddleware` to enforce authentication

## File Structure

```
packages/api/src/services/identity/
├── index.ts          # Main IdentityService class
├── store.ts          # In-memory identity store
├── api-keys.ts       # API key service
├── tokens.ts         # JWT token service
├── oauth.ts          # OAuth service
└── README.md         # This file

packages/api/src/handlers/
└── identity.ts       # HTTP request handlers

packages/api/src/routes/
└── identity.ts       # Route registration
```

## Testing

For testing, you can use the helper functions in the auth middleware:

```typescript
import { createApiKeyForTesting } from '../middleware/auth.js';

// Create a test API key
const apiKey = await createApiKeyForTesting(
  'test-user-id',
  'Test Key',
  ['api:read', 'api:write']
);
```

## Next Steps

1. Implement database integration
2. Add real OAuth provider integration
3. Implement password reset flow
4. Add email verification
5. Implement audit logging
6. Add comprehensive tests
7. Performance optimization
8. Security hardening
