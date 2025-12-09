import { Response } from 'express';
import { Team } from '../models/Team';
import { Project } from '../models/Project';
import { User, UserRole, IUser } from '../models/User';
import { AuthRequest } from '../middleware/auth';
import { NotFoundError, ValidationError } from '../utils/errors';
import mongoose from 'mongoose';

/**
 * Allowed roles for team members
 */
const ALLOWED_MEMBER_ROLES = [
  UserRole.DEVELOPER,
  UserRole.CONTRACTOR,
  UserRole.MEMBER,
  UserRole.ACCOUNTS
];

/**
 * Validate member user IDs and return validated user documents
 */
const validateMemberUserIds = async (
  memberIds: (string | mongoose.Types.ObjectId)[]
): Promise<mongoose.Types.ObjectId[]> => {
  if (!Array.isArray(memberIds) || memberIds.length === 0) {
    throw new ValidationError('Members must be provided as a non-empty array');
  }

  // Check for duplicates
  const uniqueIds = [...new Set(memberIds.map(id => id.toString()))];
  if (uniqueIds.length !== memberIds.length) {
    throw new ValidationError('Duplicate member IDs are not allowed');
  }

  // Validate ObjectIds
  const validObjectIds = uniqueIds
    .map(id => {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ValidationError(`Invalid member ID format: ${id}`);
      }
      return new mongoose.Types.ObjectId(id);
    });

  // Find all users
  const users: IUser[] = await User.find({
    _id: { $in: validObjectIds },
    isActive: true
  });

  // Check all IDs were found
  if (users.length !== validObjectIds.length) {
    const foundIds = users.map((u: IUser) => String(u._id));
    const missingIds = validObjectIds
      .map(id => id.toString())
      .filter(id => !foundIds.includes(id));
    throw new ValidationError(`Users not found: ${missingIds.join(', ')}`);
  }

  // Check all users have allowed roles
  const invalidRoleUsers = users.filter(
    user => !ALLOWED_MEMBER_ROLES.includes(user.role)
  );
  if (invalidRoleUsers.length > 0) {
    const invalidRoles = invalidRoleUsers.map(u => `${u.email} (${u.role})`);
    throw new ValidationError(
      `Users with invalid roles for team membership: ${invalidRoles.join(', ')}`
    );
  }

  return validObjectIds;
};

/**
 * Get all teams
 */
export const getAllTeams = async (req: AuthRequest, res: Response): Promise<void> => {
  const { projectId, contractorId, page, limit } = req.query;

  const filter: any = {};
  if (projectId) filter.projectId = projectId;
  if (contractorId) filter.contractorId = contractorId;

  // Contractors can only see their own teams
  if (req.user?.role === UserRole.CONTRACTOR) {
    filter.contractorId = req.user.id;
  }

  // Pagination parameters
  const pageNum = parseInt(page as string) || 1;
  const limitNum = parseInt(limit as string) || 10;
  const skip = (pageNum - 1) * limitNum;

  // Get total count for pagination metadata
  const total = await Team.countDocuments(filter);

  const teams = await Team.find(filter)
    .populate('projectId', 'name description')
    .populate('contractorId', 'name email role')
    .populate('createdBy', 'name email')
    .populate('members', 'name email role phone')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limitNum);

  const totalPages = Math.ceil(total / limitNum);

  res.status(200).json({
    success: true,
    data: teams,
    count: teams.length,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages
    }
  });
};

/**
 * Get team by ID
 */
export const getTeamById = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  const team = await Team.findById(id)
    .populate('projectId', 'name description')
    .populate('contractorId', 'name email role')
    .populate('createdBy', 'name email')
    .populate('members', 'name email role phone');

  if (!team) {
    throw new NotFoundError('Team');
  }

  // Contractors can only see their own teams
  if (req.user?.role === UserRole.CONTRACTOR) {
    if (team.contractorId.toString() !== req.user.id) {
      throw new NotFoundError('Team');
    }
  }

  res.status(200).json({
    success: true,
    data: team
  });
};

/**
 * Create new team (Admin only)
 */
