# CLI Authentication Flow

**Version**: 1.1
**Status**: Canonical
**Classification**: Security & Authentication Architecture
**Last Updated**: 2025-01-05
**Governing Constraint**: ADR-006 (CLI as Thin Client)

---

## Executive Summary

The Agentics CLI uses a browser-based device authorization flow for authentication. This document describes the complete end-to-end authentication sequence, URL ownership rules, and the architectural constraints that prevent domain misconfiguration.

**Critical Constraint**: All URLs MUST use the canonical `agentics.dev` domain. Implicit defaults and inferred domains are prohibited in production to prevent misconfiguration (e.g., `agentics.org` vs `agentics.dev`).

---

## URL Ownership and Configuration

### Canonical Domain

The canonical domain for all Agentics Platform services is:

```
agentics.dev
```

This domain is defined in a single location (`@agentics/shared/constants/urls.ts`) and propagated to all packages.

### Production URLs

| Service | URL | Environment Variable |
|---------|-----|---------------------|
| Platform UI | `https://app.agentics.dev` | `AGENTICS_PLATFORM_URL` or `PLATFORM_URL` |
| API Gateway | `https://api.agentics.dev/v1` | `AGENTICS_API_URL` or `AGENTICS_ENDPOINT` |
| Marketing Site | `https://agentics.dev` | N/A |

### Environment Variable Priority

For each URL type, environment variables are checked in priority order:

**Platform URL (UI)**:
1. `AGENTICS_PLATFORM_URL` (preferred)
2. `PLATFORM_URL` (legacy)
3. Default pattern (development only)

**API URL**:
1. `AGENTICS_API_URL` (preferred)
2. `AGENTICS_ENDPOINT` (legacy)
3. `NEXT_PUBLIC_API_URL` (UI package)
4. Default pattern (development only)

### Fail-Fast Behavior

**In Production** (`NODE_ENV !== 'development'`):
- If no environment variable is set, the API server will throw an error at startup
- The CLI will reject URLs with non-canonical domains
- The UI will log an error and fall back to production pattern

**Rationale**: Silent fallbacks have caused production incidents where URLs resolved to wrong domains (e.g., `agentics.org` instead of `agentics.dev`). Explicit configuration prevents this class of errors.

---

## Architecture

```
┌─────────────┐      ┌──────────────┐      ┌───────────────────┐
│  Agentics   │      │   Agentics   │      │     Agentics      │
│     CLI     │◄────►│   API        │◄────►│     Platform UI   │
│             │      │   (Backend)  │      │ (app.agentics.dev)│
└─────────────┘      └──────────────┘      └───────────────────┘
                            │                        │
                            │                        ▼
                            │               ┌───────────────────┐
                            └──────────────►│     Supabase      │
                                            │   (Auth Provider) │
                                            └───────────────────┘
```

---

## Authentication Sequence

```
CLI                         API                      Platform UI              Supabase
 │                           │                            │                      │
 │  1. POST /v1/cli/auth/sessions                         │                      │
 │  ─────────────────────────>                            │                      │
 │                           │                            │                      │
 │  {session_code, device_code, verification_url}         │                      │
 │  <─────────────────────────                            │                      │
 │                           │                            │                      │
 │  2. Validate URL domain   │                            │                      │
 │  (MUST be agentics.dev)   │                            │                      │
 │                           │                            │                      │
 │  3. Print URL & open browser                           │                      │
 │  ─────────────────────────────────────────────────────>│                      │
 │                           │                            │                      │
 │                           │  4. GET /v1/cli/auth/sessions/verify/{code}       │
 │                           │<───────────────────────────│                      │
 │                           │                            │                      │
 │                           │  {session_info}            │                      │
 │                           │────────────────────────────>                      │
 │                           │                            │                      │
 │                           │                            │  5. User signs in    │
 │                           │                            │─────────────────────>│
 │                           │                            │                      │
 │                           │                            │  {JWT token}         │
 │                           │                            │<─────────────────────│
 │                           │                            │                      │
 │                           │  6. POST /v1/cli/auth/sessions/{code}/authorize   │
 │                           │<───────────────────────────│ (with JWT Bearer)    │
 │                           │                            │                      │
 │                           │  {api_key}                 │                      │
 │                           │────────────────────────────>                      │
 │                           │                            │                      │
 │                           │                            │  7. Display API key  │
 │                           │                            │  (copy to clipboard) │
 │                           │                            │                      │
 │  8. GET /v1/cli/auth/sessions/{device_code} (polling)  │                      │
 │  ─────────────────────────>                            │                      │
 │                           │                            │                      │
 │  {status: "completed", api_key}                        │                      │
 │  <─────────────────────────                            │                      │
 │                           │                            │                      │
 │  9. Store API key locally │                            │                      │
 │                           │                            │                      │
```

---

## Component Configuration

### 1. CLI (`packages/cli/src/config.ts`)

