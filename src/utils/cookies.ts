/**
 * Cookie configuration utilities
 * Handles cookie settings for both development and production environments
 * 
 * iOS Safari Fix: iOS Safari has strict requirements for sameSite: 'none' cookies:
 * 1. Must have secure: true
 * 2. Must be set from HTTPS
 * 3. Cookie attributes must be in correct format
 * 4. iOS Safari may block cookies if they're considered "third-party"
 * 5. iOS Safari (especially iOS 12) treats SameSite=None as SameSite=Strict
 */

export interface CookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'strict' | 'lax' | 'none' | boolean;
  maxAge: number;
  path: string;
}

/**
 * Detect if the request is from iOS Safari
 * iOS Safari has known issues with SameSite=None cookies
 */
export const isIOSSafari = (userAgent: string | undefined): boolean => {
  if (!userAgent) return false;
  
  // Detect iOS Safari or Chrome on iOS (both use WebKit)
  // iOS Safari: contains "iPhone" or "iPad" and "Safari" but not "Chrome"
  // iOS Chrome: contains "iPhone" or "iPad" and "CriOS" (Chrome on iOS)
  const isIOS = /iPhone|iPad|iPod/.test(userAgent);
  const isSafari = /Safari/.test(userAgent) && !/Chrome|CriOS|FxiOS/.test(userAgent);
  const isIOSChrome = /CriOS/.test(userAgent);
  
  return isIOS && (isSafari || isIOSChrome);
};

/**
 * Get cookie options for authentication cookies
 * For cross-domain cookies (production), uses sameSite: 'none' and secure: true
 * For same-domain cookies (development), uses sameSite: 'strict'
 * 
 * iOS Safari Fix: iOS Safari treats SameSite=None as SameSite=Strict in some versions
 * For iOS Safari, we omit SameSite attribute entirely (defaults to Lax, but works better)
 * 
 * @param userAgent - Optional user agent string to detect iOS Safari
 */
export const getCookieOptions = (userAgent?: string): CookieOptions => {
  const isProduction = process.env.NODE_ENV === 'production';
  const isIOS = isIOSSafari(userAgent);
  
  // iOS Safari Fix: iOS Safari has issues with SameSite=None, but we still need it for cross-domain
  // We'll handle iOS Safari specially in the controller by manually setting the header
  // For now, use 'none' in production for all browsers (iOS will be handled manually)
  let sameSite: 'strict' | 'lax' | 'none' | boolean;
  
  if (isProduction) {
    // Production: use 'none' for cross-domain (iOS Safari will be handled manually in controller)
    sameSite = 'none';
  } else {
    // Development: use 'strict' for same-domain
    sameSite = 'strict';
  }
  
  // iOS Safari Fix: When sameSite is 'none', secure MUST be true
  // For iOS Safari, we still use secure in production
  const secure = isProduction ? true : false;
  
  return {
    httpOnly: true, // Prevents JavaScript access (XSS protection)
    secure: secure, // HTTPS only in production
    sameSite: sameSite as 'strict' | 'lax' | 'none',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
    path: '/' // Don't set domain - let browser handle it for cross-domain cookies
  };
};

/**
 * Get cookie options for clearing cookies (logout)
 * Must match the same options used when setting the cookie
 * 
 * iOS Safari Fix: Must use the same secure and sameSite values as when setting the cookie
 * 
 * @param userAgent - Optional user agent string to detect iOS Safari
 */
export const getClearCookieOptions = (userAgent?: string): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'strict' | 'lax' | 'none' | boolean;
  path: string;
} => {
  const isProduction = process.env.NODE_ENV === 'production';
  const isIOS = isIOSSafari(userAgent);
  
  // Must match the sameSite value used when setting the cookie
  let sameSite: 'strict' | 'lax' | 'none' | boolean;
  
  if (isProduction) {
    // Production: use 'none' (must match getCookieOptions)
    sameSite = 'none';
  } else {
    // Development: use 'strict'
    sameSite = 'strict';
  }
  
  // Must match the secure value used when setting the cookie
  const secure = isProduction ? true : false;
  
  return {
    httpOnly: true,
    secure: secure, // Must match the secure value used when setting the cookie
    sameSite: sameSite as 'strict' | 'lax' | 'none',
    path: '/' // Must match the path used when setting the cookie
  };
};

