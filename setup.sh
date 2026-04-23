#!/bin/bash
set -e

PROJECT_NAME="saas-backend"
echo "🚀 Creating $PROJECT_NAME..."

mkdir -p "$PROJECT_NAME"/{src/{modules/{auth/dto,plans/dto,customers/dto,subscriptions/dto,payments/dto,billing,accounting/dto,reports/dto},common/{decorators,guards,interceptors,filters},prisma},prisma,docs}
cd "$PROJECT_NAME"

echo "📝 Writing 56 files (Exact match to specification)..."

cat << 'ENDOFFILE' > package.json
{
  "name": "saas-subscription-backend",
  "version": "1.0.0",
  "description": "Production-grade SaaS Subscription Management Backend",
  "private": true,
  "scripts": {
    "build": "nest build",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "start:prod": "node dist/main",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:migrate:deploy": "prisma migrate deploy",
    "prisma:seed": "ts-node prisma/seed.ts",
    "setup": "prisma generate && prisma migrate deploy && prisma db seed"
  },
  "dependencies": {
    "@nestjs/common": "^10.3.0",
    "@nestjs/core": "^10.3.0",
    "@nestjs/jwt": "^10.2.0",
    "@nestjs/passport": "^10.0.3",
    "@nestjs/platform-express": "^10.3.0",
    "@nestjs/swagger": "^7.2.0",
    "@prisma/client": "^5.9.0",
    "bcrypt": "^5.1.1",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.14.1",
    "passport": "^0.7.0",
    "passport-jwt": "^4.0.1",
    "reflect-metadata": "^0.2.1",
    "rxjs": "^7.8.1"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.3.0",
    "@nestjs/schematics": "^10.1.0",
    "@types/bcrypt": "^5.0.2",
    "@types/express": "^4.17.21",
    "@types/node": "^20.11.0",
    "@types/passport-jwt": "^4.0.1",
    "prisma": "^5.9.0",
    "ts-node": "^10.9.2",
    "typescript": "^5.3.3"
  },
  "prisma": {
    "seed": "ts-node prisma/seed.ts"
  }
}
ENDOFFILE

cat << 'ENDOFFILE' > tsconfig.json
{
  "compilerOptions": {
    "module": "commonjs",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2021",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true,
    "strictNullChecks": true,
    "noImplicitAny": true,
    "strictBindCallApply": true,
    "forceConsistentCasingInFileNames": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true
  }
}
ENDOFFILE

cat << 'ENDOFFILE' > tsconfig.build.json
{
  "extends": "./tsconfig.json",
  "exclude": ["node_modules", "dist", "test", "**/*spec.ts"]
}
ENDOFFILE

cat << 'ENDOFFILE' > nest-cli.json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true
  }
}
ENDOFFILE

cat << 'ENDOFFILE' > .env.example
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/saas_billing?schema=public
JWT_SECRET=change-this-to-a-secure-random-string-in-production
JWT_EXPIRATION=24h
PORT=3000
NODE_ENV=development
ENDOFFILE

cat << 'ENDOFFILE' > .gitignore
node_modules/
dist/
.env
*.log
ENDOFFILE

cat << 'ENDOFFILE' > Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY prisma ./prisma/
RUN npx prisma generate
COPY . .
RUN npm run build

FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
RUN npx prisma generate
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
ENDOFFILE

cat << 'ENDOFFILE' > docker-compose.yml
version: '3.8'
services:
  app:
    build: .
    container_name: saas-app
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@postgres:5432/saas_billing?schema=public
      - JWT_SECRET=super-secret-jwt-key-for-docker-local-only
      - JWT_EXPIRATION=24h
      - NODE_ENV=production
      - PORT=3000
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped
  postgres:
    image: postgres:16-alpine
    container_name: saas-postgres
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: saas_billing
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d saas_billing"]
      interval: 5s
      timeout: 5s
      retries: 5
volumes:
  pgdata:
ENDOFFILE

cat << 'ENDOFFILE' > README.md
# SaaS Subscription Management Backend

A production-grade, multi-tenant SaaS backend handling subscription lifecycle, automated billing, and strict double-entry bookkeeping.

## Architecture Decisions

1. **Shared Schema Multi-Tenancy**: Row-level isolation via Prisma Middleware + AsyncLocalStorage. Simpler ops than separate schemas.
2. **Prisma Middleware**: Injects `tenantId` transparently into DB queries so developers never miss a filter.
3. **Double-Entry Bookkeeping**: No balance columns. Balances are derived from Journal Lines for perfect auditability.
4. **Deferred Revenue**: Uses accrual accounting (ASC 606). Revenue is recognized only after the service period ends.

## Local Setup

