import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { ResponseInterceptor } from './common/response.interceptor';
import { ConfigService } from '@nestjs/config';
import { RedisIoAdapter } from './common/redis-io.adapter';

const logger = new Logger('Bootstrap');

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // Enable verbose logs to see all request mappings and initialization
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  const configService = app.get(ConfigService);
  const redisUrl = configService.get<string>('REDIS_URL');
  const port = configService.get<number>('PORT');

  const redisIoAdapter = new RedisIoAdapter(app);
  await redisIoAdapter.connectToRedis(redisUrl);
  app.useWebSocketAdapter(redisIoAdapter);

  app.enableCors();

  // Global validation pipe (uses class-validator)
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Register global ConnectRPC exception filter
  app.useGlobalFilters(new HttpExceptionFilter());

  // Register global response interceptor
  app.useGlobalInterceptors(new ResponseInterceptor());

  // Swagger / OpenAPI docs at /api/docs
  const config = new DocumentBuilder()
    .setTitle('Micro-service BFF API')
    .setDescription('API Gateway (BFF) for User and Product microservices')
    .setVersion('1.0')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // ── Tuned HTTP server options ──────────────────────────
  // backlog: how many pending connections the OS will queue before refusing
  // Default is 511 — bumping to 4096 absorbs large connection spikes
  const httpAdapter = app.getHttpAdapter().getInstance();
  httpAdapter.keepAliveTimeout = 65_000;        // ms — longer than ALB/proxy timeouts
  httpAdapter.headersTimeout = 66_000;        // must be > keepAliveTimeout

  await app.listen(port, '0.0.0.0', () => {
    logger.log(`[Worker NestJS running on http://localhost:${port}`);
  });
}

bootstrap();

