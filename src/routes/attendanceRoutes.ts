import { Router } from 'express';
import {
  getAttendance,
  getUserAttendance,
  getProjectAttendance
} from '../controllers/attendanceController';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

/**
 * @route   GET /api/attendance
 * @desc    Get attendance records with filters
 * @access  Authenticated users
 */
router.get('/', authenticate, asyncHandler(getAttendance));

/**
 * @route   GET /api/attendance/user/:userId
 * @desc    Get attendance for specific user
 * @access  Authenticated users (own attendance or admin)
 */
router.get('/user/:userId', authenticate, asyncHandler(getUserAttendance));

/**
 * @route   GET /api/attendance/project/:projectId
 * @desc    Get attendance for all team members in a project
 * @access  Authenticated users (team members or admin)
 */
router.get('/project/:projectId', authenticate, asyncHandler(getProjectAttendance));

export default router;

