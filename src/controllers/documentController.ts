import { Response } from 'express';
import { Document, DocumentType } from '../models/Document';
import { Project } from '../models/Project';
import { AuthRequest } from '../middleware/auth';
import { NotFoundError, ValidationError, ForbiddenError } from '../utils/errors';
import { UserRole } from '../models/User';

/**
 * Get all documents
 */
export const getAllDocuments = async (req: AuthRequest, res: Response): Promise<void> => {
  const { projectId, type, uploadedBy } = req.query;

  const filter: any = {};
  if (projectId) filter.projectId = projectId;
  if (type) filter.type = type;
  if (uploadedBy) filter.uploadedBy = uploadedBy;

  // Contractors can only see documents for their projects
  if (req.user?.role === UserRole.CONTRACTOR) {
    // This will be filtered by project access in the project query
    // For now, we'll show all documents but filter by project access
  }

  const documents = await Document.find(filter)
    .populate('projectId', 'name description')
    .populate('uploadedBy', 'name email role')
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    data: documents,
    count: documents.length
  });
};

/**
 * Get document by ID
 */
export const getDocumentById = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  const document = await Document.findById(id)
    .populate('projectId', 'name description')
    .populate('uploadedBy', 'name email role');

  if (!document) {
    throw new NotFoundError('Document');
  }

  res.status(200).json({
    success: true,
    data: document
  });
};

/**
 * Upload document
 * - Admin: Can upload requirement and other documents
 * - Accounts: Can upload requirement and other documents
 * - Contractor: Can upload status documents
 */
export const uploadDocument = async (req: AuthRequest, res: Response): Promise<void> => {
  const { projectId, type, fileName, filePath, fileSize, mimeType, description } = req.body;

  if (!projectId || !type || !fileName || !filePath) {
    throw new ValidationError('Project ID, type, file name, and file path are required');
  }

  if (!req.user) {
    throw new ValidationError('User information is required');
  }

  // Validate project exists
  const project = await Project.findById(projectId);
  if (!project) {
    throw new NotFoundError('Project');
  }

  // Role-based document type validation
  if (req.user.role === UserRole.CONTRACTOR) {
    // Contractors can only upload status documents
    if (type !== DocumentType.STATUS) {
      throw new ForbiddenError('Contractors can only upload status documents');
    }
  } else if (req.user.role === UserRole.ADMIN || req.user.role === UserRole.ACCOUNTS) {
    // Admin and Accounts can upload requirement and other documents, but not status
    if (type === DocumentType.STATUS) {
      throw new ForbiddenError('Only contractors can upload status documents');
    }
  }

  const document = await Document.create({
    projectId,
    uploadedBy: req.user.id,
    type,
    fileName,
    filePath,
    fileSize,
    mimeType,
    description
  });

  const populatedDocument = await Document.findById(document._id)
    .populate('projectId', 'name description')
    .populate('uploadedBy', 'name email role');

  res.status(201).json({
    success: true,
    data: populatedDocument,
    message: 'Document uploaded successfully'
  });
};

/**
 * Update document (only by uploader or admin)
 */
export const updateDocument = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { fileName, description } = req.body;

  const document = await Document.findById(id);
  if (!document) {
    throw new NotFoundError('Document');
  }

  // Check permissions
  if (req.user?.role !== UserRole.ADMIN && document.uploadedBy.toString() !== req.user?.id) {
    throw new ForbiddenError('You can only update your own documents');
  }

  if (fileName) document.fileName = fileName;
  if (description !== undefined) document.description = description;

  await document.save();

  const populatedDocument = await Document.findById(document._id)
    .populate('projectId', 'name description')
    .populate('uploadedBy', 'name email role');

  res.status(200).json({
    success: true,
    data: populatedDocument,
    message: 'Document updated successfully'
  });
};

/**
 * Delete document (only by uploader or admin)
 */
export const deleteDocument = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  const document = await Document.findById(id);
  if (!document) {
    throw new NotFoundError('Document');
  }

  // Check permissions
  if (req.user?.role !== UserRole.ADMIN && document.uploadedBy.toString() !== req.user?.id) {
    throw new ForbiddenError('You can only delete your own documents');
  }

  await Document.findByIdAndDelete(id);

  res.status(200).json({
    success: true,
    message: 'Document deleted successfully'
  });
};

