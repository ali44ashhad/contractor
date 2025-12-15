import { Response } from 'express';
import { Attendance } from '../models/Attendance';
import { AuthRequest } from '../middleware/auth';
import { NotFoundError, ValidationError } from '../utils/errors';
import { UserRole } from '../models/User';
import { Types } from 'mongoose';
import { Project } from '../models/Project';
import { Team } from '../models/Team';

/**
 * Normalize date to start of day
 */
const normalizeDate = (date: Date): Date => {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
};

/**
 * Get attendance records with filters
 */
export const getAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  const { userId, projectId, startDate, endDate } = req.query;

  const filter: any = {};

  if (userId) {
    if (!Types.ObjectId.isValid(userId as string)) {
      throw new ValidationError('Invalid user ID format');
    }
    filter.userId = userId;
  }

  if (projectId) {
    if (!Types.ObjectId.isValid(projectId as string)) {
      throw new ValidationError('Invalid project ID format');
    }
    filter.projectId = projectId;
  }

  // Date range filter
  if (startDate || endDate) {
    filter.date = {};
    if (startDate) {
      const start = normalizeDate(new Date(startDate as string));
      filter.date.$gte = start;
    }
    if (endDate) {
      const end = normalizeDate(new Date(endDate as string));
      end.setHours(23, 59, 59, 999); // End of day
      filter.date.$lte = end;
    }
  }

  // Contractors and members can only see attendance for their projects
  if (req.user?.role === UserRole.CONTRACTOR || req.user?.role === UserRole.MEMBER) {
    const teams = await Team.find({
      $or: [
        { contractorId: req.user.id },
        { members: req.user.id }
      ]
    });
    const projectIds = teams.map(t => t.projectId.toString());
    
    const projects = await Project.find({
      $or: [
        { contractorId: req.user.id },
        { _id: { $in: projectIds } }
      ]
    });
    const allProjectIds = projects.map((p) => (p._id as Types.ObjectId).toString());
    
    if (filter.projectId) {
      // If specific project requested, verify access
      if (!allProjectIds.includes(filter.projectId as string)) {
        throw new NotFoundError('Project');
      }
    } else {
      filter.projectId = { $in: allProjectIds };
    }
  }

  const attendance = await Attendance.find(filter)
    .populate('userId', 'name email role')
    .populate('projectId', 'name description')
    .populate('morningUpdateId', 'updateType timestamp updateDescription')
    .populate('eveningUpdateId', 'updateType timestamp updateDescription')
    .sort({ date: -1 });

  res.status(200).json({
    success: true,
    data: attendance,
    count: attendance.length
  });
};

/**
 * Get attendance for specific user
 */
export const getUserAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  const { userId } = req.params;
  const { projectId, startDate, endDate } = req.query;

  if (!Types.ObjectId.isValid(userId)) {
    throw new ValidationError('Invalid user ID format');
  }

  // Users can only see their own attendance unless admin
  if (req.user?.role !== UserRole.ADMIN && req.user?.id !== userId) {
    throw new NotFoundError('Attendance');
  }

  const filter: any = { userId };

  if (projectId) {
    if (!Types.ObjectId.isValid(projectId as string)) {
      throw new ValidationError('Invalid project ID format');
    }
    filter.projectId = projectId;
  }

  if (startDate || endDate) {
    filter.date = {};
    if (startDate) {
      const start = normalizeDate(new Date(startDate as string));
      filter.date.$gte = start;
    }
    if (endDate) {
      const end = normalizeDate(new Date(endDate as string));
      end.setHours(23, 59, 59, 999);
      filter.date.$lte = end;
    }
  }

  const attendance = await Attendance.find(filter)
    .populate('userId', 'name email role')
    .populate('projectId', 'name description')
    .populate('morningUpdateId', 'updateType timestamp updateDescription')
    .populate('eveningUpdateId', 'updateType timestamp updateDescription')
    .sort({ date: -1 });

  res.status(200).json({
    success: true,
    data: attendance,
    count: attendance.length
  });
};

/**
 * Get attendance for all team members in a project
 */
export const getProjectAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  const { projectId } = req.params;
  const { startDate, endDate } = req.query;

  if (!Types.ObjectId.isValid(projectId)) {
    throw new ValidationError('Invalid project ID format');
  }

  // Verify project exists
  const project = await Project.findById(projectId);
  if (!project) {
    throw new NotFoundError('Project');
  }

  // Check access permissions
  if (req.user?.role === UserRole.CONTRACTOR || req.user?.role === UserRole.MEMBER) {
    const team = await Team.findOne({
      projectId: new Types.ObjectId(projectId),
      $or: [
        { contractorId: req.user.id },
        { members: req.user.id }
      ]
    });

    if (!team && project.contractorId?.toString() !== req.user.id) {
      throw new NotFoundError('Project');
    }
  }

  const filter: any = { projectId };

  if (startDate || endDate) {
    filter.date = {};
    if (startDate) {
      const start = normalizeDate(new Date(startDate as string));
      filter.date.$gte = start;
    }
    if (endDate) {
      const end = normalizeDate(new Date(endDate as string));
      end.setHours(23, 59, 59, 999);
      filter.date.$lte = end;
    }
  }

  const attendance = await Attendance.find(filter)
    .populate('userId', 'name email role phone')
    .populate('projectId', 'name description')
    .populate('morningUpdateId', 'updateType timestamp updateDescription')
    .populate('eveningUpdateId', 'updateType timestamp updateDescription')
    .sort({ date: -1, userId: 1 });

  res.status(200).json({
    success: true,
    data: attendance,
    count: attendance.length
  });
};

