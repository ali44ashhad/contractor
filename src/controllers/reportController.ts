import { Response } from 'express';
import { Report, ReportType } from '../models/Report';
import { Project } from '../models/Project';
import { DocumentType, Update, UpdateType } from '../models/Update';
import { AuthRequest } from '../middleware/auth';
import { NotFoundError, ValidationError, ForbiddenError } from '../utils/errors';
import { UserRole } from '../models/User';
import { Team } from '../models/Team';
import { Types } from 'mongoose';

const flattenUpdateDocuments = (updates: any[]) =>
  updates.flatMap((updateDoc: any) =>
    updateDoc.documents.map((doc: any) => {
      const docObject = typeof doc?.toObject === 'function' ? doc.toObject() : doc;
      return {
        ...docObject,
        projectId: updateDoc.projectId,
        updateId: updateDoc._id
      };
    })
  );

/**
 * Get all reports (Accounts only)
 */
export const getAllReports = async (req: AuthRequest, res: Response): Promise<void> => {
  const { projectId, type } = req.query;

  const filter: any = {};
  if (projectId) filter.projectId = projectId;
  if (type) filter.type = type;

  const reports = await Report.find(filter)
    .populate('projectId', 'name description')
    .populate('generatedBy', 'name email')
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    data: reports,
    count: reports.length
  });
};

/**
 * Get report by ID (Accounts only)
 */
export const getReportById = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  const report = await Report.findById(id)
    .populate('projectId', 'name description')
    .populate('generatedBy', 'name email');

  if (!report) {
    throw new NotFoundError('Report');
  }

  res.status(200).json({
    success: true,
    data: report
  });
};

/**
 * Generate report (Accounts only)
 */
export const generateReport = async (req: AuthRequest, res: Response): Promise<void> => {
  const { projectId, type, title, description, filePath } = req.body;

  if (!type || !title) {
    throw new ValidationError('Report type and title are required');
  }

  if (!req.user) {
    throw new ValidationError('User information is required');
  }

  // Validate project if provided
  if (projectId) {
    const project = await Project.findById(projectId);
    if (!project) {
      throw new NotFoundError('Project');
    }
  }

  // Generate report data based on type
  let reportData: Record<string, any> = {};

  if (projectId) {
    // Project-specific report
    const project = await Project.findById(projectId)
      .populate('adminId', 'name email')
      .populate('contractorId', 'name email role');

    const updates = await Update.find({ projectId })
      .populate('contractorId', 'name email role')
      .populate('documents.uploadedBy', 'name email role');
    const documents = flattenUpdateDocuments(updates);

    switch (type) {
      case ReportType.FINANCIAL:
        reportData = {
          project: {
            id: project?._id,
            name: project?.name,
            budget: project?.budget
          },
          documents: documents.filter(
            doc => doc.type === DocumentType.REQUIREMENT || doc.type === DocumentType.OTHER
          ),
          summary: {
            totalDocuments: documents.length,
            totalBudget: project?.budget || 0
          }
        };
        break;

      case ReportType.PROGRESS:
        reportData = {
          project: {
            id: project?._id,
            name: project?.name,
            status: project?.status
          },
          statusDocuments: documents.filter(doc => doc.type === DocumentType.STATUS),
          summary: {
            statusDocuments: documents.filter(doc => doc.type === DocumentType.STATUS).length,
            totalDocuments: documents.length
          }
        };
        break;

      case ReportType.SUMMARY:
        reportData = {
          project: project,
          documents: documents,
          summary: {
            totalDocuments: documents.length,
            byType: {
              requirement: documents.filter(doc => doc.type === DocumentType.REQUIREMENT).length,
              status: documents.filter(doc => doc.type === DocumentType.STATUS).length,
              other: documents.filter(doc => doc.type === DocumentType.OTHER).length
            }
          }
        };
        break;

      default:
        reportData = {
          project: project,
          documents: documents
        };
    }
  } else {
    // General report (all projects)
    const projects = await Project.find()
      .populate('adminId', 'name email')
      .populate('contractorId', 'name email role');

    const updates = await Update.find()
      .populate('projectId', 'name description')
      .populate('contractorId', 'name email role')
      .populate('documents.uploadedBy', 'name email role');
    const allDocuments = flattenUpdateDocuments(updates);

    reportData = {
      totalProjects: projects.length,
      projects: projects,
      totalDocuments: allDocuments.length,
      documents: allDocuments,
      summary: {
        projectsByStatus: {
          planning: projects.filter(p => p.status === 'planning').length,
          in_progress: projects.filter(p => p.status === 'in_progress').length,
          on_hold: projects.filter(p => p.status === 'on_hold').length,
          completed: projects.filter(p => p.status === 'completed').length,
          cancelled: projects.filter(p => p.status === 'cancelled').length
        },
        documentsByType: {
          requirement: allDocuments.filter(doc => doc.type === DocumentType.REQUIREMENT).length,
          status: allDocuments.filter(doc => doc.type === DocumentType.STATUS).length,
          other: allDocuments.filter(doc => doc.type === DocumentType.OTHER).length
        }
      }
    };
  }

  const report = await Report.create({
    projectId: projectId || null,
    generatedBy: req.user.id,
    type,
    title,
    data: reportData,
    filePath,
    description
  });

  const populatedReport = await Report.findById(report._id)
    .populate('projectId', 'name description')
    .populate('generatedBy', 'name email');

  res.status(201).json({
    success: true,
    data: populatedReport,
    message: 'Report generated successfully'
  });
};