```bash
docker-compose up -d --build
docker-compose exec app npx prisma db seed
Open http://localhost:3000/api/docs

Demo Credentials
Email: admin@acme.com
Password: password123
Accounting Flow Example ($100 Bronze Plan)
Invoice: Debit A/R (1100) $100 | Credit Deferred Rev (2000) $100
Payment: Debit Cash (1000) $100 | Credit A/R (1100) $100
Month-End: Debit Deferred Rev (2000) $100 | Credit Sub Rev (4000) $100
ENDOFFILE
cat << 'ENDOFFILE' > prisma/schema.prisma
generator client {
provider = "prisma-client-js"
}

datasource db {
provider = "postgresql"
url = env("DATABASE_URL")
}

model Tenant {
id String @id @default(uuid())
name String
email String @unique
createdAt DateTime @default(now())
updatedAt DateTime @updatedAt
users User[]
customers Customer[]
plans Plan[]
subscriptions Subscription[]
invoices Invoice[]
payments Payment[]
accounts Account[]
journalEntries JournalEntry[]
}

model User {
id String @id @default(uuid())
tenantId String
email String
passwordHash String
role Role @default(MEMBER)
createdAt DateTime @default(now())
updatedAt DateTime @updatedAt
tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
@@unique([tenantId, email])
@@index([tenantId])
}

enum Role {
ADMIN
MEMBER
}

model Account {
id String @id @default(uuid())
tenantId String
code String
name String
type AccountType
createdAt DateTime @default(now())
updatedAt DateTime @updatedAt
tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
journalLines JournalLine[]
@@unique([tenantId, code])
@@index([tenantId])
}

enum AccountType {
ASSET
LIABILITY
REVENUE
EXPENSE
}

model Plan {
id String @id @default(uuid())
tenantId String
name String
price Decimal @db.Decimal(12, 2)
currency String @default("USD")
intervalDays Int
isActive Boolean @default(true)
createdAt DateTime @default(now())
updatedAt DateTime @updatedAt
tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
subscriptions Subscription[]
@@index([tenantId])
@@index([tenantId, isActive])
}

model Customer {
id String @id @default(uuid())
tenantId String
name String
email String
createdAt DateTime @default(now())
updatedAt DateTime @updatedAt
tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
subscriptions Subscription[]
invoices Invoice[]
@@unique([tenantId, email])
@@index([tenantId])
}

model Subscription {
id String @id @default(uuid())
tenantId String
customerId String
planId String
status SubscriptionStatus @default(ACTIVE)
startDate DateTime
nextBillingDate DateTime
createdAt DateTime @default(now())
updatedAt DateTime @updatedAt
tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
customer Customer @relation(fields: [customerId], references: [id])
plan Plan @relation(fields: [planId], references: [id])
invoices Invoice[]
@@index([tenantId])
@@index([tenantId, status])
@@index([tenantId, status, nextBillingDate])
}

enum SubscriptionStatus {
ACTIVE
CANCELLED
}

model Invoice {
id String @id @default(uuid())
tenantId String
subscriptionId String
customerId String
amount Decimal @db.Decimal(12, 2)
status InvoiceStatus @default(PENDING)
periodStart DateTime
periodEnd DateTime
createdAt DateTime @default(now())
updatedAt DateTime @updatedAt
tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
subscription Subscription @relation(fields: [subscriptionId], references: [id])
customer Customer @relation(fields: [customerId], references: [id])
payment Payment?
@@index([tenantId])
@@index([tenantId, status])
@@index([tenantId, periodEnd])
}

enum InvoiceStatus {
PENDING
PAID
}

model Payment {
id String @id @default(uuid())
tenantId String
invoiceId String @unique
amount Decimal @db.Decimal(12, 2)
paidAt DateTime @default(now())
createdAt DateTime @default(now())
updatedAt DateTime @updatedAt
tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
invoice Invoice @relation(fields: [invoiceId], references: [id])
@@index([tenantId])
}

model JournalEntry {
id String @id @default(uuid())
tenantId String
description String
referenceType String?
referenceId String?
createdAt DateTime @default(now())
tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
lines JournalLine[]
@@index([tenantId])
@@index([tenantId, referenceType, referenceId])
@@index([referenceType, referenceId])
}

model JournalLine {
id String @id @default(uuid())
journalEntryId String
accountId String
type JournalLineType
amount Decimal @db.Decimal(12, 2)
journalEntry JournalEntry @relation(fields: [journalEntryId], references: [id], onDelete: Cascade)
account Account @relation(fields: [accountId], references: [id])
@@index([journalEntryId])
@@index([accountId])
}

enum JournalLineType {
DEBIT
CREDIT
}
ENDOFFILE

cat << 'ENDOFFILE' > prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const BCRYPT_ROUNDS = 12;

const DEFAULT_CHART_OF_ACCOUNTS = [
{ code: '1000', name: 'Cash', type: 'ASSET' as const },
{ code: '1100', name: 'Accounts Receivable', type: 'ASSET' as const },
{ code: '2000', name: 'Deferred Revenue', type: 'LIABILITY' as const },
{ code: '4000', name: 'Subscription Revenue', type: 'REVENUE' as const },
];

async function main() {
console.log('🌱 Starting seed...');
console.log('🧹 Cleaning up existing data...');
await prisma.journalLine.deleteMany();
await prisma.journalEntry.deleteMany();
await prisma.payment.deleteMany();
await prisma.invoice.deleteMany();
await prisma.subscription.deleteMany();
await prisma.customer.deleteMany();
await prisma.plan.deleteMany();
await prisma.account.deleteMany();
await prisma.user.deleteMany();
await prisma.tenant.deleteMany();

console.log('🏢 Creating tenant: Acme Corp');
const tenant = await prisma.tenant.create({
data: { name: 'Acme Corp', email: 'acme@corp.com' },
});

console.log('👤 Creating admin user...');
const passwordHash = await bcrypt.hash('password123', BCRYPT_ROUNDS);
await prisma.user.create({
data: {
tenantId: tenant.id,
email: 'admin@acme.com',
passwordHash,
role: 'ADMIN',
},
});

console.log('📊 Creating chart of accounts...');
await prisma.account.createMany({
data: DEFAULT_CHART_OF_ACCOUNTS.map((account) => ({
tenantId: tenant.id,
...account,
})),
});

const accounts = await prisma.account.findMany({ where: { tenantId: tenant.id } });
const accountMap = new Map(accounts.map((a) => [a.code, a.id]));

console.log('📦 Creating plans...');
const bronzePlan = await prisma.plan.create({
data: { tenantId: tenant.id, name: 'Bronze Plan', price: 100.00, currency: 'USD', intervalDays: 30, isActive: true },
});
const goldPlan = await prisma.plan.create({
data: { tenantId: tenant.id, name: 'Gold Plan', price: 500.00, currency: 'USD', intervalDays: 30, isActive: true },
});

console.log('👥 Creating customers...');
const alice = await prisma.customer.create({
data: { tenantId: tenant.id, name: 'Alice Johnson', email: 'alice@acme-customer.com' },
});
const bob = await prisma.customer.create({
data: { tenantId: tenant.id, name: 'Bob Smith', email: 'bob@acme-customer.com' },
});

const now = new Date();
const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

console.log('🔄 Creating subscriptions...');
const aliceSub = await prisma.subscription.create({
data: { tenantId: tenant.id, customerId: alice.id, planId: bronzePlan.id, status: 'ACTIVE', startDate: firstDayOfMonth, nextBillingDate: firstDayOfMonth },
});
const bobSub = await prisma.subscription.create({
data: { tenantId: tenant.id, customerId: bob.id, planId: goldPlan.id, status: 'ACTIVE', startDate: firstDayOfMonth, nextBillingDate: firstDayOfMonth },
});

console.log('🧾 Generating invoices...');
const alicePeriodEnd = new Date(firstDayOfMonth); alicePeriodEnd.setDate(alicePeriodEnd.getDate() + 29);
const bobPeriodEnd = new Date(firstDayOfMonth); bobPeriodEnd.setDate(bobPeriodEnd.getDate() + 29);

const aliceInvoice = await prisma.invoice.create({
data: { tenantId: tenant.id, subscriptionId: aliceSub.id, customerId: alice.id, amount: 100.00, status: 'PENDING', periodStart: firstDayOfMonth, periodEnd: alicePeriodEnd },
});
const bobInvoice = await prisma.invoice.create({
data: { tenantId: tenant.id, subscriptionId: bobSub.id, customerId: bob.id, amount: 500.00, status: 'PENDING', periodStart: firstDayOfMonth, periodEnd: bobPeriodEnd },
});

const nextBilling = new Date(firstDayOfMonth); nextBilling.setDate(nextBilling.getDate() + 30);
await prisma.subscription.updateMany({
where: { id: { in: [aliceSub.id, bobSub.id] } },
data: { nextBillingDate: nextBilling },
});

console.log('📒 Recording invoice journal entries...');
await prisma.journalEntry.create({
data: {
tenantId: tenant.id, description: Invoice created for Alice Johnson - Bronze Plan, referenceType: 'INVOICE', referenceId: aliceInvoice.id,
lines: { create: [
{ accountId: accountMap.get('1100')!, type: 'DEBIT', amount: 100.00 },
{ accountId: accountMap.get('2000')!, type: 'CREDIT', amount: 100.00 },
]}
},
});
await prisma.journalEntry.create({
data: {
tenantId: tenant.id, description: Invoice created for Bob Smith - Gold Plan, referenceType: 'INVOICE', referenceId: bobInvoice.id,
lines: { create: [
{ accountId: accountMap.get('1100')!, type: 'DEBIT', amount: 500.00 },
{ accountId: accountMap.get('2000')!, type: 'CREDIT', amount: 500.00 },
]}
},
});

console.log('💳 Recording payments...');
await prisma.invoice.updateMany({ where: { id: { in: [aliceInvoice.id, bobInvoice.id] } }, data: { status: 'PAID' } });

const alicePayment = await prisma.payment.create({ data: { tenantId: tenant.id, invoiceId: aliceInvoice.id, amount: 100.00 } });
const bobPayment = await prisma.payment.create({ data: { tenantId: tenant.id, invoiceId: bobInvoice.id, amount: 500.00 } });

await prisma.journalEntry.create({
data: {
tenantId: tenant.id, description: Payment received for Alice, referenceType: 'PAYMENT', referenceId: alicePayment.id,
lines: { create: [
{ accountId: accountMap.get('1000')!, type: 'DEBIT', amount: 100.00 },
{ accountId: accountMap.get('1100')!, type: 'CREDIT', amount: 100.00 },
]}
},
});
await prisma.journalEntry.create({
data: {
tenantId: tenant.id, description: Payment received for Bob, referenceType: 'PAYMENT', referenceId: bobPayment.id,
lines: { create: [
{ accountId: accountMap.get('1000')!, type: 'DEBIT', amount: 500.00 },
{ accountId: accountMap.get('1100')!, type: 'CREDIT', amount: 500.00 },
]}
},
});

console.log('📈 Recognizing revenue...');
await prisma.journalEntry.create({
data: {
tenantId: tenant.id, description: Revenue recognition for Alice, referenceType: 'REVENUE_RECOGNITION', referenceId: aliceInvoice.id,
lines: { create: [
{ accountId: accountMap.get('2000')!, type: 'DEBIT', amount: 100.00 },
{ accountId: accountMap.get('4000')!, type: 'CREDIT', amount: 100.00 },
]}
},
});
await prisma.journalEntry.create({
data: {
tenantId: tenant.id, description: Revenue recognition for Bob, referenceType: 'REVENUE_RECOGNITION', referenceId: bobInvoice.id,
lines: { create: [
{ accountId: accountMap.get('2000')!, type: 'DEBIT', amount: 500.00 },
{ accountId: accountMap.get('4000')!, type: 'CREDIT', amount: 500.00 },
]}
},
});

console.log('\n✅ Seed completed successfully!\n');
console.log('Email: admin@acme.com\nPassword: password123\nTenant: Acme Corp');
}

main().catch((e) => { console.error('❌ Seed failed:', e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
ENDOFFILE

cat << 'ENDOFFILE' > docs/collection.json
{
"info": { "name": "SaaS API", "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json" },
"variable": [
{ "key": "base_url", "value": "http://localhost:3000/api" },
{ "key": "token", "value": "" }
],
"item": [
{ "name": "1. Login", "request": { "method": "POST", "header": [{ "key": "Content-Type", "value": "application/json" }], "url": { "raw": "{{base_url}}/auth/login", "host": ["{{base_url}}"], "path": ["auth", "login"] }, "body": { "mode": "raw", "raw": "{\n "email": "admin@acme.com",\n "password": "password123"\n}" } }, "event": [{ "listen": "test", "script": { "exec": ["const res = pm.response.json();", "pm.collectionVariables.set('token', res.accessToken);"] } }] },
{ "name": "2. Get Plans", "request": { "method": "GET", "header": [{ "key": "Authorization", "value": "Bearer {{token}}" }], "url": { "raw": "{{base_url}}/plans", "host": ["{{base_url}}"], "path": ["plans"] } } },
{ "name": "3. Get Customers", "request": { "method": "GET", "header": [{ "key": "Authorization", "value": "Bearer {{token}}" }], "url": { "raw": "{{base_url}}/customers", "host": ["{{base_url}}"], "path": ["customers"] } } },
{ "name": "4. Get Subscriptions", "request": { "method": "GET", "header": [{ "key": "Authorization", "value": "Bearer {{token}}" }], "url": { "raw": "{{base_url}}/subscriptions", "host": ["{{base_url}}"], "path": ["subscriptions"] } } },
{ "name": "5. Generate Invoices (Cron)", "request": { "method": "POST", "header": [{ "key": "Content-Type", "value": "application/json" }], "url": { "raw": "{{base_url}}/billing/generate-monthly-invoices", "host": ["{{base_url}}"], "path": ["billing", "generate-monthly-invoices"] } } },
{ "name": "6. Balance Sheet", "request": { "method": "GET", "header": [{ "key": "Authorization", "value": "Bearer {{token}}" }], "url": { "raw": "{{base_url}}/reports/balance-sheet", "host": ["{{base_url}}"], "path": ["reports", "balance-sheet"] } } },
{ "name": "7. Income Statement", "request": { "method": "GET", "header": [{ "key": "Authorization", "value": "Bearer {{token}}" }], "url": { "raw": "{{base_url}}/reports/income-statement?from=2020-01-01&to=2030-12-31", "host": ["{{base_url}}"], "path": ["reports", "income-statement"], "query": [{ "key": "from", "value": "2020-01-01" }, { "key": "to", "value": "2030-12-31" }] } } }
]
}
ENDOFFILE

cat << 'ENDOFFILE' > src/main.ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
const app = NestFactory.create(AppModule);
app.setGlobalPrefix('api');
app.useGlobalPipes(
new ValidationPipe({
whitelist: true,
forbidNonWhitelisted: true,
transform: true,
transformOptions: { enableImplicitConversion: true },
}),
);
app.useGlobalFilters(new GlobalExceptionFilter());
app.useGlobalInterceptors(new LoggingInterceptor());
app.enableCors({ origin: true, credentials: true });

const config = new DocumentBuilder()
.setTitle('SaaS Subscription Management API')
.setDescription('Production-grade subscription billing and accounting backend')
.setVersion('1.0.0')
.addBearerAuth()
.addTag('Auth', 'Authentication and tenant registration')
.addTag('Plans', 'Subscription plan management')
.addTag('Customers', 'Customer management')
.addTag('Subscriptions', 'Subscription lifecycle')
.addTag('Payments', 'Payment processing')
.addTag('Billing', 'Automated billing engine')
.addTag('Accounting', 'Double-entry bookkeeping')
.addTag('Reports', 'Financial reporting')
.build();

const document = SwaggerModule.createDocument(app, config);
SwaggerModule.setup('api/docs', app, document, {
swaggerOptions: { persistAuthorization: true, tagsSorter: 'alpha', operationsSorter: 'method' },
});

const port = process.env.PORT || 3000;
await app.listen(port);
console.log(`\n  🚀 SaaS Backend running on http://localhost:${port}/api/docs\n`);
}
bootstrap();
ENDOFFILE

