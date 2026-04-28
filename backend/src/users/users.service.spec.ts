import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      user: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      blockedUser: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        deleteMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  describe('findAll', () => {
    it('should return users excluding blocked ones', async () => {
      prisma.blockedUser.findMany.mockResolvedValue([]);
      prisma.user.findMany.mockResolvedValue([
        { id: 'user-1', username: 'testuser', firstName: 'Test', lastName: 'User' },
      ]);

      const result = await service.findAll({ search: 'test' }, 'user-1');

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('findOne', () => {
    it('should return user by id', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        settingShowStatus: true,
        settingShowLastSeen: true,
      });

      const result = await service.findOne('user-1');

      expect(result).toHaveProperty('id', 'user-1');
    });

    it('should throw NotFoundException when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByUsername', () => {
    it('should return user by username', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        settingShowStatus: true,
        settingShowLastSeen: true,
      });

      const result = await service.findByUsername('testuser');

      expect(result.username).toBe('testuser');
    });

    it('should throw NotFoundException when username not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.findByUsername('unknown')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update user profile', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.update.mockResolvedValue({
        id: 'user-1',
        username: 'newname',
        firstName: 'Updated',
        lastName: 'User',
      });

      const result = await service.update('user-1', { firstName: 'Updated' });

      expect(result.firstName).toBe('Updated');
      expect(prisma.user.update).toHaveBeenCalled();
    });
  });

  describe('updateSettings', () => {
    it('should update privacy settings', async () => {
      prisma.user.update.mockResolvedValue({
        id: 'user-1',
        settingShowStatus: false,
        settingShowLastSeen: false,
      });

      const result = await service.updateSettings('user-1', {
        settingShowStatus: false,
      });

      expect(result.settingShowStatus).toBe(false);
    });
  });

  describe('changePassword', () => {
    it('should change password when current password is correct', async () => {
      const mockUser = {
        id: 'user-1',
        passwordHash: '$2b$10$hashedpassword',
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);
      jest.spyOn(require('bcrypt'), 'compare').mockResolvedValue(true);
      jest.spyOn(require('bcrypt'), 'hash').mockResolvedValue('$2b$10$newhash');
      prisma.user.update.mockResolvedValue({});

      const result = await service.changePassword('user-1', {
        currentPassword: 'oldpass',
        newPassword: 'newpass123',
      });

      expect(result).toHaveProperty('message');
      expect(prisma.user.update).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when current password is wrong', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        passwordHash: '$2b$10$hashedpassword',
      });
      jest.spyOn(require('bcrypt'), 'compare').mockResolvedValue(false);

      await expect(
        service.changePassword('user-1', {
          currentPassword: 'wrong',
          newPassword: 'newpass123',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('blockUser', () => {
    it('should block a user successfully', async () => {
      prisma.blockedUser.findUnique.mockResolvedValue(null);
      prisma.blockedUser.create.mockResolvedValue({});

      const result = await service.blockUser('user-1', 'user-2');

      expect(result).toHaveProperty('message');
      expect(prisma.blockedUser.create).toHaveBeenCalled();
    });

    it('should throw BadRequestException when blocking yourself', async () => {
      await expect(service.blockUser('user-1', 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when user already blocked', async () => {
      prisma.blockedUser.findUnique.mockResolvedValue({ id: 'block-id' });

      await expect(service.blockUser('user-1', 'user-2')).rejects.toThrow(BadRequestException);
    });
  });

  describe('unblockUser', () => {
    it('should unblock a user successfully', async () => {
      prisma.blockedUser.deleteMany.mockResolvedValue({ count: 1 });

      const result = await service.unblockUser('user-1', 'user-2');

      expect(result).toHaveProperty('message');
    });
  });

  describe('getBlockedUsers', () => {
    it('should return list of blocked users', async () => {
      prisma.blockedUser.findMany.mockResolvedValue([
        { blocked: { id: 'user-2', username: 'blockeduser', firstName: 'Blocked', lastName: 'User' } },
      ]);

      const result = await service.getBlockedUsers('user-1');

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1);
    });
  });
});
