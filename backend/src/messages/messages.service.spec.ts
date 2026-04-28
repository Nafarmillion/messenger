import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { PrismaService } from '../prisma/prisma.service';
import { MessagingGateway } from '../gateway/messaging.gateway';

describe('MessagesService', () => {
  let service: MessagesService;
  let prisma: any;

  const mockGateway = {
    broadcastMessage: jest.fn(),
    broadcastMessageEdit: jest.fn(),
    broadcastMessageDelete: jest.fn(),
  };

  beforeEach(async () => {
    prisma = {
      message: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      chatMember: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      blockedUser: {
        findUnique: jest.fn(),
      },
      chat: {
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagesService,
        { provide: PrismaService, useValue: prisma },
        { provide: MessagingGateway, useValue: mockGateway },
      ],
    }).compile();

    service = module.get<MessagesService>(MessagesService);
  });

  describe('create', () => {
    it('should create a message and broadcast it', async () => {
      const dto = { content: 'Hello world', replyToId: null };

      prisma.chatMember.findFirst.mockResolvedValue({ id: 'member-id' });
      prisma.chatMember.findMany.mockResolvedValue([
        { userId: 'user-1' },
        { userId: 'user-2' },
      ]);
      prisma.blockedUser.findUnique.mockResolvedValue(null);
      prisma.message.create.mockResolvedValue({
        id: 'msg-1',
        content: 'Hello world',
        senderId: 'user-1',
        chatId: 'chat-1',
        isEdited: false,
        isPinned: false,
        sender: { firstName: 'Test', lastName: 'User' },
      });
      prisma.chat.update.mockResolvedValue({});

      const result = await service.create('chat-1', 'user-1', dto);

      expect(result.content).toBe('Hello world');
      expect(prisma.message.create).toHaveBeenCalled();
      expect(mockGateway.broadcastMessage).toHaveBeenCalled();
    });

    it('should throw ForbiddenException when user not a member', async () => {
      prisma.chatMember.findFirst.mockResolvedValue(null);

      await expect(
        service.create('chat-1', 'user-1', { content: 'Hello', replyToId: null }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when sender is blocked', async () => {
      prisma.chatMember.findFirst.mockResolvedValue({ id: 'member-id' });
      prisma.chatMember.findMany.mockResolvedValue([
        { userId: 'user-1' },
        { userId: 'user-2' },
      ]);
      prisma.blockedUser.findUnique.mockResolvedValue({
        id: 'block-id',
        blockerId: 'user-2',
        blockedId: 'user-1',
      });

      await expect(
        service.create('chat-1', 'user-1', { content: 'Hello', replyToId: null }),
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.message.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return messages for a chat when user is a member', async () => {
      const mockMessages = [
        { id: 'msg-1', content: 'Hello', senderId: 'user-1', chatId: 'chat-1' },
      ];

      prisma.chatMember.findFirst.mockResolvedValue({ id: 'member-id' });
      prisma.message.findMany.mockResolvedValue(mockMessages);

      const result = await service.findAll('chat-1', 'user-1');

      expect(result).toEqual(mockMessages);
    });

    it('should throw ForbiddenException when user not a member', async () => {
      prisma.chatMember.findFirst.mockResolvedValue(null);

      await expect(service.findAll('chat-1', 'user-1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findOne', () => {
    it('should return a message by id', async () => {
      const mockMessage = {
        id: 'msg-1',
        content: 'Test message',
        senderId: 'user-1',
        chatId: 'chat-1',
      };

      prisma.message.findUnique.mockResolvedValue(mockMessage);
      prisma.chatMember.findFirst.mockResolvedValue({ id: 'member-id' });

      const result = await service.findOne('msg-1', 'user-1');

      expect(result).toEqual(mockMessage);
    });

    it('should throw NotFoundException when message not found', async () => {
      prisma.message.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException when user not a member', async () => {
      prisma.message.findUnique.mockResolvedValue({
        id: 'msg-1',
        chatId: 'chat-1',
        senderId: 'user-1',
      });
      prisma.chatMember.findFirst.mockResolvedValue(null);

      await expect(service.findOne('msg-1', 'user-2')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('update', () => {
    it('should update message content and set isEdited to true', async () => {
      const existingMessage = {
        id: 'msg-1',
        senderId: 'user-1',
        content: 'Original',
        chatId: 'chat-1',
      };

      prisma.message.findUnique.mockResolvedValue(existingMessage);
      prisma.message.update.mockResolvedValue({
        ...existingMessage,
        content: 'Updated content',
        isEdited: true,
      });

      const result = await service.update('msg-1', 'user-1', {
        content: 'Updated content',
      });

      expect(result.content).toBe('Updated content');
      expect(result.isEdited).toBe(true);
      expect(mockGateway.broadcastMessageEdit).toHaveBeenCalled();
    });

    it('should throw ForbiddenException when non-author tries to edit', async () => {
      prisma.message.findUnique.mockResolvedValue({
        id: 'msg-1',
        senderId: 'user-1',
        content: 'Original',
      });

      await expect(
        service.update('msg-1', 'user-2', { content: 'Hacked!' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('delete', () => {
    it('should delete message when author requests deletion', async () => {
      prisma.message.findUnique.mockResolvedValue({
        id: 'msg-1',
        senderId: 'user-1',
        chatId: 'chat-1',
      });
      prisma.message.delete.mockResolvedValue({});

      const result = await service.delete('msg-1', 'user-1');

      expect(result).toHaveProperty('message');
      expect(prisma.message.delete).toHaveBeenCalled();
      expect(mockGateway.broadcastMessageDelete).toHaveBeenCalledWith('chat-1', 'msg-1');
    });

    it('should throw ForbiddenException when non-author tries to delete', async () => {
      prisma.message.findUnique.mockResolvedValue({
        id: 'msg-1',
        senderId: 'user-1',
      });

      await expect(service.delete('msg-1', 'user-2')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('togglePin', () => {
    it('should toggle pinned status', async () => {
      prisma.message.findUnique.mockResolvedValue({
        id: 'msg-1',
        senderId: 'user-1',
        chatId: 'chat-1',
        isPinned: false,
        chat: { members: [{ userId: 'user-1' }] },
      });
      prisma.message.update.mockResolvedValue({
        id: 'msg-1',
        isPinned: true,
        chatId: 'chat-1',
      });

      const result = await service.togglePin('msg-1', 'user-1');

      expect(result.isPinned).toBe(true);
      expect(mockGateway.broadcastMessageEdit).toHaveBeenCalled();
    });

    it('should throw ForbiddenException when non-member tries to pin', async () => {
      prisma.message.findUnique.mockResolvedValue({
        id: 'msg-1',
        isPinned: false,
        chat: { members: [{ userId: 'other-user' }] },
      });

      await expect(service.togglePin('msg-1', 'user-1')).rejects.toThrow(ForbiddenException);
    });
  });
});