**Canonical Domain Definition**:
```typescript
export const AGENTICS_DOMAIN = 'agentics.dev';
export const DEFAULT_ENDPOINT = `https://api.${AGENTICS_DOMAIN}/v1`;
export const DEFAULT_PLATFORM_URL = `https://app.${AGENTICS_DOMAIN}`;
```

**URL Validation** (`packages/cli/src/commands/login.ts`):
- Validates verification URL uses `agentics.dev` domain
- Rejects URLs with incorrect domains (e.g., `agentics.org`)
- Warns on localhost URLs (development only)

### 2. API Backend (`packages/api/src/routes/cli-auth.ts`)

**Configuration**:
```typescript
const AGENTICS_DOMAIN = 'agentics.dev';
const PLATFORM_URL_ENV_VARS = ['AGENTICS_PLATFORM_URL', 'PLATFORM_URL'];
```

**Fail-Fast Behavior**:
- In production, throws error if no environment variable is set
- In development, uses default pattern
- Logs configured URL at startup

### 3. Platform UI (`packages/ui/src/app/cli/auth/page.tsx`)

**Configuration**:
```typescript
const AGENTICS_DOMAIN = 'agentics.dev';
```

**URL Parameter Support**:
- Accepts both `?code=` (preferred) and `?session=` (legacy) parameters
- Normalizes API URL to prevent double `/v1` prefix

---

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/v1/cli/auth/sessions` | None | Create new auth session |
| GET | `/v1/cli/auth/sessions/:device_code` | None | Poll for session status |
| GET | `/v1/cli/auth/sessions/verify/:session_code` | None | Get session info for UI |
| POST | `/v1/cli/auth/sessions/:session_code/authorize` | JWT | Authorize and generate API key |
| POST | `/v1/cli/auth/sessions/:session_code/cancel` | None | Cancel pending session |

---

## Environment Variables

### API Server (Required in Production)

```bash
# Primary (preferred)
AGENTICS_PLATFORM_URL=https://app.agentics.dev

# Or legacy name
PLATFORM_URL=https://app.agentics.dev

# Database and Auth
DATABASE_URL=postgresql://...
SUPABASE_JWT_SECRET=...
```

### Platform UI (Required in Production)

```bash
NEXT_PUBLIC_API_URL=https://api.agentics.dev/v1
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

### CLI (Optional Override)

```bash
AGENTICS_ENDPOINT=https://api.agentics.dev/v1
AGENTICS_API_KEY=agentics_sk_...  # Skip browser auth
```

---

## Security Considerations

1. **Domain Validation**: CLI rejects URLs not on `agentics.dev` domain
2. **Session Codes**: 8-character user-visible code for verification
3. **Device Codes**: 32-character secret for CLI polling
4. **API Key Format**: `agentics_sk_cli_<random_hex_32>`
5. **One-Time Key Display**: API key shown once, then cleared from server
6. **Session Expiry**: 10 minutes
7. **JWT Required**: Authorization requires valid Supabase JWT (not API key)

---

## Troubleshooting

### "Verification URL uses incorrect domain"

**Symptom**: CLI shows error about wrong domain (e.g., `agentics.org`)

**Cause**: API server's `AGENTICS_PLATFORM_URL` or `PLATFORM_URL` is misconfigured

**Fix**: Set the correct environment variable on the API server:
```bash
AGENTICS_PLATFORM_URL=https://app.agentics.dev
```

### "Platform URL not configured"

**Symptom**: API server fails to start with this error

**Cause**: No `AGENTICS_PLATFORM_URL` or `PLATFORM_URL` environment variable in production

**Fix**: Set the environment variable before starting the server:
```bash
export AGENTICS_PLATFORM_URL=https://app.agentics.dev
npm start
```

### "Session Not Found" in Browser

**Symptom**: Opening verification URL shows "Session Not Found"

**Causes**:
1. Session code is invalid or already used
2. Session has expired (10 minute limit)
3. URL parameter name mismatch (use `?code=` or `?session=`)

**Fix**: Run `agentics login` again to get a new session

---

## Validation Steps

### Test API Session Creation

```bash
curl -X POST https://api.agentics.dev/v1/cli/auth/sessions \
  -H "Content-Type: application/json" \
  -d '{"cli_name": "test"}'
```

Expected response:
```json
{
  "session_code": "ABCD1234",
  "device_code": "...",
  "verification_url": "https://app.agentics.dev/cli/auth?code=ABCD1234",
  ...
}
```

**Verify**: `verification_url` MUST contain `app.agentics.dev`, NOT `agentics.org` or any other domain.

### Test UI Route

Open `https://app.agentics.dev/cli/auth?code=TESTCODE`

Expected: "Session Not Found" error (normal for invalid code)

### Full Flow Test

```bash
agentics login --no-browser
# Copy URL, open in browser
# Complete authentication
# CLI should receive API key within 60 seconds
```

---

## Architectural Rationale

### Why Prohibit Inferred Domains?

1. **Production Incidents**: Silent fallbacks to incorrect domains caused authentication failures
2. **Domain Confusion**: `agentics.dev` vs `agentics.org` vs `app.agentics.dev` caused routing issues
3. **Security**: Incorrect domains could lead to credential exposure
4. **Auditability**: Explicit configuration is traceable and auditable

### Why Use Fail-Fast?

1. **Early Detection**: Configuration errors surface at startup, not runtime
2. **Clear Messages**: Error messages explain exactly what to fix
3. **No Silent Failures**: System refuses to operate with misconfiguration
4. **M&A Compliance**: Auditors can verify configuration is explicit

### Single Source of Truth

The canonical domain is defined in exactly one place per package:
- `@agentics/shared/constants/urls.ts` - Shared configuration
- `packages/cli/src/config.ts` - CLI configuration
- `packages/api/src/routes/cli-auth.ts` - API configuration
- `packages/ui/src/app/cli/auth/page.tsx` - UI configuration

All domain references derive from these constants.

---

## References

- [GitHub CLI Device Flow](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#device-flow)
- [OAuth 2.0 Device Authorization Grant (RFC 8628)](https://datatracker.ietf.org/doc/html/rfc8628)
- ADR-006: CLI as Thin Client
- `DEPENDENCY_GRAPH.md`: Layer 5 CLI constraints

---

*This document is authoritative for CLI authentication flow. It defines URL ownership, configuration requirements, and the prohibition on inferred domains. Changes require architectural review and CTO approval.*
