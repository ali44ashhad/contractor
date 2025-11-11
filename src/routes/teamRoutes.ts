import { Router } from 'express';
import {
  getAllTeams,
  getTeamById,
  createTeam,
  addTeamMembers,
  updateTeam,
  deleteTeam
} from '../controllers/teamController';
import { authenticate, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

/**
 * @route   GET /api/teams
 * @desc    Get all teams
 * @access  Authenticated users (contractors see only their teams)
 */
router.get('/', authenticate, asyncHandler(getAllTeams));

/**
 * @route   GET /api/teams/:id
 * @desc    Get team by ID
 * @access  Authenticated users (contractors see only their teams)
 */
router.get('/:id', authenticate, asyncHandler(getTeamById));

/**
 * @route   POST /api/teams
 * @desc    Create new team
 * @access  Admin only
 */
router.post('/', authenticate, authorize(UserRole.ADMIN), asyncHandler(createTeam));

/**
 * @route   POST /api/teams/:id/members
 * @desc    Add team members to project
 * @access  Admin only
 */
router.post('/:id/members', authenticate, authorize(UserRole.ADMIN), asyncHandler(addTeamMembers));

/**
 * @route   PUT /api/teams/:id
 * @desc    Update team (Admin can update all, Contractors can update their own team members)
 * @access  Authenticated users
 */
router.put('/:id', authenticate, asyncHandler(updateTeam));

/**
 * @route   DELETE /api/teams/:id
 * @desc    Delete team
 * @access  Admin only
 */
router.delete('/:id', authenticate, authorize(UserRole.ADMIN), asyncHandler(deleteTeam));

export default router;