cat << 'ENDOFFILE' > src/app.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { PlansModule } from './modules/plans/plans.module';
import { CustomersModule } from './modules/customers/customers.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { BillingModule } from './modules/billing/billing.module';
import { AccountingModule } from './modules/accounting/accounting.module';
import { ReportsModule } from './modules/reports/reports.module';

@Module({
imports: [
PrismaModule,
AuthModule,
PlansModule,
CustomersModule,
SubscriptionsModule,
PaymentsModule,
BillingModule,
AccountingModule,
ReportsModule,
],
})
export class AppModule {}
ENDOFFILE

--- COMMON ---
cat << 'ENDOFFILE' > src/common/tenant-context.ts
import { AsyncLocalStorage } from 'async_hooks';

interface TenantContextData {
tenantId: string;
}

export class TenantContext {
private static readonly storage = new AsyncLocalStorage<TenantContextData>();

static run<T>(tenantId: string, callback: () => T): T {
return this.storage.run({ tenantId }, callback);
}

static getTenantId(): string | undefined {
const store = this.storage.getStore();
return store?.tenantId;
}

static requireTenantId(): string {
const tenantId = this.getTenantId();
if (!tenantId) {
throw new Error('Tenant context not available');
}
return tenantId;
}
}
ENDOFFILE

cat << 'ENDOFFILE' > src/common/decorators/current-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
(data: string | undefined, ctx: ExecutionContext) => {
const request = ctx.switchToHttp().getRequest();
const user = request.user;
return data ? user?.[data] : user;
},
);
ENDOFFILE

cat << 'ENDOFFILE' > src/common/decorators/current-tenant.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentTenant = createParamDecorator(
(data: unknown, ctx: ExecutionContext): string => {
const request = ctx.switchToHttp().getRequest();
const tenantId = request.user?.tenantId;
if (!tenantId) {
throw new Error('CurrentTenant decorator used without authenticated user context');
}
return tenantId;
},
);
ENDOFFILE

cat << 'ENDOFFILE' > src/common/decorators/public.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
ENDOFFILE

cat << 'ENDOFFILE' > src/common/guards/jwt-auth.guard.ts
import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
constructor(private reflector: Reflector) {
super();
}

canActivate(context: ExecutionContext) {
const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
context.getHandler(),
context.getClass(),
]);
if (isPublic) return true;
return super.canActivate(context);
}

handleRequest(err: any, user: any) {
if (err || !user) {
throw err || new UnauthorizedException('Invalid or expired token');
}
return user;
}
}
ENDOFFILE

cat << 'ENDOFFILE' > src/common/guards/tenant.guard.ts
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class TenantGuard implements CanActivate {
constructor(private reflector: Reflector) {}

canActivate(context: ExecutionContext): boolean {
const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
context.getHandler(),
context.getClass(),
]);
if (isPublic) return true;

const request = context.switchToHttp().getRequest();
const { tenantId } = request.user || {};
if (!tenantId) {
throw new UnauthorizedException('Tenant context not found in token.');
}
return true;
}
}
ENDOFFILE

cat << 'ENDOFFILE' > src/common/interceptors/logging.interceptor.ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
private readonly logger = new Logger('HTTP');

intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
const request = context.switchToHttp().getRequest();
const { method, url } = request;
const now = Date.now();

