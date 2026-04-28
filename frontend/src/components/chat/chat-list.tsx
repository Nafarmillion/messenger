'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { chatsApi, usersApi, Chat as ChatType, CreateChatDto, Message } from '@/lib/api-client';
import { useChatStore, useAuthStore, useSocketStore } from '@/store';
import { useTranslation } from '@/lib/i18n-provider';
import { cn } from '@/lib/utils';
import { Icons } from '@/components/icons';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { CreateGroupModal } from './create-group-modal';

interface ChatListProps {
  onSelectChat: (chat: ChatType) => void;
  activeChatId?: string;
}

export function ChatList({ onSelectChat, activeChatId }: ChatListProps) {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuthStore();
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const { chats, setChats } = useChatStore();
  const { resetUnread, initUnreadFromChats } = useSocketStore();
  const [unreadCounts, setUnreadCounts] = useState<Map<string, number>>(new Map());
  const [showCreateGroup, setShowCreateGroup] = useState(false);

  // Subscribe to unread counts updates - selective subscription to only unreadCounts
  useEffect(() => {
    const unsubscribe = useSocketStore.subscribe(
      (state) => state.unreadCounts,
      (unreadCounts) => {
        setUnreadCounts(new Map(unreadCounts));
      }
    );
    return unsubscribe;
  }, []);

  // Listen for new messages to update chat list preview
  // Use a ref to always access the latest chats without re-subscribing
  const chatsRef = React.useRef(chats);
  chatsRef.current = chats;

  useEffect(() => {
    const handleNewMessage = (e: Event) => {
      const customEvent = e as CustomEvent<Message>;
      const message = customEvent.detail;
      const currentChats = chatsRef.current;

      // Check if chat exists in our list
      const existingChat = currentChats.find((c) => c.id === message.chatId);

      if (existingChat) {
        // Update existing chat's last message
        setChats(currentChats.map((chat) =>
          chat.id === message.chatId
            ? { ...chat, lastMessage: message, updatedAt: message.createdAt }
            : chat
        ));
      } else if (message.senderId !== currentUser?.id) {
        // New chat from another user - refresh the chat list
        queryClient.invalidateQueries({ queryKey: ['chats'] });
      }
    };

    window.addEventListener('socket-new-message', handleNewMessage as EventListener);
    return () => window.removeEventListener('socket-new-message', handleNewMessage as EventListener);
  }, [currentUser?.id, queryClient, setChats]);

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['chats'],
    queryFn: async () => {
      const response = await chatsApi.getAll();
      setChats(response.data);
      // Populate initial unread counts based on lastMessage sender
      const uid = useAuthStore.getState().user?.id;
      if (uid) {
        initUnreadFromChats(response.data as any, uid);
      }
      return response.data;
    },
    enabled: !!currentUser?.id,
    refetchInterval: 10000,
  });

  const { data: users, isLoading: isSearching } = useQuery({
    queryKey: ['users-search', debouncedSearch],
    queryFn: async () => {
      if (!debouncedSearch) return [];
      const response = await usersApi.searchUsers(debouncedSearch, 10);
      // Filter out current user
      return response.data.filter((user) => user.id !== currentUser?.id);
    },
    enabled: debouncedSearch.length > 0,
  });

  useEffect(() => {
    const handleChatUpdated = () => {
      refetch();
    };
    
    window.addEventListener('socket-chat-updated', handleChatUpdated);
    return () => {
      window.removeEventListener('socket-chat-updated', handleChatUpdated);
    };
  }, [refetch]);

  // Create chat mutation
  const createChat = useMutation({
    mutationFn: async (userId: string) => {
      const data: CreateChatDto = {
        isGroup: false,
        memberIds: [userId],
      };
      const response = await chatsApi.create(data);
      return response.data;
    },
    onSuccess: (chat) => {
      setChats([chat, ...chats]);
      onSelectChat(chat);
      setSearchQuery('');
      toast.success(t('chat.chatStarted'));
    },
    onError: () => {
      toast.error(t('chat.failedToStartChat'));
    },
  });

  const handleUserSelect = (userId: string) => {
    // Check if chat already exists
    const existingChat = chats.find(
      (chat) => !chat.isGroup && chat.members.some((m) => m.userId === userId)
    );

    if (existingChat) {
      onSelectChat(existingChat);
      resetUnread(existingChat.id);
      setSearchQuery('');
    } else {
      createChat.mutate(userId);
    }
  };

  const filteredChats = chats.filter((chat) => {
    if (!searchQuery) return true;
    const otherMember = chat.members.find((m) => m.user.id !== currentUser?.id);
    const name = chat.isGroup
      ? (chat.name || '')
      : `${otherMember?.user.firstName} ${otherMember?.user.lastName}`;
    const username = otherMember?.user.username || '';
    return (
      name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      username.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  // Separate existing chats from search results
  const existingUserIds = new Set(
    chats
      .filter((c) => !c.isGroup)
      .flatMap((c) => c.members.filter((m) => m.userId !== currentUser?.id).map((m) => m.userId))
  );

  const filteredUsers = users?.filter((user) => !existingUserIds.has(user.id)) || [];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t('chat.chats')}</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowCreateGroup(true)}
            title={t('chat.createGroup')}
          >
            <Icons.Users />
          </Button>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder={t('chat.searchUsers')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Search Results */}
      {searchQuery && (
        <ScrollArea className="flex-1">
          <div className="p-2">
            {/* Existing Chats */}
            {filteredChats.length > 0 && (
              <>
                <p className="text-xs text-muted-foreground mb-2 px-2">{t('chat.existingChats')}</p>
                <div className="space-y-1 mb-4">
                  {filteredChats.map((chat) => {
                    const otherMember = chat.members.find((m) => m.user.id !== currentUser?.id);
                    const lastMessage = chat.messages?.[chat.messages.length - 1] || (chat as any).lastMessage;

                    return (
                      <div
                        key={chat.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          onSelectChat(chat);
                          resetUnread(chat.id);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onSelectChat(chat);
                            resetUnread(chat.id);
                          }
                        }}
                        className={cn(
                          'w-full flex items-center gap-3 p-3 rounded-lg transition-colors cursor-pointer',
                          'hover:bg-accent focus:bg-accent focus:outline-none',
                          activeChatId === chat.id && 'bg-accent'
                        )}
                      >
                        <Avatar className="h-10 w-10 shrink-0">
                          <AvatarFallback>
                            {otherMember?.user.firstName[0]}
                            {otherMember?.user.lastName[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0 text-left">
                          <p className="font-medium truncate">
                            {otherMember?.user.firstName} {otherMember?.user.lastName}
                          </p>
                          {lastMessage ? (
                            <p className="text-sm text-muted-foreground truncate">
                              {chat.isGroup && lastMessage.senderId !== currentUser?.id ? (
                                <>
                                  <span className="font-medium">{lastMessage.sender?.firstName || 'User'}: </span>
                                  {lastMessage.content}
                                </>
                              ) : (
                                lastMessage.content
                              )}
                            </p>
                          ) : (
                            <p className="text-sm text-muted-foreground">No messages yet</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* New Users */}
            {isSearching ? (
              <div className="flex items-center justify-center py-4">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : filteredUsers.length > 0 ? (
              <>
                <p className="text-xs text-muted-foreground mb-2 px-2">{t('chat.users')}</p>
                <div className="space-y-1">
                  {filteredUsers.map((user) => (
                    <div
                      key={user.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleUserSelect(user.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleUserSelect(user.id);
                        }
                      }}
                      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-accent focus:bg-accent focus:outline-none transition-colors cursor-pointer"
                    >
                      <Avatar className="h-10 w-10 shrink-0">
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {user.firstName[0]}{user.lastName[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0 text-left">
                        <p className="font-medium text-sm truncate">{user.firstName} {user.lastName}</p>
                        <p className="text-xs text-muted-foreground truncate">@{user.username}</p>
                      </div>
                      <Badge variant="secondary" className="text-xs shrink-0">
                        {t('common.new')}
                      </Badge>
                    </div>
                  ))}
                </div>
              </>
            ) : debouncedSearch ? (
              <p className="py-4 text-sm text-muted-foreground text-center">{t('common.noResults')}</p>
            ) : null}
          </div>
        </ScrollArea>
      )}

      {/* Chat List (when not searching) */}
      {!searchQuery && (
        <ScrollArea className="flex-1">
          <div className="p-2">
            {isLoading && chats.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : filteredChats.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <p className="text-muted-foreground text-sm">{t('chat.noChatsYet')}</p>
              </div>
            ) : (
              <div className="space-y-1">
                {filteredChats.map((chat) => {
                  const otherMember = chat.members.find((m) => m.user.id !== currentUser?.id);
                  const lastMessage = chat.lastMessage || chat.messages?.[chat.messages.length - 1];
                  const unreadCount = unreadCounts.get(chat.id) || 0;

                  return (
                    <div
                      key={chat.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        onSelectChat(chat);
                        resetUnread(chat.id);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onSelectChat(chat);
                          resetUnread(chat.id);
                        }
                      }}
                      className={cn(
                        'w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left overflow-hidden cursor-pointer',
                        'hover:bg-accent focus:bg-accent focus:outline-none',
                        activeChatId === chat.id && 'bg-accent'
                      )}
                    >
                      <Avatar className={cn('h-12 w-12 shrink-0', chat.isGroup && 'bg-primary/10')}>
                        <AvatarFallback>
                          {chat.isGroup
                            ? (chat.name || '?')[0].toUpperCase()
                            : `${otherMember?.user.firstName[0]}${otherMember?.user.lastName[0]}`}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1 w-full min-w-0">
                          <p className="font-medium truncate flex-1 mr-2">
                            {chat.isGroup
                              ? chat.name
                              : `${otherMember?.user.firstName} ${otherMember?.user.lastName}`}
                          </p>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {activeChatId !== chat.id && unreadCount > 0 && (
                              <Badge className="h-5 min-w-5 px-1.5 bg-primary text-primary-foreground text-xs">
                                {unreadCount}
                              </Badge>
                            )}
                            {lastMessage && (
                              <span className="text-xs text-muted-foreground whitespace-nowrap">
                                {new Date(lastMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </div>
                        </div>
                        {lastMessage ? (
                          <p className={cn(
                            'text-sm truncate',
                            activeChatId !== chat.id && unreadCount > 0 ? 'font-semibold text-foreground' : 'text-muted-foreground'
                          )}>
                            {chat.isGroup && lastMessage.senderId !== currentUser?.id ? (
                              <>
                                <span className="font-medium">{lastMessage.sender?.firstName || 'User'}: </span>
                                {lastMessage.content}
                              </>
                            ) : (
                              lastMessage.content
                            )}
                          </p>
                        ) : (
                          <p className="text-sm text-muted-foreground">No messages yet</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </ScrollArea>
      )}

      {/* Create Group Modal */}
      <CreateGroupModal
        isOpen={showCreateGroup}
        onClose={() => setShowCreateGroup(false)}
        onSuccess={(chat) => {
          setChats([chat, ...chats]);
          onSelectChat(chat);
          setShowCreateGroup(false);
        }}
      />
    </div>
  );
}
