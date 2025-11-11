import { Response } from 'express';
import { Report, ReportType } from '../models/Report';
import { Project } from '../models/Project';
import { Document } from '../models/Document';
import { AuthRequest } from '../middleware/auth';
import { NotFoundError, ValidationError, ForbiddenError } from '../utils/errors';
import { UserRole } from '../models/User';

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

    const documents = await Document.find({ projectId })
      .populate('uploadedBy', 'name email role');

    switch (type) {
      case ReportType.FINANCIAL:
        reportData = {
          project: {
            id: project?._id,
            name: project?.name,
            budget: project?.budget
          },
          documents: documents.filter(doc => doc.type === 'requirement' || doc.type === 'other'),
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
          statusDocuments: documents.filter(doc => doc.type === 'status'),
          summary: {
            statusDocuments: documents.filter(doc => doc.type === 'status').length,
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
              requirement: documents.filter(doc => doc.type === 'requirement').length,
              status: documents.filter(doc => doc.type === 'status').length,
              other: documents.filter(doc => doc.type === 'other').length
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

    const allDocuments = await Document.find()
      .populate('uploadedBy', 'name email role');

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
          requirement: allDocuments.filter(doc => doc.type === 'requirement').length,
          status: allDocuments.filter(doc => doc.type === 'status').length,
          other: allDocuments.filter(doc => doc.type === 'other').length
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

