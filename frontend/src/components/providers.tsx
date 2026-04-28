'use client';

import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '@/store';
import { usersApi } from '@/lib/api-client';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}

function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setLoading, logout, isLoading } = useAuthStore();

  // Load user on mount
  useEffect(() => {
    const loadUser = async () => {
      try {
        // Try to get user info - cookies are sent automatically with withCredentials
        const userResponse = await usersApi.getMe();
        setUser(userResponse.data);

        // Connect to WebSocket using token from login response
        // (cookies are HttpOnly, so we can't read them from JS)
      } catch (error) {
        // Not authenticated or token expired
        logout();
      }

      setLoading(false);
    };

    loadUser();
  }, []);

  // NOTE: No client-side redirects here — proxy.ts handles all route protection server-side.
  // This prevents redirect loops between proxy (server) and AuthProvider (client).

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return <>{children}</>;
}
