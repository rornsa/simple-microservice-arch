import { ConfigService } from '@nestjs/config';
import { StudentService } from './../proto_gen/student_connect';
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  ParseIntPipe,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from "@nestjs/swagger";
import { Client } from "@connectrpc/connect";
import { RpcService } from "../rpc/rpc.service";
import {
  CreateStudentDto,
  UpdateStudentDto,
  StudentPaymentDto,
} from "./student.dto";

@ApiTags("student")
@Controller("api/student")
export class StudentController {
  private readonly userClient: Client<typeof StudentService>;
  constructor(
    private readonly rpcService: RpcService,
    private readonly configService: ConfigService,
  ) {
    this.userClient = this.rpcService.createClient(
      StudentService,
      this.configService.get<string>("USER_SERVICE_URL"),
    );
  }

  @Get()
  @ApiOperation({ summary: "List all student" })
  @ApiResponse({ status: 200, description: "Array of student" })
  async list() {
    return await this.userClient.listStudents({
      page: 1,
      limit: 10,
    });
  }

  @Post()
  @ApiOperation({ summary: "Create a new user" })
  @ApiResponse({ status: 201, description: "User created" })
  @ApiResponse({ status: 400, description: "User already existed" })
  create(@Body() dto: CreateStudentDto) {
    return this.userClient.createStudent(dto);
  }

  @Put(":id")
  @ApiOperation({ summary: "Update user by ID" })
  @ApiParam({ name: "id", example: 1 })
  @ApiResponse({ status: 200, description: "Updated user" })
  @ApiResponse({ status: 404, description: "User not found" })
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateStudentDto) {
    return this.userClient.updateStudent({ ...dto, id: BigInt(id) });
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete user by ID" })
  @ApiParam({ name: "id", example: 1 })
  @ApiResponse({ status: 200, description: "Deleted user" })
  @ApiResponse({ status: 404, description: "User not found" })
  delete(@Param("id", ParseIntPipe) id: number) {
    return this.userClient.deleteStudent({
      id: BigInt(id),
    });
  }

  @Post(":id/pay")
  @ApiOperation({ summary: "Initiate a payment for a student" })
  @ApiParam({ name: "id", example: 1 })
  @ApiResponse({ status: 200, description: "Payment initiated successfully" })
  @ApiResponse({ status: 404, description: "Student not found" })
  pay(@Param("id", ParseIntPipe) id: number, @Body() dto: StudentPaymentDto) {
    return this.userClient.makePayment({ ...dto, studentId: BigInt(id) });
  }
}
