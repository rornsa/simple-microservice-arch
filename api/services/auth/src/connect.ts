import { ConnectRouter, ConnectError, Code } from "@connectrpc/connect";
import { AuthService } from "./proto_gen/auth_connect";
import {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  VerifyRequest,
  VerifyResponse,
  AuthUser,
} from "./proto_gen/auth_pb";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "super-secret-key");

interface User {
  id: number;
  email: string;
  password: string;
  role: string;
}

// In-memory object store
const users: Record<string, User> = {
  // Pre-seed a demo user
  "admin@gmail.com": {
    id: 1,
    email: "admin@gmail.com",
    password: bcrypt.hashSync("123456", 10),
    role: "admin",
  }
};

let nextId = 2;

export default (router: ConnectRouter) => {
  router.service(AuthService, {
    async login(req: LoginRequest): Promise<Partial<LoginResponse>> {
      console.log(`[Auth] Login attempt: ${req.email}`);

      const user = users[req.email];

      if (!user) {
        throw new ConnectError(
          "Invalid email or password",
          Code.Unauthenticated
        );
      }

      const isPasswordValid = await bcrypt.compare(
        req.password,
        user.password
      );

      if (!isPasswordValid) {
        throw new ConnectError(
          "Invalid email or password",
          Code.Unauthenticated
        );
      }

      const token = await new SignJWT({
        id: user.id,
        email: user.email,
        role: user.role,
      })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("2h")
        .sign(JWT_SECRET);

      return {
        success: true,
        token,
        user: new AuthUser({
          id: user.id,
          email: user.email,
          role: user.role,
        }),
      };
    },

    async register(
      req: RegisterRequest
    ): Promise<Partial<RegisterResponse>> {
      console.log(`[Auth] Registering: ${req.email}`);

      if (!req.email?.trim()) {
        throw new ConnectError(
          "Email is required",
          Code.InvalidArgument
        );
      }

      if (!req.password || req.password.length < 6) {
        throw new ConnectError(
          "Password must be at least 6 characters",
          Code.InvalidArgument
        );
      }

      if (users[req.email]) {
        throw new ConnectError(
          "Email already exists",
          Code.AlreadyExists
        );
      }

      const hashedPassword = await bcrypt.hash(req.password, 10);
      const newUser: User = {
        id: nextId++,
        email: req.email,
        password: hashedPassword,
        role: "user",
      };

      users[req.email] = newUser;

      return {
        success: true,
        user: new AuthUser({
          id: newUser.id,
          email: newUser.email,
          role: newUser.role,
        }),
      };
    },

    async verify(
      req: VerifyRequest
    ): Promise<Partial<VerifyResponse>> {
      console.log("[Auth] Verifying token");

      try {
        if (!req.token) {
          return {
            valid: false,
          };
        }

        const { payload } = await jwtVerify(
          req.token,
          JWT_SECRET
        );

        return {
          valid: true,
          user: new AuthUser({
            id: payload.id as number,
            email: payload.email as string,
            role: payload.role as string,
          }),
        };
      } catch (error) {
        console.error(
          "[Auth] Token verification failed:",
          error
        );

        return {
          valid: false,
        };
      }
    },
  });
};
