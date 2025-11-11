import { Response } from 'express';
import { Project, ProjectStatus } from '../models/Project';
import { AuthRequest } from '../middleware/auth';
import { NotFoundError, ValidationError } from '../utils/errors';
import { User, UserRole } from '../models/User';

/**
 * Get all projects
 */
export const getAllProjects = async (req: AuthRequest, res: Response): Promise<void> => {
  const { status, contractorId, adminId } = req.query;

  const filter: any = {};
  if (status) filter.status = status;
  if (contractorId) filter.contractorId = contractorId;
  if (adminId) filter.adminId = adminId;

  // Contractors can only see their assigned projects
  if (req.user?.role === UserRole.CONTRACTOR) {
    filter.contractorId = req.user.id;
  }

  const projects = await Project.find(filter)
    .populate('adminId', 'name email')
    .populate('contractorId', 'name email role')
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    data: projects,
    count: projects.length
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

