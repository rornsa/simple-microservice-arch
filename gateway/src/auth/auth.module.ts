import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { RpcModule } from '../rpc/rpc.module';

@Module({
  imports: [RpcModule],
  controllers: [AuthController],
})
export class AuthModule {}
