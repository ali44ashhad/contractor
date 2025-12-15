import { Response } from 'express';
import { Types } from 'mongoose';
import { Project, ProjectStatus } from '../models/Project';
import { Update } from '../models/Update';
import { ProjectRequest, RequestStatus } from '../models/ProjectRequest';
import { User, UserRole } from '../models/User';
import { AuthRequest } from '../middleware/auth';

/**
 * Get dashboard statistics/KPIs (Admin only)
 */
export const getDashboardStats = async (req: AuthRequest, res: Response): Promise<void> => {
  // Calculate start of today
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  startOfToday.setMilliseconds(0);

  // Calculate end of today
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  // Total Projects
  const totalProjects = await Project.countDocuments();

  // Updates Today - count updates created today (using timestamp field)
  const updatesToday = await Update.countDocuments({
    timestamp: {
      $gte: startOfToday,
      $lte: endOfToday
    }
  });

  // Active Contractors - count distinct contractors who have at least one project with status IN_PROGRESS
  const activeProjects = await Project.find({
    status: ProjectStatus.IN_PROGRESS,
    contractorId: { $ne: null }
  }).select('contractorId');

  const activeContractorIds = new Set(
    activeProjects
      .map((p) => p.contractorId?.toString())
      .filter((id): id is string => id !== undefined)
  );

  const activeContractors = activeContractorIds.size;

  // Pending Requests
  const pendingRequests = await ProjectRequest.countDocuments({
    status: RequestStatus.PENDING
  });

  res.status(200).json({
    success: true,
    data: {
      totalProjects,
      updatesToday,
      activeContractors,
      pendingRequests
    }
  });
};

/**
 * Get recent updates for dashboard (Admin only)
 */
export const getRecentUpdates = async (req: AuthRequest, res: Response): Promise<void> => {
  const limit = parseInt(req.query.limit as string) || 8;

  const updates = await Update.find()
    .populate('projectId', 'name description')
    .populate('contractorId', 'name email role')
    .populate('postedBy', 'name email role')
    .sort({ timestamp: -1 })
    .limit(limit);

  // Transform updates to match frontend RecentUpdate interface
  const recentUpdates = updates.map((update) => {
    const project = update.projectId as any;
    const contractor = update.contractorId as any;
    const postedBy = update.postedBy as any;

    // Get first document image URL if available
    const firstDocument = update.documents && update.documents.length > 0 ? update.documents[0] : null;
    const imageUrl = firstDocument?.filePath || 'https://placehold.co/400/300/cccccc/000000?text=No+Image';

    // Get coordinates from first document if available
    const lat = firstDocument?.latitude;
    const lng = firstDocument?.longitude;

    return {
      _id: (update._id as Types.ObjectId).toString(),
      imageUrl,
      contractorName: contractor?.name || 'Unknown Contractor',
      projectName: project?.name || 'Unknown Project',
      projectId: project?._id?.toString() || '',
      description: update.updateDescription || '',
      updateType: update.updateType === 'morning' ? 'morning' : 'evening',
      timestamp: update.timestamp.toISOString(),
      status: update.status || 'pending',
      lat,
      lng
    };
  });

  res.status(200).json({
    success: true,
    data: recentUpdates,
    count: recentUpdates.length
  });
};

