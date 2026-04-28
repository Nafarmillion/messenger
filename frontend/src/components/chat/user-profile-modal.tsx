'use client';

import React from 'react';
import { useTranslation } from '@/lib/i18n-provider';
import { User } from '@/lib/api-client';
import { Icons } from '@/components/icons';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString();
}

function formatDateTime(dateStr?: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleString();
}

interface UserProfileModalProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
  currentUserId?: string;
}

export function UserProfileModal({ user, isOpen, onClose, currentUserId }: UserProfileModalProps) {
  const { t } = useTranslation();

  if (!isOpen || !user) return null;

  const isMe = user.id === currentUserId;
  const memberSince = formatDate(user.createdAt);
  const lastSeenStr = formatDateTime(user.lastSeen);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-xl border border-border w-full max-w-sm overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-semibold text-lg">{isMe ? t('profile.title') : t('profile.viewProfile')}</h3>
          <button onClick={onClose} className="p-2 hover:bg-accent rounded-lg">
            <Icons.X />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col items-center">
          {/* Avatar */}
          <Avatar size="lg" className="w-24 h-24 mb-4">
            {user.avatarUrl ? (
              <AvatarImage src={user.avatarUrl} alt={`${user.firstName} ${user.lastName}`} />
            ) : (
              <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                {user.firstName[0]}{user.lastName[0]}
              </AvatarFallback>
            )}
          </Avatar>

          {/* Name */}
          <h2 className="text-xl font-bold mb-1">
            {user.firstName} {user.lastName}
          </h2>
          <p className="text-muted-foreground mb-4">@{user.username}</p>

          {/* Online Status */}
          <div className="flex items-center gap-2 mb-4">
            {user.isOnline ? (
              <span className="flex items-center gap-1.5 text-green-500 text-sm">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                {t('common.online')}
              </span>
            ) : (
              <span className="text-muted-foreground text-sm">
                {lastSeenStr
                  ? `${t('common.lastSeen')} ${lastSeenStr}`
                  : t('common.offline')
                }
              </span>
            )}
          </div>

          {/* Info */}
          <div className="w-full space-y-3 border-t border-border pt-4">
            {user.email && (
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">{t('profile.email')}</span>
                <span className="text-sm font-medium">{user.email}</span>
              </div>
            )}
            {user.phone && (
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">{t('profile.phone')}</span>
                <span className="text-sm font-medium">{user.phone}</span>
              </div>
            )}
            {memberSince && (
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">{t('profile.memberSince')}</span>
                <span className="text-sm font-medium">{memberSince}</span>
              </div>
            )}
            {!user.isOnline && lastSeenStr && (
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">{t('profile.lastSeen')}</span>
                <span className="text-sm font-medium">{lastSeenStr}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
