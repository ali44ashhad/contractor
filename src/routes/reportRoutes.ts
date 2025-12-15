import { Router } from 'express';
import {
  getAllReports,
  getReportById,
  generateReport,
  updateReport,
  deleteReport,
  getProjectReport
} from '../controllers/reportController';
import { authenticate, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

/**
 * @route   GET /api/reports
 * @desc    Get all reports
 * @access  Accounts only
 */
router.get('/', authenticate, authorize(UserRole.ACCOUNTS), asyncHandler(getAllReports));

/**
 * @route   GET /api/reports/project/:projectId
 * @desc    Get project report with team members and updates
 * @access  Admin only
 */
router.get('/project/:projectId', authenticate, authorize(UserRole.ADMIN), asyncHandler(getProjectReport));

/**
 * @route   GET /api/reports/:id
 * @desc    Get report by ID
 * @access  Accounts only
 */
router.get('/:id', authenticate, authorize(UserRole.ACCOUNTS), asyncHandler(getReportById));

/**
 * @route   POST /api/reports
 * @desc    Generate report
 * @access  Accounts only
 */
router.post('/', authenticate, authorize(UserRole.ACCOUNTS), asyncHandler(generateReport));

/**
 * @route   PUT /api/reports/:id
 * @desc    Update report (only by creator or admin)
 * @access  Accounts only
 */
router.put('/:id', authenticate, authorize(UserRole.ACCOUNTS), asyncHandler(updateReport));

/**
 * @route   DELETE /api/reports/:id
 * @desc    Delete report (only by creator or admin)
 * @access  Accounts only
 */
router.delete('/:id', authenticate, authorize(UserRole.ACCOUNTS), asyncHandler(deleteReport));

export default router;

