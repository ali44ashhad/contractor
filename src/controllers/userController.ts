import { Response } from 'express';
import { User, UserRole } from '../models/User';
import { AuthRequest } from '../middleware/auth';
import { NotFoundError, ValidationError } from '../utils/errors';

/**
 * Get all users (Admin only)
 */
export const getAllUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  const { role, isActive, page, limit } = req.query;

  const filter: any = {};
  if (role) filter.role = role;
  if (isActive !== undefined) filter.isActive = isActive === 'true';

  // Pagination parameters
  const pageNum = parseInt(page as string) || 1;
  const limitNum = parseInt(limit as string) || 10;
  const skip = (pageNum - 1) * limitNum;

  // Get total count for pagination metadata
  const total = await User.countDocuments(filter);

  const users = await User.find(filter)
    .select('-password')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limitNum);

  const totalPages = Math.ceil(total / limitNum);

  res.status(200).json({
    success: true,
    data: users,
    count: users.length,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages
    }
  });
};

/**
 * Get user by ID
 */
export const getUserById = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  const user = await User.findById(id).select('-password');

  if (!user) {
    throw new NotFoundError('User');
  }

  res.status(200).json({
    success: true,
    data: user
  });
};

/**
 * Create new user (Admin only)
 */
export const createUser = async (req: AuthRequest, res: Response): Promise<void> => {
  const { email, password, name, role, phone } = req.body;

  if (!email || !password || !name || !role) {
    throw new ValidationError('Email, password, name, and role are required');
  }

  // Validate role
  if (!Object.values(UserRole).includes(role)) {
    throw new ValidationError('Invalid user role');
  }

  // Password will be automatically hashed by pre-save middleware
  const user = await User.create({
    email,
    password,
    name,
    role,
    phone
  });

  // Remove password from response
  const userResponse: any = user.toObject();
  delete userResponse.password;

  res.status(201).json({
    success: true,
    data: userResponse,
    message: 'User created successfully'
  });
};

/**
 * Update user
 */
export const updateUser = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { name, phone, role, isActive, password } = req.body;

  const user = await User.findById(id);
  if (!user) {
    throw new NotFoundError('User');
  }

  // Users can only update their own profile (except role, isActive, and password)
  // Password changes should use the change-password endpoint
  if (req.user?.id !== id && req.user?.role !== UserRole.ADMIN) {
    if (role || isActive !== undefined || password) {
      throw new ValidationError('You can only update your own name and phone');
    }
  }

  // Build update data
  const updateData: any = {};
  if (name) updateData.name = name;
  if (phone !== undefined) updateData.phone = phone;
  
  // Only admin can update role and isActive
  if (req.user?.role === UserRole.ADMIN) {
    if (role) updateData.role = role;
    if (isActive !== undefined) updateData.isActive = isActive;
  }

  // Password updates should use change-password endpoint, but if admin wants to reset it
  if (password && req.user?.role === UserRole.ADMIN) {
    updateData.password = password; // Will be hashed by pre-save middleware
  }

  // Update user
  Object.assign(user, updateData);
  await user.save();

  // Remove password from response
  const userResponse: any = user.toObject();
  delete userResponse.password;

  res.status(200).json({
    success: true,
    data: userResponse,
    message: 'User updated successfully'
  });
};

/**
 * Delete user (Admin only)
 */
export const deleteUser = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  const user = await User.findByIdAndDelete(id);

  if (!user) {
    throw new NotFoundError('User');
  }

  res.status(200).json({
    success: true,
    message: 'User deleted successfully'
  });
};

