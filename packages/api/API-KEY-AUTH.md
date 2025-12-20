# API Key Authentication

The Layer 4 API Gateway uses API key authentication to protect all endpoints except health checks.

## Overview

- API keys are passed via the `Authorization` header as Bearer tokens
- Keys are stored hashed (SHA-256) and never in plaintext
- Keys belong to an organization and have scopes
- Keys can be active or revoked

## Authentication Flow

1. Client sends request with `Authorization: Bearer <api_key>`
2. Gateway extracts and hashes the key
3. Gateway looks up the key record by hash
4. Request is rejected (401) if key is missing, invalid, or revoked
5. Request is rejected (403) if key lacks required scope
6. On success, auth context is attached to the request

## Usage

### Making Authenticated Requests

```bash
# Basic authenticated request
curl -H "Authorization: Bearer agentics_abc123..." \
  https://api.example.com/v1/example/protected

# POST request with body
curl -X POST \
  -H "Authorization: Bearer agentics_abc123..." \
  -H "Content-Type: application/json" \
  -d '{"action": "test"}' \
  https://api.example.com/v1/example/protected/action
```

### Response Codes

| Code | Meaning |
|------|---------|
| 200  | Success |
| 401  | Missing or invalid API key |
| 403  | Key lacks required scope |
| 429  | Rate limit exceeded |

### Error Response Format

```json
{
  "error": "Authentication required",
  "code": "AUTHENTICATION_REQUIRED",
  "message": "Valid API key required. Use Authorization: Bearer <api_key>",
  "request_id": "uuid-here"
}
```

### Scope Errors

```json
{
  "error": "Insufficient permissions",
  "code": "AUTHORIZATION_DENIED",
  "request_id": "uuid-here",
  "details": {
    "requiredScope": "intelligence:write",
    "keyScopes": ["intelligence:read"]
  }
}
```

## Auth Context

On successful authentication, the following context is attached to the request:

```typescript
interface AuthContext {
  org_id: string;   // Organization ID the key belongs to
  key_id: string;   // Unique key identifier
  scopes: string[]; // Array of granted scopes
}
```

## Scopes

API keys have scopes that control access to different endpoints:

| Scope | Description |
|-------|-------------|
| `admin:*` | Full access to all endpoints |
| `intelligence:read` | Read access to intelligence endpoints |
| `intelligence:write` | Write access to intelligence endpoints |
| `security:read` | Read access to security endpoints |
| `security:write` | Write access to security endpoints |
| `automation:read` | Read access to automation endpoints |
| `automation:write` | Write access to automation endpoints |
| `governance:read` | Read access to governance endpoints |
| `governance:write` | Write access to governance endpoints |
| `data:read` | Read access to data endpoints |
| `data:write` | Write access to data endpoints |
| `ecosystem:read` | Read access to ecosystem endpoints |
| `ecosystem:write` | Write access to ecosystem endpoints |
| `research:read` | Read access to research endpoints |
| `research:write` | Write access to research endpoints |
| `identity:read` | Read access to identity endpoints |
| `identity:write` | Write access to identity endpoints |

Wildcard scopes (e.g., `intelligence:*`) grant both read and write access.

## Unauthenticated Endpoints

The following endpoints do NOT require authentication:

- `GET /health` - Main health check
- `GET /health/layer3` - Aggregated Layer 3 health
- `GET /health/{service}` - Individual Layer 3 service health

## Creating API Keys (Programmatic)

```typescript
import { createApiKey } from './middleware/auth.js';

// Create a key for an organization
const { key, record } = createApiKey(
  'org_123',           // Organization ID
  'Production Key',    // Key name
  ['intelligence:*', 'data:read'],  // Scopes
  new Date('2025-12-31')  // Optional expiration
);

// key = "agentics_abc123..." (save this - shown only once)
// record = { id, org_id, name, scopes, ... }
```

## Middleware Usage

```typescript
import { authMiddleware } from './middleware/auth.js';
import { hasScope } from './middleware/scope.js';

// Protect a route
fastify.get('/v1/my-endpoint', {
  onRequest: [authMiddleware],
  handler: async (request, reply) => {
    const auth = request.auth!;

    // Check for specific scope
    if (!hasScope(auth, 'my-scope:write')) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    // Use auth context
    console.log('Request from org:', auth.org_id);
    console.log('Using key:', auth.key_id);

    return { success: true };
  },
});
```

## Security Considerations

1. **Never log API keys** - Only log key IDs, never the actual key value
2. **Use HTTPS** - API keys are sensitive credentials
3. **Rotate keys regularly** - Revoke and recreate keys periodically
4. **Minimum scopes** - Grant only the scopes needed for each key
5. **Set expiration** - Use expiration dates for time-limited access
