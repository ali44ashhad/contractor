import { Response } from 'express';
import { User, UserRole, IUser } from '../models/User';
import { generateToken } from '../utils/jwt';
import { ValidationError, UnauthorizedError } from '../utils/errors';
import { AuthRequest } from '../middleware/auth';
import { getCookieOptions, getClearCookieOptions, isSafari, isIOSSafari } from '../utils/cookies';

/**
 * Set cookie with Safari workaround
 * Safari (both desktop and iOS) requires proper cookie attribute ordering
 * Safari is very strict about cookie format, especially for SameSite=None cookies
 */
const setCookieForResponse = (
  res: Response,
  name: string,
  value: string,
  options: any,
  userAgent?: string
): void => {
  const isSafariBrowser = isSafari(userAgent);
  const isProduction = process.env.NODE_ENV === 'production';
  
  // Safari requires special handling, especially in production with SameSite=None
  if (isSafariBrowser && isProduction && options.sameSite === 'none') {
    // Safari: Manually construct Set-Cookie header with proper attribute ordering
    // Safari requires: Path -> Secure -> HttpOnly -> SameSite (in this order)
    // Value must be URL-encoded if it contains special characters
    const encodedValue = encodeURIComponent(value);
    const path = options.path || '/';
    const maxAge = options.maxAge ? Math.floor(options.maxAge / 1000) : undefined;
    
    // Build cookie string with proper Safari ordering
    let cookieString = `${name}=${encodedValue}`;
    cookieString += `; Path=${path}`;
    if (maxAge) {
      cookieString += `; Max-Age=${maxAge}`;
    }
    cookieString += '; Secure'; // Must come before SameSite for Safari
    if (options.httpOnly) {
      cookieString += '; HttpOnly';
    }
    cookieString += '; SameSite=None'; // Must be last for Safari
    
    res.setHeader('Set-Cookie', cookieString);
  } else {
    // Other browsers or development: Use Express's res.cookie() method
    // Express handles encoding and formatting automatically
    res.cookie(name, value, options);
  }
};

/**
 * Register new user
 * Note: In production, you might want to restrict registration to admins only
 */
export const register = async (req: AuthRequest, res: Response): Promise<void> => {
  const { email, password, name, role, phone } = req.body;

  // Validation
  if (!email || !password || !name) {
    throw new ValidationError('Email, password, and name are required');
  }

  if (password.length < 6) {
    throw new ValidationError('Password must be at least 6 characters long');
  }

  // Check if user already exists
  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    throw new ValidationError('User with this email already exists');
  }

  // Create new user
  const user: IUser = await User.create({
    email: email.toLowerCase(),
    password, // Will be hashed by pre-save middleware
    name,
    role: role || UserRole.DEVELOPER,
    phone
  });

  // Generate JWT token
  const token = generateToken({
    id: user.id,
    email: user.email,
    role: user.role
  });

  // Set token in httpOnly cookie with proper cross-domain support
  // Pass user agent for iOS Safari detection
  const userAgent = req.headers['user-agent'];
  const cookieOptions = getCookieOptions(userAgent);
  setCookieForResponse(res, 'token', token, cookieOptions, userAgent);

  // Remove password from response
  const userResponse: any = user.toObject();
  delete userResponse.password;

  // Safari Fix: Return token in response body for Safari as fallback
  // Safari may block cross-site cookies in some scenarios, so provide token as fallback
  const isSafariBrowser = isSafari(userAgent);
  const isProduction = process.env.NODE_ENV === 'production';
  
  res.status(201).json({
    success: true,
    data: {
      user: userResponse,
      // Return token for Safari to store and send via Authorization header if cookies fail
      ...(isSafariBrowser && isProduction ? { token } : {})
    },
    message: 'User registered successfully'
  });
};

/**
 * Login user
 */