return next.handle().pipe(
tap({
next: () => {
const response = context.switchToHttp().getResponse();
this.logger.log(`${method} ${url} ${response.statusCode} - ${Date.now() - now}ms`);
},
error: (error) => {
this.logger.error(`${method} ${url} ${error.status || 500} - ${Date.now() - now}ms - ${error.message}`);
},
}),
);
}
}
ENDOFFILE

cat << 'ENDOFFILE' > src/common/interceptors/tenant.interceptor.ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { Reflector } from '@nestjs/core';
import { TenantContext } from '../tenant-context';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class TenantInterceptor implements NestInterceptor {
constructor(private reflector: Reflector) {}

intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
context.getHandler(),
context.getClass(),
]);
if (isPublic) return next.handle();

const request = context.switchToHttp().getRequest();
const { tenantId } = request.user || {};
if (!tenantId) return next.handle();

return new Observable((subscriber) => {
TenantContext.run(tenantId, () => {
return next.handle().subscribe({
next: (value) => subscriber.next(value),
error: (err) => subscriber.error(err),
complete: () => subscriber.complete(),
});
});
});
}
}
ENDOFFILE

cat << 'ENDOFFILE' > src/common/filters/global-exception.filter.ts
import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
private readonly logger = new Logger('ExceptionFilter');

catch(exception: unknown, host: ArgumentsHost): void {
const ctx = host.switchToHttp();
const response = ctx.getResponse<Response>();
const request = ctx.getRequest<Request>();

let status = HttpStatus.INTERNAL_SERVER_ERROR;
let message: string | string[] = 'Internal server error';

if (exception instanceof HttpException) {
status = exception.getStatus();
const exceptionResponse = exception.getResponse();
if (typeof exceptionResponse === 'string') {
message = exceptionResponse;
} else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
const resp = exceptionResponse as Record<string, unknown>;
message = (resp.message as string | string[]) || exception.message;
if (Array.isArray(message)) {
message = message.map((m) => (typeof m === 'string' ? m : JSON.stringify(m)));
}
}
} else if (exception instanceof Error) {
message = exception.message;
}

if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
this.logger.error(`Unhandled exception: ${exception instanceof Error ? exception.stack : JSON.stringify(exception)}`);
}

response.status(status).json({
statusCode: status,
message,
timestamp: new Date().toISOString(),
path: request.url,
});
}
}
ENDOFFILE

--- PRISMA ---
cat << 'ENDOFFILE' > src/prisma/prisma.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { TenantContext } from '../common/tenant-context';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
constructor() {
super({
log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});
this.setupTenantMiddleware();
}

async onModuleInit() {
await this.$connect();
}

async onModuleDestroy() {
await this.$disconnect();
}

private setupTenantMiddleware(): void {
const tenantScopedModels: string[] = [
'user', 'customer', 'plan', 'subscription',
'invoice', 'payment', 'account', 'journalEntry',
];

this.$use(async (params: any, next: (params: any) => Promise<any>) => {
const tenantId = TenantContext.getTenantId();
if (!tenantId || !tenantScopedModels.includes(params.model)) {
return next(params);
}

const args = { ...params.args };

switch (params.action) {
case 'findUnique':
case 'findFirst':
args.where = { ...(args.where || {}), tenantId };
break;
case 'findMany':
case 'count':
args.where = args.where ? { ...args.where, tenantId } : { tenantId };
break;
case 'create':
args.data = { ...(args.data || {}), tenantId };
break;
case 'update':
args.where = { ...(args.where || {}), tenantId };
break;
case 'updateMany':
args.where = args.where ? { ...args.where, tenantId } : { tenantId };
break;
case 'delete':
args.where = { ...(args.where || {}), tenantId };
break;
case 'deleteMany':
args.where = args.where ? { ...args.where, tenantId } : { tenantId };
break;
case 'upsert':
args.where = { ...(args.where || {}), tenantId };
args.create = { ...(args.create || {}), tenantId };
break;
}

return next({ ...params, args });
});
}
}
ENDOFFILE

cat << 'ENDOFFILE' > src/prisma/prisma.module.ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
providers: [PrismaService],
exports: [PrismaService],
})
export class PrismaModule {}
ENDOFFILE

--- AUTH MODULE (Including DTOs) ---
cat << 'ENDOFFILE' > src/modules/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';

@Module({
imports: [
PassportModule.register({ defaultStrategy: 'jwt' }),
JwtModule.register({
secret: process.env.JWT_SECRET || 'fallback-secret-change-me',
signOptions: { expiresIn: process.env.JWT_EXPIRATION || '24h' },
}),
],
controllers: [AuthController],
providers: [AuthService, JwtStrategy],
exports: [AuthService, JwtModule],
})
export class AuthModule {}
ENDOFFILE

cat << 'ENDOFFILE' > src/modules/auth/jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';

export interface JwtPayload {
userId: string;
tenantId: string;
email: string;
role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
constructor(private prisma: PrismaService) {
super({
jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
ignoreExpiration: false,
secretOrKey: process.env.JWT_SECRET || 'fallback-secret-change-me',
});
}

async validate(payload: JwtPayload): Promise<JwtPayload> {
const user = await this.prisma.user.findFirst({
where: { id: payload.userId, tenantId: payload.tenantId },
select: { id: true, tenantId: true, role: true },
});
if (!user) throw new UnauthorizedException('User no longer exists');
return payload;
}
}
ENDOFFILE

cat << 'ENDOFFILE' > src/modules/auth/auth.controller.ts
import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterTenantDto } from './dto/register-tenant.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
constructor(private readonly authService: AuthService) {}

@Post('register-tenant')
@HttpCode(HttpStatus.CREATED)
@ApiOperation({ summary: 'Register a new tenant with admin user' })
@ApiResponse({ status: 201, type: AuthResponseDto })
async registerTenant(@Body() dto: RegisterTenantDto): Promise<AuthResponseDto> {
return this.authService.registerTenant(dto);
}

@Post('login')
@HttpCode(HttpStatus.OK)
@ApiOperation({ summary: 'Authenticate and receive JWT token' })
@ApiResponse({ status: 200, type: AuthResponseDto })
async login(@Body() dto: LoginDto): Promise<AuthResponseDto> {
return this.authService.login(dto);
}
}
ENDOFFILE

cat << 'ENDOFFILE' > src/modules/auth/auth.service.ts
import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterTenantDto } from './dto/register-tenant.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';

const DEFAULT_CHART_OF_ACCOUNTS = [
{ code: '1000', name: 'Cash', type: 'ASSET' as const },
{ code: '1100', name: 'Accounts Receivable', type: 'ASSET' as const },
{ code: '2000', name: 'Deferred Revenue', type: 'LIABILITY' as const },
{ code: '4000', name: 'Subscription Revenue', type: 'REVENUE' as const },
];

@Injectable()
export class AuthService {
constructor(private prisma: PrismaService, private jwtService: JwtService) {}

async registerTenant(dto: RegisterTenantDto): Promise<AuthResponseDto> {
const passwordHash = await bcrypt.hash(dto.adminPassword, 12);
try {
const result = await this.prisma.$transaction(async (tx) => {
const tenant = await tx.tenant.create({ data: { name: dto.companyName, email: dto.adminEmail } });
const user = await tx.user.create({ data: { tenantId: tenant.id, email: dto.adminEmail, passwordHash, role: 'ADMIN' } });
await tx.account.createMany({ data: DEFAULT_CHART_OF_ACCOUNTS.map((account) => ({ tenantId: tenant.id, ...account })) });
return { tenant, user };
});
const token = await this.jwtService.signAsync({ userId: result.user.id, tenantId: result.tenant.id, email: result.user.email, role: result.user.role });
return { accessToken: token };
} catch (error) {
if (error.code === 'P2002') throw new ConflictException('Tenant or user email already exists');
throw error;
}
}

async login(dto: LoginDto): Promise<AuthResponseDto> {
const user = await this.prisma.user.findFirst({ where: { email: dto.email }, include: { tenant: true } });
if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
throw new UnauthorizedException('Invalid email or password');
}
const token = await this.jwtService.signAsync({ userId: user.id, tenantId: user.tenantId, email: user.email, role: user.role });
return { accessToken: token };
}
}
ENDOFFILE

