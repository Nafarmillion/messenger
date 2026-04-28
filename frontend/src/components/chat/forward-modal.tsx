'use client';

import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Message, chatsApi, usersApi, messagesApi } from '@/lib/api-client';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { useTranslation } from '@/lib/i18n-provider';

interface ForwardModalProps {
  message: Message | null;
  isOpen: boolean;
  onClose: () => void;
  currentChatId: string;
}

export function ForwardModal({ message, isOpen, onClose, currentChatId }: ForwardModalProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');

  const { data: chats } = useQuery({
    queryKey: ['chats'],
    queryFn: async () => {
      const response = await chatsApi.getAll();
      return response.data;
    },
    enabled: isOpen,
  });

  const { data: users } = useQuery({
    queryKey: ['users-search', searchQuery],
    queryFn: async () => {
      if (!searchQuery) return [];
      const response = await usersApi.searchUsers(searchQuery, 10);
      return response.data;
    },
    enabled: isOpen && searchQuery.length > 0,
  });

  const forwardToChat = useMutation({
    mutationFn: async (chatId: string) => {
      await messagesApi.create(chatId, message!.content);
    },
    onSuccess: () => {
      toast.success(t('forward.forwarded'));
      onClose();
    },
    onError: () => {
      toast.error(t('forward.failedToForward'));
    },
  });

  if (!isOpen || !message) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-xl border border-border w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-semibold text-lg">{t('forward.title')}</h3>
          <button onClick={onClose} className="p-2 hover:bg-accent rounded-lg">
            <Icons.X />
          </button>
        </div>

        {/* Message Preview */}
        <div className="p-4 border-b border-border bg-muted/50">
          <p className="text-sm text-muted-foreground mb-1">{t('forward.forwarding')}</p>
          <p className="text-sm line-clamp-2">{message.content}</p>
        </div>

        {/* Search */}
        <div className="p-4">
          <div className="relative">
            <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder={t('forward.searchChatsOrUsers')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Results */}
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {/* Recent chats */}
            {!searchQuery && chats?.filter((c) => c.id !== currentChatId).map((chat) => {
              const otherMember = chat.members.find((m) => m.user.id !== chat.members[0]?.user.id);
              const name = chat.isGroup ? (chat.name || 'Group') : `${otherMember?.user.firstName} ${otherMember?.user.lastName}`;
              
              return (
                <button
                  key={chat.id}
                  onClick={() => forwardToChat.mutate(chat.id)}
                  className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-accent transition-colors"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">
                      {chat.isGroup ? (name[0] || 'G') : `${otherMember?.user.firstName?.[0]}${otherMember?.user.lastName?.[0]}`}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium truncate">{name}</span>
                </button>
              );
            })}

            {/* User search results */}
            {searchQuery && users?.map((user) => {
              const existingChat = chats?.find((c) => 
                !c.isGroup && c.members.some((m) => m.userId === user.id)
              );
              
              return (
                <button
                  key={user.id}
                  onClick={() => {
                    if (existingChat) {
                      forwardToChat.mutate(existingChat.id);
                    }
                  }}
                  className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-accent transition-colors"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">
                      {user.firstName[0]}{user.lastName[0]}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium">{user.firstName} {user.lastName}</span>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
