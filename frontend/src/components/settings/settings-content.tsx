'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useAuthStore, useSocketStore, useLanguageStore } from '@/store';
import { useTranslation } from '@/lib/i18n-provider';
import { usersApi, authApi } from '@/lib/api-client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';
import { clearTokens } from '@/lib/cookies';
import { toast } from 'sonner';
import type { Locale } from '@/store/language-store';

export function SettingsContent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, setUser, logout } = useAuthStore();
  const { disconnect } = useSocketStore();
  const { t, locale } = useTranslation();
  const { setLocale } = useLanguageStore();
  const { theme, setTheme } = useTheme();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await authApi.logout().catch(() => {});
    } finally {
      disconnect();
      logout();
      clearTokens();
      queryClient.clear();
      router.push('/login');
    }
  };

  // Update privacy settings
  const updateSettings = useMutation({
    mutationFn: async (data: { settingShowStatus?: boolean; settingShowLastSeen?: boolean }) => {
      const response = await usersApi.updateSettings(data);
      return response.data;
    },
    onSuccess: (updatedUser) => {
      setUser(updatedUser);
      queryClient.invalidateQueries({ queryKey: ['user'] });
      toast.success(t('settings.settingsUpdated'));
    },
    onError: () => {
      toast.error(t('settings.failedToUpdateSettings'));
    },
  });

  // Change password
  const changePassword = useMutation({
    mutationFn: async () => {
      if (newPassword !== confirmPassword) {
        throw new Error(t('settings.passwordsNotMatch'));
      }
      if (newPassword.length < 8) {
        throw new Error(t('settings.passwordTooShort'));
      }
      await usersApi.changePassword(currentPassword, newPassword);
    },
    onSuccess: () => {
      toast.success(t('settings.passwordChanged'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    },
    onError: (err: any) => {
      toast.error(err.message || t('settings.failedToChangePassword'));
    },
  });

  const handlePrivacyToggle = (field: 'settingShowStatus' | 'settingShowLastSeen') => {
    updateSettings.mutate({ [field]: !user?.[field] });
  };

  const handleSubmitPassword = (e: React.FormEvent) => {
    e.preventDefault();
    changePassword.mutate();
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('settings.title')}</h1>
        <p className="text-muted-foreground">{t('settings.subtitle')}</p>
      </div>

      <Separator />

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.appearance.title')}</CardTitle>
          <CardDescription>{t('settings.appearance.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{t('settings.appearance.darkMode')}</Label>
              <p className="text-sm text-muted-foreground">
                {t('settings.appearance.darkModeDesc')}
              </p>
            </div>
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className={cn(
                'relative w-16 h-8 rounded-full border border-border transition-colors',
                theme === 'dark' ? 'bg-accent' : 'bg-muted'
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 left-0.5 w-7 h-7 rounded-full flex items-center justify-center transition-transform',
                  theme === 'dark' ? 'translate-x-8 bg-accent-foreground' : 'translate-x-0 bg-background shadow'
                )}
              >
                {theme === 'dark' ? (
                  <Icons.Moon className="w-3.5 h-3.5 text-foreground" />
                ) : (
                  <Icons.Sun className="w-3.5 h-3.5 text-yellow-500" />
                )}
              </span>
              <Icons.Sun className={cn(
                'absolute w-3.5 h-3.5 left-2 top-1/2 -translate-y-1/2',
                theme === 'light' ? 'text-yellow-500' : 'text-muted-foreground'
              )} />
              <Icons.Moon className={cn(
                'absolute w-3.5 h-3.5 right-2 top-1/2 -translate-y-1/2',
                theme === 'dark' ? 'text-blue-400' : 'text-muted-foreground'
              )} />
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Language */}
      <Card>
        <CardHeader>
          <CardTitle>{t('language.title')}</CardTitle>
          <CardDescription>{t('language.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="font-medium">{t('language.chooseLanguage')}</p>
              <p className="text-sm text-muted-foreground">
                {t('language.subtitle')}
              </p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="min-w-35">
                  {locale === 'en' ? t('language.english') : t('language.ukrainian')}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => { setLocale('en'); toast.success(t('language.languageChanged')); }}>
                  {t('language.english')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setLocale('uk'); toast.success(t('language.languageChanged')); }}>
                  {t('language.ukrainian')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>

      {/* Privacy Settings */}
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.privacy.title')}</CardTitle>
          <CardDescription>{t('settings.privacy.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{t('settings.privacy.showOnlineStatus')}</Label>
              <p className="text-sm text-muted-foreground">
                {t('settings.privacy.showOnlineStatusDesc')}
              </p>
            </div>
            <Switch
              checked={user?.settingShowStatus}
              onCheckedChange={() => handlePrivacyToggle('settingShowStatus')}
              disabled={updateSettings.isPending}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{t('settings.privacy.showLastSeen')}</Label>
              <p className="text-sm text-muted-foreground">
                {t('settings.privacy.showLastSeenDesc')}
              </p>
            </div>
            <Switch
              checked={user?.settingShowLastSeen}
              onCheckedChange={() => handlePrivacyToggle('settingShowLastSeen')}
              disabled={updateSettings.isPending}
            />
          </div>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.security.title')}</CardTitle>
          <CardDescription>{t('settings.security.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmitPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">{t('settings.security.currentPassword')}</Label>
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">{t('settings.security.newPassword')}</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t('settings.security.confirmNewPassword')}</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            <Button
              type="submit"
              disabled={changePassword.isPending || !currentPassword || !newPassword}
            >
              {changePassword.isPending ? t('settings.security.changing') : t('settings.security.changePassword')}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Account Info */}
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.account.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">{t('settings.account.username')}</p>
              <p className="font-medium">@{user?.username}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('settings.account.email')}</p>
              <p className="font-medium">{user?.email || t('settings.account.notProvided')}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('settings.account.phone')}</p>
              <p className="font-medium">{user?.phone || t('settings.account.notProvided')}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      {/* Danger Zone */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">{t('settings.dangerZone.title')}</CardTitle>
          <CardDescription>{t('settings.dangerZone.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="font-medium">{t('settings.dangerZone.signOut')}</p>
              <p className="text-sm text-muted-foreground">
                {t('settings.dangerZone.signOutDesc')}
              </p>
            </div>
            <Button
              variant="destructive"
              onClick={handleLogout}
              disabled={isLoggingOut}
            >
              {isLoggingOut ? t('settings.dangerZone.signingOut') : t('settings.dangerZone.signOut')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
