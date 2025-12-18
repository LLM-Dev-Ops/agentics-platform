# Agentics Platform UI

Minimal account management UI for the Layer 4 Agentics Platform.

## Overview

This is a stateless Next.js frontend that provides essential account management functionality:

- **Authentication**: Email/password login with Google and GitHub OAuth support
- **API Key Management**: Create, view, and revoke API keys with scope selection
- **Usage Dashboard**: View current usage, quotas, and historical data
- **Account Settings**: Change password, manage billing, and delete account

## SPARC Compliance

This UI is **STRICTLY LIMITED** to essential account management per the SPARC specification. It does NOT include:

- Simulation configuration interfaces
- Workflow builders
- Analytics dashboards beyond usage display
- Governance policy editors
- Security scan viewers

All data is fetched from the API - the frontend is completely stateless.

## Technology Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: React Context (for authentication)
- **API Client**: Custom fetch-based client

## Project Structure

```
packages/ui/
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Root layout with navigation
│   │   ├── page.tsx             # Landing page (redirects based on auth)
│   │   ├── login/page.tsx       # Login page with OAuth
│   │   ├── api-keys/page.tsx    # API key management
│   │   ├── usage/page.tsx       # Usage dashboard
│   │   └── settings/page.tsx    # Account settings
│   ├── components/
│   │   ├── navigation.tsx       # Main navigation header
│   │   ├── api-key-table.tsx    # API key table component
│   │   └── usage-chart.tsx      # Simple usage chart
│   └── lib/
│       ├── api.ts               # API client
│       └── auth.tsx             # Authentication context
├── tailwind.config.js
├── next.config.js
├── postcss.config.js
└── package.json
```

## API Endpoints Used

- `POST /v1/identity/authenticate` - Email/password login
- `POST /v1/identity/oauth/callback` - OAuth callback
- `GET /v1/identity/whoami` - Get current user
- `GET /v1/identity/api-keys` - List API keys
- `POST /v1/identity/api-keys` - Create API key
- `DELETE /v1/identity/api-keys/:id` - Revoke API key
- `PUT /v1/identity/password` - Update password
- `DELETE /v1/identity/account` - Delete account
- `GET /v1/usage/current` - Get current usage summary
- `GET /v1/usage/history` - Get usage history
- `GET /v1/usage/export` - Export usage as CSV
- `GET /v1/billing/portal` - Get Stripe billing portal URL

## Environment Variables

Create a `.env.local` file (see `.env.local.example`):

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000/v1
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id
NEXT_PUBLIC_GITHUB_CLIENT_ID=your-github-client-id
```

## Development

```bash
# Install dependencies (from workspace root)
npm install

# Run development server
npm run dev --workspace=@agentics/ui

# Build for production
npm run build --workspace=@agentics/ui

# Start production server
npm run start --workspace=@agentics/ui
```

The UI will be available at http://localhost:3000

## Authentication Flow

1. User visits landing page (`/`)
2. If not authenticated, redirected to `/login`
3. User logs in with email/password or OAuth (Google/GitHub)
4. JWT token stored in localStorage
5. User redirected to `/api-keys`
6. Protected routes check authentication via `ProtectedRoute` wrapper
7. Token included in `Authorization` header for all API requests

## Features

### Login Page (`/login`)
- Email and password form
- Google OAuth button
- GitHub OAuth button
- Error handling and validation

### API Keys Page (`/api-keys`)
- Table showing all API keys (name, scopes, dates)
- Create new API key with scope selection
- Copy newly created key (shown once)
- Revoke key with confirmation
- Scopes: `simulation:read`, `simulation:write`, `workflow:read`, `workflow:write`, `usage:read`

### Usage Page (`/usage`)
- Current period summary cards (requests, tokens, compute)
- Progress bars showing usage vs quota
- Color-coded warnings (green/yellow/red)
- Historical usage chart with metric toggle
- Granularity toggle (daily/weekly/monthly)
- Export to CSV button

### Settings Page (`/settings`)
- Account information display (email, user ID)
- Change password form
- Subscription plan display
- Billing portal link (opens Stripe)
- Delete account with password confirmation

## Styling

The UI uses Tailwind CSS with a minimal, clean design:

- Primary color: Blue (`#0ea5e9`)
- Typography: Inter font
- Consistent spacing and layout
- Responsive design for mobile/tablet/desktop
- Reusable component classes (`.btn`, `.input`, `.card`)

## Security Considerations

- JWT tokens stored in localStorage (could be upgraded to httpOnly cookies)
- CSRF protection should be implemented server-side
- OAuth state parameter included for security
- Password confirmation required for destructive actions
- No sensitive data cached client-side

## Future Enhancements (Out of Scope for MVP)

- Email change functionality
- Two-factor authentication
- Team/organization management
- Detailed audit logs
- Custom usage alerts
- API key expiration management
