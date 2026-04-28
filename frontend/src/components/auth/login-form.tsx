'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { authApi, usersApi } from '@/lib/api-client';
import { useAuthStore, useSocketStore } from '@/store';
import { useTranslation } from '@/lib/i18n-provider';
import { cn } from '@/lib/utils';

type LoginMethod = 'email' | 'phone';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setUser } = useAuthStore();
  const { connect } = useSocketStore();
  const { t } = useTranslation();
  const [method, setMethod] = useState<LoginMethod>('email');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    phone: '',
    password: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
  const loginData = method === 'email'
    ? { email: formData.email, password: formData.password }
    : { phone: formData.phone, password: formData.password };

  const loginResponse = await (method === 'email'
    ? authApi.loginWithEmail(loginData as any)
    : authApi.loginWithPhone(loginData as any));

  const accessToken = loginResponse.data.accessToken;

  if (accessToken) {
    localStorage.setItem('accessToken', accessToken);
  }

  const userResponse = await usersApi.getMe();
  setUser(userResponse.data);

  connect(accessToken);

  const from = searchParams.get('from') || '/chats';
  router.push(from);
} catch (err: any) {
  console.error('Login error:', err);
  setError(err.response?.data?.message || t('auth.login.loginFailed'));
} finally {
  setIsLoading(false);
};

  return (
    <div className="w-full max-w-md space-y-8">
      {/* Header */}
      <div className="text-center">
        <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center mx-auto mb-4">
          <span className="text-primary-foreground font-bold text-xl">M</span>
        </div>
        <h1 className="text-2xl font-bold">{t('auth.login.title')}</h1>
        <p className="text-muted-foreground mt-2">{t('auth.login.subtitle')}</p>
      </div>

      {/* Login Method Toggle */}
      <div className="flex p-1 bg-muted rounded-lg">
        <button
          type="button"
          onClick={() => setMethod('email')}
          className={cn(
            'flex-1 py-2 text-sm font-medium rounded-md transition-colors',
            method === 'email' ? 'bg-background shadow' : 'text-muted-foreground'
          )}
        >
          {t('auth.login.email')}
        </button>
        <button
          type="button"
          onClick={() => setMethod('phone')}
          className={cn(
            'flex-1 py-2 text-sm font-medium rounded-md transition-colors',
            method === 'phone' ? 'bg-background shadow' : 'text-muted-foreground'
          )}
        >
          {t('auth.login.phone')}
        </button>
      </div>

      {/* Login Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-lg">
            {error}
          </div>
        )}

        {method === 'email' ? (
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1">
              {t('auth.login.email')}
            </label>
            <input
              id="email"
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="you@example.com"
            />
          </div>
        ) : (
          <div>
            <label htmlFor="phone" className="block text-sm font-medium mb-1">
              {t('auth.login.phone')}
            </label>
            <input
              id="phone"
              type="tel"
              required
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="+1234567890"
            />
          </div>
        )}

        <div>
          <label htmlFor="password" className="block text-sm font-medium mb-1">
            {t('auth.login.password')}
          </label>
          <input
            id="password"
            type="password"
            required
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-2.5 px-4 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? t('common.signingIn') : t('auth.login.signIn')}
        </button>
      </form>

      {/* Register Link */}
      <p className="text-center text-sm text-muted-foreground">
        {t('auth.login.noAccount')}{' '}
        <Link href="/register" className="text-primary hover:underline font-medium">
          {t('auth.login.signUp')}
        </Link>
      </p>
    </div>
  );
}
