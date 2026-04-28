import { create } from 'zustand';
import { Chat, Message } from '@/lib/api-client';

// Maximum number of messages to keep per chat in memory
const MAX_MESSAGES_PER_CHAT = 200;
// Maximum number of read message IDs to track (cap to prevent unbounded growth)
const MAX_READ_IDS = 5000;

interface ChatState {
  chats: Chat[];
  activeChat: Chat | null;
  messages: Map<string, Message[]>; // chatId -> messages
  readMessageIds: Set<string>; // messageIds that current user has read
  isLoading: boolean;
  error: string | null;
  setChats: (chats: Chat[]) => void;
  addChat: (chat: Chat) => void;
  setActiveChat: (chat: Chat | null) => void;
  addMessage: (chatId: string, message: Message) => void;
  updateMessage: (chatId: string, messageId: string, content: string) => void;
  togglePinMessage: (chatId: string, messageId: string) => void;
  deleteMessage: (chatId: string, messageId: string) => void;
  updateChat: (chatId: string, updates: Partial<Chat>) => void;
  removeChat: (chatId: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  markChatAsRead: (chatId: string) => void;
  isMessageRead: (messageId: string) => boolean;
  updateMemberStatus: (userId: string, isOnline: boolean, lastSeen?: string) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  chats: [],
  activeChat: null,
  messages: new Map(),
  readMessageIds: new Set(),
  isLoading: false,
  error: null,

  setChats: (chats) => set({ chats }),

  addChat: (chat) => set((state) => ({ chats: [chat, ...state.chats] })),

  setActiveChat: (chat) => {
    set({ activeChat: chat });
    // Mark all messages in this chat as read
    if (chat) {
      get().markChatAsRead(chat.id);
    }
  },

  addMessage: (chatId, message) => {
    const { messages } = get();
    const chatMessages = messages.get(chatId) || [];

    // Check if message already exists (prevent duplicates)
    if (chatMessages.some((m) => m.id === message.id)) {
      return;
    }

    // Add new message to the END of the array
    let newMessages = [...chatMessages, message];

    // Evict oldest messages if we exceed the limit
    if (newMessages.length > MAX_MESSAGES_PER_CHAT) {
      const removedMessages = newMessages.slice(0, newMessages.length - MAX_MESSAGES_PER_CHAT);
      // Clean up readMessageIds for removed messages
      const newReadMessageIds = new Set(get().readMessageIds);
      removedMessages.forEach((m) => newReadMessageIds.delete(m.id));
      newMessages = newMessages.slice(newMessages.length - MAX_MESSAGES_PER_CHAT);
      set({ readMessageIds: newReadMessageIds });
    }

    set({
      messages: new Map(messages).set(chatId, newMessages),
    });

    // Update chat's last message in the list
    set((state) => ({
      chats: state.chats.map((c) =>
        c.id === chatId
          ? {
              ...c,
              messages: newMessages,
              updatedAt: message.createdAt,
              lastMessage: message,
            }
          : c
      ),
    }));
  },

  updateMessage: (chatId, messageId, content) => {
    const { messages } = get();
    const chatMessages = messages.get(chatId) || [];
    const updatedMessages = chatMessages.map((m) =>
      m.id === messageId ? { ...m, content, isEdited: true } : m
    );
    set({
      messages: new Map(messages).set(chatId, updatedMessages),
    });
  },

  togglePinMessage: (chatId, messageId) => {
    const { messages } = get();
    const chatMessages = messages.get(chatId) || [];
    const updatedMessages = chatMessages.map((m) =>
      m.id === messageId ? { ...m, isPinned: !m.isPinned } : m
    );
    set({
      messages: new Map(messages).set(chatId, updatedMessages),
    });
  },

  deleteMessage: (chatId, messageId) => {
    const { messages } = get();
    const chatMessages = messages.get(chatId) || [];
    const filteredMessages = chatMessages.filter((m) => m.id !== messageId);
    set({
      messages: new Map(messages).set(chatId, filteredMessages),
    });
  },

  updateChat: (chatId, updates) => {
    set((state) => ({
      chats: state.chats.map((c) =>
        c.id === chatId ? { ...c, ...updates } : c
      ),
      activeChat: state.activeChat?.id === chatId ? { ...state.activeChat, ...updates } : state.activeChat,
    }));
  },

  removeChat: (chatId: string) => {
    const { messages, readMessageIds } = get();
    // Clean up messages and readMessageIds for removed chat
    const newMessages = new Map(messages);
    const removedMessages = newMessages.get(chatId) || [];
    newMessages.delete(chatId);

    const newReadMessageIds = new Set(readMessageIds);
    removedMessages.forEach((m) => newReadMessageIds.delete(m.id));

    set((state) => ({
      messages: newMessages,
      readMessageIds: newReadMessageIds,
      chats: state.chats.filter((c) => c.id !== chatId),
      activeChat: state.activeChat?.id === chatId ? null : state.activeChat,
    }));
  },

  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),

  markChatAsRead: (chatId: string) => {
    const { messages, readMessageIds } = get();
    const chatMessages = messages.get(chatId) || [];

    // Add all message IDs to read set, but cap to prevent unbounded growth
    const newReadMessageIds = new Set(readMessageIds);
    chatMessages.forEach((msg) => newReadMessageIds.add(msg.id));

    // If we exceed the limit, remove oldest IDs (from inactive chats)
    if (newReadMessageIds.size > MAX_READ_IDS) {
      // Keep only IDs from the active chat and the most recent ones
      const activeChatMsgs = get().messages.get(chatId) || [];
      const activeIds = new Set(activeChatMsgs.map((m) => m.id));

      const filteredReadIds = new Set<string>();
      // First, keep all active chat IDs
      activeIds.forEach((id) => {
        if (newReadMessageIds.has(id)) {
          filteredReadIds.add(id);
        }
      });

      // Then add remaining IDs up to the limit
      for (const id of newReadMessageIds) {
        if (filteredReadIds.size >= MAX_READ_IDS) break;
        if (!activeIds.has(id)) {
          filteredReadIds.add(id);
        }
      }

      set({ readMessageIds: filteredReadIds });
    } else {
      set({ readMessageIds: newReadMessageIds });
    }
  },

  isMessageRead: (messageId: string) => {
    return get().readMessageIds.has(messageId);
  },

  updateMemberStatus: (userId, isOnline, lastSeen) => {
    set((state) => ({
      chats: state.chats.map((chat) => ({
        ...chat,
        members: chat.members.map((member) =>
          member.userId === userId
            ? { ...member, user: { ...member.user, isOnline, lastSeen: lastSeen || member.user.lastSeen } }
            : member
        ),
      })),
      activeChat: state.activeChat
        ? {
            ...state.activeChat,
            members: state.activeChat.members.map((member) =>
              member.userId === userId
                ? { ...member, user: { ...member.user, isOnline, lastSeen: lastSeen || member.user.lastSeen } }
                : member
            ),
          }
        : null,
    }));
  },
}));
