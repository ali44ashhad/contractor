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
 * Detect if the request is from Safari (iOS or desktop)
 * Safari has known issues with SameSite=None cookies and requires special handling
 */
export const isSafari = (userAgent: string | undefined): boolean => {
  if (!userAgent) return false;
  
  // Detect Safari on any platform (iOS, macOS, etc.)
  // Safari: contains "Safari" but NOT "Chrome", "CriOS", "FxiOS", or "Edg"
  // This catches both iOS Safari and desktop Safari
  const isSafariBrowser = /Safari/.test(userAgent) && 
    !/Chrome|CriOS|FxiOS|Edg|OPR/.test(userAgent);
  
  return isSafariBrowser;
};

/**
 * Detect if the request is from iOS Safari (for specific iOS handling)
 * iOS Safari and Chrome on iOS both have issues with cross-origin cookies
 * This function detects all iOS browsers (Safari, Chrome, Firefox, etc.)
 */
export const isIOSSafari = (userAgent: string | undefined): boolean => {
  if (!userAgent) return false;
  
  // Detect iOS device (iPhone, iPad, iPod)
  const isIOS = /iPhone|iPad|iPod/.test(userAgent);
  
  if (!isIOS) return false;
  
  // iOS Safari: contains "Safari" but NOT "Chrome", "CriOS", "FxiOS", or "Edg"
  const isSafari = /Safari/.test(userAgent) && !/Chrome|CriOS|FxiOS|Edg|OPR/.test(userAgent);
  
  // iOS Chrome: contains "CriOS" (Chrome on iOS)
  const isIOSChrome = /CriOS/.test(userAgent);
  
  // iOS Firefox: contains "FxiOS" (Firefox on iOS)
  const isIOSFirefox = /FxiOS/.test(userAgent);
  
  // iOS Edge: contains "EdgiOS" (Edge on iOS)
  const isIOSEdge = /EdgiOS/.test(userAgent);
  
  // All iOS browsers have issues with cross-origin cookies
  // Return true for any iOS browser
  return isSafari || isIOSChrome || isIOSFirefox || isIOSEdge;
};

/**
 * Get cookie options for authentication cookies
 * For cross-domain cookies (production), uses sameSite: 'none' and secure: true
 * For same-domain cookies (development), uses sameSite: 'lax' (better Safari compatibility)
 * 
 * Safari Fix: Safari (both desktop and iOS) requires:
 * 1. SameSite=None MUST have Secure=true
 * 2. Proper attribute ordering in Set-Cookie header
 * 3. No domain attribute for cross-domain cookies
 * 
 * iOS Safari Fix: iOS Safari blocks cross-origin cookies even in development (different ports)
 * So we need to always return the token in the response body for iOS devices
 * 
 * @param userAgent - Optional user agent string to detect Safari
 */
export const getCookieOptions = (userAgent?: string): CookieOptions => {
  const isProduction = process.env.NODE_ENV === 'production';
  const isIOSDevice = isIOSSafari(userAgent);
  
  // iOS Safari Fix: iOS Safari blocks cross-origin cookies even in development
  // If it's an iOS device, we'll still try to set the cookie, but the client
  // should use the token from the response body as fallback
  let sameSite: 'strict' | 'lax' | 'none' | boolean;
  
  if (isProduction) {
    // Production: use 'none' for cross-domain (requires secure: true)
    sameSite = 'none';
  } else {
    // Development: use 'lax' for same-origin, but iOS Safari may still block it
    // if frontend and backend are on different ports (cross-origin)
    // In that case, the token fallback in response body will be used
    sameSite = 'lax';
  }
  
  // Safari Fix: When sameSite is 'none', secure MUST be true
  // In production, always use secure. In development, use secure only if HTTPS
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
 * Safari Fix: Must use the same secure and sameSite values as when setting the cookie
 * 
 * @param userAgent - Optional user agent string to detect Safari
 */
export const getClearCookieOptions = (userAgent?: string): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'strict' | 'lax' | 'none' | boolean;
  path: string;
} => {
  const isProduction = process.env.NODE_ENV === 'production';
  
  // Must match the sameSite value used when setting the cookie
  let sameSite: 'strict' | 'lax' | 'none' | boolean;
  
  if (isProduction) {
    // Production: use 'none' (must match getCookieOptions)
    sameSite = 'none';
  } else {
    // Development: use 'lax' (must match getCookieOptions)
    sameSite = 'lax';
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

