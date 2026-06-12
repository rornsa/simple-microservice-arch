import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, any> {
    intercept(
        context: ExecutionContext,
        next: CallHandler,
    ): Observable<any> {
        return next.handle().pipe(
            map((response) => {
                if (
                    response &&
                    typeof response === 'object' &&
                    'data' in response
                ) {
                    const { data, ...rest } = response;

                    return {
                        success: true,
                        timestamp: new Date().toISOString(),
                        data,
                        ...rest,
                    };
                }

                return {
                    success: true,
                    timestamp: new Date().toISOString(),
                    data: response,
                };
            }),
        );
    }
}