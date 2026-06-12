import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqp-connection-manager';
import { AmqpConnectionManager, ChannelWrapper } from 'amqp-connection-manager';
import { Channel } from 'amqplib';
import { PaymentGateway } from '../websocket/payment.gateway';

@Injectable()
export class RabbitMQService implements OnModuleInit {
    private connection: AmqpConnectionManager;
    private channel: ChannelWrapper;
    constructor(
        private readonly paymentGateway: PaymentGateway,
        private readonly configService: ConfigService
    ) { }

    async onModuleInit() {
        this.connection = amqp.connect([this.configService.get<string>('RABBITMQ_URL')]);

        this.channel = this.connection.createChannel({
            setup: async (channel: Channel) => {
                // 1. CREATE EXCHANGE (IMPORTANT)
                await channel.assertExchange('microservices_exchange', 'topic', { durable: true });

                // 2. CREATE QUEUE
                await channel.assertQueue('payment_queue', { durable: true });

                // 3. BIND QUEUE TO EXCHANGE
                await channel.bindQueue(
                    'payment_queue',
                    'microservices_exchange',
                    'payment.processed.success',
                );

                await channel.consume('payment_queue', (msg) => {
                    if (!msg) return;
                    const data = JSON.parse(msg.content.toString());
                    // console.log('Received payment event:', data);
                    this.paymentGateway.server
                        .to(`student:${data.student_id}`)
                        .emit('payment.success', data);
                    channel.ack(msg);
                });
            },
        });
    }
}