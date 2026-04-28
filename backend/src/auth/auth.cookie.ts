/**
 * HttpOnly cookie configuration for JWT tokens.
 *
 * Using HttpOnly cookies provides:
 * - XSS protection: JavaScript cannot access the tokens
 * - Automatic cookie sending with every request (withCredentials: true)
 * - CSRF protection via SameSite=Strict
 */

interface CookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'strict' | 'lax' | 'none';
  path: string;
  maxAge: number;
}

// 15 minutes for access token
const ACCESS_TOKEN_MAX_AGE = 15 * 60 * 1000;
// 7 days for refresh token
const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

const isDevelopment = process.env.NODE_ENV !== 'production';

function getBaseCookieOptions(maxAge: number): CookieOptions {
  return {
    httpOnly: true,
    secure: !isDevelopment, // false for http://localhost, true for https
    sameSite: 'strict' as const,
    path: '/',
    maxAge,
  };
}

export function getCookieConfig(accessToken: string, refreshToken: string) {
  const accessCookie = `accessToken=${accessToken}; ${formatCookieOptions(getBaseCookieOptions(ACCESS_TOKEN_MAX_AGE))}`;
  const refreshCookie = `refreshToken=${refreshToken}; ${formatCookieOptions(getBaseCookieOptions(REFRESH_TOKEN_MAX_AGE))}`;

  return {
    accessTokenCookie: accessCookie,
    refreshTokenCookie: refreshCookie,
  };
}

export function getClearCookieConfig() {
  const clearAccess = 'accessToken=; path=/; max-age=0; httpOnly; secure';
  const clearRefresh = 'refreshToken=; path=/; max-age=0; httpOnly; secure';
  return [clearAccess, clearRefresh];
}

function formatCookieOptions(options: CookieOptions): string {
  const parts: string[] = [];
  if (options.httpOnly) parts.push('httpOnly');
  if (options.secure) parts.push('secure');
  parts.push(`SameSite=${options.sameSite}`);
  parts.push(`path=${options.path}`);
  parts.push(`max-age=${Math.floor(options.maxAge / 1000)}`);
  return parts.join('; ');
}
