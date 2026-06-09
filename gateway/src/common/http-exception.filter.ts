import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
} from '@nestjs/common';

import { Request, Response } from 'express';

import {
    ConnectError,
    Code,
} from '@connectrpc/connect';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();

        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();

        let status = HttpStatus.INTERNAL_SERVER_ERROR;
        let error: unknown = 'Internal server error';

        // NestJS HttpException
        if (exception instanceof HttpException) {
            status = exception.getStatus();
            error = exception.getResponse();
        }

        // ConnectRPC Error
        else if (exception instanceof ConnectError) {
            status = this.mapConnectCodeToHttp(exception.code);

            error = {
                message: exception.message,
                code: Code[exception.code],
                rawCode: exception.code,
            };
        }

        response.status(status).json({
            success: false,
            statusCode: status,
            path: request.url,
            method: request.method,
            timestamp: new Date().toISOString(),
            error,
        });
    }

    private mapConnectCodeToHttp(code: Code): number {
        switch (code) {
            case Code.InvalidArgument:
                return HttpStatus.BAD_REQUEST;

            case Code.NotFound:
                return HttpStatus.NOT_FOUND;

            case Code.AlreadyExists:
                return HttpStatus.CONFLICT;

            case Code.PermissionDenied:
                return HttpStatus.FORBIDDEN;

            case Code.Unauthenticated:
                return HttpStatus.UNAUTHORIZED;

            case Code.ResourceExhausted:
                return HttpStatus.TOO_MANY_REQUESTS;

            case Code.FailedPrecondition:
                return HttpStatus.PRECONDITION_FAILED;

            case Code.Unimplemented:
                return HttpStatus.NOT_IMPLEMENTED;

            case Code.Unavailable:
                return HttpStatus.SERVICE_UNAVAILABLE;

            case Code.DeadlineExceeded:
                return HttpStatus.REQUEST_TIMEOUT;

            default:
                return HttpStatus.INTERNAL_SERVER_ERROR;
        }
    }
}