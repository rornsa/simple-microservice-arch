import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { Client } from '@connectrpc/connect';
import { RpcService } from '../rpc/rpc.service';
import { PaymentService } from '../proto_gen/payment_connect';
import { ConfigService } from '@nestjs/config';

@ApiTags('payment')
@Controller('api/payments')
export class PaymentController {
  private readonly paymentClient: Client<typeof PaymentService>;
  constructor(
    private readonly rpcService: RpcService,
    private readonly configService: ConfigService
  ) {
    this.paymentClient = this.rpcService.createClient(PaymentService, this.configService.get<string>('PAYMENT_SERVICE_URL'));
  }

  @Get()
  @ApiOperation({ summary: 'List all payments (optionally filter by student_id)' })
  @ApiQuery({ name: 'student_id', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Array of payment records' })
  async listPayments(@Query('student_id') studentId?: string) {
    const request: any = {};
    if (studentId) {
      request.studentId = BigInt(studentId);
    }
    const response = await this.paymentClient.listPayments(request);
    const data = response.data.map((p) => ({
      id: Number(p.id),
      student_id: Number(p.studentId),
      amount: p.amount,
      reference: p.reference,
      status: p.status,
      transaction_id: p.transactionId ?? null,
      created_at: p.createdAt ? new Date(Number(p.createdAt.seconds) * 1000).toISOString() : null,
      updated_at: p.updatedAt ? new Date(Number(p.updatedAt.seconds) * 1000).toISOString() : null,
    }));
    return data
  }
}
