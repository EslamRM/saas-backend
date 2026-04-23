import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
const app = await NestFactory.create(AppModule);
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
