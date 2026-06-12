import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { Logger } from '@nestjs/common';

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter>;
  private readonly logger = new Logger(RedisIoAdapter.name);

  async connectToRedis(redisUrl: string): Promise<void> {
    this.logger.log(`Attempting to connect to Redis at: ${redisUrl}`);

    const redisOptions = {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      // Retry strategy for initial connection and reconnection
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 100, 3000);
        this.logger.warn(`Redis connection failed. Retrying in ${delay}ms... (Attempt ${times})`);
        return delay;
      },
      // Reconnect on errors like ENOTFOUND
      reconnectOnError: (err: Error) => {
        this.logger.error('Redis connection error occurred', err.message);
        return true;
      }
    };

    const pubClient = new Redis(redisUrl, redisOptions);
    const subClient = new Redis(redisUrl, {
      ...redisOptions,
      enableReadyCheck: false, // Must be disabled for subscriber client
    });

    pubClient.on('error', (err: any) => {
      if (err.code === 'ENOTFOUND') {
        this.logger.error(`Redis host not found at ${redisUrl}. Ensure the Redis service is running.`);
      } else {
        this.logger.error('Redis Pub Client Error', err);
      }
    });

    subClient.on('error', (err: any) => {
      this.logger.error('Redis Sub Client Error', err);
    });

    // Wait for at least one client to be ready before proceeding
    await new Promise<void>((resolve) => {
      let resolved = false;
      const timeout = setTimeout(() => {
        if (!resolved) {
          this.logger.error('Timeout waiting for Redis connection');
          resolve(); // Resolve anyway to not block startup, but adapter might fail later
        }
      }, 10000);

      pubClient.once('ready', () => {
        resolved = true;
        clearTimeout(timeout);
        this.logger.log('Redis Pub Client is ready');
        resolve();
      });

      pubClient.once('error', (err: any) => {
        if (!resolved && err.code !== 'ENOTFOUND') {
          // We don't reject on ENOTFOUND because we want the retryStrategy to kick in
          this.logger.warn('Redis initial connection error, waiting for retry...');
        }
      });
    });

    this.adapterConstructor = createAdapter(pubClient, subClient);
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options);
    server.adapter(this.adapterConstructor);
    return server;
  }
}
