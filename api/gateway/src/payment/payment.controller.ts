import { Controller, Get, Post, Body, Query, NotFoundException } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from "@nestjs/swagger";
import { Client } from "@connectrpc/connect";
import { RpcService } from "../rpc/rpc.service";
import { PaymentService } from "../proto_gen/payment_connect";
import { StudentService } from "../proto_gen/student_connect";
import { ConfigService } from "@nestjs/config";

import { RedisService } from "../redis/redis.service";
import { CreatePaymentDto } from "./payment.dto";

@ApiTags("payment")
@Controller("api/payments")
export class PaymentController {
  private readonly paymentClient: Client<typeof PaymentService>;
  private readonly studentClient: Client<typeof StudentService>;
  constructor(
    private readonly rpcService: RpcService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {
    this.paymentClient = this.rpcService.createClient(
      PaymentService,
      this.configService.get<string>("PAYMENT_SERVICE_URL"),
    );
    this.studentClient = this.rpcService.createClient(
      StudentService,
      this.configService.get<string>("STUDENT_SERVICE_URL"),
    );
  }

  @Post()
  @ApiOperation({ summary: "Initiate a payment for a student" })
  @ApiResponse({ status: 201, description: "Payment initiated successfully" })
  @ApiResponse({ status: 404, description: "Student not found" })
  async createPayment(@Body() dto: CreatePaymentDto) {
    // 1. Check if student exists via RPC to Student Service
    try {
      await this.studentClient.getStudent({ id: BigInt(dto.student_id) });
    } catch (err: any) {
      if (err.code === 5 || err.message?.includes("not found")) {
        throw new NotFoundException(`Student with ID ${dto.student_id} not found`);
      }
      throw err;
    }

    // 2. Initiate payment
    const result = await this.paymentClient.makePayment({
      studentId: BigInt(dto.student_id),
      amount: dto.amount,
      reference: dto.reference,
    });
    await this.redisService.del(`cache:payments:student:${dto.student_id}`);
    await this.redisService.del("cache:payments:all");
    return result;
  }


  @Get()
  @ApiOperation({
    summary: "List all payments (optionally filter by student_id)",
  })
  @ApiQuery({ name: "student_id", required: false, type: Number })
  @ApiResponse({ status: 200, description: "Array of payment records" })
  async listPayments(@Query("student_id") studentId?: string) {
    const cacheKey = studentId
      ? `cache:payments:student:${studentId}`
      : `cache:payments:all`;

    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      return cached;
    }

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
      created_at: p.createdAt
        ? new Date(Number(p.createdAt.seconds) * 1000).toISOString()
        : null,
      updated_at: p.updatedAt
        ? new Date(Number(p.updatedAt.seconds) * 1000).toISOString()
        : null,
    }));

    await this.redisService.set(cacheKey, data, 60);
    return data;
  }
}
