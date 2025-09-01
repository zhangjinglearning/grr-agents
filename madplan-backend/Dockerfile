# Multi-stage production Dockerfile for MadPlan Backend
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++ && ln -sf python3 /usr/bin/python

# Copy package files for dependency installation
COPY package*.json ./
COPY tsconfig*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY src/ ./src/
COPY scripts/ ./scripts/

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S backend -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force && \
    chown -R backend:nodejs /app

# Copy built application from builder stage
COPY --from=builder --chown=backend:nodejs /app/dist ./dist
COPY --from=builder --chown=backend:nodejs /app/scripts ./scripts

# Create necessary directories
RUN mkdir -p logs && chown backend:nodejs logs

# Switch to non-root user
USER backend

# Expose application port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node ./dist/scripts/health-check.js

# Start the application with dumb-init
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]

# Labels for container identification
LABEL org.opencontainers.image.title="MadPlan Backend"
LABEL org.opencontainers.image.description="Studio Ghibli-inspired Kanban board backend API"
LABEL org.opencontainers.image.version="${VERSION:-latest}"
LABEL org.opencontainers.image.vendor="MadPlan"