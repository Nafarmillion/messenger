import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket, Namespace } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { JWT_ACCESS_SECRET } from '../common/constants';

interface AuthenticatedSocket extends Socket {
  userId?: string;
}

@WebSocketGateway({
  cors: {
    origin: '*', // Allow all origins for ngrok
    credentials: true,
    methods: ['GET', 'POST'],
  },
  namespace: 'messenger',
})
export class MessagingGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Namespace;

  private logger: Logger = new Logger('MessagingGateway');
  private connectedUsers: Map<string, string> = new Map(); // userId -> socketId

  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');
  }

  async handleConnection(socket: AuthenticatedSocket) {
    try {
      // Authenticate user from token
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        socket.disconnect();
        return;
      }

      const secret = process.env.JWT_ACCESS_SECRET;
      if (!secret) {
        throw new Error('FATAL: JWT_ACCESS_SECRET is missing');
      }

      const payload = this.jwtService.verify(token, {
        secret,
      });

      socket.userId = payload.sub;

      // Store connection
      if (socket.userId) {
        this.connectedUsers.set(socket.userId, socket.id);

        // Update user status in database
        await this.prisma.user.update({
          where: { id: socket.userId },
          data: { isOnline: true },
        });

        // Broadcast online status to user's chat members
        await this.broadcastUserStatus(socket.userId, true);

        this.logger.log(`User ${socket.userId} connected`);
      }
    } catch (error) {
      this.logger.error(`Connection error: ${error.message}`);
      socket.disconnect();
    }
  }

  async handleDisconnect(socket: AuthenticatedSocket) {
    if (socket.userId) {
      this.connectedUsers.delete(socket.userId);

      // Update user status in database
      await this.prisma.user.update({
        where: { id: socket.userId },
        data: {
          isOnline: false,
          lastSeen: new Date(),
        },
      });

      // Broadcast offline status to user's chat members
      await this.broadcastUserStatus(socket.userId, false);

      this.logger.log(`User ${socket.userId} disconnected`);
    }
  }

  @SubscribeMessage('mark_read')
  async handleMarkRead(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() data: { chatId: string },
  ) {
    if (!socket.userId) return;

    // Get all messages in the chat that the user hasn't read
    const messages = await this.prisma.message.findMany({
      where: {
        chatId: data.chatId,
      },
      select: {
        id: true,
        senderId: true,
      },
    });

    // Filter out already read messages (will be improved with persistent storage)
    const unreadMessages = messages; // For now, assume all are unread

    // Mark all messages as read
    if (unreadMessages.length > 0) {
      await (this.prisma as any).messageRead.createMany({
        data: unreadMessages.map((m) => ({
          messageId: m.id,
          userId: socket.userId,
        })),
        skipDuplicates: true,
      });

      // Notify sender(s) that their messages were read
      const senderIds = [...new Set(unreadMessages.map((m) => m.senderId))];
      senderIds.forEach((senderId) => {
        if (senderId !== socket.userId) {
          // Find sender's socket and notify
          const senderSocketId = this.connectedUsers.get(senderId);
          if (senderSocketId) {
            const senderSocket = this.server.sockets.get(senderSocketId);
            if (senderSocket) {
              senderSocket.emit('messages_read', {
                chatId: data.chatId,
                readerId: socket.userId,
                messageIds: unreadMessages.filter((m) => m.senderId === senderId).map((m) => m.id),
              });
            }
          }
        }
      });
    }
  }

  @SubscribeMessage('join_chat')
  async handleJoinChat(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() data: { chatId: string },
  ) {
    if (!socket.userId) return;

    // Verify user is a member of the chat
    const membership = await this.prisma.chatMember.findFirst({
      where: { chatId: data.chatId, userId: socket.userId },
    });

    if (!membership) {
      socket.emit('error', { message: 'You are not a member of this chat' });
      return;
    }

    socket.join(`chat:${data.chatId}`);
    this.logger.log(`User ${socket.userId} joined chat ${data.chatId}`);
  }

  @SubscribeMessage('leave_chat')
  handleLeaveChat(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() data: { chatId: string },
  ) {
    if (!socket.userId) return;

    socket.leave(`chat:${data.chatId}`);
    this.logger.log(`User ${socket.userId} left chat ${data.chatId}`);
  }

  @SubscribeMessage('typing_start')
  handleTypingStart(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() data: { chatId: string },
  ) {
    if (!socket.userId) return;

    socket.to(`chat:${data.chatId}`).emit('user_typing', {
      userId: socket.userId,
      chatId: data.chatId,
      isTyping: true,
    });
  }

  @SubscribeMessage('typing_stop')
  handleTypingStop(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() data: { chatId: string },
  ) {
    if (!socket.userId) return;

    socket.to(`chat:${data.chatId}`).emit('user_typing', {
      userId: socket.userId,
      chatId: data.chatId,
      isTyping: false,
    });
  }



  // Broadcast message to all chat members
  async broadcastMessage(chatId: string, message: any) {
    const members = await this.prisma.chatMember.findMany({ where: { chatId } });
    members.forEach((member) => {
      const socketId = this.connectedUsers.get(member.userId);
      if (socketId) this.server.to(socketId).emit('new_message', message);
    });
  }

  // Broadcast message edit to all chat members
  async broadcastMessageEdit(chatId: string, message: any) {
    const members = await this.prisma.chatMember.findMany({ where: { chatId } });
    members.forEach((member) => {
      const socketId = this.connectedUsers.get(member.userId);
      if (socketId) this.server.to(socketId).emit('message_edited', message);
    });
  }

  // Broadcast message deletion to all chat members
  async broadcastMessageDelete(chatId: string, messageId: string) {
    const members = await this.prisma.chatMember.findMany({ where: { chatId } });
    members.forEach((member) => {
      const socketId = this.connectedUsers.get(member.userId);
      if (socketId) this.server.to(socketId).emit('message_deleted', { chatId, messageId });
    });
  }

  // Broadcast user status to all chats they're in
  private async broadcastUserStatus(userId: string, isOnline: boolean) {
    const memberships = await this.prisma.chatMember.findMany({
      where: { userId },
      include: { chat: true },
    });

    const statusData = {
      userId,
      isOnline,
      lastSeen: isOnline ? null : new Date(),
    };

    memberships.forEach((membership) => {
      this.server.to(`chat:${membership.chatId}`).emit('user_status', statusData);
    });
  }

  // Get connected users in a chat
  getChatOnlineUsers(chatId: string): string[] {
    const room = this.server.adapter.rooms.get(`chat:${chatId}`);
    if (!room) return [];

    const onlineUsers: string[] = [];
    room.forEach((socketId) => {
      const socket = this.server.sockets.get(socketId) as AuthenticatedSocket;
      if (socket?.userId) {
        onlineUsers.push(socket.userId);
      }
    });

    return onlineUsers;
  }
}