cat << 'ENDOFFILE' > src/modules/auth/dto/register-tenant.dto.ts
import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterTenantDto {
@ApiProperty({ example: 'Acme Corporation' })
@IsString() @MinLength(2) @MaxLength(255)
companyName: string;

@ApiProperty({ example: 'admin@acme.com' })
@IsEmail()
adminEmail: string;

@ApiProperty({ example: 'SecurePass123!' })
@IsString() @MinLength(8) @MaxLength(128)
adminPassword: string;
}
ENDOFFILE

cat << 'ENDOFFILE' > src/modules/auth/dto/login.dto.ts
import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
@ApiProperty({ example: 'admin@acme.com' })
@IsEmail()
email: string;

@ApiProperty({ example: 'SecurePass123!' })
@IsString() @MinLength(1)
password: string;
}
ENDOFFILE

cat << 'ENDOFFILE' > src/modules/auth/dto/auth-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class AuthResponseDto {
@ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
accessToken: string;
}
ENDOFFILE

--- PLANS MODULE (Including DTOs) ---
cat << 'ENDOFFILE' > src/modules/plans/plans.module.ts
import { Module } from '@nestjs/common';
import { PlansController } from './plans.controller';
import { PlansService } from './plans.service';

@Module({
controllers: [PlansController],
providers: [PlansService],
exports: [PlansService],
})
export class PlansModule {}
ENDOFFILE

cat << 'ENDOFFILE' > src/modules/plans/plans.controller.ts
import { Controller, Get, Post, Patch, Delete, Body, Param, ParseUUIDPipe, UseGuards, HttpCode, HttpStatus, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { TenantInterceptor } from '../../common/interceptors/tenant.interceptor';
import { PlansService } from './plans.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { PlanResponseDto } from './dto/plan-response.dto';

@ApiTags('Plans')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@UseInterceptors(TenantInterceptor)
@Controller('plans')
export class PlansController {
constructor(private readonly plansService: PlansService) {}

@Post() @HttpCode(HttpStatus.CREATED)
@ApiOperation({ summary: 'Create a new subscription plan' })
@ApiResponse({ status: 201, type: PlanResponseDto })
async create(@Body() dto: CreatePlanDto): Promise<PlanResponseDto> { return this.plansService.create(dto); }

@Get()
@ApiOperation({ summary: 'List all plans' })
@ApiResponse({ status: 200, type: [PlanResponseDto] })
async findAll(): Promise<PlanResponseDto[]> { return this.plansService.findAll(); }

@Patch(':id')
@ApiOperation({ summary: 'Update a plan' })
@ApiResponse({ status: 200, type: PlanResponseDto })
async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePlanDto): Promise<PlanResponseDto> { return this.plansService.update(id, dto); }

@Delete(':id') @HttpCode(HttpStatus.OK)
@ApiOperation({ summary: 'Soft delete a plan' })
async remove(@Param('id', ParseUUIDPipe) id: string): Promise<{ success: boolean }> { return this.plansService.softDelete(id); }
}
ENDOFFILE

cat << 'ENDOFFILE' > src/modules/plans/plans.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { PlanResponseDto } from './dto/plan-response.dto';

@Injectable()
export class PlansService {
constructor(private prisma: PrismaService) {}

async create(dto: CreatePlanDto): Promise<PlanResponseDto> {
const plan = await this.prisma.plan.create({
data: { name: dto.name, price: dto.price, currency: dto.currency || 'USD', intervalDays: dto.intervalDays },
});
return this.toResponseDto(plan);
}

async findAll(): Promise<PlanResponseDto[]> {
const plans = await this.prisma.plan.findMany({ orderBy: { createdAt: 'desc' } });
return plans.map(this.toResponseDto);
}

async update(id: string, dto: UpdatePlanDto): Promise<PlanResponseDto> {
try {
const plan = await this.prisma.plan.update({ where: { id }, data: dto });
return this.toResponseDto(plan);
} catch (e) { if (e.code === 'P2025') throw new NotFoundException('Plan not found'); throw e; }
}

async softDelete(id: string): Promise<{ success: boolean }> {
try {
await this.prisma.plan.update({ where: { id }, data: { isActive: false } });
return { success: true };
} catch (e) { if (e.code === 'P2025') throw new NotFoundException('Plan not found'); throw e; }
}

private toResponseDto(plan: any): PlanResponseDto {
return { id: plan.id, name: plan.name, price: Number(plan.price), currency: plan.currency, intervalDays: plan.intervalDays, isActive: plan.isActive, createdAt: plan.createdAt, updatedAt: plan.updatedAt };
}
}
ENDOFFILE

cat << 'ENDOFFILE' > src/modules/plans/dto/create-plan.dto.ts
import { IsString, IsNumber, IsInt, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePlanDto {
@ApiProperty() @IsString() name: string;
@ApiProperty() @IsNumber() @Min(0) price: number;
@ApiPropertyOptional() @IsOptional() @IsString() currency?: string;
@ApiProperty() @IsInt() @Min(1) intervalDays: number;
}
ENDOFFILE

cat << 'ENDOFFILE' > src/modules/plans/dto/update-plan.dto.ts
import { IsString, IsNumber, IsInt, IsOptional, Min, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdatePlanDto {
@ApiPropertyOptional() @IsOptional() @IsString() name?: string;
@ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) price?: number;
@ApiPropertyOptional() @IsOptional() @IsString() currency?: string;
@ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) intervalDays?: number;
@ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}
ENDOFFILE

cat << 'ENDOFFILE' > src/modules/plans/dto/plan-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class PlanResponseDto {
@ApiProperty() id: string;
@ApiProperty() name: string;
@ApiProperty() price: number;
@ApiProperty() currency: string;
@ApiProperty() intervalDays: number;
@ApiProperty() isActive: boolean;
@ApiProperty() createdAt: Date;
@ApiProperty() updatedAt: Date;
}
ENDOFFILE

--- CUSTOMERS MODULE (Including DTOs) ---
cat << 'ENDOFFILE' > src/modules/customers/customers.module.ts
import { Module } from '@nestjs/common';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';

@Module({
controllers: [CustomersController],
providers: [CustomersService],
exports: [CustomersService],
})
export class CustomersModule {}
ENDOFFILE

cat << 'ENDOFFILE' > src/modules/customers/customers.controller.ts
import { Controller, Get, Post, Patch, Delete, Body, Param, ParseUUIDPipe, UseGuards, HttpCode, HttpStatus, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { TenantInterceptor } from '../../common/interceptors/tenant.interceptor';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CustomerResponseDto } from './dto/customer-response.dto';

@ApiTags('Customers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@UseInterceptors(TenantInterceptor)
@Controller('customers')
export class CustomersController {
constructor(private readonly customersService: CustomersService) {}

@Post() @HttpCode(HttpStatus.CREATED)
@ApiOperation({ summary: 'Create a new customer' })
@ApiResponse({ status: 201, type: CustomerResponseDto })
async create(@Body() dto: CreateCustomerDto): Promise<CustomerResponseDto> { return this.customersService.create(dto); }

@Get()
@ApiOperation({ summary: 'List all customers' })
@ApiResponse({ status: 200, type: [CustomerResponseDto] })
async findAll(): Promise<CustomerResponseDto[]> { return this.customersService.findAll(); }

@Patch(':id')
@ApiOperation({ summary: 'Update a customer' })
@ApiResponse({ status: 200, type: CustomerResponseDto })
async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCustomerDto): Promise<CustomerResponseDto> { return this.customersService.update(id, dto); }

@Delete(':id') @HttpCode(HttpStatus.OK)
@ApiOperation({ summary: 'Delete a customer' })
async remove(@Param('id', ParseUUIDPipe) id: string): Promise<{ success: boolean }> { return this.customersService.remove(id); }
}
ENDOFFILE

