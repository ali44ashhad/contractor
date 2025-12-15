/**
 * Cookie configuration utilities
 * Handles cookie settings for both development and production environments
 * 
 * iOS Safari Fix: iOS Safari has strict requirements for sameSite: 'none' cookies:
 * 1. Must have secure: true
 * 2. Must be set from HTTPS
 * 3. Cookie attributes must be in correct format
 * 4. iOS Safari may block cookies if they're considered "third-party"
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
 * iOS Safari Fix: When sameSite is 'none', secure MUST be true (iOS requirement)
 * This is critical for iOS Safari/Chrome compatibility
 */
export const getCookieOptions = (): CookieOptions => {
  const isProduction = process.env.NODE_ENV === 'production';
  
  // In production, use 'none' for cross-domain cookies (required for mobile compatibility)
  // In development, use 'strict' for same-domain cookies
  const sameSite: 'strict' | 'lax' | 'none' = isProduction ? 'none' : 'strict';
  
  // iOS Safari Fix: When sameSite is 'none', secure MUST be true
  // iOS Safari will reject cookies with sameSite: 'none' if secure is false
  const secure = sameSite === 'none' ? true : isProduction;
  
  return {
    httpOnly: true, // Prevents JavaScript access (XSS protection)
    secure: secure, // MUST be true when sameSite is 'none' (iOS Safari requirement)
    sameSite: sameSite,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
    path: '/' // Don't set domain - let browser handle it for cross-domain cookies
  };
};

/**
 * Get cookie options for clearing cookies (logout)
 * Must match the same options used when setting the cookie
 * 
 * iOS Safari Fix: Must use the same secure value as when setting the cookie
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
  
  // iOS Safari Fix: When sameSite is 'none', secure MUST be true (must match getCookieOptions)
  const secure = sameSite === 'none' ? true : isProduction;
  
  return {
    httpOnly: true,
    secure: secure, // Must match the secure value used when setting the cookie
    sameSite: sameSite,
    path: '/' // Must match the path used when setting the cookie
  };
};