export const login = async (req: AuthRequest, res: Response): Promise<void> => {
  const { email, password } = req.body;

  // Validation
  if (!email || !password) {
    throw new ValidationError('Email and password are required');
  }

  // Find user and include password (since it's excluded by default)
  const user: IUser | null = await User.findOne({ email: email.toLowerCase() })
    .select('+password');

  if (!user) {
    throw new UnauthorizedError('Invalid email or password');
  }

  // Check if user is active
  if (!user.isActive) {
    throw new UnauthorizedError('User account is inactive. Please contact administrator');
  }

  // Verify password
  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    throw new UnauthorizedError('Invalid email or password');
  }

  // Generate JWT token
  const token = generateToken({
    id: user.id,
    email: user.email,
    role: user.role
  });

  // Set token in httpOnly cookie with proper cross-domain support
  // Pass user agent for iOS Safari detection
  const userAgent = req.headers['user-agent'];
  const cookieOptions = getCookieOptions(userAgent);
  setCookieForResponse(res, 'token', token, cookieOptions, userAgent);

  // Remove password from response
  const userResponse: any = user.toObject();
  delete userResponse.password;

  // Safari Fix: Return token in response body for Safari as fallback
  const isSafariBrowser = isSafari(userAgent);
  const isProduction = process.env.NODE_ENV === 'production';

  res.status(200).json({
    success: true,
    data: {
      user: userResponse,
      // Return token for Safari to store and send via Authorization header if cookies fail
      ...(isSafariBrowser && isProduction ? { token } : {})
    },
    message: 'Login successful'
  });
};

/**
 * Get current user profile
 */
export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }

  const user = await User.findById(req.user.id).select('-password');

  if (!user) {
    throw new UnauthorizedError('User not found');
  }

  res.status(200).json({
    success: true,
    data: user
  });
};

/**
 * Change password
 */
export const changePassword = async (req: AuthRequest, res: Response): Promise<void> => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    throw new ValidationError('Current password and new password are required');
  }

  if (newPassword.length < 6) {
    throw new ValidationError('New password must be at least 6 characters long');
  }

  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }

  // Find user with password
  const user = await User.findById(req.user.id).select('+password');

  if (!user) {
    throw new UnauthorizedError('User not found');
  }

  // Verify current password
  const isPasswordValid = await user.comparePassword(currentPassword);
  if (!isPasswordValid) {
    throw new UnauthorizedError('Current password is incorrect');
  }

  // Update password (will be hashed by pre-save middleware)
  user.password = newPassword;
  await user.save();

  res.status(200).json({
    success: true,
    message: 'Password changed successfully'
  });
};

/**
 * Refresh token (get new token with same credentials)
 */
export const refreshToken = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }

  // Verify user still exists and is active
  const user: IUser | null = await User.findById(req.user.id);

  if (!user) {
    throw new UnauthorizedError('User not found');
  }

  if (!user.isActive) {
    throw new UnauthorizedError('User account is inactive');
  }

  // Generate new token
  const token = generateToken({
    id: user.id,
    email: user.email,
    role: user.role
  });

  // Update token in cookie with proper cross-domain support
  // Pass user agent for Safari detection
  const userAgent = req.headers['user-agent'];
  const cookieOptions = getCookieOptions(userAgent);
  setCookieForResponse(res, 'token', token, cookieOptions, userAgent);

  // Safari Fix: Return token in response body for Safari as fallback
  const isSafariBrowser = isSafari(userAgent);
  const isProduction = process.env.NODE_ENV === 'production';

  res.status(200).json({
    success: true,
    message: 'Token refreshed successfully',
    // Return token for Safari to store and send via Authorization header if cookies fail
    ...(isSafariBrowser && isProduction ? { data: { token } } : {})
  });
};

/**
 * Logout user (clear cookie)
 */
export const logout = async (req: AuthRequest, res: Response): Promise<void> => {
  // Clear the token cookie with proper cross-domain support
  // Pass user agent for Safari detection
  const userAgent = req.headers['user-agent'];
  const clearCookieOptions = getClearCookieOptions(userAgent);
  const isSafariBrowser = isSafari(userAgent);
  const isProduction = process.env.NODE_ENV === 'production';
  
  // Safari requires special handling for clearing cookies with SameSite=None
  if (isSafariBrowser && isProduction && clearCookieOptions.sameSite === 'none') {
    // Manually set cookie with empty value and immediate expiration
    const cookieString = `token=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=None`;
    res.setHeader('Set-Cookie', cookieString);
  } else {
    // Use Express's clearCookie for other browsers
    res.clearCookie('token', clearCookieOptions);
  }

  res.status(200).json({
    success: true,
    message: 'Logged out successfully'
  });
};

