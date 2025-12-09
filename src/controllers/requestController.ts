import { Response } from 'express';
import { ProjectRequest, RequestType, RequestStatus } from '../models/ProjectRequest';
import { Project, ProjectStatus } from '../models/Project';
import { AuthRequest } from '../middleware/auth';
import { ForbiddenError, NotFoundError, ValidationError } from '../utils/errors';
import { UserRole } from '../models/User';
import { Types } from 'mongoose';

/**
 * Create completion request (Contractor only)
 */
export const createCompletionRequest = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  if (!req.user) {
    throw new ValidationError('User information is required');
  }

  if (req.user.role !== UserRole.CONTRACTOR) {
    throw new ForbiddenError('Only contractors can create completion requests');
  }

  const { projectId, reason } = req.body;

  if (!projectId) {
    throw new ValidationError('Project ID is required');
  }

  if (!Types.ObjectId.isValid(projectId)) {
    throw new ValidationError('Invalid project ID format');
  }

  // Verify project exists and contractor is assigned
  const project = await Project.findById(projectId);
  if (!project) {
    throw new NotFoundError('Project');
  }

  if (!project.contractorId || project.contractorId.toString() !== req.user.id) {
    throw new ForbiddenError('You can only create completion requests for projects assigned to you');
  }

  if (project.status !== ProjectStatus.IN_PROGRESS) {
    throw new ValidationError(
      `Completion requests can only be created for projects with status "in_progress". Current status: ${project.status}`
    );
  }

  // Check if there's already a pending completion request
  const existingRequest = await ProjectRequest.findOne({
    projectId: new Types.ObjectId(projectId),
    type: RequestType.COMPLETION,
    status: RequestStatus.PENDING
  });

  if (existingRequest) {
    throw new ValidationError('A pending completion request already exists for this project');
  }

  const request = await ProjectRequest.create({
    projectId: new Types.ObjectId(projectId),
    requestedBy: new Types.ObjectId(req.user.id),
    type: RequestType.COMPLETION,
    status: RequestStatus.PENDING,
    reason: reason ? reason.trim() : undefined
  });

  const populatedRequest = await ProjectRequest.findById(request._id)
    .populate('projectId', 'name description status')
    .populate('requestedBy', 'name email role')
    .populate('reviewedBy', 'name email');

  res.status(201).json({
    success: true,
    data: populatedRequest,
    message: 'Completion request created successfully'
  });
};

/**
 * Create extension request (Contractor only)
 */
export const createExtensionRequest = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  if (!req.user) {
    throw new ValidationError('User information is required');
  }

  if (req.user.role !== UserRole.CONTRACTOR) {
    throw new ForbiddenError('Only contractors can create extension requests');
  }

  const { projectId, requestedEndDate, reason } = req.body;

  if (!projectId || !requestedEndDate) {
    throw new ValidationError('Project ID and requested end date are required');
  }

  if (!Types.ObjectId.isValid(projectId)) {
    throw new ValidationError('Invalid project ID format');
  }

  // Validate requested end date
  const parsedEndDate = new Date(requestedEndDate);
  if (Number.isNaN(parsedEndDate.getTime())) {
    throw new ValidationError('Requested end date must be a valid date');
  }

  // Verify project exists and contractor is assigned
  const project = await Project.findById(projectId);
  if (!project) {
    throw new NotFoundError('Project');
  }

  if (!project.contractorId || project.contractorId.toString() !== req.user.id) {
    throw new ForbiddenError('You can only create extension requests for projects assigned to you');
  }

  if (project.status !== ProjectStatus.IN_PROGRESS) {
    throw new ValidationError(
      `Extension requests can only be created for projects with status "in_progress". Current status: ${project.status}`
    );
  }

  // Validate that requested end date is after current end date
  if (project.endDate && parsedEndDate <= project.endDate) {
    throw new ValidationError(
      'Requested end date must be after the current project end date'
    );
  }

  // Check if there's already a pending extension request
  const existingRequest = await ProjectRequest.findOne({
    projectId: new Types.ObjectId(projectId),
    type: RequestType.EXTENSION,
    status: RequestStatus.PENDING
  });

  if (existingRequest) {
    throw new ValidationError('A pending extension request already exists for this project');
  }

  const request = await ProjectRequest.create({
    projectId: new Types.ObjectId(projectId),
    requestedBy: new Types.ObjectId(req.user.id),
    type: RequestType.EXTENSION,
    status: RequestStatus.PENDING,
    requestedEndDate: parsedEndDate,
    reason: reason ? reason.trim() : undefined
  });

  const populatedRequest = await ProjectRequest.findById(request._id)
    .populate('projectId', 'name description status endDate')
    .populate('requestedBy', 'name email role')
    .populate('reviewedBy', 'name email');

  res.status(201).json({
    success: true,
    data: populatedRequest,
    message: 'Extension request created successfully'
  });
};

