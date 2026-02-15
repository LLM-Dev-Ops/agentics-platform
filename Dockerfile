FROM node:20-alpine AS builder

WORKDIR /app

# Copy root workspace config
COPY package.json package-lock.json tsconfig.base.json ./

# Copy workspace package.json files that @agentics/api depends on
COPY packages/api/package.json ./packages/api/
COPY packages/agents/package.json ./packages/agents/
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/shared/package.json ./packages/shared/
COPY packages/ruvector-client/package.json ./packages/ruvector-client/

# Install all workspace dependencies
RUN npm ci --workspace=@agentics/shared \
           --workspace=@agentics/contracts \
           --workspace=@agentics/ruvector-client \
           --workspace=@agentics/agents \
           --workspace=@agentics/api

# Copy source for all required workspaces
COPY packages/shared/ ./packages/shared/
COPY packages/contracts/ ./packages/contracts/
COPY packages/ruvector-client/ ./packages/ruvector-client/
COPY packages/agents/ ./packages/agents/
COPY packages/api/ ./packages/api/

# Build dependencies first, then API
RUN npm run build --workspace=@agentics/shared --if-present && \
    npm run build --workspace=@agentics/contracts --if-present && \
    npm run build --workspace=@agentics/ruvector-client --if-present && \
    npm run build --workspace=@agentics/agents --if-present && \
    npm run build --workspace=@agentics/api

# Production stage
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
ENV HOST=0.0.0.0

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser

# Copy built artifacts and node_modules
COPY --from=builder /app/packages/api/dist ./dist
COPY --from=builder /app/packages/api/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages

USER appuser

EXPOSE 8080

CMD ["node", "dist/index.js"]
