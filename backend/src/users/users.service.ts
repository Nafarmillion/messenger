import { Injectable, NotFoundException, BadRequestException, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto, UpdateSettingsDto, ChangePasswordDto } from './dto/user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(query?: { search?: string; limit?: number }, userId?: string) {
    const { search, limit } = query || {};

    // Get blocked user IDs
    const blockedUsers = await this.prisma.blockedUser.findMany({
      where: { blockerId: userId },
      select: { blockedId: true },
    });
    const blockedIds = blockedUsers.map((b) => b.blockedId);

    const where: any = search
      ? {
          OR: [
            { username: { contains: search } },
            { firstName: { contains: search } },
            { lastName: { contains: search } },
          ],
          id: { notIn: blockedIds },
        }
      : {
          id: { notIn: blockedIds },
        };

    const users = await this.prisma.user.findMany({
      where,
      take: limit || 20,
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        isOnline: true,
        lastSeen: true,
        settingShowStatus: true,
        settingShowLastSeen: true,
        avatarUrl: true,
      },
    });

    // Apply privacy settings
    return users.map((user) => this.applyPrivacySettings(user));
  }

  async findOne(id: string, requestUserId?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        isOnline: true,
        lastSeen: true,
        settingShowStatus: true,
        settingShowLastSeen: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.applyPrivacySettings(user, requestUserId);
  }

  async findByUsername(username: string, requestUserId?: string) {
    const user = await this.prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        isOnline: true,
        lastSeen: true,
        settingShowStatus: true,
        settingShowLastSeen: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.applyPrivacySettings(user, requestUserId);
  }

  async update(userId: string, dto: UpdateUserDto) {
    // Check if new username is taken
    if (dto.username) {
      const existingUser = await this.prisma.user.findUnique({
        where: { username: dto.username },
      });

      if (existingUser && existingUser.id !== userId) {
        throw new BadRequestException('Username already exists');
      }
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: dto,
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        settingShowStatus: true,
        settingShowLastSeen: true,
        avatarUrl: true,
        updatedAt: true,
      },
    });
  }

  async updateAvatar(userId: string, avatarUrl: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        settingShowStatus: true,
        settingShowLastSeen: true,
        avatarUrl: true,
        updatedAt: true,
      },
    });
  }

  async updateSettings(userId: string, dto: UpdateSettingsDto) {
    return this.prisma.user.update({
      where: { id: userId },
      data: dto,
      select: {
        id: true,
        settingShowStatus: true,
        settingShowLastSeen: true,
      },
    });
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isPasswordValid = await bcrypt.compare(dto.currentPassword, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const newPasswordHash = await bcrypt.hash(dto.newPassword, 10);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });

    return { message: 'Password changed successfully' };
  }

  async delete(userId: string) {
    await this.prisma.user.delete({
      where: { id: userId },
    });

    return { message: 'User deleted successfully' };
  }

  async setOnline(userId: string, isOnline: boolean) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        isOnline,
        lastSeen: new Date(),
      },
    });
  }

  async updateLastSeen(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastSeen: new Date() },
    });
  }

  private applyPrivacySettings(user: any, requestUserId?: string) {
    const result = { ...user };

    // If user is requesting their own data, show everything
    if (requestUserId === user.id) {
      return result;
    }

    // Apply privacy settings
    if (!user.settingShowStatus) {
      result.isOnline = undefined;
    }

    if (!user.settingShowLastSeen) {
      result.lastSeen = undefined;
    }

    return result;
  }

  async blockUser(blockerId: string, blockedId: string) {
    if (blockerId === blockedId) {
      throw new BadRequestException('You cannot block yourself');
    }

    // Check if already blocked
    const existing = await this.prisma.blockedUser.findUnique({
      where: {
        blockerId_blockedId: {
          blockerId,
          blockedId,
        },
      },
    });

    if (existing) {
      throw new BadRequestException('User is already blocked');
    }

    await this.prisma.blockedUser.create({
      data: {
        blockerId,
        blockedId,
      },
    });

    return { message: 'User blocked successfully' };
  }

  async unblockUser(blockerId: string, blockedId: string) {
    await this.prisma.blockedUser.deleteMany({
      where: {
        blockerId,
        blockedId,
      },
    });

    return { message: 'User unblocked successfully' };
  }

  async getBlockedUsers(userId: string) {
    const blocked = await this.prisma.blockedUser.findMany({
      where: { blockerId: userId },
      include: {
        blocked: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return blocked.map((b) => b.blocked);
  }

  async isBlocked(blockerId: string, blockedId: string): Promise<boolean> {
    const existing = await this.prisma.blockedUser.findUnique({
      where: {
        blockerId_blockedId: {
          blockerId,
          blockedId,
        },
      },
    });

    return !!existing;
  }
}
