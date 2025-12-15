/**
 * Cookie configuration utilities
 * Handles cookie settings for both development and production environments
 */

export interface CookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'strict' | 'lax' | 'none';
  maxAge: number;
  path: string;
}

/**
 * Get cookie options for authentication cookies
 * For cross-domain cookies (production), uses sameSite: 'none' and secure: true
 * For same-domain cookies (development), uses sameSite: 'strict'
 * 
 * Note: Mobile browsers (especially Chrome) can be strict about sameSite: 'none' cookies.
 * Ensure both frontend and backend are on HTTPS in production.
 */
export const getCookieOptions = (): CookieOptions => {
  const isProduction = process.env.NODE_ENV === 'production';
  
  // In production, use 'none' for cross-domain cookies (required for mobile compatibility)
  // In development, use 'strict' for same-domain cookies
  const sameSite: 'strict' | 'lax' | 'none' = isProduction ? 'none' : 'strict';
  
  return {
    httpOnly: true, // Prevents JavaScript access (XSS protection)
    secure: isProduction, // HTTPS only in production (required for sameSite: 'none')
    sameSite: sameSite,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
    path: '/' // Don't set domain - let browser handle it for cross-domain cookies
  };
};

/**
 * Get cookie options for clearing cookies (logout)
 * Must match the same options used when setting the cookie
 */
export const getClearCookieOptions = (): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'strict' | 'lax' | 'none';
  path: string;
} => {
  const isProduction = process.env.NODE_ENV === 'production';
  
  // Must match the sameSite value used when setting the cookie
  const sameSite: 'strict' | 'lax' | 'none' = isProduction ? 'none' : 'strict';
  
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: sameSite,
    path: '/' // Must match the path used when setting the cookie
  };
};

