import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import { Message } from '@/lib/api-client';
import { useAuthStore } from './auth-store';
import { useChatStore } from './chat-store';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3000/messenger';

interface TypingUser {
  userId: string;
  chatId: string;
  isTyping: boolean;
}

interface SocketState {
  socket: Socket | null;
  isConnected: boolean;
  typingUsers: Map<string, TypingUser>;
  onlineUsers: Set<string>;
  unreadCounts: Map<string, number>; // chatId -> count
  connect: (token: string) => void;
  disconnect: () => void;
  joinChat: (chatId: string) => void;
  leaveChat: (chatId: string) => void;
  startTyping: (chatId: string) => void;
  stopTyping: (chatId: string) => void;
  markAsRead: (chatId: string) => void;
  incrementUnread: (chatId: string) => void;
  resetUnread: (chatId: string) => void;
  getUnreadCount: (chatId: string) => number;
  getTotalUnread: () => number;
  initUnreadFromChats: (chats: Array<{ id: string; messages?: Array<{ senderId: string }> | null; lastMessage?: { senderId: string } | null }>, currentUserId: string) => void;
}

export const useSocketStore = create<SocketState>((set, get) => ({
  socket: null,
  isConnected: false,
  typingUsers: new Map(),
  onlineUsers: new Set(),
  unreadCounts: new Map(),

  connect: (token: string) => {
    // Disconnect existing socket before creating a new one
    const existingSocket = get().socket;
    if (existingSocket) {
      existingSocket.removeAllListeners();
      existingSocket.disconnect();
    }

    const socket = io(WS_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      set({ isConnected: true });
    });

    socket.on('disconnect', () => {
      set({ isConnected: false });
    });

    // Handle incoming messages
    socket.on('new_message', (message: Message) => {
      // Dispatch custom event for chat-store to listen
      window.dispatchEvent(new CustomEvent('socket-new-message', { detail: message }));

      // Increment unread only if:
      // 1. The message is NOT from the current user (own messages are never unread)
      // 2. The chat is not currently active
      const currentUserId = useAuthStore.getState().user?.id;
      const activeChatId = useChatStore.getState().activeChat?.id;
      if (message.senderId !== currentUserId && activeChatId !== message.chatId) {
        get().incrementUnread(message.chatId);
      }
    });

    // When the current user reads messages — notify senders (messages_read comes back from backend to sender)
    socket.on('messages_read', ({ chatId, readerId, messageIds }: { chatId: string; readerId: string; messageIds?: string[] }) => {
      window.dispatchEvent(new CustomEvent('socket-messages-read', {
        detail: { chatId, readerId, messageIds }
      }));
    });

    socket.on('message_edited', (message: Message) => {
      window.dispatchEvent(new CustomEvent('socket-message-edited', { detail: message }));
    });

    socket.on('message_deleted', ({ chatId, messageId }: { chatId: string; messageId: string }) => {
      window.dispatchEvent(new CustomEvent('socket-message-deleted', { detail: { chatId, messageId } }));
    });

    socket.on('user_typing', (data: TypingUser) => {
      set((state) => {
        const newTypingUsers = new Map(state.typingUsers);
        if (data.isTyping) {
          newTypingUsers.set(`${data.chatId}-${data.userId}`, data);
        } else {
          newTypingUsers.delete(`${data.chatId}-${data.userId}`);
        }
        return { typingUsers: newTypingUsers };
      });
    });

    socket.on('user_status', ({ userId, isOnline, lastSeen }: { userId: string; isOnline: boolean; lastSeen?: string }) => {
      set((state) => {
        const newOnlineUsers = new Set(state.onlineUsers);
        if (isOnline) {
          newOnlineUsers.add(userId);
        } else {
          newOnlineUsers.delete(userId);
        }
        return { onlineUsers: newOnlineUsers };
      });
    });

    socket.on('chat_updated', ({ chatId }: { chatId: string }) => {
      window.dispatchEvent(new CustomEvent('socket-chat-updated', { detail: { chatId } }));
    });

    set({ socket });
  },

  disconnect: () => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
      set({ socket: null, isConnected: false });
    }
  },

  joinChat: (chatId: string) => {
    const { socket } = get();
    if (socket) {
      socket.emit('join_chat', { chatId });
      // NOTE: do NOT resetUnread here — it nukes counts set by initUnreadFromChats.
      // Unread is only reset explicitly when the user opens the chat (chat-window).
    }
  },

  leaveChat: (chatId: string) => {
    const { socket } = get();
    if (socket) {
      socket.emit('leave_chat', { chatId });
    }
  },

  startTyping: (chatId: string) => {
    const { socket } = get();
    if (socket) {
      socket.emit('typing_start', { chatId });
    }
  },

  stopTyping: (chatId: string) => {
    const { socket } = get();
    if (socket) {
      socket.emit('typing_stop', { chatId });
    }
  },

  markAsRead: (chatId: string) => {
    const { socket } = get();
    if (socket) {
      socket.emit('mark_read', { chatId });
    }
  },

  incrementUnread: (chatId: string) => {
    set((state) => {
      const newUnreadCounts = new Map(state.unreadCounts);
      const current = newUnreadCounts.get(chatId) || 0;
      newUnreadCounts.set(chatId, current + 1);
      return { unreadCounts: newUnreadCounts };
    });
  },

  resetUnread: (chatId: string) => {
    set((state) => {
      const newUnreadCounts = new Map(state.unreadCounts);
      newUnreadCounts.set(chatId, 0);
      return { unreadCounts: newUnreadCounts };
    });
  },

  getUnreadCount: (chatId: string) => {
    return get().unreadCounts.get(chatId) || 0;
  },

  getTotalUnread: () => {
    const { unreadCounts } = get();
    let total = 0;
    unreadCounts.forEach((count) => {
      total += count;
    });
    return total;
  },

  initUnreadFromChats: (chats, currentUserId) => {
    set((state) => {
      const newUnreadCounts = new Map(state.unreadCounts);
      const activeChatId = useChatStore.getState().activeChat?.id;

      chats.forEach((chat) => {
        // Don't overwrite counts already tracked via socket events this session
        if (newUnreadCounts.has(chat.id)) return;

        // Skip the currently open chat — it has no unread
        if (activeChatId === chat.id) {
          newUnreadCounts.set(chat.id, 0);
          return;
        }

        // Backend returns messages sorted DESC (newest first at index 0)
        const lastMsg = chat.lastMessage ?? chat.messages?.[0];
        if (lastMsg && lastMsg.senderId !== currentUserId) {
          newUnreadCounts.set(chat.id, 1);
        } else {
          newUnreadCounts.set(chat.id, 0);
        }
      });

      return { unreadCounts: newUnreadCounts };
    });
  },
}));
