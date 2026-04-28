'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore, useSocketStore } from '@/store';
import { useTranslation } from '@/lib/i18n-provider';
import { cn } from '@/lib/utils';
import { Icons } from '@/components/icons';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { clearTokens } from '@/lib/cookies';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter();
  const { user, setUser, isAuthenticated, logout } = useAuthStore();
  const { disconnect } = useSocketStore();
  const { t } = useTranslation();

  // Disconnect socket on unmount (tab close, navigation away from dashboard)
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  // Disconnect socket on page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      disconnect();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [disconnect]);

  const handleLogout = async () => {
    try {
      await import('@/lib/api-client').then(({ authApi }) => authApi.logout());
    } catch {}
    disconnect();
    logout();
    clearTokens();
    router.push('/login');
  };

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 bg-background/80 backdrop-blur border-b border-border">
        <Link href="/chats" className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <span className="text-primary-foreground font-bold text-sm">M</span>
          </div>
          <span className="font-semibold text-lg">Messenger</span>
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 px-2">
              <Avatar className="w-8 h-8">
                {user?.avatarUrl ? (
                  <AvatarImage src={user.avatarUrl} alt={user.firstName} />
                ) : (
                  <AvatarFallback className="text-sm bg-secondary">
                    {user?.firstName?.[0]}{user?.lastName?.[0]}
                  </AvatarFallback>
                )}
              </Avatar>
              <span className="text-sm font-medium hidden sm:inline">
                {user?.firstName} {user?.lastName}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem asChild>
              <Link href="/profile" className="flex items-center gap-2 cursor-pointer">
                <Icons.User className="w-4 h-4" />
                {t('navigation.profile')}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings" className="flex items-center gap-2 cursor-pointer">
                <Icons.Settings className="w-4 h-4" />
                {t('navigation.settings')}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleLogout}
              className="text-destructive focus:text-destructive cursor-pointer flex items-center gap-2"
            >
              <Icons.LogOut className="w-4 h-4" />
              {t('settings.dangerZone.signOut')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <main className="p-4 lg:p-6">
        {children}
      </main>
    </div>
  );
}
