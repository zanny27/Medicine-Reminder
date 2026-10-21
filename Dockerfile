# ==========================================
# Stage 1: Build stage (compiles native modules)
# ==========================================
FROM node:22-slim AS builder

WORKDIR /app

# Install native build tools required for better-sqlite3 compilation
RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 make g++ && \
    rm -rf /var/lib/apt/lists/*

# Copy dependency manifests
COPY package.json package-lock.json ./

# Install production dependencies and clean cache
RUN npm ci --only=production && \
    npm cache clean --force

# ==========================================
# Stage 2: Production runtime stage (lean & clean)
# ==========================================
FROM node:22-slim AS runner

WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Copy built node_modules from builder stage
COPY --from=builder /app/node_modules ./node_modules

# Copy application source code
COPY . .

# Ensure data directory exists for SQLite persistence
RUN mkdir -p /app/data

EXPOSE 5000

CMD ["node", "server.js"]