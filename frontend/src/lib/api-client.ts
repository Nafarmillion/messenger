import api from './api';

export interface RegisterDto {
  username: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  password: string;
}

export interface LoginWithEmailDto {
  email: string;
  password: string;
}

export interface LoginWithPhoneDto {
  phone: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface User {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  isOnline?: boolean;
  lastSeen?: string;
  settingShowStatus?: boolean;
  settingShowLastSeen?: boolean;
  avatarUrl?: string | null;
  createdAt: string;
}

export interface Chat {
  id: string;
  isGroup: boolean;
  name?: string | null;
  members: ChatMember[];
  messages?: Message[];
  lastMessage?: Message | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMember {
  id: string;
  chatId: string;
  userId: string;
  role: 'OWNER' | 'ADMIN' | 'MODERATOR' | 'MEMBER';
  user: User;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  content: string;
  isEdited: boolean;
  isPinned?: boolean;
  replyTo?: Message & {
    sender: {
      id: string;
      firstName: string;
      lastName: string;
    };
  };
  sender: User;
  createdAt: string;
  updatedAt: string;
}

export interface CreateChatDto {
  isGroup?: boolean;
  name?: string;
  memberIds?: string[];
}

export interface CreateMessageDto {
  content: string;
  replyToId?: string;
}

// Auth API
export const authApi = {
  register: (data: RegisterDto) =>
    api.post<User>('/auth/register', data),

  loginWithEmail: (data: LoginWithEmailDto, deviceInfo?: string) =>
    api.post<{ success: boolean; accessToken: string }>('/auth/login/email', data, {
      headers: { 'X-Device-Info': deviceInfo || '' },
    }),

  loginWithPhone: (data: LoginWithPhoneDto, deviceInfo?: string) =>
    api.post<{ success: boolean; accessToken: string }>('/auth/login/phone', data, {
      headers: { 'X-Device-Info': deviceInfo || '' },
    }),

  refreshTokens: () =>
    api.post<{ success: boolean }>('/auth/refresh'),

  logout: () =>
    api.post('/auth/logout'),

  logoutAll: () =>
    api.post('/auth/logout/all'),
};

// Users API
export const usersApi = {
  getMe: () =>
    api.get<User>('/users/me'),

  getUserByUsername: (username: string) =>
    api.get<User>(`/users/${username}`),

  updateMe: (data: Partial<User>) =>
    api.put<User>('/users/me', data),

  updateSettings: (data: { settingShowStatus?: boolean; settingShowLastSeen?: boolean }) =>
    api.put<User>('/users/me/settings', data),

  updateAvatar: (avatarUrl: string) =>
    api.post<User>('/users/me/avatar', { avatarUrl }),

  changePassword: (currentPassword: string, newPassword: string) =>
    api.put('/users/me/password', { currentPassword, newPassword }),

  searchUsers: (search: string, limit?: number) =>
    api.get<User[]>('/users', { params: { search, limit } }),

  blockUser: (userId: string) =>
    api.post('/users/block', { userId }),

  unblockUser: (userId: string) =>
    api.post('/users/unblock', { userId }),

  getBlockedUsers: () =>
    api.get<User[]>('/users/blocked'),
};

// Chats API
export const chatsApi = {
  getAll: () =>
    api.get<Chat[]>('/chats'),

  getById: (id: string) =>
    api.get<Chat>(`/chats/${id}`),

  create: (data: CreateChatDto) =>
    api.post<Chat>('/chats', data),

  updateGroup: (id: string, name: string) =>
    api.put<Chat>(`/chats/${id}`, { name }),

  addMember: (chatId: string, userId: string, role?: 'MEMBER' | 'MODERATOR' | 'ADMIN') =>
    api.post(`/chats/${chatId}/members`, { userId, role }),

  removeMember: (chatId: string, memberId: string) =>
    api.delete(`/chats/${chatId}/members/${memberId}`),

  leaveGroup: (chatId: string) =>
    api.post(`/chats/${chatId}/leave`),

  updateMemberRole: (chatId: string, memberId: string, role: 'MEMBER' | 'MODERATOR' | 'ADMIN') =>
    api.put(`/chats/${chatId}/members/${memberId}/role`, { role }),

  transferOwnership: (chatId: string, newOwnerId: string) =>
    api.post(`/chats/${chatId}/transfer/${newOwnerId}`),

  delete: (chatId: string) =>
    api.delete(`/chats/${chatId}`),
};

// Messages API
export const messagesApi = {
  getAll: (chatId: string, limit?: number, before?: string, after?: string) =>
    api.get<Message[]>(`/chats/${chatId}/messages`, { params: { limit, before, after } }),

  create: (chatId: string, content: string, replyToId?: string) =>
    api.post<Message>(`/chats/${chatId}/messages`, { content, replyToId }),

  update: (chatId: string, messageId: string, content: string) =>
    api.put<Message>(`/chats/${chatId}/messages/${messageId}`, { content }),

  delete: (chatId: string, messageId: string) =>
    api.delete(`/chats/${chatId}/messages/${messageId}`),

  togglePin: (chatId: string, messageId: string) =>
    api.post<Message>(`/chats/${chatId}/messages/${messageId}/pin`),
};
