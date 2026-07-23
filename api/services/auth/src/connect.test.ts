import { describe, it, expect, beforeEach } from "bun:test";
import { createAuthService, createUserStore } from "./connect";
import {
  LoginRequest,
  RegisterRequest,
  VerifyRequest,
} from "./proto_gen/auth_pb";
import { createRouterTransport, createClient } from "@connectrpc/connect";
import { AuthService } from "./proto_gen/auth_connect";

describe("Auth Service", () => {
  let userStore: ReturnType<typeof createUserStore>;
  let transport: ReturnType<typeof createRouterTransport>;

  beforeEach(() => {
    userStore = createUserStore();
    const routes = createAuthService(userStore);
    transport = createRouterTransport(routes);
  });

  describe("login", () => {
    it("should login with valid credentials", async () => {
      const client = createClient(AuthService, transport);
      const req = new LoginRequest({
        email: "admin@gmail.com",
        password: "123456"
      });

      const res = await client.login(req);
      expect(res.success).toBe(true);
      expect(res.token).toBeTruthy();
      expect(res.user?.email).toBe("admin@gmail.com");
    });

    it("should throw error with invalid password", async () => {
      const client = createClient(AuthService, transport);
      const req = new LoginRequest({
        email: "admin@gmail.com",
        password: "wrongpassword"
      });

      expect(client.login(req)).rejects.toThrow();
    });

    it("should throw error with non-existent email", async () => {
      const client = createClient(AuthService, transport);
      const req = new LoginRequest({
        email: "nonexistent@gmail.com",
        password: "123456"
      });

      expect(client.login(req)).rejects.toThrow();
    });
  });

  describe("register", () => {
    it("should register a new user", async () => {
      const client = createClient(AuthService, transport);
      const req = new RegisterRequest({
        email: "newuser@gmail.com",
        password: "password123"
      });

      const res = await client.register(req);
      expect(res.success).toBe(true);
      expect(res.user?.email).toBe("newuser@gmail.com");
      expect(res.user?.role).toBe("user");
      expect(userStore.users["newuser@gmail.com"]).toBeTruthy();
    });

    it("should throw error if email already exists", async () => {
      const client = createClient(AuthService, transport);
      const req = new RegisterRequest({
        email: "admin@gmail.com",
        password: "password123"
      });

      expect(client.register(req)).rejects.toThrow();
    });

    it("should throw error if email is empty", async () => {
      const client = createClient(AuthService, transport);
      const req = new RegisterRequest({
        email: "",
        password: "password123"
      });

      expect(client.register(req)).rejects.toThrow();
    });

    it("should throw error if password is too short", async () => {
      const client = createClient(AuthService, transport);
      const req = new RegisterRequest({
        email: "test@gmail.com",
        password: "123"
      });

      expect(client.register(req)).rejects.toThrow();
    });
  });

  describe("verify", () => {
    it("should verify a valid token", async () => {
      const client = createClient(AuthService, transport);
      const loginRes = await client.login(new LoginRequest({
        email: "admin@gmail.com",
        password: "123456"
      }));

      const verifyRes = await client.verify(new VerifyRequest({
        token: loginRes.token
      }));

      expect(verifyRes.valid).toBe(true);
      expect(verifyRes.user?.email).toBe("admin@gmail.com");
    });

    it("should return invalid for invalid token", async () => {
      const client = createClient(AuthService, transport);
      const res = await client.verify(new VerifyRequest({
        token: "invalid-token"
      }));

      expect(res.valid).toBe(false);
    });

    it("should return invalid for empty token", async () => {
      const client = createClient(AuthService, transport);
      const res = await client.verify(new VerifyRequest({
        token: ""
      }));

      expect(res.valid).toBe(false);
    });
  });
});
