# Deployment Guide

## Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- Backend API running (or configured API URL)

## Environment Setup

1. Copy the environment example file:
```bash
cp .env.local.example .env.local
```

2. Update the environment variables in `.env.local`:
```bash
# Backend API URL
NEXT_PUBLIC_API_URL=http://localhost:8000/v1

# OAuth Client IDs (optional, for OAuth login)
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id
NEXT_PUBLIC_GITHUB_CLIENT_ID=your-github-client-id
```

## Installation

From the workspace root:

```bash
# Install all dependencies
npm install

# Or install only UI dependencies
npm install --workspace=@agentics/ui
```

## Development

```bash
# Run development server
npm run dev --workspace=@agentics/ui

# Or from the UI package directory
cd packages/ui
npm run dev
```

The application will be available at http://localhost:3000

## Production Build

```bash
# Build for production
npm run build --workspace=@agentics/ui

# Start production server
npm run start --workspace=@agentics/ui
```

## Deployment Options

### Option 1: Vercel (Recommended for Next.js)

1. Install Vercel CLI:
```bash
npm install -g vercel
```

2. Deploy:
```bash
cd packages/ui
vercel
```

3. Set environment variables in Vercel dashboard

### Option 2: Docker

Create a `Dockerfile` in `packages/ui/`:

```dockerfile
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Production image, copy all files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000

CMD ["node", "server.js"]
```

Build and run:
```bash
docker build -t agentics-ui .
docker run -p 3000:3000 -e NEXT_PUBLIC_API_URL=https://api.example.com/v1 agentics-ui
```

### Option 3: Static Export (if no server-side features needed)

Update `next.config.js`:
```javascript
const nextConfig = {
  output: 'export',
  // ... rest of config
}
```

Build:
```bash
npm run build --workspace=@agentics/ui
```

Static files will be in `packages/ui/out/` and can be served by any static hosting service.

## Environment Variables by Deployment

### Development
- `NEXT_PUBLIC_API_URL`: http://localhost:8000/v1

### Staging
- `NEXT_PUBLIC_API_URL`: https://staging-api.example.com/v1

### Production
- `NEXT_PUBLIC_API_URL`: https://api.example.com/v1
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID`: Production Google OAuth client ID
- `NEXT_PUBLIC_GITHUB_CLIENT_ID`: Production GitHub OAuth client ID

## OAuth Configuration

### Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URIs:
   - http://localhost:3000/login (development)
   - https://your-domain.com/login (production)
6. Copy the client ID to `NEXT_PUBLIC_GOOGLE_CLIENT_ID`

### GitHub OAuth

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Create a new OAuth App
3. Set Authorization callback URL:
   - http://localhost:3000/login (development)
   - https://your-domain.com/login (production)
4. Copy the client ID to `NEXT_PUBLIC_GITHUB_CLIENT_ID`

## Security Considerations

1. **HTTPS Only**: Always use HTTPS in production
2. **Environment Variables**: Never commit `.env.local` to git
3. **CORS**: Configure backend API CORS to allow your frontend domain
4. **CSP**: Consider implementing Content Security Policy headers
5. **Token Storage**: JWT tokens are stored in localStorage (consider httpOnly cookies for production)

## Monitoring

Add monitoring tools as needed:

- **Error Tracking**: Sentry, Rollbar
- **Analytics**: Google Analytics, Plausible
- **Performance**: Vercel Analytics, New Relic

## Troubleshooting

### API Connection Issues

Check that:
1. Backend API is running
2. `NEXT_PUBLIC_API_URL` is correct
3. CORS is configured on backend
4. Network allows connection to API

### OAuth Issues

Check that:
1. OAuth client IDs are correct
2. Redirect URIs match exactly
3. OAuth apps are enabled
4. Backend OAuth endpoints are implemented

### Build Errors

Common solutions:
1. Clear Next.js cache: `rm -rf .next`
2. Reinstall dependencies: `rm -rf node_modules && npm install`
3. Check Node.js version: `node --version` (should be 18+)
