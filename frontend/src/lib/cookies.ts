/**
 * Cookie-based token management for SSR-compatible auth.
 *
 * Tokens are stored in HttpOnly cookies set by the backend.
 * The frontend cannot read these cookies (HttpOnly), but can:
 * - Clear them on logout (browser deletes them)
 * - The browser automatically sends them with every request (withCredentials: true)
 *
 * Note: Since cookies are HttpOnly, getAccessToken() and getRefreshToken()
 * will return null in client-side JavaScript. These functions are kept for
 * backward compatibility but the actual token reading is done server-side
 * by the proxy (middleware) and backend JWT strategy.
 */

const ACCESS_TOKEN_COOKIE = 'accessToken';
const REFRESH_TOKEN_COOKIE = 'refreshToken';

/**
 * Clear auth cookies on logout.
 * Since cookies are HttpOnly, this sets them to expire immediately.
 * The browser will delete them automatically.
 */
export function clearTokens() {
  document.cookie = `${ACCESS_TOKEN_COOKIE}=; path=/; max-age=0; Secure; SameSite=Strict`;
  document.cookie = `${REFRESH_TOKEN_COOKIE}=; path=/; max-age=0; Secure; SameSite=Strict`;
}

/**
 * @deprecated - HttpOnly cookies cannot be read from JavaScript.
 * This function always returns null. The backend JWT strategy reads
 * the cookie automatically on protected routes.
 */
export function getAccessToken(): string | null {
  // HttpOnly cookies are not accessible from document.cookie
  // This is intentional for security
  return null;
}

/**
 * @deprecated - HttpOnly cookies cannot be read from JavaScript.
 * This function always returns null.
 */
export function getRefreshToken(): string | null {
  // HttpOnly cookies are not accessible from document.cookie
  return null;
}

/**
 * @deprecated - Tokens are now set by the backend via Set-Cookie headers.
 * Do not call this from client-side code.
 */
export function setAccessToken(_token: string) {
  // No-op: backend sets HttpOnly cookies via Set-Cookie headers
  console.warn('setAccessToken is deprecated - backend now sets cookies automatically');
}

/**
 * @deprecated - Tokens are now set by the backend via Set-Cookie headers.
 * Do not call this from client-side code.
 */
export function setRefreshToken(_token: string) {
  // No-op: backend sets HttpOnly cookies via Set-Cookie headers
  console.warn('setRefreshToken is deprecated - backend now sets cookies automatically');
}