cat << 'ENDOFFILE' > src/modules/customers/customers.service.ts
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CustomerResponseDto } from './dto/customer-response.dto';

@Injectable()
export class CustomersService {
constructor(private prisma: PrismaService) {}

async create(dto: CreateCustomerDto): Promise<CustomerResponseDto> {
try {
const customer = await this.prisma.customer.create({ data: dto });
return this.toResponseDto(customer);
} catch (e) { if (e.code === 'P2002') throw new ConflictException('Customer email already exists'); throw e; }
}

async findAll(): Promise<CustomerResponseDto[]> {
const customers = await this.prisma.customer.findMany({ orderBy: { createdAt: 'desc' } });
return customers.map(this.toResponseDto);
}

async update(id: string, dto: UpdateCustomerDto): Promise<CustomerResponseDto> {
try {
const customer = await this.prisma.customer.update({ where: { id }, data: dto });
return this.toResponseDto(customer);
} catch (e) { if (e.code === 'P2025') throw new NotFoundException('Customer not found'); throw e; }
}

async remove(id: string): Promise<{ success: boolean }> {
try {
await this.prisma.customer.delete({ where: { id } });
return { success: true };
} catch (e) { if (e.code === 'P2025') throw new NotFoundException('Customer not found'); throw e; }
}

private toResponseDto(customer: any): CustomerResponseDto {
return { id: customer.id, name: customer.name, email: customer.email, createdAt: customer.createdAt, updatedAt: customer.updatedAt };
}
}
ENDOFFILE

cat << 'ENDOFFILE' > src/modules/customers/dto/create-customer.dto.ts
import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCustomerDto {
@ApiProperty() @IsString() @MinLength(1) @MaxLength(255) name: string;
@ApiProperty() @IsEmail() email: string;
}
ENDOFFILE

cat << 'ENDOFFILE' > src/modules/customers/dto/update-customer.dto.ts
import { IsEmail, IsString, IsOptional, MinLength, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateCustomerDto {
@ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) @MaxLength(255) name?: string;
@ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;
}
ENDOFFILE

cat << 'ENDOFFILE' > src/modules/customers/dto/customer-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class CustomerResponseDto {
@ApiProperty() id: string;
@ApiProperty() name: string;
@ApiProperty() email: string;
@ApiProperty() createdAt: Date;
@ApiProperty() updatedAt: Date;
}
ENDOFFILE

--- SUBSCRIPTIONS MODULE (Including DTOs) ---
cat << 'ENDOFFILE' > src/modules/subscriptions/subscriptions.module.ts
import { Module } from '@nestjs/common';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';

