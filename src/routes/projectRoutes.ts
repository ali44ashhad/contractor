import { Router } from 'express';
import {
  getAllProjects,
  getProjectById,
  createProject,
  updateProject,
  assignProjectToContractor,
  deleteProject
} from '../controllers/projectController';
import { authenticate, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

/**
 * @route   GET /api/projects
 * @desc    Get all projects
 * @access  Authenticated users (contractors see only their projects)
 */
router.get('/', authenticate, asyncHandler(getAllProjects));

/**
 * @route   GET /api/projects/:id
 * @desc    Get project by ID
 * @access  Authenticated users (contractors see only their projects)
 */
router.get('/:id', authenticate, asyncHandler(getProjectById));

/**
 * @route   POST /api/projects
 * @desc    Create new project
 * @access  Admin only
 */
router.post('/', authenticate, authorize(UserRole.ADMIN), asyncHandler(createProject));

/**
 * @route   PUT /api/projects/:id
 * @desc    Update project
 * @access  Admin only
 */
router.put('/:id', authenticate, authorize(UserRole.ADMIN), asyncHandler(updateProject));

/**
 * @route   POST /api/projects/:id/assign
 * @desc    Assign project to contractor
 * @access  Admin only
 */
router.post('/:id/assign', authenticate, authorize(UserRole.ADMIN), asyncHandler(assignProjectToContractor));

/**
 * @route   DELETE /api/projects/:id
 * @desc    Delete project
 * @access  Admin only
 */
router.delete('/:id', authenticate, authorize(UserRole.ADMIN), asyncHandler(deleteProject));

export default router;

