import { Router } from 'express';
import {
  register,
  login,
  logout,
  getMe,
  changePassword,
  refreshToken
} from '../controllers/authController';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

/**
 * @route   POST /api/auth/register
 * @desc    Register new user
 * @access  Public (or restrict to admin in production)
 */
router.post('/register', asyncHandler(register));

/**
 * @route   POST /api/auth/login
 * @desc    Login user (sets httpOnly cookie)
 * @access  Public
 */
router.post('/login', asyncHandler(login));

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user (clears cookie)
 * @access  Authenticated users
 */
router.post('/logout', authenticate, asyncHandler(logout));

/**
 * @route   GET /api/auth/me
 * @desc    Get current user profile
 * @access  Public (returns success: false if not authenticated)
 */
router.get('/me', asyncHandler(getMe));

/**
 * @route   POST /api/auth/change-password
 * @desc    Change user password
 * @access  Authenticated users
 */
router.post('/change-password', authenticate, asyncHandler(changePassword));

/**
 * @route   POST /api/auth/refresh-token
 * @desc    Refresh JWT token (updates cookie)
 * @access  Authenticated users
 */
router.post('/refresh-token', authenticate, asyncHandler(refreshToken));

export default router;

