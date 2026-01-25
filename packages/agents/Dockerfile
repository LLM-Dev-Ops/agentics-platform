# =============================================================================
# AGENTICS-DEV-PLATFORM AGENTS SERVICE
# =============================================================================
# Unified control-plane service for executive decisioning, synthesis, and
# platform governance agents.
#
# DEPLOYMENT MODEL:
# - Single unified service (NO standalone agent deployments)
# - Stateless execution
# - All persistence via ruvector-service
# - Environment-based configuration
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Builder
# -----------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy workspace configuration
COPY package*.json ./
COPY tsconfig.base.json ./

# Copy all package.json files for workspace resolution
COPY packages/shared/package*.json ./packages/shared/
COPY packages/contracts/package*.json ./packages/contracts/
COPY packages/ruvector-client/package*.json ./packages/ruvector-client/
COPY packages/agents/package*.json ./packages/agents/

# Install all dependencies
RUN npm ci --workspace=@agentics/shared \
    --workspace=@agentics/contracts \
    --workspace=@agentics/ruvector-client \
    --workspace=@agentics/agents

# Copy source files
COPY packages/shared ./packages/shared
COPY packages/contracts ./packages/contracts
COPY packages/ruvector-client ./packages/ruvector-client
COPY packages/agents ./packages/agents

# Build packages in dependency order
RUN npm run build --workspace=@agentics/shared
RUN npm run build --workspace=@agentics/contracts
RUN npm run build --workspace=@agentics/ruvector-client
RUN npm run build --workspace=@agentics/agents

# -----------------------------------------------------------------------------
# Stage 2: Production
# -----------------------------------------------------------------------------
FROM node:20-alpine AS production

WORKDIR /app

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 agentics

# Copy package files
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/contracts/package*.json ./packages/contracts/
COPY packages/ruvector-client/package*.json ./packages/ruvector-client/
COPY packages/agents/package*.json ./packages/agents/

# Install production dependencies only
RUN npm ci --omit=dev \
    --workspace=@agentics/shared \
    --workspace=@agentics/contracts \
    --workspace=@agentics/ruvector-client \
    --workspace=@agentics/agents

# Copy built artifacts
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/contracts/dist ./packages/contracts/dist
COPY --from=builder /app/packages/ruvector-client/dist ./packages/ruvector-client/dist
COPY --from=builder /app/packages/agents/dist ./packages/agents/dist

# Set ownership
RUN chown -R agentics:nodejs /app

# Switch to non-root user
USER agentics

# Environment configuration
ENV NODE_ENV=production
ENV PORT=8080
ENV HOST=0.0.0.0

# Service identification
ENV SERVICE_NAME=agentics-agents
ENV SERVICE_VERSION=0.1.0

# Apex layer configuration
# These identify this service as an Apex control-plane agent
ENV AGENT_NAME=agentics-agents
ENV AGENT_PHASE=apex
ENV AGENT_LAYER=layer5

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# Start the unified agents service
WORKDIR /app/packages/agents
CMD ["node", "dist/server/index.js"]
