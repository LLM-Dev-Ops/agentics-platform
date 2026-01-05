# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY packages/api/package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm install

# Copy source code and tsconfig
COPY packages/api/src ./src
COPY packages/api/tsconfig.json ./
COPY tsconfig.base.json ./

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY packages/api/package*.json ./

# Install production dependencies only
RUN npm install --omit=dev

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Expose port
EXPOSE 8080

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080
ENV HOST=0.0.0.0

# Start the application
CMD ["node", "dist/index.js"]
