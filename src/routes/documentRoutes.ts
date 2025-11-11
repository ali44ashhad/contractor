import { Router } from 'express';
import {
  getAllDocuments,
  getDocumentById,
  uploadDocument,
  updateDocument,
  deleteDocument
} from '../controllers/documentController';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

/**
 * @route   GET /api/documents
 * @desc    Get all documents
 * @access  Authenticated users
 */
router.get('/', authenticate, asyncHandler(getAllDocuments));

/**
 * @route   GET /api/documents/:id
 * @desc    Get document by ID
 * @access  Authenticated users
 */
router.get('/:id', authenticate, asyncHandler(getDocumentById));

/**
 * @route   POST /api/documents
 * @desc    Upload document
 * @access  Authenticated users
 * @note    - Admin/Accounts: Can upload requirement and other documents
 *          - Contractor: Can upload status documents
 */
router.post('/', authenticate, asyncHandler(uploadDocument));

/**
 * @route   PUT /api/documents/:id
 * @desc    Update document (only by uploader or admin)
 * @access  Authenticated users
 */
router.put('/:id', authenticate, asyncHandler(updateDocument));

/**
 * @route   DELETE /api/documents/:id
 * @desc    Delete document (only by uploader or admin)
 * @access  Authenticated users
 */
router.delete('/:id', authenticate, asyncHandler(deleteDocument));

export default router;