export const createTeam = async (req: AuthRequest, res: Response): Promise<void> => {
  const { projectId, contractorId, teamName, members } = req.body;

  if (!projectId || !contractorId || !teamName) {
    throw new ValidationError('Project ID, contractor ID, and team name are required');
  }

  if (!req.user) {
    throw new ValidationError('User information is required');
  }

  // Validate project exists
  const project = await Project.findById(projectId);
  if (!project) {
    throw new NotFoundError('Project');
  }

  // Validate contractor user exists
  const contractorUser = await User.findOne({
    _id: contractorId,
    role: UserRole.CONTRACTOR
  });
  if (!contractorUser) {
    throw new ValidationError('Invalid contractor user');
  }

  // Validate and process member user IDs
  let memberUserIds: mongoose.Types.ObjectId[] = [];
  if (members) {
    memberUserIds = await validateMemberUserIds(members);
  }

  const team = await Team.create({
    projectId,
    contractorId,
    teamName,
    members: memberUserIds,
    createdBy: req.user.id
  });

  const populatedTeam = await Team.findById(team._id)
    .populate('projectId', 'name description')
    .populate('contractorId', 'name email role')
    .populate('createdBy', 'name email')
    .populate('members', 'name email role phone');

  res.status(201).json({
    success: true,
    data: populatedTeam,
    message: 'Team created successfully'
  });
};

/**
 * Add team members to project (Admin only)
 */
export const addTeamMembers = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { members } = req.body;

  if (!members || !Array.isArray(members) || members.length === 0) {
    throw new ValidationError('Members array is required and must not be empty');
  }

  const team = await Team.findById(id);
  if (!team) {
    throw new NotFoundError('Team');
  }

  // Validate new member user IDs
  const newMemberUserIds = await validateMemberUserIds(members);

  // Check for duplicates with existing team members
  const existingMemberIds = team.members.map(m => m.toString());
  const duplicateIds = newMemberUserIds
    .map(id => id.toString())
    .filter(id => existingMemberIds.includes(id));

  if (duplicateIds.length > 0) {
    throw new ValidationError(
      `Members already in team: ${duplicateIds.join(', ')}`
    );
  }

  // Add new members to existing members
  team.members.push(...newMemberUserIds);
  await team.save();

  const populatedTeam = await Team.findById(team._id)
    .populate('projectId', 'name description')
    .populate('contractorId', 'name email role')
    .populate('createdBy', 'name email')
    .populate('members', 'name email role phone');

  res.status(200).json({
    success: true,
    data: populatedTeam,
    message: 'Team members added successfully'
  });
};

/**
 * Update team (Admin only, Contractors can update their own team details)
 */
export const updateTeam = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { teamName, members } = req.body;

  const team = await Team.findById(id);
  if (!team) {
    throw new NotFoundError('Team');
  }

  // Contractors can only update team members, not team name or structure
  if (req.user?.role === UserRole.CONTRACTOR) {
    if (team.contractorId.toString() !== req.user.id) {
      throw new NotFoundError('Team');
    }
    // Only allow updating members for contractors
    if (members !== undefined) {
      const memberUserIds = await validateMemberUserIds(members);
      team.members = memberUserIds;
    }
  } else {
    // Admin can update everything
    if (teamName) team.teamName = teamName;
    if (members !== undefined) {
      const memberUserIds = await validateMemberUserIds(members);
      team.members = memberUserIds;
    }
  }

  await team.save();

  const populatedTeam = await Team.findById(team._id)
    .populate('projectId', 'name description')
    .populate('contractorId', 'name email role')
    .populate('createdBy', 'name email')
    .populate('members', 'name email role phone');

  res.status(200).json({
    success: true,
    data: populatedTeam,
    message: 'Team updated successfully'
  });
};

/**
 * Delete team (Admin only)
 */
export const deleteTeam = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  const team = await Team.findByIdAndDelete(id);

  if (!team) {
    throw new NotFoundError('Team');
  }

  res.status(200).json({
    success: true,
    message: 'Team deleted successfully'
  });
};

