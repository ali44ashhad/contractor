import { Router } from 'express';
import {
  createUpdate,
  getUpdates,
  getUpdateById,
  addDocumentsToUpdate
} from '../controllers/updateController';
import { authenticate } from '../middleware/auth';
import { uploadDocuments } from '../middleware/upload';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

/**
 * @route   GET /api/updates
 * @desc    Get all updates
 * @access  Authenticated users
 */
router.get('/', authenticate, asyncHandler(getUpdates));

/**
 * @route   GET /api/updates/:id
 * @desc    Get update by ID
 * @access  Authenticated users
 */
router.get('/:id', authenticate, asyncHandler(getUpdateById));

/**
 * @route   POST /api/updates
 * @desc    Create an update (team members only)
 * @access  Team members (contractors and team members)
 */
router.post('/', authenticate, uploadDocuments, asyncHandler(createUpdate));

/**
 * @route   POST /api/updates/:id/documents
 * @desc    Attach documents to an update (team members only)
 * @access  Team members (can only modify their own updates)
 */
router.post('/:id/documents', authenticate, uploadDocuments, asyncHandler(addDocumentsToUpdate));

export default router;


