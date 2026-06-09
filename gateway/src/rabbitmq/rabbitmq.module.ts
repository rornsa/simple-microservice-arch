import { Module } from '@nestjs/common';
import { RabbitMQService } from './rabbitmq.service';
import { PaymentGateway } from '../websocket/payment.gateway';

@Module({
    providers: [RabbitMQService, PaymentGateway],
})
export class RabbitModule {
}