/**
 * Update report (Accounts only)
 */
export const updateReport = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { title, description, filePath } = req.body;

  const report = await Report.findById(id);
  if (!report) {
    throw new NotFoundError('Report');
  }

  // Only the creator or admin can update
  if (req.user?.role !== UserRole.ADMIN && report.generatedBy.toString() !== req.user?.id) {
    throw new ForbiddenError('You can only update your own reports');
  }

  if (title) report.title = title;
  if (description !== undefined) report.description = description;
  if (filePath) report.filePath = filePath;

  await report.save();

  const populatedReport = await Report.findById(report._id)
    .populate('projectId', 'name description')
    .populate('generatedBy', 'name email');

  res.status(200).json({
    success: true,
    data: populatedReport,
    message: 'Report updated successfully'
  });
};

/**
 * Delete report (Accounts only)
 */
export const deleteReport = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  const report = await Report.findById(id);
  if (!report) {
    throw new NotFoundError('Report');
  }

  // Only the creator or admin can delete
  if (req.user?.role !== UserRole.ADMIN && report.generatedBy.toString() !== req.user?.id) {
    throw new ForbiddenError('You can only delete your own reports');
  }

  await Report.findByIdAndDelete(id);

  res.status(200).json({
    success: true,
    message: 'Report deleted successfully'
  });
};

/**
 * Normalize date to start of day in UTC
 * This ensures consistent date handling regardless of server timezone
 */
const normalizeDate = (date: Date): Date => {
  const normalized = new Date(date);
  // Use UTC methods to avoid timezone issues
  normalized.setUTCHours(0, 0, 0, 0);
  return normalized;
};

/**
 * Get project report with team members and updates (Admin only)
 */
