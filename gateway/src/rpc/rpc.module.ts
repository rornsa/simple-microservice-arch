import { Global, Module } from '@nestjs/common';
import { RpcService } from './rpc.service';

@Global()
@Module({
    exports: [RpcService],
    providers: [RpcService],
})
export class RpcModule { }
