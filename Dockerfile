FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install system dependencies and wait utilities
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    postgresql-client \
    curl

# Copy package files first (for better caching)
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy application code
COPY . .

# Create necessary directories with proper permissions
RUN mkdir -p logs uploads data && \
    chown -R node:node /app

# Copy wait script for database readiness
COPY scripts/wait-for-db.sh /wait-for-db.sh
RUN chmod +x /wait-for-db.sh

# Switch to node user
USER node

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Wait for database, then start application
CMD ["/wait-for-db.sh", "postgres", "5432", "--", "npm", "start"]
