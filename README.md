# SaaS Subscription Management Backend

Multi-tenant SaaS backend built with NestJS + Prisma + PostgreSQL for subscription billing and accounting.

This project implements:
- tenant registration and tenant-scoped data access
- plans/customers/subscriptions APIs
- automated invoice generation
- payment recording
- double-entry accounting with deferred revenue
- revenue recognition and financial reports

## Tech Stack

- NestJS (Node.js + TypeScript)
- Prisma ORM
- PostgreSQL
- Docker / Docker Compose
- Swagger (OpenAPI)

## Project Structure

```text
src/
  common/          # guards, decorators, interceptors, filters
  prisma/          # Prisma service and tenant middleware
  modules/
    auth/          # tenant registration + login
    plans/         # plans CRUD
    customers/     # customers CRUD
    subscriptions/ # subscriptions management + cancellation
    billing/       # monthly invoice generation endpoint
    invoices/      # invoice query/listing
    payments/      # payment recording
    accounting/    # journal entry + revenue recognition logic
    reports/       # balance sheet + income statement
prisma/
  schema.prisma
  migrations/
  seed.ts
```

## Core Design Decisions

1. **Shared-Schema Multi-Tenancy**
   - Every tenant-owned model contains `tenantId`.
   - Request-level tenant context is captured through `AsyncLocalStorage`.
   - Prisma middleware injects tenant filters into model operations.

2. **Ledger-Based Accounting (No Fake Balances)**
   - No mutable balance columns are stored on account records.
   - Account balances are computed from journal lines.
   - Journal entries must be balanced before write.

3. **Deferred Revenue Handling**
   - Invoicing credits deferred revenue first.
   - Revenue is recognized later using period logic.
   - Income statement is tied to recognized revenue references and invoice periods.

4. **Modular Service Architecture**
   - Billing, payments, accounting, and reports are separated by module.
   - Financial writes execute inside transactions for consistency.

## Accounting Logic

### Invoice Creation (Accrual)
- Debit `Accounts Receivable (1100)`
- Credit `Deferred Revenue (2000)`

### Payment Received
- Debit `Cash (1000)`
- Credit `Accounts Receivable (1100)`

### Revenue Recognition (Month-End)
- Debit `Deferred Revenue (2000)`
- Credit `Subscription Revenue (4000)`

This sequence ensures revenue is recognized only when earned, not when cash is billed or collected.

## API Overview

Base URL:
- Local: `http://localhost:3000/api`
- Swagger: `http://localhost:3000/api/docs`

Main routes:
- `POST /auth/register-tenant`
- `POST /auth/login`
- `GET/POST/PATCH/DELETE /plans`
- `GET/POST/PATCH/DELETE /customers`
- `GET/POST /subscriptions`
- `PATCH /subscriptions/:id/cancel`
- `GET /invoices`
- `POST /payments`
- `POST /billing/generate-monthly-invoices` (requires `x-api-key`)
- `POST /accounting/recognize-revenue`
- `GET /reports/balance-sheet`
- `GET /reports/income-statement?from=YYYY-MM-DD&to=YYYY-MM-DD`

## Running Locally

### Prerequisites
- Docker + Docker Compose

### Start the project

```bash
docker-compose up -d --build
```

### Seed demo data

```bash
docker-compose exec app npx prisma db seed
```

### Open docs

- `http://localhost:3000/api/docs`

Demo credentials (seed):
- Email: `admin@acme.com`
- Password: `password123`

## Environment Variables

Example values are in `.env.example`.

Required:
- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_EXPIRATION`
- `PORT`
- `NODE_ENV`
- `INTERNAL_API_KEY` (for billing system endpoint)

## Tests

### What is covered

Current unit tests focus on high-risk business logic:
- `AccountingService`
  - balanced entry validation
  - missing account validation
- `PaymentsService`
  - strict invoice/payment amount matching
  - transaction flow (payment + invoice status + journal write)
- `SubscriptionsService`
  - validation checks for plan/customer
  - subscription cancellation flow

Additionally, one focused end-to-end integration test validates tenant isolation behavior through real HTTP flow:
- `tenant-isolation.e2e.spec.ts`
  - tenant A and tenant B register separately
  - each tenant creates customers with its own JWT
  - each tenant listing endpoint only returns its own records

And one integration test validates accounting/report consistency across the full financial lifecycle:
- `financial-flow.integration.spec.ts`
  - invoice journal entry (AR vs Deferred Revenue)
  - payment journal entry (Cash vs AR)
  - revenue recognition execution
  - final assertions on balance sheet and income statement totals

### Run tests

```bash
npm install
npm test
```

Coverage run:

```bash
npm run test:cov
```

## Live Demo Checklist

Use this sequence to verify end-to-end behavior:
1. Register tenant (`/auth/register-tenant`)
2. Create plan
3. Create customer
4. Create subscription
5. Generate monthly invoices (`/billing/generate-monthly-invoices`)
6. Record payment (`/payments`)
7. Recognize revenue (`/accounting/recognize-revenue`)
8. Verify reports:
   - `/reports/balance-sheet`
   - `/reports/income-statement`

## Scalability and Maintainability Notes

- Prisma schema uses UUIDs, indexes, and tenant-aware constraints.
- Services are organized by bounded domain modules.
- Financial state is auditable through journal entries and lines.
- Tenant context and guards reduce accidental cross-tenant access.

## About the Developer

Eslam Ramadan

Backend Engineer with 5 years of software development experience focused on scalable web applications and backend systems.

Background includes:

- Python / Django
- Node.js / NestJS
- PostgreSQL
- Multi-tenant systems
- SaaS platforms
- REST APIs
- AI integrations

Additionally, I hold a Bachelor's degree in Accounting, which helped significantly in designing the accounting logic of this project, especially:

- Deferred revenue handling
- Double-entry bookkeeping
- Financial statements structure
- Revenue recognition principles

This combination of technical engineering + accounting knowledge allows building stronger fintech and billing systems.
