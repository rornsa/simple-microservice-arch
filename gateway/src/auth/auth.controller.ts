import { Controller, Post, Body, HttpCode, HttpStatus } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { Client } from "@connectrpc/connect";
import { ConfigService } from "@nestjs/config";
import { RpcService } from "../rpc/rpc.service";
import { AuthService } from "../proto_gen/auth_connect";
import { LoginResponse, RegisterResponse } from "../proto_gen/auth_pb";
import { Public } from "./public.decorator";
import { LoginDto } from "./auth.dto";

@ApiTags("auth")
@Controller("api/auth")
export class AuthController {
  private readonly authClient: Client<typeof AuthService>;

  constructor(
    private readonly rpcService: RpcService,
    private readonly configService: ConfigService,
  ) {
    this.authClient = this.rpcService.createClient(
      AuthService,
      this.configService.get<string>("AUTH_SERVICE_URL"),
    );
  }

  @Public()
  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Login user" })
  @ApiResponse({ status: 200, description: "Successful login" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async login(@Body() body: LoginDto) {
    const res = await this.authClient.login({
      email: body.email,
      password: body.password,
    });

    return {
      success: res.success,
      token: res.token,
      user: res.user
        ? { id: res.user.id, email: res.user.email, role: res.user.role }
        : undefined,
    };
  }

  @Public()
  @Post("register")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Register a new user" })
  @ApiResponse({ status: 201, description: "Successful registration" })
  @ApiResponse({ status: 409, description: "Email already exists" })
  async register(@Body() body: LoginDto) {
    const res = await this.authClient.register({
      email: body.email,
      password: body.password,
    });

    return { success: res.success, user: res.user };
  }
}
