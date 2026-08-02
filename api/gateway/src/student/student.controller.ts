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
} from "./student.dto";

import { RedisService } from '../redis/redis.service';

@ApiTags("student")
@Controller("api/student")
export class StudentController {
  private readonly studentService: Client<typeof StudentService>;
  constructor(
    private readonly rpcService: RpcService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {
    this.studentService = this.rpcService.createClient(
      StudentService,
      this.configService.get<string>("STUDENT_SERVICE_URL"),
    );
  }

  @Get()
  @ApiOperation({ summary: "List all student" })
  @ApiResponse({ status: 200, description: "Array of student" })
  async list() {
    const cacheKey = "cache:students:list:page:1:limit:10";
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      return cached;
    }
    const result = await this.studentService.listStudents({
      page: 1,
      limit: 10,
    });
    await this.redisService.set(cacheKey, result, 60);
    return result;
  }

  @Post()
  @ApiOperation({ summary: "Create a new user" })
  @ApiResponse({ status: 201, description: "User created" })
  @ApiResponse({ status: 400, description: "User already existed" })
  async create(@Body() dto: CreateStudentDto) {
    const result = await this.studentService.createStudent(dto);
    await this.redisService.delByPattern("cache:students:*");
    return result;
  }

  @Put(":id")
  @ApiOperation({ summary: "Update user by ID" })
  @ApiParam({ name: "id", example: 1 })
  @ApiResponse({ status: 200, description: "Updated user" })
  @ApiResponse({ status: 404, description: "User not found" })
  async update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateStudentDto) {
    const result = await this.studentService.updateStudent({ ...dto, id: BigInt(id) });
    await this.redisService.delByPattern("cache:students:*");
    return result;
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete user by ID" })
  @ApiParam({ name: "id", example: 1 })
  @ApiResponse({ status: 200, description: "Deleted user" })
  @ApiResponse({ status: 404, description: "User not found" })
  async delete(@Param("id", ParseIntPipe) id: number) {
    const result = await this.studentService.deleteStudent({
      id: BigInt(id),
    });
    await this.redisService.delByPattern("cache:students:*");
    return result;
  }
}
