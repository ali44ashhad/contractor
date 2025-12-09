import { Router } from 'express';
import { getDashboardStats, getRecentUpdates } from '../controllers/dashboardController';
import { authenticate, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

/**
 * @route   GET /api/dashboard/stats
 * @desc    Get dashboard statistics/KPIs
 * @access  Admin only
 */
router.get('/stats', authenticate, authorize(UserRole.ADMIN), asyncHandler(getDashboardStats));

/**
 * @route   GET /api/dashboard/recent-updates
 * @desc    Get recent updates for dashboard
 * @access  Admin only
 */
router.get('/recent-updates', authenticate, authorize(UserRole.ADMIN), asyncHandler(getRecentUpdates));

export default router;

