'use client';

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi, User } from '@/lib/api-client';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { useTranslation } from '@/lib/i18n-provider';

interface BlockedUsersModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BlockedUsersModal({ isOpen, onClose }: BlockedUsersModalProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [blockedUsers, setBlockedUsers] = useState<User[]>([]);

  const unblockUser = useMutation({
    mutationFn: async (userId: string) => {
      await usersApi.unblockUser(userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blocked-users'] });
      toast.success(t('blocked.userUnblocked'));
    },
    onError: () => {
      toast.error(t('blocked.failedToUnblock'));
    },
  });

  const handleUnblock = (userId: string) => {
    unblockUser.mutate(userId);
    setBlockedUsers((prev) => prev.filter((u) => u.id !== userId));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-xl border border-border w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-semibold text-lg">{t('blocked.title')}</h3>
          <button onClick={onClose} className="p-2 hover:bg-accent rounded-lg">
            <Icons.X />
          </button>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="p-4">
            {blockedUsers.length > 0 ? (
              <div className="space-y-2">
                {blockedUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarFallback>
                        {user.firstName[0]}{user.lastName[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {user.firstName} {user.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground">@{user.username}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUnblock(user.id)}
                    >
                      {t('blocked.unblock')}
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Icons.Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">{t('blocked.noBlockedUsers')}</p>
                <p className="text-xs mt-1">{t('blocked.noBlockedUsersDesc')}</p>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="p-4 border-t border-border">
          <Button variant="default" className="w-full" onClick={onClose}>
            {t('common.close')}
          </Button>
        </div>
      </div>
    </div>
  );
}
