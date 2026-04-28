import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MessagingGateway } from '../gateway/messaging.gateway';
import { CreateMessageDto, UpdateMessageDto } from './dto/message.dto';

@Injectable()
export class MessagesService {
  constructor(
    private prisma: PrismaService,
    private gateway: MessagingGateway,
  ) {}

  async create(chatId: string, senderId: string, dto: CreateMessageDto) {
    // Check if user is a member of the chat
    const chatMember = await this.prisma.chatMember.findFirst({
      where: { chatId, userId: senderId },
    });

    if (!chatMember) {
      throw new ForbiddenException('You are not a member of this chat');
    }

    // Check if sender is blocked by any chat member
    const chatMembers = await this.prisma.chatMember.findMany({
      where: { chatId },
      select: { userId: true },
    });

    for (const member of chatMembers) {
      if (member.userId === senderId) continue;
      
      const isBlocked = await this.prisma.blockedUser.findUnique({
        where: {
          blockerId_blockedId: {
            blockerId: member.userId,
            blockedId: senderId,
          },
        },
      });

      if (isBlocked) {
        throw new ForbiddenException('You cannot send messages to this chat');
      }
    }

    const message = await this.prisma.message.create({
      data: {
        chatId,
        senderId,
        content: dto.content,
        replyToId: dto.replyToId,
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
        replyTo: {
          include: {
            sender: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    // Broadcast to all chat members via WebSocket
    this.gateway.broadcastMessage(chatId, message);

    // Update chat's updatedAt
    await this.prisma.chat.update({
      where: { id: chatId },
      data: {},
    });

    return message;
  }

  async findAll(chatId: string, userId: string, options?: { limit?: number; before?: Date; after?: Date }) {
    // Check if user is a member of the chat
    const chatMember = await this.prisma.chatMember.findFirst({
      where: { chatId, userId },
    });

    if (!chatMember) {
      throw new ForbiddenException('You are not a member of this chat');
    }

    const where: any = { chatId };

    if (options?.before) {
      where.createdAt = { ...where.createdAt, lt: options.before };
    }

    if (options?.after) {
      where.createdAt = { ...where.createdAt, gt: options.after };
    }

    const messages = await this.prisma.message.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: options?.limit || 50,
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return messages.reverse();
  }

  async findOne(messageId: string, userId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    // Check if user is a member of the chat
    const chatMember = await this.prisma.chatMember.findFirst({
      where: { chatId: message.chatId, userId },
    });

    if (!chatMember) {
      throw new ForbiddenException('You are not a member of this chat');
    }

    return message;
  }

  async update(messageId: string, userId: string, dto: UpdateMessageDto) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    // Only sender can edit their message
    if (message.senderId !== userId) {
      throw new ForbiddenException('You can only edit your own messages');
    }

    return this.prisma.message.update({
      where: { id: messageId },
      data: {
        content: dto.content,
        isEdited: true,
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    }).then((updatedMessage) => {
      // Broadcast edit event
      this.gateway.broadcastMessageEdit(message.chatId, updatedMessage);
      return updatedMessage;
    });
  }

  async delete(messageId: string, userId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    // Only sender can delete their message
    if (message.senderId !== userId) {
      throw new ForbiddenException('You can only delete your own messages');
    }

    await this.prisma.message.delete({
      where: { id: messageId },
    });

    // Broadcast delete event
    this.gateway.broadcastMessageDelete(message.chatId, messageId);

    return { message: 'Message deleted successfully' };
  }

  async togglePin(messageId: string, userId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: {
        chat: {
          include: {
            members: true,
          },
        },
      },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    // Only chat members can pin/unpin messages
    const isMember = message.chat.members.some((m) => m.userId === userId);
    if (!isMember) {
      throw new ForbiddenException('You are not a member of this chat');
    }

    // Toggle pinned status
    const updatedMessage = await this.prisma.message.update({
      where: { id: messageId },
      data: {
        isPinned: !message.isPinned,
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
        replyTo: {
          include: {
            sender: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    // Broadcast update event
    this.gateway.broadcastMessageEdit(message.chatId, updatedMessage);

    return updatedMessage;
  }
}
