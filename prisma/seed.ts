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
tenantId: tenant.id, description: 'Invoice created for Alice Johnson - Bronze Plan', referenceType: 'INVOICE', referenceId: aliceInvoice.id,
lines: { create: [
{ accountId: accountMap.get('1100')!, type: 'DEBIT', amount: 100.00 },
{ accountId: accountMap.get('2000')!, type: 'CREDIT', amount: 100.00 },
]}
},
});
await prisma.journalEntry.create({
data: {
tenantId: tenant.id, description: 'Invoice created for Bob Smith - Gold Plan', referenceType: 'INVOICE', referenceId: bobInvoice.id,
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
tenantId: tenant.id, description: 'Payment received for Alice', referenceType: 'PAYMENT', referenceId: alicePayment.id,
lines: { create: [
{ accountId: accountMap.get('1000')!, type: 'DEBIT', amount: 100.00 },
{ accountId: accountMap.get('1100')!, type: 'CREDIT', amount: 100.00 },
]}
},
});
await prisma.journalEntry.create({
data: {
tenantId: tenant.id, description: 'Payment received for Bob', referenceType: 'PAYMENT', referenceId: bobPayment.id,
lines: { create: [
{ accountId: accountMap.get('1000')!, type: 'DEBIT', amount: 500.00 },
{ accountId: accountMap.get('1100')!, type: 'CREDIT', amount: 500.00 },
]}
},
});

console.log('📈 Recognizing revenue...');
await prisma.journalEntry.create({
data: {
tenantId: tenant.id, description: 'Revenue recognition for Alice', referenceType: 'REVENUE_RECOGNITION', referenceId: aliceInvoice.id,
lines: { create: [
{ accountId: accountMap.get('2000')!, type: 'DEBIT', amount: 100.00 },
{ accountId: accountMap.get('4000')!, type: 'CREDIT', amount: 100.00 },
]}
},
});
await prisma.journalEntry.create({
data: {
tenantId: tenant.id, description: 'Revenue recognition for Bob', referenceType: 'REVENUE_RECOGNITION', referenceId: bobInvoice.id,
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
