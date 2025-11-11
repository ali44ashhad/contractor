import { Response } from 'express';
import { Team, ITeamMember } from '../models/Team';
import { Project } from '../models/Project';
import { User, UserRole } from '../models/User';
import { AuthRequest } from '../middleware/auth';
import { NotFoundError, ValidationError } from '../utils/errors';

/**
 * Get all teams
 */
export const getAllTeams = async (req: AuthRequest, res: Response): Promise<void> => {
  const { projectId, contractorId } = req.query;

  const filter: any = {};
  if (projectId) filter.projectId = projectId;
  if (contractorId) filter.contractorId = contractorId;

  // Contractors can only see their own teams
  if (req.user?.role === UserRole.CONTRACTOR) {
    filter.contractorId = req.user.id;
  }

  const teams = await Team.find(filter)
    .populate('projectId', 'name description')
    .populate('contractorId', 'name email role')
    .populate('createdBy', 'name email')
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    data: teams,
    count: teams.length
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
    .populate('createdBy', 'name email');

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

  if (members && !Array.isArray(members)) {
    throw new ValidationError('Members must be provided as an array');
  }

  if (members) {
    members.forEach((member: ITeamMember) => {
      if (!member.name || !member.role) {
        throw new ValidationError('Each member must have name and role');
      }
    });
  }

  const team = await Team.create({
    projectId,
    contractorId,
    teamName,
    members: members || [],
    createdBy: req.user.id
  });

  const populatedTeam = await Team.findById(team._id)
    .populate('projectId', 'name description')
    .populate('contractorId', 'name email role')
    .populate('createdBy', 'name email');

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

  // Validate each member has required fields
  for (const member of members) {
    if (!member.name || !member.role) {
      throw new ValidationError('Each member must have name and role');
    }
  }

  const team = await Team.findById(id);
  if (!team) {
    throw new NotFoundError('Team');
  }

  // Add new members to existing members
  team.members.push(...members);
  await team.save();

  const populatedTeam = await Team.findById(team._id)
    .populate('projectId', 'name description')
    .populate('contractorId', 'name email role')
    .populate('createdBy', 'name email');

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
    if (members) {
      if (!Array.isArray(members)) {
        throw new ValidationError('Members must be provided as an array');
      }
      members.forEach((member: ITeamMember) => {
        if (!member.name || !member.role) {
          throw new ValidationError('Each member must have name and role');
        }
      });
      team.members = members;
    }
  } else {
    // Admin can update everything
    if (teamName) team.teamName = teamName;
    if (members) {
      if (!Array.isArray(members)) {
        throw new ValidationError('Members must be provided as an array');
      }
      members.forEach((member: ITeamMember) => {
        if (!member.name || !member.role) {
          throw new ValidationError('Each member must have name and role');
        }
      });
      team.members = members;
    }
  }

  await team.save();

  const populatedTeam = await Team.findById(team._id)
    .populate('projectId', 'name description')
    .populate('contractorId', 'name email role')
    .populate('createdBy', 'name email');

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

