import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { ChatsService } from './chats.service';
import { PrismaService } from '../prisma/prisma.service';
import { MessagingGateway } from '../gateway/messaging.gateway';

describe('ChatsService', () => {
  let service: ChatsService;
  let prisma: any;

  const mockGateway = {
    server: {
      to: jest.fn().mockReturnValue({ emit: jest.fn() }),
    },
  };

  const mockGroupChat = {
    id: 'chat-1',
    isGroup: true,
    name: 'Test Group',
    members: [
      { id: 'm1', userId: 'user-1', role: 'OWNER', user: { settingShowStatus: true } },
      { id: 'm2', userId: 'user-2', role: 'MEMBER', user: { settingShowStatus: true } },
    ],
  };

  const mockPrivateChat = {
    id: 'chat-2',
    isGroup: false,
    name: null,
    members: [
      { id: 'm3', userId: 'user-1', role: 'MEMBER', user: { settingShowStatus: true } },
      { id: 'm4', userId: 'user-2', role: 'MEMBER', user: { settingShowStatus: true } },
    ],
  };

  beforeEach(async () => {
    prisma = {
      chat: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      chatMember: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        createMany: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatsService,
        { provide: PrismaService, useValue: prisma },
        { provide: MessagingGateway, useValue: mockGateway },
      ],
    }).compile();

    service = module.get<ChatsService>(ChatsService);
  });

  describe('findAll', () => {
    it('should return all chats for a user', async () => {
      prisma.chat.findMany.mockResolvedValue([mockPrivateChat]);

      const result = await service.findAll('user-1');

      expect(Array.isArray(result)).toBe(true);
      expect(prisma.chat.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { members: { some: { userId: 'user-1' } } },
        }),
      );
    });
  });

  describe('findById', () => {
    it('should return chat when user is a member', async () => {
      prisma.chat.findUnique.mockResolvedValue(mockPrivateChat);

      const result = await service.findById('chat-2', 'user-1');

      expect(result).toHaveProperty('id', 'chat-2');
    });

    it('should throw NotFoundException when chat not found', async () => {
      prisma.chat.findUnique.mockResolvedValue(null);

      await expect(service.findById('nonexistent', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException when user is not a member', async () => {
      prisma.chat.findUnique.mockResolvedValue({
        ...mockPrivateChat,
        members: [{ userId: 'other-user', role: 'MEMBER', user: { settingShowStatus: true } }],
      });

      await expect(service.findById('chat-2', 'user-1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('create - private chat', () => {
    it('should return existing chat if already exists', async () => {
      prisma.chat.findFirst.mockResolvedValue(mockPrivateChat);

      const result = await service.create('user-1', {
        isGroup: false,
        memberIds: ['user-2'],
      });

      expect(result).toEqual(mockPrivateChat);
    });

    it('should create new private chat if not exists', async () => {
      prisma.chat.findFirst.mockResolvedValue(null);
      const newChat = {
        id: 'new-chat',
        isGroup: false,
        name: null,
        members: [
          { userId: 'user-1', role: 'MEMBER', user: { settingShowStatus: true } },
          { userId: 'user-2', role: 'MEMBER', user: { settingShowStatus: true } },
        ],
      };
      prisma.chat.create.mockResolvedValue(newChat);

      const result = await service.create('user-1', {
        isGroup: false,
        memberIds: ['user-2'],
      });

      expect(result).toHaveProperty('id', 'new-chat');
      expect(prisma.chat.create).toHaveBeenCalledTimes(1);
    });

    it('should throw BadRequestException when creating chat with yourself', async () => {
      await expect(
        service.create('user-1', { isGroup: false, memberIds: ['user-1'] }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('create - group chat', () => {
    it('should create group with creator as OWNER', async () => {
      const newGroup = {
        id: 'group-1',
        isGroup: true,
        name: 'Test Group',
        members: [{ userId: 'user-1', role: 'OWNER', user: { settingShowStatus: true } }],
      };
      prisma.chat.create.mockResolvedValue(newGroup);
      prisma.chat.findUnique.mockResolvedValue(newGroup);

      const result = await service.create('user-1', {
        isGroup: true,
        name: 'Test Group',
        memberIds: ['user-2'],
      });

      expect(result).toHaveProperty('id', 'group-1');
      expect(prisma.chat.create).toHaveBeenCalled();
    });

    it('should throw BadRequestException when group name is missing', async () => {
      await expect(
        service.create('user-1', { isGroup: true, name: undefined, memberIds: [] }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateGroup', () => {
    it('should update group name when user has permission', async () => {
      prisma.chat.findUnique.mockResolvedValue(mockGroupChat);
      prisma.chat.update.mockResolvedValue({ ...mockGroupChat, name: 'Updated' });

      const result = await service.updateGroup('chat-1', 'user-1', { name: 'Updated' });

      expect(result.name).toBe('Updated');
    });

    it('should throw ForbiddenException when user lacks permission', async () => {
      prisma.chat.findUnique.mockResolvedValue({
        ...mockGroupChat,
        members: [{ userId: 'user-1', role: 'MEMBER', user: { settingShowStatus: true } }],
      });

      await expect(
        service.updateGroup('chat-1', 'user-1', { name: 'Updated' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('leaveGroup', () => {
    it('should allow member to leave group', async () => {
      prisma.chat.findUnique.mockResolvedValue(mockGroupChat);
      prisma.chatMember.delete.mockResolvedValue({});

      const result = await service.leaveGroup('chat-1', 'user-2');

      expect(result).toHaveProperty('message');
      expect(prisma.chatMember.delete).toHaveBeenCalled();
    });

    it('should throw ForbiddenException for private chat', async () => {
      prisma.chat.findUnique.mockResolvedValue(mockPrivateChat);

      await expect(service.leaveGroup('chat-2', 'user-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ForbiddenException if OWNER tries to leave', async () => {
      prisma.chat.findUnique.mockResolvedValue(mockGroupChat);

      await expect(service.leaveGroup('chat-1', 'user-1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('delete', () => {
    it('should allow owner to delete chat', async () => {
      prisma.chat.findUnique.mockResolvedValue(mockGroupChat);
      prisma.chat.delete.mockResolvedValue({});

      const result = await service.delete('chat-1', 'user-1');

      expect(result).toHaveProperty('message');
      expect(prisma.chat.delete).toHaveBeenCalled();
    });

    it('should throw ForbiddenException if non-owner tries to delete', async () => {
      prisma.chat.findUnique.mockResolvedValue({
        ...mockGroupChat,
        members: [{ userId: 'user-1', role: 'MEMBER', user: { settingShowStatus: true } }],
      });

      await expect(service.delete('chat-1', 'user-1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
