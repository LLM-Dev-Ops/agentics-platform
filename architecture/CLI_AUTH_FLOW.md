# CLI Authentication Flow

## Overview

The Agentics CLI uses a browser-based device authorization flow for authentication, similar to the patterns used by Claude CLI and GitHub CLI. This document describes the complete end-to-end authentication sequence.

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
 │  2. Print URL & open browser                           │                      │
 │  ─────────────────────────────────────────────────────>│                      │
 │                           │                            │                      │
 │                           │  3. GET /v1/cli/auth/sessions/verify/{code}       │
 │                           │<───────────────────────────│                      │
 │                           │                            │                      │
 │                           │  {session_info}            │                      │
 │                           │────────────────────────────>                      │
 │                           │                            │                      │
 │                           │                            │  4. User signs in    │
 │                           │                            │─────────────────────>│
 │                           │                            │                      │
 │                           │                            │  {JWT token}         │
 │                           │                            │<─────────────────────│
 │                           │                            │                      │
 │                           │  5. POST /v1/cli/auth/sessions/{code}/authorize   │
 │                           │<───────────────────────────│ (with JWT Bearer)    │
 │                           │                            │                      │
 │                           │  {api_key}                 │                      │
 │                           │────────────────────────────>                      │
 │                           │                            │                      │
 │                           │                            │  6. Display API key  │
 │                           │                            │  (copy to clipboard) │
 │                           │                            │                      │
 │  7. GET /v1/cli/auth/sessions/{device_code} (polling)  │                      │
 │  ─────────────────────────>                            │                      │
 │                           │                            │                      │
 │  {status: "completed", api_key}                        │                      │
 │  <─────────────────────────                            │                      │
 │                           │                            │                      │
 │  8. Store API key locally │                            │                      │
 │                           │                            │                      │
```

## Components

### 1. CLI (`packages/cli/src/commands/login.ts`)

**Responsibilities:**
- Initiates authentication by creating a session via API
- Displays the verification URL to the user
- Optionally opens the browser automatically
- Polls the API for session completion
- Stores the received API key in `~/.agentics/credentials.json`

**Key Configuration:**
- `AGENTICS_ENDPOINT`: API endpoint (default: `https://api.agentics.dev/v1`)
- `AGENTICS_API_KEY`: Can be set directly to skip browser auth

**Commands:**
```bash
# Browser-based auth (default, recommended)
agentics login

# Browser auth without auto-opening
agentics login --no-browser

# Direct API key auth
agentics login --api-key <key>
```

### 2. API Backend (`packages/api/src/routes/cli-auth.ts`)

**Endpoints:**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/v1/cli/auth/sessions` | None | Create new auth session |
| GET | `/v1/cli/auth/sessions/:device_code` | None | Poll for session status |
| GET | `/v1/cli/auth/sessions/verify/:session_code` | None | Get session info for UI |
| POST | `/v1/cli/auth/sessions/:session_code/authorize` | JWT | Authorize and generate API key |
| POST | `/v1/cli/auth/sessions/:session_code/cancel` | None | Cancel pending session |

**Key Configuration:**
- `PLATFORM_URL`: UI base URL (default: `https://app.agentics.dev`)

**Database Table:** `cli_auth_sessions`
- Stores session state, codes, and temporary API key for one-time retrieval

### 3. Platform UI (`packages/ui/src/app/cli/auth/page.tsx`)

**Route:** `/cli/auth?code=<session_code>`

**Responsibilities:**
- Verifies the session code is valid
- Prompts user to sign in (if not authenticated)
- Displays CLI details and requested permissions
- Allows user to authorize or cancel
- Generates and displays API key (shown once)

**Key Configuration:**
- `NEXT_PUBLIC_API_URL`: API endpoint (default: `http://localhost:8000`)

## Security Considerations

1. **Session Codes**:
   - `session_code`: 8-character user-visible code for verification
   - `device_code`: 32-character secret for CLI polling

2. **API Key Generation**:
   - Format: `agentics_sk_cli_<random_hex_32>`
   - Stored hashed in database
   - Plaintext returned once to CLI, then cleared

3. **Session Expiry**:
   - Sessions expire after 10 minutes
   - Polling interval: 5 seconds

4. **JWT Validation**:
   - Authorization requires valid Supabase JWT
   - API keys cannot authorize sessions (prevents key escalation)

## Environment Variables

### API Server
```bash
PLATFORM_URL=https://app.agentics.dev    # UI URL for verification links
DATABASE_URL=...                          # PostgreSQL connection
SUPABASE_JWT_SECRET=...                  # For JWT verification
```

### Platform UI
```bash
NEXT_PUBLIC_API_URL=https://api.agentics.dev/v1    # API endpoint
NEXT_PUBLIC_SUPABASE_URL=...                       # Supabase URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=...                  # Supabase anon key
```

### CLI
```bash
AGENTICS_ENDPOINT=https://api.agentics.dev/v1     # Override default endpoint
AGENTICS_API_KEY=agentics_sk_...                  # Direct API key auth
```

## Troubleshooting

### Common Issues

1. **"Session Not Found" Error**
   - Session code is invalid or already used
   - Solution: Run `agentics login` again

2. **"Session Expired" Error**
   - Authentication took longer than 10 minutes
   - Solution: Run `agentics login` again

3. **Verification URL Points to Wrong Host**
   - API server has incorrect `PLATFORM_URL`
   - Solution: Set `PLATFORM_URL=https://app.agentics.dev`

4. **API Calls Fail with 404**
   - `NEXT_PUBLIC_API_URL` may have incorrect path
   - Solution: Ensure it's set to `https://api.agentics.dev/v1`

5. **Browser Doesn't Open**
   - Use `agentics login --no-browser` and open URL manually

### Validation Steps

1. **Test Session Creation:**
   ```bash
   curl -X POST https://api.agentics.dev/v1/cli/auth/sessions \
     -H "Content-Type: application/json" \
     -d '{"cli_name": "test", "scopes": ["platform:read"]}'
   ```
   Should return `verification_url` pointing to `https://app.agentics.dev/cli/auth?code=...`

2. **Test UI Route:**
   Open `https://app.agentics.dev/cli/auth?code=TESTCODE` - should show "Session Not Found" (expected for invalid code)

3. **Full Flow Test:**
   ```bash
   agentics login --no-browser
   # Copy URL, open in browser, complete auth
   # Should complete within 60 seconds
   ```

## Root Cause of Previous Failure

The CLI auth flow was failing because:

1. **Backend Issue**: `PLATFORM_URL` defaulted to `https://agentics.dev` instead of `https://app.agentics.dev`
   - Result: CLI printed URLs that didn't resolve to valid pages

2. **UI Issue**: `NEXT_PUBLIC_API_URL` handling could double-up `/v1` prefix
   - Result: API calls went to wrong paths

## Changes Made

1. **`packages/api/src/routes/cli-auth.ts`**
   - Changed default `PLATFORM_URL` from `https://agentics.dev` to `https://app.agentics.dev`

2. **`packages/ui/src/app/cli/auth/page.tsx`**
   - Added regex to strip trailing `/v1` from `NEXT_PUBLIC_API_URL` to prevent double-prefixing

3. **`packages/cli/src/commands/login.ts`**
   - Added endpoint validation with warnings for localhost/HTTP
   - Added verification URL validation with helpful error messages
   - Improved URL display with bold/underline formatting

## References

- [GitHub CLI Device Flow](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#device-flow)
- [OAuth 2.0 Device Authorization Grant (RFC 8628)](https://datatracker.ietf.org/doc/html/rfc8628)