/**
 * Get all requests with filters
 */
export const getRequests = async (req: AuthRequest, res: Response): Promise<void> => {
  const { projectId, status, type, requestedBy, page, limit } = req.query;

  const filter: any = {};

  if (projectId) {
    if (!Types.ObjectId.isValid(projectId as string)) {
      throw new ValidationError('Invalid project ID format');
    }
    filter.projectId = projectId;
  }

  if (status) {
    if (!Object.values(RequestStatus).includes(status as RequestStatus)) {
      throw new ValidationError('Invalid request status');
    }
    filter.status = status;
  }

  if (type) {
    if (!Object.values(RequestType).includes(type as RequestType)) {
      throw new ValidationError('Invalid request type');
    }
    filter.type = type;
  }

  if (requestedBy) {
    if (!Types.ObjectId.isValid(requestedBy as string)) {
      throw new ValidationError('Invalid requested by user ID format');
    }
    filter.requestedBy = requestedBy;
  }

  // Contractors can only see their own requests
  if (req.user?.role === UserRole.CONTRACTOR) {
    filter.requestedBy = req.user.id;
  }

  // Pagination parameters
  const pageNum = parseInt(page as string) || 1;
  const limitNum = parseInt(limit as string) || 10;
  const skip = (pageNum - 1) * limitNum;

  // Get total count for pagination metadata
  const total = await ProjectRequest.countDocuments(filter);

  const requests = await ProjectRequest.find(filter)
    .populate('projectId', 'name description status endDate')
    .populate('requestedBy', 'name email role')
    .populate('reviewedBy', 'name email')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limitNum);

  const totalPages = Math.ceil(total / limitNum);

  res.status(200).json({
    success: true,
    data: requests,
    count: requests.length,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages
    }
  });
};

/**
 * Approve request (Admin only)
 */
