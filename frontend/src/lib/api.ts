import axios from 'axios';
import { clearTokens } from '@/lib/cookies';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Automatically send cookies with requests
});

// No Authorization header needed - cookies are sent automatically with withCredentials: true

// Response interceptor - handle 401 by redirecting to login
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Don't redirect if already on a public page (login/register)
      const publicPaths = ['/login', '/register'];
      const isPublicPath = typeof window !== 'undefined' &&
        publicPaths.some(path => window.location.pathname === path);

      if (!isPublicPath) {
        clearTokens();
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
