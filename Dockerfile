# ============================================
# Stage 1: Builder
# ============================================
FROM node:20-alpine AS builder

# FIX: Install OpenSSL required by Prisma in Alpine
RUN apk add --no-cache openssl

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* ./

# Install dependencies (including devDependencies for build)
RUN if [ -f yarn.lock ]; then yarn install --frozen-lockfile; \
    elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm install --frozen-lockfile; \
    elif [ -f package-lock.json ]; then npm ci; \
    else npm install; \
    fi

# Copy Prisma schema and generate client
COPY prisma ./prisma/
RUN npx prisma@5.9.0 generate

# Copy source code
COPY . .

# Build NestJS application
RUN npm run build

# ============================================
# Stage 2: Production
# ============================================
FROM node:20-alpine AS production

# FIX: Install OpenSSL required by Prisma in Alpine
RUN apk add --no-cache openssl

WORKDIR /app

# Set Node environment
ENV NODE_ENV=production

# Copy package files
COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* ./

# Install production dependencies only
RUN if [ -f yarn.lock ]; then yarn install --production --frozen-lockfile; \
    elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm install --prod --frozen-lockfile; \
    elif [ -f package-lock.json ]; then npm ci --only=production; \
    else npm install --only=production; \
    fi

# Copy built application
COPY --from=builder /app/dist ./dist

# Copy Prisma client and schema from builder
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/prisma ./prisma

# Expose port
EXPOSE 3000

# Run migrations and start application
CMD ["sh", "-c", "npx prisma@5.9.0 migrate deploy && node dist/main"]