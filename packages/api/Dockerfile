# Build stage - build from monorepo root to access workspace packages
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package files for workspace resolution
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/api/package*.json ./packages/api/

# Install all dependencies
RUN npm install --workspaces --include-workspace-root

# Copy source code for shared and api packages
COPY packages/shared ./packages/shared
COPY packages/api ./packages/api
COPY tsconfig.base.json ./

# Build shared package first, then api
RUN npm run build --workspace=@agentics/shared
RUN npm run build --workspace=@agentics/api

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/api/package*.json ./packages/api/

# Install production dependencies only
RUN npm install --workspaces --include-workspace-root --omit=dev

# Copy built files from builder
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/api/dist ./packages/api/dist

# Expose port
EXPOSE 8080

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080
ENV HOST=0.0.0.0

WORKDIR /app/packages/api

# Start the application
CMD ["node", "dist/index.js"]
