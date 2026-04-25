import { Module } from "@nestjs/common";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./modules/auth/auth.module";
import { PlansModule } from "./modules/plans/plans.module";
import { CustomersModule } from "./modules/customers/customers.module";
import { SubscriptionsModule } from "./modules/subscriptions/subscriptions.module";
import { InvoicesModule } from "./modules/invoices/invoices.module"; // FIX: Added
import { PaymentsModule } from "./modules/payments/payments.module";
import { BillingModule } from "./modules/billing/billing.module";
import { AccountingModule } from "./modules/accounting/accounting.module";
import { ReportsModule } from "./modules/reports/reports.module";

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    PlansModule,
    CustomersModule,
    SubscriptionsModule,
    InvoicesModule,
    PaymentsModule,
    BillingModule,
    AccountingModule,
    ReportsModule,
  ],
})
export class AppModule {}
