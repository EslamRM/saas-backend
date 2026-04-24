import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { GlobalExceptionFilter } from "./common/filters/global-exception.filter";
import { LoggingInterceptor } from "./common/interceptors/logging.interceptor";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global prefix
  app.setGlobalPrefix("api");

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global exception filter
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Global logging interceptor
  app.useGlobalInterceptors(new LoggingInterceptor());

  // CORS
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle(process.env.SWAGGER_TITLE || "SaaS Subscription Management API")
    .setDescription(
      process.env.SWAGGER_DESCRIPTION ||
        "Production-grade subscription billing and accounting backend with multi-tenant architecture",
    )
    .setVersion(process.env.SWAGGER_VERSION || "1.0.0")
    .addBearerAuth()
    .addTag("Auth", "Authentication and tenant registration")
    .addTag("Plans", "Subscription plan management")
    .addTag("Customers", "Customer management")
    .addTag("Subscriptions", "Subscription lifecycle")
    .addTag("Payments", "Payment processing")
    .addTag("Billing", "Automated billing engine")
    .addTag("Accounting", "Double-entry bookkeeping")
    .addTag("Reports", "Financial reporting")
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api/docs", app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: "alpha",
      operationsSorter: "method",
    },
  });

  const port = parseInt(process.env.PORT || '3000', 10);
  await app.listen(port);

  console.log(`
  ╔══════════════════════════════════════════════════════════╗
  ║  SaaS Subscription Management Backend                    ║
  ║  Environment: ${process.env.NODE_ENV || "development"}${" ".repeat(37 - (process.env.NODE_ENV || "development").length)}║
  ║  Port: ${port}${" ".repeat(50 - String(port).length)}║
  ║  Docs: http://localhost:${port}/api/docs${" ".repeat(29 - String(port).length)}║
  ╚══════════════════════════════════════════════════════════╝
  `);
}

bootstrap();
