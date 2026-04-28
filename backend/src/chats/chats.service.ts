import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateChatDto, AddMemberDto, UpdateGroupDto } from './dto/chat.dto';
import { ChatRole } from '../common/constants';
import { Prisma } from '@prisma/client';
import { MessagingGateway } from '../gateway/messaging.gateway';

@Injectable()
export class ChatsService {
  constructor(
    private prisma: PrismaService,
    private gateway: MessagingGateway
  ) {}

  async create(userId: string, dto: CreateChatDto) {
    if (dto.isGroup) {
      return this.createGroup(userId, dto);
    } else {
      return this.createPrivateChat(userId, dto);
    }
  }

  private async createGroup(userId: string, dto: CreateChatDto) {
    if (!dto.name) {
      throw new BadRequestException('Group name is required');
    }

    const chat = await this.prisma.chat.create({
      data: {
        isGroup: true,
        name: dto.name,
        members: {
          create: {
            userId,
            role: ChatRole.OWNER,
          },
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    // Add initial members if provided
    if (dto.memberIds && dto.memberIds.length > 0) {
      await this.prisma.chatMember.createMany({
        data: dto.memberIds
          .filter((id) => id !== userId)
          .map((id) => ({
            chatId: chat.id,
            userId: id,
            role: ChatRole.MEMBER,
          })),
      });
    }

    return this.findById(chat.id, userId);
  }

  private async createPrivateChat(userId: string, dto: CreateChatDto) {
    if (!dto.memberIds || dto.memberIds.length !== 1) {
      throw new BadRequestException('Exactly one member is required for private chat');
    }

    const otherUserId = dto.memberIds[0];

    if (otherUserId === userId) {
      throw new BadRequestException('Cannot create chat with yourself');
    }

    // Check if chat already exists
    const existingChat = await this.prisma.chat.findFirst({
      where: {
        isGroup: false,
        members: {
          every: {
            userId: { in: [userId, otherUserId] },
          },
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
                isOnline: true,
              },
            },
          },
        },
      },
    });

    if (existingChat) {
      return existingChat;
    }

    const chat = await this.prisma.chat.create({
      data: {
        isGroup: false,
        members: {
          create: [
            { userId, role: ChatRole.MEMBER },
            { userId: otherUserId, role: ChatRole.MEMBER },
          ],
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
                isOnline: true,
              },
            },
          },
        },
      },
    });

    return chat;
  }

  async findAll(userId: string) {
    const chats = await this.prisma.chat.findMany({
      where: {
        members: {
          some: { userId },
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
                isOnline: true,
                settingShowStatus: true,
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
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
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return chats.map((chat) => this.processChat(chat, userId));
  }

  async findById(chatId: string, userId: string) {
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
                isOnline: true,
                settingShowStatus: true,
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 50,
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
        },
      },
    });

    if (!chat) {
      throw new NotFoundException('Chat not found');
    }

    // Check if user is a member
    const isMember = chat.members.some((m) => m.userId === userId);
    if (!isMember) {
      throw new ForbiddenException('You are not a member of this chat');
    }

    return this.processChat(chat, userId);
  }

  async updateGroup(chatId: string, userId: string, dto: UpdateGroupDto) {
    const chat = await this.getChatWithMembers(chatId);

    this.verifyPermission(chat, userId, [ChatRole.OWNER, ChatRole.ADMIN, ChatRole.MODERATOR]);

    const updatedChat = await this.prisma.chat.update({
      where: { id: chatId },
      data: { name: dto.name },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    this.gateway.server.to(`chat:${chatId}`).emit('chat_updated', { chatId });
    return updatedChat;
  }

  async addMember(chatId: string, userId: string, dto: AddMemberDto) {
    const chat = await this.getChatWithMembers(chatId);

    if (!chat.isGroup) {
      throw new ForbiddenException('Cannot add members to private chat');
    }

    // Any member can add other members
    const requesterMember = chat.members.find((m) => m.userId === userId);
    if (!requesterMember) {
      throw new ForbiddenException('You are not a member of this chat');
    }

    // Check if user is already a member
    const existingMember = chat.members.find((m) => m.userId === dto.userId);
    if (existingMember) {
      throw new BadRequestException('User is already a member');
    }

    await this.prisma.chatMember.create({
      data: {
        chatId,
        userId: dto.userId,
        role: dto.role || ChatRole.MEMBER,
      },
    });

    this.gateway.server.to(`chat:${chatId}`).emit('chat_updated', { chatId });
    return this.findById(chatId, userId);
  }

  async removeMember(chatId: string, userId: string, memberId: string) {
    const chat = await this.getChatWithMembers(chatId);

    if (!chat.isGroup) {
      throw new ForbiddenException('Cannot remove members from private chat');
    }

    const memberToRemove = chat.members.find((m) => m.id === memberId);
    if (!memberToRemove) {
      throw new NotFoundException('Member not found');
    }

    // OWNER cannot be removed
    if (memberToRemove.role === ChatRole.OWNER) {
      throw new ForbiddenException('Cannot remove the group owner');
    }

    // Only OWNER and ADMIN can remove members
    this.verifyPermission(chat, userId, [ChatRole.OWNER, ChatRole.ADMIN]);

    // Check if user is trying to remove themselves
    if (memberToRemove.userId === userId) {
      return this.leaveGroup(chatId, userId);
    }

    await this.prisma.chatMember.delete({
      where: { id: memberId },
    });

    this.gateway.server.to(`chat:${chatId}`).emit('chat_updated', { chatId });
    return { message: 'Member removed successfully' };
  }

  async leaveGroup(chatId: string, userId: string) {
    const chat = await this.getChatWithMembers(chatId);

    if (!chat.isGroup) {
      throw new ForbiddenException('Cannot leave a private chat');
    }

    const member = chat.members.find((m) => m.userId === userId);
    if (!member) {
      throw new NotFoundException('You are not a member of this chat');
    }

    // OWNER cannot leave without transferring ownership
    if (member.role === ChatRole.OWNER) {
      throw new ForbiddenException('Owner must transfer ownership before leaving');
    }

    await this.prisma.chatMember.delete({
      where: { id: member.id },
    });

    this.gateway.server.to(`chat:${chatId}`).emit('chat_updated', { chatId });
    return { message: 'You have left the group' };
  }

  async updateMemberRole(chatId: string, userId: string, memberId: string, role: ChatRole) {
    const chat = await this.getChatWithMembers(chatId);

    // Only OWNER and ADMIN can update roles
    this.verifyPermission(chat, userId, [ChatRole.OWNER, ChatRole.ADMIN]);

    const member = chat.members.find((m) => m.id === memberId);
    if (!member) {
      throw new NotFoundException('Member not found');
    }

    // Cannot change OWNER role
    if (member.role === ChatRole.OWNER) {
      throw new ForbiddenException('Cannot change owner role');
    }

    // Cannot assign OWNER role
    if (role === ChatRole.OWNER) {
      throw new ForbiddenException('Cannot assign owner role. Transfer ownership instead.');
    }

    await this.prisma.chatMember.update({
      where: { id: memberId },
      data: { role },
    });

    this.gateway.server.to(`chat:${chatId}`).emit('chat_updated', { chatId });
    return { message: 'Role updated successfully' };
  }

  async transferOwnership(chatId: string, userId: string, newOwnerId: string) {
    const chat = await this.getChatWithMembers(chatId);

    // Only current OWNER can transfer ownership
    this.verifyPermission(chat, userId, [ChatRole.OWNER]);

    const newOwnerMember = chat.members.find((m) => m.userId === newOwnerId);
    if (!newOwnerMember) {
      throw new NotFoundException('User is not a member of this chat');
    }

    // Update current owner to ADMIN
    await this.prisma.chatMember.updateMany({
      where: { chatId, userId },
      data: { role: ChatRole.ADMIN },
    });

    await this.prisma.chatMember.update({
      where: { id: newOwnerMember.id },
      data: { role: ChatRole.OWNER },
    });

    this.gateway.server.to(`chat:${chatId}`).emit('chat_updated', { chatId });
    return { message: 'Ownership transferred successfully' };
  }

  async delete(chatId: string, userId: string) {
    const chat = await this.getChatWithMembers(chatId);

    // Only OWNER can delete the chat
    this.verifyPermission(chat, userId, [ChatRole.OWNER]);

    await this.prisma.chat.delete({
      where: { id: chatId },
    });

    return { message: 'Chat deleted successfully' };
  }

  private async getChatWithMembers(chatId: string) {
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        members: true,
      },
    });

    if (!chat) {
      throw new NotFoundException('Chat not found');
    }

    return chat;
  }

  private verifyPermission(chat: { members: Array<{ userId: string; role: string }> }, userId: string, allowedRoles: ChatRole[]) {
    const member = chat.members.find((m) => m.userId === userId);

    if (!member) {
      throw new ForbiddenException('You are not a member of this chat');
    }

    if (!allowedRoles.includes(member.role as ChatRole)) {
      throw new ForbiddenException('Insufficient permissions');
    }
  }

  private processChat<T extends { members: Array<{ user: any }> }>(chat: T, userId: string): T {
    const processed = { ...chat };

    // Apply privacy settings for members
    processed.members = chat.members.map((m) => {
      const memberData = { ...m, user: { ...m.user } };
      if (!m.user.settingShowStatus) {
        memberData.user.isOnline = undefined;
      }
      return memberData;
    }) as any;

    return processed;
  }
}