@Module({
controllers: [SubscriptionsController],
providers: [SubscriptionsService],
exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
ENDOFFILE

cat << 'ENDOFFILE' > src/modules/subscriptions/subscriptions.controller.ts
import { Controller, Get, Post, Body, UseGuards, HttpCode, HttpStatus, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { TenantInterceptor } from '../../common/interceptors/tenant.interceptor';
import { SubscriptionsService } from './subscriptions.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { SubscriptionResponseDto } from './dto/subscription-response.dto';

@ApiTags('Subscriptions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@UseInterceptors(TenantInterceptor)
@Controller('subscriptions')
export class SubscriptionsController {
constructor(private readonly subscriptionsService: SubscriptionsService) {}

@Post() @HttpCode(HttpStatus.CREATED)
@ApiOperation({ summary: 'Create a new subscription' })
@ApiResponse({ status: 201, type: SubscriptionResponseDto })
async create(@Body() dto: CreateSubscriptionDto): Promise<SubscriptionResponseDto> { return this.subscriptionsService.create(dto); }

@Get()
@ApiOperation({ summary: 'List all subscriptions' })
@ApiResponse({ status: 200, type: [SubscriptionResponseDto] })
async findAll(): Promise<SubscriptionResponseDto[]> { return this.subscriptionsService.findAll(); }
}
ENDOFFILE

cat << 'ENDOFFILE' > src/modules/subscriptions/subscriptions.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContext } from '../../common/tenant-context';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { SubscriptionResponseDto } from './dto/subscription-response.dto';

@Injectable()
export class SubscriptionsService {
constructor(private prisma: PrismaService) {}

async create(dto: CreateSubscriptionDto): Promise<SubscriptionResponseDto> {
const tenantId = TenantContext.requireTenantId();
const plan = await this.prisma.plan.findFirst({ where: { id: dto.planId, tenantId, isActive: true } });
if (!plan) throw new BadRequestException('Active plan not found');

const customer = await this.prisma.customer.findFirst({ where: { id: dto.customerId, tenantId } });
if (!customer) throw new BadRequestException('Customer not found');

const subscription = await this.prisma.subscription.create({
data: {
customerId: dto.customerId,
planId: dto.planId,
status: 'ACTIVE',
startDate: new Date(dto.startDate),
nextBillingDate: new Date(dto.startDate),
},
include: { customer: true, plan: true },
});

return this.toResponseDto(subscription);
}

async findAll(): Promise<SubscriptionResponseDto[]> {
const subscriptions = await this.prisma.subscription.findMany({
include: { customer: true, plan: true },
orderBy: { createdAt: 'desc' },
});
return subscriptions.map(this.toResponseDto);
}

private toResponseDto(subscription: any): SubscriptionResponseDto {
return {
id: subscription.id,
customerId: subscription.customerId,
customerName: subscription.customer?.name,
planId: subscription.planId,
planName: subscription.plan?.name,
status: subscription.status,
startDate: subscription.startDate,
nextBillingDate: subscription.nextBillingDate,
createdAt: subscription.createdAt,
updatedAt: subscription.updatedAt,
};
}
}
ENDOFFILE

cat << 'ENDOFFILE' > src/modules/subscriptions/dto/create-subscription.dto.ts
import { IsDateString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSubscriptionDto {
@ApiProperty() @IsUUID() customerId: string;
@ApiProperty() @IsUUID() planId: string;
@ApiProperty() @IsDateString() startDate: string;
}
ENDOFFILE

cat << 'ENDOFFILE' > src/modules/subscriptions/dto/subscription-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class SubscriptionResponseDto {
@ApiProperty() id: string;
@ApiProperty() customerId: string;
@ApiProperty() customerName: string;
@ApiProperty() planId: string;
@ApiProperty() planName: string;
@ApiProperty() status: string;
@ApiProperty() startDate: Date;
@ApiProperty() nextBillingDate: Date;
@ApiProperty() createdAt: Date;
@ApiProperty() updatedAt: Date;
}
ENDOFFILE

--- PAYMENTS MODULE (Including DTOs) ---
cat << 'ENDOFFILE' > src/modules/payments/payments.module.ts
import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { AccountingModule } from '../accounting/accounting.module';

@Module({
imports: [AccountingModule],
controllers: [PaymentsController],
providers: [PaymentsService],
})
export class PaymentsModule {}
ENDOFFILE

cat << 'ENDOFFILE' > src/modules/payments/payments.controller.ts
import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { TenantInterceptor } from '../../common/interceptors/tenant.interceptor';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentResponseDto } from './dto/payment-response.dto';

@ApiTags('Payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@UseInterceptors(TenantInterceptor)
@Controller('payments')
export class PaymentsController {
constructor(private readonly paymentsService: PaymentsService) {}

@Post() @HttpCode(HttpStatus.CREATED)
@ApiOperation({ summary: 'Record a payment for an invoice' })
@ApiResponse({ status: 201, type: PaymentResponseDto })
async create(@Body() dto: CreatePaymentDto): Promise<PaymentResponseDto> { return this.paymentsService.createPayment(dto); }
}
ENDOFFILE

cat << 'ENDOFFILE' > src/modules/payments/payments.service.ts
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AccountingService } from '../accounting/accounting.service';
import { TenantContext } from '../../common/tenant-context';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentResponseDto } from './dto/payment-response.dto';

@Injectable()
export class PaymentsService {
constructor(private prisma: PrismaService, private accountingService: AccountingService) {}

async createPayment(dto: CreatePaymentDto): Promise<PaymentResponseDto> {
const tenantId = TenantContext.requireTenantId();

return this.prisma.$transaction(async (tx) => {
const invoice = await tx.invoice.findFirst({ where: { id: dto.invoiceId, tenantId } });
if (!invoice) throw new NotFoundException('Invoice not found');
if (invoice.status === 'PAID') throw new BadRequestException('Invoice already paid');
if (Number(dto.amount) !== Number(invoice.amount)) throw new BadRequestException('Amount mismatch');

const payment = await tx.payment.create({ data: { invoiceId: dto.invoiceId, amount: dto.amount } });
await tx.invoice.update({ where: { id: dto.invoiceId }, data: { status: 'PAID' } });

await this.accountingService.createJournalEntry(
{
tenantId,
description: `Payment received for invoice ${invoice.id}`,
referenceType: 'PAYMENT',
referenceId: payment.id,
lines: [
{ accountCode: '1000', type: 'DEBIT', amount: dto.amount },
{ accountCode: '1100', type: 'CREDIT', amount: dto.amount },
],
},
tx as any,
);

return this.toResponseDto(payment);
});
}

private toResponseDto(payment: any): PaymentResponseDto {
return { id: payment.id, invoiceId: payment.invoiceId, amount: Number(payment.amount), paidAt: payment.paidAt, createdAt: payment.createdAt };
}
}
ENDOFFILE

cat << 'ENDOFFILE' > src/modules/payments/dto/create-payment.dto.ts
import { IsNumber, IsUUID, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePaymentDto {
@ApiProperty() @IsUUID() invoiceId: string;
@ApiProperty() @IsNumber() @Min(0.01) amount: number;
}
ENDOFFILE

cat << 'ENDOFFILE' > src/modules/payments/dto/payment-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class PaymentResponseDto {
@ApiProperty() id: string;
@ApiProperty() invoiceId: string;
@ApiProperty() amount: number;
@ApiProperty() paidAt: Date;
@ApiProperty() createdAt: Date;
}
ENDOFFILE

--- BILLING MODULE ---
cat << 'ENDOFFILE' > src/modules/billing/billing.module.ts
import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { AccountingModule } from '../accounting/accounting.module';

@Module({
imports: [AccountingModule],
controllers: [BillingController],
providers: [BillingService],
})
export class BillingModule {}
ENDOFFILE

cat << 'ENDOFFILE' > src/modules/billing/billing.controller.ts
import { Controller, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { BillingService } from './billing.service';

@ApiTags('Billing')
@Controller('billing')
export class BillingController {
constructor(private readonly billingService: BillingService) {}

@Post('generate-monthly-invoices')
@Public()
@HttpCode(HttpStatus.OK)
@ApiOperation({ summary: 'Generate monthly invoices for all tenants' })
@ApiResponse({ status: 200, schema: { type: 'object', properties: { generated: { type: 'number' }, message: { type: 'string' } } } })
async generateMonthlyInvoices() {
const generated = await this.billingService.generateMonthlyInvoices();
return { generated, message: ${generated} invoice(s) generated successfully };
}
}
ENDOFFILE

cat << 'ENDOFFILE' > src/modules/billing/billing.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AccountingService } from '../accounting/accounting.service';

@Injectable()
export class BillingService {
private readonly logger = new Logger(BillingService.name);

constructor(private prisma: PrismaService, private accountingService: AccountingService) {}

async generateMonthlyInvoices() {
this.logger.log('Starting monthly invoice generation');
const tenants = await this.prisma.tenant.findMany({ select: { id: true, name: true } });
let totalGenerated = 0;

for (const tenant of tenants) {
try {
const subs = await this.prisma.subscription.findMany({
where: { tenantId: tenant.id, status: 'ACTIVE', nextBillingDate: { lte: new Date() } },
include: { plan: true, customer: true },
});

for (const sub of subs) {
try {
await this.prisma.$transaction(async (tx) => {
const periodEnd = new Date(sub.nextBillingDate);
periodEnd.setDate(periodEnd.getDate() + sub.plan.intervalDays - 1);

const invoice = await tx.invoice.create({
data: {
tenantId: tenant.id,
subscriptionId: sub.id,
customerId: sub.customerId,
amount: sub.plan.price,
status: 'PENDING',
periodStart: sub.nextBillingDate,
periodEnd,
},
});

await this.accountingService.createJournalEntry(
{
tenantId: tenant.id,
description: `Invoice created for ${sub.customer.name} - ${sub.plan.name}`,
referenceType: 'INVOICE',
referenceId: invoice.id,
lines: [
{ accountCode: '1100', type: 'DEBIT', amount: Number(sub.plan.price) },
{ accountCode: '2000', type: 'CREDIT', amount: Number(sub.plan.price) },
],
},
tx as any,
);

const nextBilling = new Date(sub.nextBillingDate);
nextBilling.setDate(nextBilling.getDate() + sub.plan.intervalDays);
await tx.subscription.update({ where: { id: sub.id }, data: { nextBillingDate: nextBilling } });
});
totalGenerated++;
} catch (e) {
this.logger.error(`Failed sub ${sub.id}: ${e.message}`);
}
}
} catch (e) {
this.logger.error(`Failed tenant ${tenant.name}: ${e.message}`);
}
}
this.logger.log(`Billing complete: ${totalGenerated} invoices`);
return totalGenerated;
}
}
ENDOFFILE

--- ACCOUNTING MODULE (Including DTOs) ---
cat << 'ENDOFFILE' > src/modules/accounting/accounting.module.ts
import { Module } from '@nestjs/common';
import { AccountingController } from './accounting.controller';
import { AccountingService } from './accounting.service';

@Module({
controllers: [AccountingController],
providers: [AccountingService],
exports: [AccountingService],
})
export class AccountingModule {}
ENDOFFILE

cat << 'ENDOFFILE' > src/modules/accounting/accounting.controller.ts
import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { TenantInterceptor } from '../../common/interceptors/tenant.interceptor';
import { AccountingService } from './accounting.service';
import { RecognizeRevenueDto } from './dto/recognize-revenue.dto';

@ApiTags('Accounting')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@UseInterceptors(TenantInterceptor)
@Controller('accounting')
export class AccountingController {
constructor(private readonly accountingService: AccountingService) {}

@Post('recognize-revenue') @HttpCode(HttpStatus.OK)
@ApiOperation({ summary: 'Recognize revenue for a month (month-end close)' })
@ApiResponse({ status: 200, schema: { type: 'object', properties: { recognized: { type: 'number' }, message: { type: 'string' } } } })
async recognizeRevenue(@Body() dto: RecognizeRevenueDto) {
const recognized = await this.accountingService.recognizeRevenue(dto.month);
return { recognized, message: ${recognized} revenue recognition entry(ies) created };
}
}
ENDOFFILE

cat << 'ENDOFFILE' > src/modules/accounting/accounting.service.ts
import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContext } from '../../common/tenant-context';

export interface JournalLineInput {
accountCode: string;
type: 'DEBIT' | 'CREDIT';
amount: number;
}

export interface CreateJournalEntryData {
tenantId: string;
description: string;
referenceType?: string;
referenceId?: string;
lines: JournalLineInput[];
}

type TransactionClient = any;

@Injectable()
export class AccountingService {
private readonly logger = new Logger(AccountingService.name);
constructor(private prisma: PrismaService) {}

async createJournalEntry(data: CreateJournalEntryData, tx?: TransactionClient) {
const client = tx || this.prisma;

const accountCodes = [...new Set(data.lines.map((l) => l.accountCode))];
const accounts = await client.account.findMany({ where: { code: { in: accountCodes }, tenantId: data.tenantId } });

const foundCodes = new Set(accounts.map((a) => a.code));
const missingCodes = accountCodes.filter((code) => !foundCodes.has(code));
if (missingCodes.length > 0) throw new BadRequestException(`Account codes not found: ${missingCodes.join(', ')}`);

const totalDebits = data.lines.filter((l) => l.type === 'DEBIT').reduce((sum, l) => sum + l.amount, 0);
const totalCredits = data.lines.filter((l) => l.type === 'CREDIT').reduce((sum, l) => sum + l.amount, 0);
if (Math.abs(totalDebits - totalCredits) > 0.001) {
throw new BadRequestException(`Journal entry must balance. Debits: ${totalDebits}, Credits: ${totalCredits}`);
}

return client.journalEntry.create({
data: {
tenantId: data.tenantId,
description: data.description,
referenceType: data.referenceType,
referenceId: data.referenceId,
lines: {
create: data.lines.map((line) => ({
accountId: accounts.find((a) => a.code === line.accountCode)!.id,
type: line.type,
amount: line.amount,
})),
},
},
include: { lines: { include: { account: true } } },
});
}

async recognizeRevenue(month?: string) {
const tenantId = TenantContext.requireTenantId();
const targetMonth = month || this.getPreviousMonth();
const { start, end } = this.getMonthBounds(targetMonth);

const invoices = await this.prisma.invoice.findMany({
where: { tenantId, status: 'PAID', periodEnd: { gte: start, lte: end } },
});

let recognized = 0;
for (const invoice of invoices) {
const exists = await this.prisma.journalEntry.findFirst({
where: { tenantId, referenceType: 'REVENUE_RECOGNITION', referenceId: invoice.id },
});
if (exists) continue;

await this.createJournalEntry({
tenantId,
description: `Revenue recognition for invoice ${invoice.id} (${targetMonth})`,
referenceType: 'REVENUE_RECOGNITION',
referenceId: invoice.id,
lines: [
{ accountCode: '2000', type: 'DEBIT', amount: Number(invoice.amount) },
{ accountCode: '4000', type: 'CREDIT', amount: Number(invoice.amount) },
],
});
recognized++;
}
return recognized;
}

private getPreviousMonth(): string {
const now = new Date();
now.setMonth(now.getMonth() - 1);
return ${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')};
}

private getMonthBounds(month: string) {
const [year, monthNum] = month.split('-').map(Number);
return {
start: new Date(year, monthNum - 1, 1, 0, 0, 0, 0),
end: new Date(year, monthNum, 0, 23, 59, 59, 999),
};
}
}
ENDOFFILE

cat << 'ENDOFFILE' > src/modules/accounting/dto/recognize-revenue.dto.ts
import { IsOptional, IsString, Matches } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class RecognizeRevenueDto {
@ApiPropertyOptional({ example: '2025-01' })
@IsOptional() @IsString() @Matches(/^\d{4}-\d{2}$/, { message: 'month must be YYYY-MM' })
month?: string;
}
ENDOFFILE

--- REPORTS MODULE (Including DTOs) ---
cat << 'ENDOFFILE' > src/modules/reports/reports.module.ts
import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
controllers: [ReportsController],
providers: [ReportsService],
})
export class ReportsModule {}
ENDOFFILE

cat << 'ENDOFFILE' > src/modules/reports/reports.controller.ts
import { Controller, Get, Query, UseGuards, UseInterceptors, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { TenantInterceptor } from '../../common/interceptors/tenant.interceptor';
import { ReportsService } from './reports.service';
import { BalanceSheetDto } from './dto/balance-sheet.dto';
import { IncomeStatementDto } from './dto/income-statement.dto';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@UseInterceptors(TenantInterceptor)
@Controller('reports')
export class ReportsController {
constructor(private readonly reportsService: ReportsService) {}

@Get('balance-sheet')
@ApiOperation({ summary: 'Get balance sheet' })
@ApiResponse({ status: 200, type: BalanceSheetDto })
async getBalanceSheet(): Promise<BalanceSheetDto> {
return this.reportsService.getBalanceSheet();
}

@Get('income-statement')
@ApiOperation({ summary: 'Get income statement' })
@ApiQuery({ name: 'from', required: true }) @ApiQuery({ name: 'to', required: true })
@ApiResponse({ status: 200, type: IncomeStatementDto })
async getIncomeStatement(@Query('from') from: string, @Query('to') to: string): Promise<IncomeStatementDto> {
const fromDate = new Date(from);
const toDate = new Date(to);
if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) throw new BadRequestException('Invalid dates');
return this.reportsService.getIncomeStatement(fromDate, toDate);
}
}
ENDOFFILE

cat << 'ENDOFFILE' > src/modules/reports/reports.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContext } from '../../common/tenant-context';
import { BalanceSheetDto } from './dto/balance-sheet.dto';
import { IncomeStatementDto } from './dto/income-statement.dto';

