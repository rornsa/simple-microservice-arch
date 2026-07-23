import { describe, it, expect, beforeEach, mock } from "bun:test";
import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { RpcService } from '../rpc/rpc.service';
import { ConfigService } from '@nestjs/config';
import { AuthUser, LoginResponse, RegisterResponse } from '../proto_gen/auth_pb';

describe('AuthController', () => {
    let controller: AuthController;
    let mockAuthClient: any;

    beforeEach(async () => {
        mockAuthClient = {
            login: mock(),
            register: mock(),
        };

        const mockRpcService = {
            createClient: mock(() => mockAuthClient),
        };

        const mockConfigService = {
            get: mock(() => 'http://localhost:8001'),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [AuthController],
            providers: [
                { provide: RpcService, useValue: mockRpcService },
                { provide: ConfigService, useValue: mockConfigService },
            ],
        }).compile();

        controller = module.get<AuthController>(AuthController);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('login', () => {
        it('should login successfully', async () => {
            const mockRes = new LoginResponse({
                success: true,
                token: 'test-token',
                user: new AuthUser({ id: 1, email: 'test@gmail.com', role: 'user' }),
            });
            mockAuthClient.login.mockResolvedValue(mockRes);

            const result = await controller.login({ email: 'test@gmail.com', password: 'password' });
            expect(result).toEqual({
                success: true,
                token: 'test-token',
                user: { id: 1, email: 'test@gmail.com', role: 'user' },
            });
        });
    });

    describe('register', () => {
        it('should register successfully', async () => {
            const mockRes = new RegisterResponse({
                success: true,
                user: new AuthUser({ id: 2, email: 'newuser@gmail.com', role: 'user' }),
            });
            mockAuthClient.register.mockResolvedValue(mockRes);

            const result = await controller.register({ email: 'newuser@gmail.com', password: 'password' });
            expect(result).toEqual({
                success: true,
                user: new AuthUser({ id: 2, email: 'newuser@gmail.com', role: 'user' }),
            });
        });
    });
});
