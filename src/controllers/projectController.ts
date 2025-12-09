import { Response } from 'express';
import { Project, ProjectStatus } from '../models/Project';
import { ProjectRequest, RequestStatus } from '../models/ProjectRequest';
import { AuthRequest } from '../middleware/auth';
import { NotFoundError, ValidationError } from '../utils/errors';
import { User, UserRole } from '../models/User';
import { Team } from '../models/Team';
import { Types } from 'mongoose';

/**
 * Check if project has pending requests
 */
const hasPendingRequests = async (projectId: string): Promise<boolean> => {
  const pendingRequest = await ProjectRequest.findOne({
    projectId: new Types.ObjectId(projectId),
    status: RequestStatus.PENDING
  });
  return !!pendingRequest;
};

/**
 * Get all projects
 */
export const getAllProjects = async (req: AuthRequest, res: Response): Promise<void> => {
  const { status, contractorId, adminId, page, limit } = req.query;

  const filter: any = {};
  if (status) filter.status = status;
  if (contractorId) filter.contractorId = contractorId;
  if (adminId) filter.adminId = adminId;

  // Contractors can only see their assigned projects
  if (req.user?.role === UserRole.CONTRACTOR) {
    filter.contractorId = req.user.id;
  }

  // Members can only see projects they are enrolled in through teams
  if (req.user?.role === UserRole.MEMBER) {
    const teams = await Team.find({
      members: req.user.id
    });
    const projectIds = teams.map(t => t.projectId.toString());
    
    if (projectIds.length === 0) {
      // Member is not in any teams, return empty array with pagination
      res.status(200).json({
        success: true,
        data: [],
        count: 0,
        pagination: {
          page: 1,
          limit: parseInt(limit as string) || 10,
          total: 0,
          totalPages: 0
        }
      });
      return;
    }
    
    filter._id = { $in: projectIds.map(id => new Types.ObjectId(id)) };
  }

  // Pagination parameters
  const pageNum = parseInt(page as string) || 1;
  const limitNum = parseInt(limit as string) || 10;
  const skip = (pageNum - 1) * limitNum;

  // Get total count for pagination metadata
  const total = await Project.countDocuments(filter);

  const projects = await Project.find(filter)
    .populate('adminId', 'name email')
    .populate('contractorId', 'name email role')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limitNum);

  const totalPages = Math.ceil(total / limitNum);

  res.status(200).json({
    success: true,
    data: projects,
    count: projects.length,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages
    }
  });
};

/**
 * Get project by ID
 */
export const getProjectById = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  const project = await Project.findById(id);

  if (!project) {
    throw new NotFoundError('Project');
  }

  // Contractors can only see their assigned projects
  if (req.user?.role === UserRole.CONTRACTOR) {
    if (!project.contractorId || project.contractorId.toString() !== req.user.id) {
      throw new NotFoundError('Project');
    }
  }

  // Members can only see projects they are enrolled in through teams
  if (req.user?.role === UserRole.MEMBER) {
    const team = await Team.findOne({
      projectId: new Types.ObjectId(id),
      members: req.user.id
    });

    if (!team) {
      throw new NotFoundError('Project');
    }
  }

  await project.populate([
    { path: 'adminId', select: 'name email' },
    { path: 'contractorId', select: 'name email role' }
  ]);

  res.status(200).json({
    success: true,
    data: project
  });
};

/**
 * Create new project (Admin only)
 */
export const createProject = async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, description, contractorId, status, startDate, endDate, budget, location } = req.body;

  if (!name || !description) {
    throw new ValidationError('Project name and description are required');
  }

  if (!req.user) {
    throw new ValidationError('User information is required');
  }

  // Validate contractor if provided
  if (contractorId) {
    const contractorUser = await User.findOne({
      _id: contractorId,
      role: UserRole.CONTRACTOR
    });
    if (!contractorUser) {
      throw new ValidationError('Invalid contractor user');
    }
  }

  const project = await Project.create({
    name,
    description,
    adminId: req.user.id,
    contractorId: contractorId || undefined,
    status: status || ProjectStatus.PLANNING,
    startDate: startDate ? new Date(startDate) : undefined,
    endDate: endDate ? new Date(endDate) : undefined,
    budget,
    location
  });

  const populatedProject = await Project.findById(project._id)
    .populate('adminId', 'name email')
    .populate('contractorId', 'name email role');

  res.status(201).json({
    success: true,
    data: populatedProject,
    message: 'Project created successfully'
  });
};

/**
 * Update project (Admin only)
 */
export const updateProject = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { name, description, contractorId, status, startDate, endDate, budget, location } = req.body;

  // Check if project exists
  const existingProject = await Project.findById(id);
  if (!existingProject) {
    throw new NotFoundError('Project');
  }

  // Check for pending requests if status is being changed
  if (status && status !== existingProject.status) {
    const hasPending = await hasPendingRequests(id);
    if (hasPending) {
      throw new ValidationError(
        'Cannot change project status while there are pending requests. Please approve or reject the requests first.'
      );
    }
  }

  // Validate contractor if provided
  if (contractorId) {
    const contractorUser = await User.findOne({
      _id: contractorId,
      role: UserRole.CONTRACTOR
    });
    if (!contractorUser) {
      throw new ValidationError('Invalid contractor user');
    }
  }

  const updateData: any = {};
  if (name) updateData.name = name;
  if (description) updateData.description = description;
  if (contractorId !== undefined) updateData.contractorId = contractorId || null;
  if (status) updateData.status = status;
  if (startDate) updateData.startDate = new Date(startDate);
  if (endDate) updateData.endDate = new Date(endDate);
  if (budget !== undefined) updateData.budget = budget;
  if (location !== undefined) updateData.location = location;

  const project = await Project.findByIdAndUpdate(
    id,
    updateData,
    { new: true, runValidators: true }
  )
    .populate('adminId', 'name email')
    .populate('contractorId', 'name email role');

  if (!project) {
    throw new NotFoundError('Project');
  }

  res.status(200).json({
    success: true,
    data: project,
    message: 'Project updated successfully'
  });
};

/**
 * Assign project to contractor (Admin only)
 */
export const assignProjectToContractor = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { contractorId } = req.body;

  if (!contractorId) {
    throw new ValidationError('Contractor ID is required');
  }

  const contractorUser = await User.findOne({
    _id: contractorId,
    role: UserRole.CONTRACTOR
  });
  if (!contractorUser) {
    throw new ValidationError('Invalid contractor user');
  }

  const project = await Project.findByIdAndUpdate(
    id,
    { contractorId },
    { new: true, runValidators: true }
  )
    .populate('adminId', 'name email')
    .populate('contractorId', 'name email role');

  if (!project) {
    throw new NotFoundError('Project');
  }

  res.status(200).json({
    success: true,
    data: project,
    message: 'Project assigned to contractor successfully'
  });
};

/**
 * Delete project (Admin only)
 */
export const deleteProject = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  const project = await Project.findByIdAndDelete(id);

  if (!project) {
    throw new NotFoundError('Project');
  }

  res.status(200).json({
    success: true,
    message: 'Project deleted successfully'
  });
};

