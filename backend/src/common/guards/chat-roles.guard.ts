import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { CHAT_ROLES_KEY } from '../../common/decorators/chat-roles.decorator';
import { ChatRole as ChatRoleEnum } from '../../common/constants';
import { ChatRole } from '@prisma/client';

@Injectable()
export class ChatRolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.get<ChatRole[]>(
      CHAT_ROLES_KEY,
      context.getHandler(),
    );

    if (!requiredRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const chatId = request.params.chatId || request.params.id;

    if (!user || !chatId) {
      throw new ForbiddenException('Access denied');
    }

    const member = await this.prisma.chatMember.findFirst({
      where: {
        chatId,
        userId: user.id,
      },
    });

    if (!member) {
      throw new ForbiddenException('You are not a member of this chat');
    }

    if (!requiredRoles.includes(member.role as any)) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
