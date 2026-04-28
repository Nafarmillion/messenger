'use client';

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Chat, chatsApi } from '@/lib/api-client';
import { useChatStore, useAuthStore } from '@/store';
import { cn } from '@/lib/utils';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { useTranslation } from '@/lib/i18n-provider';

interface GroupMembersProps {
  chat: Chat;
  onClose: () => void;
}

const roleColors: Record<string, string> = {
  OWNER: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  ADMIN: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  MODERATOR: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  MEMBER: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
};

export function GroupMembers({ chat, onClose }: GroupMembersProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuthStore();
  const { updateChat } = useChatStore();
  const [isUpdating, setIsUpdating] = useState(false);

  const myMembership = chat.members.find((m) => m.userId === currentUser?.id);
  const isOwner = myMembership?.role === 'OWNER';
  const isAdmin = myMembership?.role === 'ADMIN' || isOwner;

  const updateRole = useMutation({
    mutationFn: async ({ memberId, role }: { memberId: string; role: 'MEMBER' | 'MODERATOR' | 'ADMIN' }) => {
      await chatsApi.updateMemberRole(chat.id, memberId, role);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chats', chat.id] });
      toast.success(t('group.roleUpdated'));
    },
    onError: () => {
      toast.error(t('group.failedToUpdateRole'));
    },
  });

  const removeMember = useMutation({
    mutationFn: async (memberId: string) => {
      await chatsApi.removeMember(chat.id, memberId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chats', chat.id] });
      toast.success(t('group.memberRemoved'));
    },
    onError: () => {
      toast.error(t('group.failedToRemoveMember'));
    },
  });

  const transferOwnership = useMutation({
    mutationFn: async (newOwnerId: string) => {
      await chatsApi.transferOwnership(chat.id, newOwnerId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chats', chat.id] });
      toast.success(t('group.ownershipTransferred'));
    },
    onError: () => {
      toast.error(t('group.failedToTransferOwnership'));
    },
  });

  const leaveGroup = useMutation({
    mutationFn: async () => {
      await chatsApi.leaveGroup(chat.id);
    },
    onSuccess: () => {
      updateChat(chat.id, { id: '' } as any);
      onClose();
      toast.success(t('group.leftGroup'));
    },
    onError: () => {
      toast.error(t('group.failedToLeaveGroup'));
    },
  });

  const handleRemoveMember = (memberId: string) => {
    if (confirm(t('group.confirmRemoveMember'))) {
      removeMember.mutate(memberId);
    }
  };

  const handleTransferOwnership = (memberId: string) => {
    if (confirm(t('group.confirmTransferOwnership'))) {
      transferOwnership.mutate(memberId);
    }
  };

  const handleLeaveGroup = () => {
    if (confirm(t('group.confirmLeaveGroup'))) {
      leaveGroup.mutate();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-xl border border-border w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-semibold text-lg">{t('group.members')} ({chat.members.length})</h3>
          <button onClick={onClose} className="p-2 hover:bg-accent rounded-lg">
            <Icons.X />
          </button>
        </div>

        {/* Members List */}
        <div className="flex-1 overflow-y-auto p-2">
          {chat.members.map((member) => {
            const isMe = member.userId === currentUser?.id;
            const canModify = isOwner && !isMe;
            const canKick = (isAdmin && member.role !== 'OWNER') || (isOwner && !isMe);

            return (
              <div
                key={member.id}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors"
              >
                <Avatar className="h-10 w-10">
                  <AvatarFallback>
                    {member.user.firstName[0]}{member.user.lastName[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">
                    {member.user.firstName} {member.user.lastName}
                    {isMe && <span className="text-muted-foreground ml-1">({t('common.you')})</span>}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className={cn('text-xs', roleColors[member.role])}>
                      {member.role}
                    </Badge>
                    {member.user.isOnline && (
                      <span className="text-xs text-green-600 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-600" />
                        {t('common.online')}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions for OWNER */}
                {canModify && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Icons.MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {member.role !== 'ADMIN' && (
                        <DropdownMenuItem onClick={() => updateRole.mutate({ memberId: member.id, role: 'ADMIN' })}>
                          {t('group.makeAdmin')}
                        </DropdownMenuItem>
                      )}
                      {member.role !== 'MODERATOR' && member.role !== 'ADMIN' && (
                        <DropdownMenuItem onClick={() => updateRole.mutate({ memberId: member.id, role: 'MODERATOR' })}>
                          {t('group.makeModerator')}
                        </DropdownMenuItem>
                      )}
                      {member.role === 'OWNER' && (
                        <DropdownMenuItem
                          className="text-purple-600"
                          onClick={() => handleTransferOwnership(member.id)}
                        >
                          {t('group.transferOwnership')}
                        </DropdownMenuItem>
                      )}
                      {canKick && (
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleRemoveMember(member.id)}
                        >
                          {t('group.removeMember')}
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

                {/* Actions for ADMIN (kick only) */}
                {isAdmin && !isOwner && canKick && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => handleRemoveMember(member.id)}
                  >
                    <Icons.X />
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-border space-y-2">
          {!isOwner && (
            <Button
              variant="outline"
              className="w-full"
              onClick={handleLeaveGroup}
              disabled={leaveGroup.isPending}
            >
              {leaveGroup.isPending ? t('group.leavingGroup') : t('group.leaveGroup')}
            </Button>
          )}
          <Button variant="default" className="w-full" onClick={onClose}>
            {t('common.close')}
          </Button>
        </div>
      </div>
    </div>
  );
}
