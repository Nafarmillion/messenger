'use client';

import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { chatsApi, usersApi, Chat } from '@/lib/api-client';
import { useChatStore } from '@/store';
import { useTranslation } from '@/lib/i18n-provider';
import { Icons } from '@/components/icons';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (chat: Chat) => void;
}

export function CreateGroupModal({ isOpen, onClose, onSuccess }: CreateGroupModalProps) {
  const { setChats } = useChatStore();
  const { t } = useTranslation();
  const [groupName, setGroupName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  const { data: users } = useQuery({
    queryKey: ['users-search', searchQuery],
    queryFn: async () => {
      if (!searchQuery) return [];
      const response = await usersApi.searchUsers(searchQuery, 20);
      return response.data;
    },
    enabled: searchQuery.length > 0,
  });

  const createGroup = useMutation({
    mutationFn: async () => {
      const response = await chatsApi.create({
        isGroup: true,
        name: groupName,
        memberIds: selectedUserIds,
      });
      return response.data;
    },
    onSuccess: (chat) => {
      toast.success(t('group.groupCreated'));
      onSuccess(chat);
      resetForm();
    },
    onError: () => {
      toast.error(t('group.failedToCreateGroup'));
    },
  });

  const resetForm = () => {
    setGroupName('');
    setSearchQuery('');
    setSelectedUserIds([]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) {
      toast.error(t('group.enterGroupNameError'));
      return;
    }
    if (selectedUserIds.length === 0) {
      toast.error(t('group.selectMemberError'));
      return;
    }
    createGroup.mutate();
  };

  const toggleUser = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-xl border border-border w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-semibold text-lg">{t('group.createGroup')}</h3>
          <button onClick={onClose} className="p-2 hover:bg-accent rounded-lg">
            <Icons.X />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col">
          <div className="p-4 space-y-4">
            {/* Group Name */}
            <div>
              <label className="block text-sm font-medium mb-1">
                {t('group.groupName')}
              </label>
              <Input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder={t('group.enterGroupName')}
                className="w-full"
              />
            </div>

            {/* Selected Members */}
            {selectedUserIds.length > 0 && (
              <div>
                <label className="block text-sm font-medium mb-2">
                  {t('group.selectedMembers')} ({selectedUserIds.length})
                </label>
                <div className="flex flex-wrap gap-2">
                  {selectedUserIds.map((userId) => {
                    const user = users?.find((u) => u.id === userId);
                    if (!user) return null;
                    return (
                      <Badge
                        key={userId}
                        variant="secondary"
                        className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                        onClick={() => toggleUser(userId)}
                      >
                        {user.firstName} {user.lastName}
                        <Icons.X className="w-3 h-3 ml-1" />
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Search Users */}
            <div>
              <label className="block text-sm font-medium mb-1">
                {t('group.addMembers')}
              </label>
              <div className="relative">
                <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('chat.searchUsers')}
                  className="w-full pl-9"
                />
              </div>
            </div>
          </div>

          {/* User Search Results */}
          <ScrollArea className="flex-1 border-t border-border">
            <div className="p-2">
              {searchQuery && users && users.length > 0 ? (
                <div className="space-y-1">
                  {users.map((user) => {
                    const isSelected = selectedUserIds.includes(user.id);
                    return (
                      <div
                        key={user.id}
                        onClick={() => toggleUser(user.id)}
                        className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-accent transition-colors cursor-pointer"
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-primary/10 text-primary text-sm">
                            {user.firstName[0]}{user.lastName[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 text-left">
                          <p className="text-sm font-medium">{user.firstName} {user.lastName}</p>
                          <p className="text-xs text-muted-foreground">@{user.username}</p>
                        </div>
                        {isSelected ? (
                          <Badge variant="default" className="text-xs">{t('common.new')}</Badge>
                        ) : (
                          <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={(e) => {
                            e.stopPropagation();
                            toggleUser(user.id);
                          }}>
                            <Icons.Plus />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : searchQuery ? (
                <p className="py-4 text-sm text-muted-foreground text-center">{t('common.noResults')}</p>
              ) : (
                <p className="py-4 text-sm text-muted-foreground text-center">{t('common.startTyping')}</p>
              )}
            </div>
          </ScrollArea>

          {/* Footer */}
          <div className="p-4 border-t border-border flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={createGroup.isPending}>
              {createGroup.isPending ? t('group.creatingGroup') : t('group.createGroupButton')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