@Injectable()
export class ReportsService {
constructor(private prisma: PrismaService) {}

async getBalanceSheet(): Promise<BalanceSheetDto> {
const tenantId = TenantContext.requireTenantId();
const lines = await this.prisma.journalLine.findMany({
where: { journalEntry: { tenantId }, account: { code: { in: ['1000', '1100', '2000'] } } },
include: { account: { select: { code: true, type: true } } },
});

const balances = this.computeBalances(lines);
const round = (v: number) => Math.round(v * 100) / 100;
const cash = round(balances['1000'] || 0);
const ar = round(balances['1100'] || 0);
const dr = round(balances['2000'] || 0);

return {
asOf: new Date().toISOString().split('T')[0],
assets: { cash, accountsReceivable: ar, totalAssets: round(cash + ar) },
liabilities: { deferredRevenue: dr, totalLiabilities: dr },
};
}

async getIncomeStatement(from: Date, to: Date): Promise<IncomeStatementDto> {
const tenantId = TenantContext.requireTenantId();
const lines = await this.prisma.journalLine.findMany({
where: {
journalEntry: { tenantId, createdAt: { gte: from, lte: to } },
account: { type: 'REVENUE' },
},
include: { account: { select: { code: true, type: true } } },
});

const balances = this.computeBalances(lines);
const round = (v: number) => Math.round(v * 100) / 100;
const subRev = round(balances['4000'] || 0);

return {
period: { from: from.toISOString().split('T')[0], to: to.toISOString().split('T')[0] },
revenue: { subscriptionRevenue: subRev },
totalRevenue: subRev,
};
}

private computeBalances(lines: Array<{ account: { code: string; type: string }; type: string; amount: any }>) {
const balances: Record<string, number> = {};
for (const line of lines) {
if (!balances[line.account.code]) balances[line.account.code] = 0;
const amount = Number(line.amount);
if (line.account.type === 'ASSET' || line.account.type === 'EXPENSE') {
balances[line.account.code] += line.type === 'DEBIT' ? amount : -amount;
} else {
balances[line.account.code] += line.type === 'CREDIT' ? amount : -amount;
}
}
return balances;
}
}
ENDOFFILE

cat << 'ENDOFFILE' > src/modules/reports/dto/balance-sheet.dto.ts
import { ApiProperty } from '@nestjs/swagger';

class AssetsSection {
@ApiProperty() cash: number;
@ApiProperty() accountsReceivable: number;
@ApiProperty() totalAssets: number;
}

class LiabilitiesSection {
@ApiProperty() deferredRevenue: number;
@ApiProperty() totalLiabilities: number;
}

export class BalanceSheetDto {
@ApiProperty() asOf: string;
@ApiProperty({ type: AssetsSection }) assets: AssetsSection;
@ApiProperty({ type: LiabilitiesSection }) liabilities: LiabilitiesSection;
}
ENDOFFILE

cat << 'ENDOFFILE' > src/modules/reports/dto/income-statement.dto.ts
import { ApiProperty } from '@nestjs/swagger';

class PeriodDto {
@ApiProperty() from: string;
@ApiProperty() to: string;
}

class RevenueSection {
@ApiProperty() subscriptionRevenue: number;
}

export class IncomeStatementDto {
@ApiProperty({ type: PeriodDto }) period: PeriodDto;
@ApiProperty({ type: RevenueSection }) revenue: RevenueSection;
@ApiProperty() totalRevenue: number;
}
ENDOFFILE

echo "✅ Successfully generated all 56 files identically matching the specification."
echo "👉 Next steps:"
echo " 1. cd $PROJECT_NAME"
echo " 2. docker-compose up -d --build"
echo " 3. docker-compose exec app npx prisma db seed"
echo " 4. Open http://localhost:3000/api/docs"