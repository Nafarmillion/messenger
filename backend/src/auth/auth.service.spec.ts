import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

// Mock uuid
jest.mock('uuid', () => ({ v4: () => 'test-session-id' }));

describe('AuthService', () => {
  let service: AuthService;
  let prisma: any;
  let jwtService: any;

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      session: {
        findUnique: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
    };

    jwtService = {
      signAsync: jest.fn(),
      verify: jest.fn(),
      decode: jest.fn(() => ({ exp: Math.floor(Date.now() / 1000) + 604800 })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, string> = {
                JWT_ACCESS_SECRET: 'test-access-secret',
                JWT_REFRESH_SECRET: 'test-refresh-secret',
                JWT_ACCESS_EXPIRATION: '15m',
                JWT_REFRESH_EXPIRATION: '7d',
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const dto = {
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        phone: '+380123456789',
        password: 'password123',
      };

      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'user-id',
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        phone: '+380123456789',
        settingShowStatus: true,
        settingShowLastSeen: true,
        createdAt: new Date(),
      });

      const result = await service.register(dto);

      expect(result).toHaveProperty('id', 'user-id');
      expect(result.username).toBe('testuser');
      expect(result).not.toHaveProperty('passwordHash');
      expect(prisma.user.create).toHaveBeenCalledTimes(1);
    });

    it('should throw ConflictException when username is taken', async () => {
      const dto = {
        username: 'existing',
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        password: 'password123',
      };

      prisma.user.findUnique.mockResolvedValueOnce({ id: 'existing-id' });

      await expect(service.register(dto)).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException when email is taken', async () => {
      const dto = {
        username: 'newuser',
        firstName: 'Test',
        lastName: 'User',
        email: 'existing@example.com',
        password: 'password123',
      };

      prisma.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'existing-email-id' });

      await expect(service.register(dto)).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException when neither email nor phone provided', async () => {
      const dto = {
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        password: 'password123',
      };

      await expect(service.register(dto as any)).rejects.toThrow(BadRequestException);
    });
  });

  describe('loginWithEmail', () => {
    it('should return tokens on successful login', async () => {
      const dto = { email: 'user@example.com', password: 'password123' };
      const mockUser = {
        id: 'user-id',
        email: 'user@example.com',
        passwordHash: '$2b$10$hashedvalue',
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);
      jest.spyOn(require('bcrypt'), 'compare').mockResolvedValue(true);
      jwtService.signAsync
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');
      prisma.session.create.mockResolvedValue({ id: 'session-id' });

      const result = await service.loginWithEmail(dto);

      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
      expect(jwtService.signAsync).toHaveBeenCalledTimes(2);
    });

    it('should throw UnauthorizedException when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.loginWithEmail({ email: 'unknown@example.com', password: 'password' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException on invalid password', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-id',
        email: 'user@example.com',
        passwordHash: '$2b$10$hashedvalue',
      });
      jest.spyOn(require('bcrypt'), 'compare').mockResolvedValue(false);

      await expect(
        service.loginWithEmail({ email: 'user@example.com', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('loginWithPhone', () => {
    it('should return tokens on successful phone login', async () => {
      const dto = { phone: '+380123456789', password: 'password123' };
      const mockUser = {
        id: 'user-id',
        phone: '+380123456789',
        passwordHash: '$2b$10$hashedvalue',
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);
      jest.spyOn(require('bcrypt'), 'compare').mockResolvedValue(true);
      jwtService.signAsync
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');
      prisma.session.create.mockResolvedValue({ id: 'session-id' });

      const result = await service.loginWithPhone(dto);

      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
    });

    it('should throw UnauthorizedException when phone user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.loginWithPhone({ phone: '+380000000000', password: 'password' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('should delete session and return true', async () => {
      jwtService.verify.mockReturnValue({ sessionId: 'session-id' });
      prisma.session.delete.mockResolvedValue({});

      const result = await service.logout('refresh-token');

      expect(result).toBe(true);
      expect(prisma.session.delete).toHaveBeenCalledTimes(1);
    });

    it('should return false when session deletion fails', async () => {
      jwtService.verify.mockReturnValue({ sessionId: 'session-id' });
      prisma.session.delete.mockRejectedValue(new Error('Not found'));

      const result = await service.logout('invalid-token');

      expect(result).toBe(false);
    });
  });

  describe('logoutAllDevices', () => {
    it('should delete all user sessions', async () => {
      prisma.session.deleteMany.mockResolvedValue({ count: 3 });

      const result = await service.logoutAllDevices('user-id');

      expect(result).toBe(true);
      expect(prisma.session.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-id' },
      });
    });
  });
});
