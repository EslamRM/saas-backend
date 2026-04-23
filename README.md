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
