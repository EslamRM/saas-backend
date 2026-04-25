import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { GlobalExceptionFilter } from "./common/filters/global-exception.filter";
import { LoggingInterceptor } from "./common/interceptors/logging.interceptor";

async function bootstrap() {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.JWT_SECRET === "fallback-secret-change-me"
  ) {
    throw new Error(
      "FATAL ERROR: JWT_SECRET must be changed from the fallback value in production.",
    );
  }

  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix("api");

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
    .setTitle(process.env.SWAGGER_TITLE || "SaaS Subscription Management API")
    .setDescription(
      process.env.SWAGGER_DESCRIPTION || "Production-grade backend",
    )
    .setVersion(process.env.SWAGGER_VERSION || "1.0.0")
    .addBearerAuth()
    .addApiKey({ type: "apiKey", name: "x-api-key", in: "header" }, "api-key")
    .addTag("Auth")
    .addTag("Plans")
    .addTag("Customers")
    .addTag("Subscriptions")
    .addTag("Invoices")
    .addTag("Payments")
    .addTag("Billing")
    .addTag("Accounting")
    .addTag("Reports")
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api/docs", app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: "alpha",
      operationsSorter: "method",
    },
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(
    `\n  🚀 SaaS Backend running on http://localhost:${port}/api/docs\n`,
  );
}

bootstrap();
