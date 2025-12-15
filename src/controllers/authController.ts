import { Response } from 'express';
import { User, UserRole, IUser } from '../models/User';
import { generateToken } from '../utils/jwt';
import { ValidationError, UnauthorizedError } from '../utils/errors';
import { AuthRequest } from '../middleware/auth';
import { getCookieOptions, getClearCookieOptions, isIOSSafari } from '../utils/cookies';

/**
 * Set cookie with iOS Safari workaround
 * iOS Safari requires manual Set-Cookie header construction for better compatibility
 */
const setCookieForResponse = (
  res: Response,
  name: string,
  value: string,
  options: any,
  userAgent?: string
): void => {
  const isIOS = isIOSSafari(userAgent);
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (isIOS && isProduction) {
    // iOS Safari: Manually construct Set-Cookie header for better compatibility
    // Use SameSite=None; Secure format that iOS Safari accepts
    const maxAge = options.maxAge ? `; Max-Age=${Math.floor(options.maxAge / 1000)}` : '';
    const secure = options.secure ? '; Secure' : '';
    const httpOnly = options.httpOnly ? '; HttpOnly' : '';
    const path = options.path ? `; Path=${options.path}` : '';
    // iOS Safari: Use SameSite=None explicitly in the header
    const sameSite = '; SameSite=None';
    
    const cookieString = `${name}=${value}${maxAge}${path}${secure}${httpOnly}${sameSite}`;
    res.setHeader('Set-Cookie', cookieString);
  } else {
    // Other browsers: Use Express's res.cookie() method
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

  res.status(201).json({
    success: true,
    data: {
      user: userResponse
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

  res.status(200).json({
    success: true,
    data: {
      user: userResponse
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
  // Pass user agent for iOS Safari detection
  const userAgent = req.headers['user-agent'];
  const cookieOptions = getCookieOptions(userAgent);
  setCookieForResponse(res, 'token', token, cookieOptions, userAgent);

  res.status(200).json({
    success: true,
    message: 'Token refreshed successfully'
  });
};

/**
 * Logout user (clear cookie)
 */
export const logout = async (req: AuthRequest, res: Response): Promise<void> => {
  // Clear the token cookie with proper cross-domain support
  // Pass user agent for iOS Safari detection
  const userAgent = req.headers['user-agent'];
  const clearCookieOptions = getClearCookieOptions(userAgent);
  res.clearCookie('token', clearCookieOptions);

  res.status(200).json({
    success: true,
    message: 'Logged out successfully'
  });
};

