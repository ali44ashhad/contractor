import { Router } from 'express';
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser
} from '../controllers/userController';
import { authenticate, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

/**
 * @route   GET /api/users
 * @desc    Get all users
 * @access  Admin only
 */
router.get('/', authenticate, authorize(UserRole.ADMIN), asyncHandler(getAllUsers));

/**
 * @route   GET /api/users/:id
 * @desc    Get user by ID
 * @access  Authenticated users (can view own profile, admin can view all)
 */
router.get('/:id', authenticate, asyncHandler(getUserById));

/**
 * @route   POST /api/users
 * @desc    Create new user
 * @access  Admin only
 */
router.post('/', authenticate, authorize(UserRole.ADMIN), asyncHandler(createUser));

/**
 * @route   PUT /api/users/:id
 * @desc    Update user
 * @access  Authenticated users (can update own profile, admin can update all)
 */
router.put('/:id', authenticate, asyncHandler(updateUser));

/**
 * @route   DELETE /api/users/:id
 * @desc    Delete user
 * @access  Admin only
 */
router.delete('/:id', authenticate, authorize(UserRole.ADMIN), asyncHandler(deleteUser));

export default router;

