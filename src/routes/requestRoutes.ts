import { Router } from 'express';
import {
  createCompletionRequest,
  createExtensionRequest,
  getRequests,
  approveRequest,
  rejectRequest,
  cancelRequest
} from '../controllers/requestController';
import { authenticate, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

/**
 * @route   POST /api/requests/completion
 * @desc    Create completion request
 * @access  Contractors only
 */
router.post(
  '/completion',
  authenticate,
  authorize(UserRole.CONTRACTOR),
  asyncHandler(createCompletionRequest)
);

/**
 * @route   POST /api/requests/extension
 * @desc    Create extension request
 * @access  Contractors only
 */
router.post(
  '/extension',
  authenticate,
  authorize(UserRole.CONTRACTOR),
  asyncHandler(createExtensionRequest)
);

/**
 * @route   GET /api/requests
 * @desc    Get all requests with filters
 * @access  Authenticated users (contractors see own, admins see all)
 */
router.get('/', authenticate, asyncHandler(getRequests));

/**
 * @route   PATCH /api/requests/:id/approve
 * @desc    Approve a request
 * @access  Admins only
 */
router.patch(
  '/:id/approve',
  authenticate,
  authorize(UserRole.ADMIN),
  asyncHandler(approveRequest)
);

/**
 * @route   PATCH /api/requests/:id/reject
 * @desc    Reject a request
 * @access  Admins only
 */
router.patch(
  '/:id/reject',
  authenticate,
  authorize(UserRole.ADMIN),
  asyncHandler(rejectRequest)
);

/**
 * @route   DELETE /api/requests/:id/cancel
 * @desc    Cancel a pending request
 * @access  Contractors only (can only cancel their own requests)
 */
router.delete(
  '/:id/cancel',
  authenticate,
  authorize(UserRole.CONTRACTOR),
  asyncHandler(cancelRequest)
);

export default router;

