# ============================================
# Stage 1: Builder
# ============================================
FROM node:20-slim AS builder

# Explicitly install OpenSSL headers
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* ./

RUN if [ -f yarn.lock ]; then yarn install --frozen-lockfile; \
    elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm install --frozen-lockfile; \
    elif [ -f package-lock.json ]; then npm ci; \
    else npm install; \
    fi

COPY prisma ./prisma/
RUN npx prisma generate

COPY . .

RUN npm run build

RUN sh -c "ls -la dist/ || (echo 'ERROR: dist folder is completely missing!' && exit 1)"

# ============================================
# Stage 2: Production
# ============================================
FROM node:20-slim AS production

# Explicitly install OpenSSL headers
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* ./

RUN if [ -f yarn.lock ]; then yarn install --production --frozen-lockfile; \
    elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm install --prod --frozen-lockfile; \
    elif [ -f package-lock.json ]; then npm ci --only=production; \
    else npm install --only=production; \
    fi

# =============================================
# CRITICAL FIX FOR PRISMA DOCKER BUG
# Copy the working Prisma engines from the builder 
# stage to prevent runtime OpenSSL detection errors
# =============================================
COPY --from=builder /app/node_modules/.prisma /app/node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma /app/node_modules/@prisma

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

RUN npx prisma generate

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/api/docs || exit 1

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]