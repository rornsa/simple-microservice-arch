import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Client, ConnectError } from '@connectrpc/connect';
import { RpcService } from '../rpc/rpc.service';
import { AuthService } from '../proto_gen/auth_connect';
import { VerifyResponse } from '../proto_gen/auth_pb';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly authClient: Client<typeof AuthService>;

  constructor(
    private readonly rpcService: RpcService,
    private readonly configService: ConfigService,
    private readonly reflector: Reflector,
  ) {
    this.authClient = this.rpcService.createClient(
      AuthService,
      this.configService.get<string>('AUTH_SERVICE_URL'),
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    let token: string | undefined;

    // Check Authorization header
    const authHeader: string | undefined = request.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    if (!token) {
      throw new UnauthorizedException('Authentication required');
    }

    try {
      const res = await this.authClient.verify({ token }) as VerifyResponse;

      if (!res.valid) {
        throw new UnauthorizedException('Invalid or expired token');
      }

      request['user'] = res.user;
      return true;
    } catch (err: any) {
      if (err instanceof ConnectError) {
        throw new UnauthorizedException(err.rawMessage || 'Authentication failed');
      }
      throw new UnauthorizedException('Authentication service unavailable');
    }
  }
}
