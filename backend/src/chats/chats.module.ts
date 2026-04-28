import { Module } from '@nestjs/common';
import { ChatsController } from './chats.controller';
import { ChatsService } from './chats.service';
import { PrismaService } from '../prisma/prisma.service';
import { APP_GUARD } from '@nestjs/core';
import { ChatRolesGuard } from '../common/guards/chat-roles.guard';
import { GatewayModule } from '../gateway/gateway.module';

@Module({
  imports: [GatewayModule],
  controllers: [ChatsController],
  providers: [ChatsService, PrismaService],
  exports: [ChatsService],
})
export class ChatsModule {}
