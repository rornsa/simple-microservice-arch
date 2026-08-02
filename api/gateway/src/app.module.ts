import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { RpcModule } from './rpc/rpc.module';
import { StudentModule } from './student/student.module';
import { PaymentModule } from './payment/payment.module';
import { PaymentGateway } from './websocket/payment.gateway';
import { RabbitModule } from './rabbitmq/rabbitmq.module';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { AuthGuard } from './auth/auth.guard';
import { LoggerMiddleware } from './common/logger.middleware';
import * as Joi from 'joi';


import { RedisModule } from './redis/redis.module';

@Module({
  imports: [ConfigModule.forRoot({
    isGlobal: true,
    validationSchema: Joi.object({
      STUDENT_SERVICE_URL: Joi.string().required(),
      PAYMENT_SERVICE_URL: Joi.string().required(),
      RABBITMQ_URL: Joi.string().required(),
      AUTH_SERVICE_URL: Joi.string().required(),
      REDIS_URL: Joi.string().required(),
      PORT: Joi.number().required(),
    }),
  }), RedisModule, StudentModule, RpcModule, PaymentModule, RabbitModule, AuthModule],
  providers: [
    PaymentGateway,
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(LoggerMiddleware)
      .forRoutes('*');
  }
}
