# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies for native modules
RUN apk add --no-cache python3 make g++

# Copy package files for workspace
COPY package*.json ./
COPY packages/ui/package*.json ./packages/ui/
COPY packages/sdk/package*.json ./packages/sdk/

# Install all dependencies
RUN npm install --workspace=@agentics/ui

# Copy SDK source
COPY packages/sdk/ ./packages/sdk/

# Copy UI source
COPY packages/ui/ ./packages/ui/

WORKDIR /app/packages/ui

# Set build-time environment variables
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy built assets from standalone output
COPY --from=builder /app/packages/ui/public ./public
COPY --from=builder /app/packages/ui/.next/standalone/packages/ui/. ./
COPY --from=builder /app/packages/ui/.next/standalone/node_modules ./node_modules
COPY --from=builder /app/packages/ui/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
