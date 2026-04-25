# ============================================
# Stage 1: Builder
# ============================================
FROM node:20-slim AS builder

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* ./

RUN if [ -f yarn.lock ]; then yarn install --frozen-lockfile; \
    elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm install --frozen-lockfile; \
    elif [ -f package-lock.json ]; then npm ci; \
    else npm install; \
    fi

# Copy ALL source code first
COPY . .

# =============================================
# FIX: RAILWAY BUILD PHASE TRICK
# Set a dummy DATABASE_URL so Prisma schema validation 
# passes during the Docker build phase. The REAL URL 
# from Railway/Docker will override this at runtime.
# =============================================
ENV DATABASE_URL="postgresql://user:pass@localhost:5432/dummy"

# Generate Prisma Client
RUN npx prisma generate

# BUILD THE APP
RUN npm run build

# Verify build succeeded
RUN sh -c "ls -la dist/ || (echo 'ERROR: dist folder is completely missing!' && exit 1)"

# ============================================
# Stage 2: Production
# ============================================
FROM node:20-slim AS production

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production

# NOTE: We do NOT set DATABASE_URL here. 
# We want Railway/Docker-Compose to inject the real one at runtime.

COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* ./

RUN if [ -f yarn.lock ]; then yarn install --production --frozen-lockfile; \
    elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm install --prod --frozen-lockfile; \
    elif [ -f package-lock.json ]; then npm ci --only=production; \
    else npm install --only=production; \
    fi

# Copy built application and Prisma schema
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Copy the exact generated client from builder
COPY --from=builder /app/node_modules/.prisma /app/node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma /app/node_modules/@prisma

EXPOSE 3000

# Use /api/docs for healthcheck (change to /api/health if you added that endpoint)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/api/docs || exit 1

# At runtime, Railway injects the REAL DATABASE_URL, 
# so migrate deploy connects to Neon successfully.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]