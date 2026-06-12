import { Injectable } from '@nestjs/common';
import {
    Client,
    createClient,
} from '@connectrpc/connect';
import {
    createConnectTransport,
} from '@connectrpc/connect-node';
import { ServiceType } from '@bufbuild/protobuf';

@Injectable()
export class RpcService {
    private transports = new Map();
    createClient<T extends ServiceType>(
        service: T,
        serviceUrl: string,
    ): Client<T> {
        if (!this.transports.has(serviceUrl)) {
            this.transports.set(
                serviceUrl,
                createConnectTransport({
                    baseUrl: serviceUrl,
                    httpVersion: '1.1',
                }),
            );
        }
        const transport = this.transports.get(serviceUrl);
        return createClient(service, transport);
    }
}