export const approveRequest = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) {
    throw new ValidationError('User information is required');
  }

  if (req.user.role !== UserRole.ADMIN) {
    throw new ForbiddenError('Only admins can approve requests');
  }

  const { id } = req.params;
  const { approvedEndDate, adminNotes } = req.body;

  const request = await ProjectRequest.findById(id)
    .populate('projectId');
  
  if (!request) {
    throw new NotFoundError('Request');
  }

  if (request.status !== RequestStatus.PENDING) {
    throw new ValidationError(`Request is already ${request.status}`);
  }

  const project = request.projectId as any;
  if (!project) {
    throw new NotFoundError('Project');
  }

  // Update request status
  request.status = RequestStatus.APPROVED;
  request.reviewedBy = new Types.ObjectId(req.user.id);
  request.reviewedAt = new Date();
  if (adminNotes) {
    request.adminNotes = adminNotes.trim();
  }

  // Handle approval based on request type
  if (request.type === RequestType.COMPLETION) {
    // Mark project as completed
    project.status = ProjectStatus.COMPLETED;
    await project.save();
  } else if (request.type === RequestType.EXTENSION) {
    // Update project end date
    let endDateToUse = request.requestedEndDate;
    
    // Admin can modify the extension duration
    if (approvedEndDate) {
      const parsedApprovedDate = new Date(approvedEndDate);
      if (Number.isNaN(parsedApprovedDate.getTime())) {
        throw new ValidationError('Approved end date must be a valid date');
      }
      
      if (project.endDate && parsedApprovedDate <= project.endDate) {
        throw new ValidationError(
          'Approved end date must be after the current project end date'
        );
      }
      
      endDateToUse = parsedApprovedDate;
    }

    if (!endDateToUse) {
      throw new ValidationError('End date is required for extension approval');
    }

    project.endDate = endDateToUse;
    request.approvedEndDate = endDateToUse;
    await project.save();
  }

  await request.save();

  const populatedRequest = await ProjectRequest.findById(request._id)
    .populate('projectId', 'name description status endDate')
    .populate('requestedBy', 'name email role')
    .populate('reviewedBy', 'name email');

  res.status(200).json({
    success: true,
    data: populatedRequest,
    message: 'Request approved successfully'
  });
};

/**
 * Reject request (Admin only)
 */
export const rejectRequest = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) {
    throw new ValidationError('User information is required');
  }

  if (req.user.role !== UserRole.ADMIN) {
    throw new ForbiddenError('Only admins can reject requests');
  }

  const { id } = req.params;
  const { adminNotes } = req.body;

  const request = await ProjectRequest.findById(id)
    .populate('projectId');
  
  if (!request) {
    throw new NotFoundError('Request');
  }

  if (request.status !== RequestStatus.PENDING) {
    throw new ValidationError(`Request is already ${request.status}`);
  }

  const project = request.projectId as any;
  if (!project) {
    throw new NotFoundError('Project');
  }

  // Update request status
  request.status = RequestStatus.REJECTED;
  request.reviewedBy = new Types.ObjectId(req.user.id);
  request.reviewedAt = new Date();
  if (adminNotes) {
    request.adminNotes = adminNotes.trim();
  }

  // For completion requests, ensure project goes back to IN_PROGRESS
  if (request.type === RequestType.COMPLETION && project.status !== ProjectStatus.IN_PROGRESS) {
    project.status = ProjectStatus.IN_PROGRESS;
    await project.save();
  }

  // For extension requests, project stays IN_PROGRESS (no change needed)

  await request.save();

  const populatedRequest = await ProjectRequest.findById(request._id)
    .populate('projectId', 'name description status endDate')
    .populate('requestedBy', 'name email role')
    .populate('reviewedBy', 'name email');

  res.status(200).json({
    success: true,
    data: populatedRequest,
    message: 'Request rejected successfully'
  });
};

/**
 * Cancel request (Contractor only - can only cancel their own pending requests)
 */
export const cancelRequest = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) {
    throw new ValidationError('User information is required');
  }

  if (req.user.role !== UserRole.CONTRACTOR) {
    throw new ForbiddenError('Only contractors can cancel their own requests');
  }

  const { id } = req.params;

  if (!Types.ObjectId.isValid(id)) {
    throw new ValidationError('Invalid request ID format');
  }

  const request = await ProjectRequest.findById(id);
  
  if (!request) {
    throw new NotFoundError('Request');
  }

  // Verify the request belongs to the current contractor
  if (request.requestedBy.toString() !== req.user.id) {
    throw new ForbiddenError('You can only cancel your own requests');
  }

  // Only allow canceling pending requests
  if (request.status !== RequestStatus.PENDING) {
    throw new ValidationError(`Cannot cancel a request that is already ${request.status}`);
  }

  // Delete the request
  await ProjectRequest.findByIdAndDelete(id);

  res.status(200).json({
    success: true,
    message: 'Request cancelled successfully'
  });
};

