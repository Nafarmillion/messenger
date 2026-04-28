import { Module } from '@nestjs/common';
import { MessagingGateway } from './messaging.gateway';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  imports: [JwtModule],
  providers: [MessagingGateway, PrismaService],
  exports: [MessagingGateway],
})
export class GatewayModule {}
