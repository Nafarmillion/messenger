'use client';

import React, { useState, useRef } from 'react';
import { useTranslation } from '@/lib/i18n-provider';
import { useAuthStore } from '@/store';
import { usersApi } from '@/lib/api-client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AvatarCropModal } from '@/components/chat/avatar-crop-modal';
import { UserProfileModal } from '@/components/chat/user-profile-modal';
import { Icons } from '@/components/icons';
import { toast } from 'sonner';

export function ProfileContent() {
  const { t } = useTranslation();
  const { user, setUser } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [username, setUsername] = useState(user?.username || '');

  const hasChanges =
    firstName !== user?.firstName ||
    lastName !== user?.lastName ||
    username !== user?.username;

  // Avatar crop modal state
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Profile view modal state
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  const queryClient = useQueryClient();

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setSelectedImage(event.target?.result as string);
      setCropModalOpen(true);
    };
    reader.readAsDataURL(file);

    // Reset input
    e.target.value = '';
  };

  const updateAvatar = useMutation({
    mutationFn: async (avatarUrl: string) => {
      const response = await usersApi.updateAvatar(avatarUrl);
      return response.data;
    },
    onSuccess: (updatedUser) => {
      setUser(updatedUser);
      queryClient.invalidateQueries({ queryKey: ['user'] });
      toast.success(t('profile.avatarSaved'));
      setCropModalOpen(false);
      setSelectedImage(null);
    },
    onError: () => {
      toast.error(t('profile.avatarFailed'));
    },
  });

  const handleCropSave = (croppedImage: string) => {
    updateAvatar.mutate(croppedImage);
  };

  const updateProfile = useMutation({
    mutationFn: async () => {
      const response = await usersApi.updateMe({ firstName, lastName, username });
      return response.data;
    },
    onSuccess: (updatedUser) => {
      setUser(updatedUser);
      queryClient.invalidateQueries({ queryKey: ['user'] });
      toast.success(t('profile.profileSaved'));
      setIsEditing(false);
    },
    onError: () => {
      toast.error(t('profile.profileFailed'));
    },
  });

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile.mutate();
  };

  if (!user) return null;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('profile.title')}</h1>
          <p className="text-muted-foreground">{t('profile.subtitle')}</p>
        </div>
      </div>

      <Separator />

      {/* Profile Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t('profile.title')}</CardTitle>
          {!isEditing && (
            <Button variant="ghost" size="icon" onClick={() => setIsEditing(true)}>
              <Icons.Edit className="w-4 h-4" />
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center mb-6">
            {/* Avatar - Larger */}
            <div className="relative group cursor-pointer" onClick={handleAvatarClick}>
              <Avatar size="lg" className="w-32 h-32">
                {user.avatarUrl ? (
                  <AvatarImage src={user.avatarUrl} alt={`${user.firstName} ${user.lastName}`} />
                ) : (
                  <AvatarFallback className="text-3xl bg-primary/10 text-primary">
                    {user.firstName[0]}{user.lastName[0]}
                  </AvatarFallback>
                )}
              </Avatar>
              {/* Hover overlay */}
              <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Icons.Upload className="w-8 h-8 text-white" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-2">{t('profile.changeAvatar')}</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {isEditing ? (
            /* Edit Mode */
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">{t('profile.firstName')}</Label>
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">{t('profile.lastName')}</Label>
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="username">{t('profile.username')}</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>{t('profile.email')}</Label>
                <Input value={user.email || t('settings.account.notProvided')} disabled />
              </div>

              <div className="space-y-2">
                <Label>{t('profile.phone')}</Label>
                <Input value={user.phone || t('settings.account.notProvided')} disabled />
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={updateProfile.isPending || !hasChanges}>
                  {updateProfile.isPending ? t('common.saving') : t('common.save')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEditing(false);
                    setFirstName(user.firstName);
                    setLastName(user.lastName);
                    setUsername(user.username);
                  }}
                >
                  {t('common.cancel')}
                </Button>
              </div>
            </form>
          ) : (
            /* Read-only Mode */
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">{t('profile.firstName')}</p>
                  <p className="font-medium">{user.firstName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('profile.lastName')}</p>
                  <p className="font-medium">{user.lastName}</p>
                </div>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">{t('profile.username')}</p>
                <p className="font-medium">@{user.username}</p>
              </div>

              {user.email && (
                <div>
                  <p className="text-sm text-muted-foreground">{t('profile.email')}</p>
                  <p className="font-medium">{user.email}</p>
                </div>
              )}

              {user.phone && (
                <div>
                  <p className="text-sm text-muted-foreground">{t('profile.phone')}</p>
                  <p className="font-medium">{user.phone}</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Account Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.account.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {user.createdAt && new Date(user.createdAt).toString() !== 'Invalid Date' && (
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">{t('profile.memberSince')}</span>
              <span className="text-sm font-medium">
                {new Date(user.createdAt).toLocaleDateString()}
              </span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">{t('profile.onlineStatus')}</span>
            <span className="text-sm font-medium">
              {user.isOnline ? (
                <span className="text-green-500">{t('common.online')}</span>
              ) : (
                t('common.offline')
              )}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Avatar Crop Modal */}
      <AvatarCropModal
        isOpen={cropModalOpen}
        onClose={() => {
          setCropModalOpen(false);
          setSelectedImage(null);
        }}
        onSave={handleCropSave}
        imageSrc={selectedImage}
      />

      {/* User Profile Modal (for viewing own profile) */}
      <UserProfileModal
        user={user}
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        currentUserId={user.id}
      />
    </div>
  );
}