export const getProjectReport = async (req: AuthRequest, res: Response): Promise<void> => {
  const { projectId } = req.params;
  const { startDate, endDate } = req.query;

  if (!Types.ObjectId.isValid(projectId)) {
    throw new ValidationError('Invalid project ID format');
  }

  // Verify project exists
  const project = await Project.findById(projectId)
    .populate('adminId', 'name email')
    .populate('contractorId', 'name email role');

  if (!project) {
    throw new NotFoundError('Project');
  }

  // Validate date range
  if (!startDate || !endDate) {
    throw new ValidationError('Start date and end date are required');
  }

  // Parse dates as UTC to avoid timezone issues
  // Date strings in YYYY-MM-DD format are interpreted as UTC midnight
  const start = normalizeDate(new Date(startDate as string + 'T00:00:00.000Z'));
  const end = normalizeDate(new Date(endDate as string + 'T00:00:00.000Z'));
  end.setUTCHours(23, 59, 59, 999); // End of day in UTC

  if (start > end) {
    throw new ValidationError('Start date must be before or equal to end date');
  }

  // Validate dates against project dates
  if (project.startDate) {
    const projectStart = normalizeDate(new Date(project.startDate));
    if (start < projectStart) {
      throw new ValidationError(
        `Report start date cannot be before project start date (${projectStart.toISOString().split('T')[0]})`
      );
    }
  }

  if (project.endDate) {
    const projectEnd = normalizeDate(new Date(project.endDate));
    projectEnd.setUTCHours(23, 59, 59, 999);
    if (end > projectEnd) {
      throw new ValidationError(
        `Report end date cannot be after project deadline (${projectEnd.toISOString().split('T')[0]})`
      );
    }
  }

  // Debug logging
  console.log('Report Query:', {
    projectId,
    startDate: startDate,
    endDate: endDate,
    normalizedStart: start.toISOString(),
    normalizedEnd: end.toISOString()
  });

  // Get all teams for this project
  const teams = await Team.find({ projectId: new Types.ObjectId(projectId) })
    .populate('contractorId', 'name email role phone')
    .populate('members', 'name email role phone')
    .populate('createdBy', 'name email');

  // Fetch all updates directly for this project in the date range
  // Note: updateDate might be stored with time component, so we query with full day range
  // We use $gte and $lte to ensure we capture all updates for the date range
  const updates = await Update.find({
    projectId: new Types.ObjectId(projectId),
    updateDate: {
      $gte: start,
      $lte: end
    }
  })
    .populate('projectId', 'name description')
    .populate('contractorId', 'name email role')
    .populate('postedBy', 'name email role')
    .populate('documents.uploadedBy', 'name email role')
    .sort({ updateDate: -1, timestamp: -1 });

  // Get all unique members with their details
  const memberDetailsMap = new Map<string, any>();
  
  // Add members from teams
  teams.forEach(team => {
    if (team.contractorId) {
      const contractorId = typeof team.contractorId === 'object' && team.contractorId !== null && '_id' in team.contractorId
        ? String((team.contractorId as any)._id)
        : String(team.contractorId);
      if (!memberDetailsMap.has(contractorId)) {
        memberDetailsMap.set(contractorId, team.contractorId);
      }
    }
    team.members.forEach(member => {
      const memberId = typeof member === 'object' && member !== null && '_id' in member
        ? String((member as any)._id)
        : String(member);
      if (!memberDetailsMap.has(memberId)) {
        memberDetailsMap.set(memberId, member);
      }
    });
  });

  // Add project contractor if exists
  if (project.contractorId) {
    const contractorId = typeof project.contractorId === 'object' && project.contractorId !== null && '_id' in project.contractorId
      ? String((project.contractorId as any)._id)
      : String(project.contractorId);
    if (!memberDetailsMap.has(contractorId)) {
      memberDetailsMap.set(contractorId, project.contractorId);
    }
  }

  // Add all users who posted updates (even if not in teams)
  updates.forEach(update => {
    if (update.postedBy) {
      const postedById = typeof update.postedBy === 'object' && update.postedBy !== null && '_id' in update.postedBy
        ? String((update.postedBy as any)._id)
        : String(update.postedBy);
      if (!memberDetailsMap.has(postedById)) {
        // User details are already populated from the query
        const userRef = typeof update.postedBy === 'object' ? update.postedBy : null;
        if (userRef) {
          memberDetailsMap.set(postedById, userRef);
        }
      }
    }
  });

  const members = Array.from(memberDetailsMap.values());

  // Group updates by date and member
  const updatesByDate: Record<string, Record<string, { morning: any | null; evening: any | null }>> = {};

  // Process updates directly
  updates.forEach(update => {
    // Normalize update date to UTC start of day for consistent date key
    const updateDateNormalized = normalizeDate(update.updateDate);
    const dateKey = updateDateNormalized.toISOString().split('T')[0];
    const postedById = typeof update.postedBy === 'object' && update.postedBy !== null && '_id' in update.postedBy
      ? String((update.postedBy as any)._id)
      : String(update.postedBy);

    if (!updatesByDate[dateKey]) {
      updatesByDate[dateKey] = {};
    }

    if (!updatesByDate[dateKey][postedById]) {
      updatesByDate[dateKey][postedById] = { morning: null, evening: null };
    }

    // Set the update based on its type (if there's already an update, keep the existing one)
    if (update.updateType === UpdateType.MORNING) {
      if (!updatesByDate[dateKey][postedById].morning) {
        updatesByDate[dateKey][postedById].morning = update;
      }
    } else if (update.updateType === UpdateType.EVENING) {
      if (!updatesByDate[dateKey][postedById].evening) {
        updatesByDate[dateKey][postedById].evening = update;
      }
    }
  });

  // Ensure all members appear for all dates in range (with null updates if no updates)
  const allDates: string[] = [];
  const currentDate = new Date(start);
  while (currentDate <= end) {
    allDates.push(normalizeDate(new Date(currentDate)).toISOString().split('T')[0]);
    currentDate.setDate(currentDate.getDate() + 1);
  }

  allDates.forEach(dateKey => {
    if (!updatesByDate[dateKey]) {
      updatesByDate[dateKey] = {};
    }
    members.forEach(member => {
      const memberId = typeof member === 'object' && member !== null && '_id' in member
        ? String((member as any)._id)
        : String(member);
      if (!updatesByDate[dateKey][memberId]) {
        updatesByDate[dateKey][memberId] = { morning: null, evening: null };
      }
    });
  });

  res.status(200).json({
    success: true,
    data: {
      project: {
        _id: project._id,
        name: project.name,
        description: project.description,
        status: project.status,
        adminId: project.adminId,
        contractorId: project.contractorId
      },
      teams: teams,
      members: members,
      updatesByDate: updatesByDate
    }
  });
};

