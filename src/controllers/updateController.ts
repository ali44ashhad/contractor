import { Response } from 'express';
import type { Express } from 'express';
import { Types } from 'mongoose';
import { DocumentType, Update, UpdateType } from '../models/Update';
import { Project, ProjectStatus } from '../models/Project';
import { Team } from '../models/Team';
import { Attendance } from '../models/Attendance';
import { AuthRequest } from '../middleware/auth';
import { ForbiddenError, NotFoundError, ValidationError } from '../utils/errors';
import { UserRole } from '../models/User';
import { uploadBufferToCloudinary } from '../utils/cloudinary';

/**
 * Check if user is part of a project team
 */
const isUserInProjectTeam = async (
  userId: string,
  projectId: string
): Promise<{ isMember: boolean; contractorId: string | null }> => {
  const project = await Project.findById(projectId);
  if (!project) {
    throw new NotFoundError('Project');
  }

  // Check if user is the contractor assigned to the project
  if (project.contractorId && project.contractorId.toString() === userId) {
    return { isMember: true, contractorId: project.contractorId.toString() };
  }

  // Check if user is a member of any team for this project
  const team = await Team.findOne({
    projectId: new Types.ObjectId(projectId),
    $or: [
      { contractorId: new Types.ObjectId(userId) },
      { members: new Types.ObjectId(userId) }
    ]
  });

  if (team) {
    return { isMember: true, contractorId: team.contractorId.toString() };
  }

  return { isMember: false, contractorId: null };
};

type DocumentPayload = {
  uploadedBy: Types.ObjectId;
  type: DocumentType;
  fileName: string;
  filePath: string;
  fileSize?: number;
  mimeType?: string;
  description?: string;
  latitude: number;
  longitude: number;
};

type DocumentMetadataInput = {
  type: DocumentType;
  description?: string;
  fileName?: string;
  latitude: number;
  longitude: number;
};

const isValidDocumentType = (type: unknown): type is DocumentType =>
  typeof type === 'string' && (Object.values(DocumentType) as string[]).includes(type);

const isValidUpdateType = (type: unknown): type is UpdateType =>
  typeof type === 'string' && (Object.values(UpdateType) as string[]).includes(type);

const CLOUDINARY_FOLDER = process.env.CLOUDINARY_FOLDER ?? 'construction/documents';

const extractCloudinaryErrorMessage = (error: unknown): string => {
  if (!error) {
    return 'Unknown Cloudinary upload error';
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (typeof error === 'object') {
    const maybeMessage = (error as { message?: unknown }).message;
    if (typeof maybeMessage === 'string' && maybeMessage.trim()) {
      return maybeMessage;
    }

    const nestedError = (error as { error?: { message?: unknown } }).error;
    if (nestedError && typeof nestedError.message === 'string' && nestedError.message.trim()) {
      return nestedError.message;
    }

    try {
      return JSON.stringify(error);
    } catch {
      return 'Unknown Cloudinary upload error';
    }
  }

  return 'Unknown Cloudinary upload error';
};

const extractUploadedFiles = (req: AuthRequest): Express.Multer.File[] | undefined => {
  const potentialFiles = (req as AuthRequest & { files?: unknown }).files;

  if (Array.isArray(potentialFiles)) {
    return potentialFiles as Express.Multer.File[];
  }

  return undefined;
};

const normalizeDocumentsPayload = (
  documents: unknown,
  uploadedBy: Types.ObjectId
): DocumentPayload[] => {
  if (documents === undefined || documents === null || documents === '') {
    return [];
  }

  let parsedDocuments = documents;

  if (typeof parsedDocuments === 'string') {
    try {
      parsedDocuments = JSON.parse(parsedDocuments);
    } catch (error) {
      throw new ValidationError('Documents payload must be valid JSON');
    }
  }

  if (!Array.isArray(parsedDocuments)) {
    throw new ValidationError('Documents must be provided as a non-empty array of objects');
  }

  if (parsedDocuments.length === 0) {
    return [];
  }

  return parsedDocuments.map((doc, index) => {
    if (typeof doc !== 'object' || doc === null) {
      throw new ValidationError(`Document at index ${index} must be an object`);
    }

    const { type, fileName, filePath, fileSize, mimeType, description } = doc as Record<
      string,
      unknown
    >;

    if (!isValidDocumentType(type)) {
      throw new ValidationError(`Document at index ${index} has an invalid type`);
    }

    if (typeof fileName !== 'string' || fileName.trim().length === 0) {
      throw new ValidationError(`Document at index ${index} must have a valid file name`);
    }

    if (typeof filePath !== 'string' || filePath.trim().length === 0) {
      throw new ValidationError(`Document at index ${index} must have a valid file path`);
    }

    if (fileSize !== undefined && (typeof fileSize !== 'number' || fileSize < 0)) {
      throw new ValidationError(`Document at index ${index} must have a non-negative file size`);
    }

    if (mimeType !== undefined && (typeof mimeType !== 'string' || mimeType.trim().length === 0)) {
      throw new ValidationError(`Document at index ${index} must have a valid mime type`);
    }

    if (description !== undefined && typeof description !== 'string') {
      throw new ValidationError(`Document at index ${index} must have a valid description string`);
    }

    // Validate latitude
    const { latitude, longitude } = doc as Record<string, unknown>;
    if (typeof latitude !== 'number' || isNaN(latitude)) {
      throw new ValidationError(`Document at index ${index} must have a valid latitude (number)`);
    }
    if (latitude < -90 || latitude > 90) {
      throw new ValidationError(`Document at index ${index} latitude must be between -90 and 90`);
    }

    // Validate longitude
    if (typeof longitude !== 'number' || isNaN(longitude)) {
      throw new ValidationError(`Document at index ${index} must have a valid longitude (number)`);
    }
    if (longitude < -180 || longitude > 180) {
      throw new ValidationError(`Document at index ${index} longitude must be between -180 and 180`);
    }

    return {
      uploadedBy,
      type,
      fileName: fileName.trim(),
      filePath: filePath.trim(),
      fileSize,
      mimeType: mimeType ? (mimeType as string).trim() : undefined,
      description: description ? (description as string).trim() : undefined,
      latitude,
      longitude
    };
  });
};

const parseDocumentMetadata = (
  rawMetadata: unknown,
  expectedLength: number
): DocumentMetadataInput[] => {
  if (expectedLength === 0) {
    return [];
  }

  if (rawMetadata === undefined || rawMetadata === null || rawMetadata === '') {
    throw new ValidationError('Document metadata is required when uploading files');
  }

  let parsedMetadata = rawMetadata;

  if (typeof parsedMetadata === 'string') {
    try {
      parsedMetadata = JSON.parse(parsedMetadata);
    } catch (error) {
      throw new ValidationError('Document metadata must be valid JSON');
    }
  }

  if (!Array.isArray(parsedMetadata)) {
    throw new ValidationError('Document metadata must be provided as an array');
  }

  if (parsedMetadata.length !== expectedLength) {
    throw new ValidationError('Document metadata count must match number of uploaded files');
  }

  return parsedMetadata.map((item, index) => {
    if (typeof item !== 'object' || item === null) {
      throw new ValidationError(`Document metadata at index ${index} must be an object`);
    }

    const { type, description, fileName, latitude, longitude } = item as Record<string, unknown>;

    if (!isValidDocumentType(type)) {
      throw new ValidationError(`Document metadata at index ${index} has an invalid type`);
    }

    if (description !== undefined && typeof description !== 'string') {
      throw new ValidationError(
        `Document metadata at index ${index} must have a valid description string`
      );
    }

    if (fileName !== undefined && (typeof fileName !== 'string' || fileName.trim().length === 0)) {
      throw new ValidationError(`Document metadata at index ${index} must have a valid file name`);
    }

    // Validate latitude
    if (typeof latitude !== 'number' || isNaN(latitude)) {
      throw new ValidationError(`Document metadata at index ${index} must have a valid latitude (number)`);
    }
    if (latitude < -90 || latitude > 90) {
      throw new ValidationError(`Document metadata at index ${index} latitude must be between -90 and 90`);
    }

    // Validate longitude
    if (typeof longitude !== 'number' || isNaN(longitude)) {
      throw new ValidationError(`Document metadata at index ${index} must have a valid longitude (number)`);
    }
    if (longitude < -180 || longitude > 180) {
      throw new ValidationError(`Document metadata at index ${index} longitude must be between -180 and 180`);
    }

    return {
      type,
      description: description ? (description as string).trim() : undefined,
      fileName: fileName ? (fileName as string).trim() : undefined,
      latitude,
      longitude
    };
  });
};

const buildDocumentsFromUploads = async (
  files: Express.Multer.File[] | undefined,
  uploadedBy: Types.ObjectId,
  rawMetadata: unknown
): Promise<DocumentPayload[]> => {
  if (!files || files.length === 0) {
    return [];
  }

  const metadata = parseDocumentMetadata(rawMetadata, files.length);

  const uploadedDocuments = await Promise.all(
    files.map(async (file, index) => {
      let cloudinaryResult;
      try {
        cloudinaryResult = await uploadBufferToCloudinary(file.buffer, {
          folder: CLOUDINARY_FOLDER,
          filename_override: metadata[index]?.fileName ?? file.originalname,
          resource_type: 'auto',
          use_filename: true,
          unique_filename: true
        });
      } catch (error: unknown) {
        const errorMessage = extractCloudinaryErrorMessage(error);
        throw new ValidationError(`Failed to upload document to Cloudinary: ${errorMessage}`);
      }

      return {
        uploadedBy,
        type: metadata[index].type,
        fileName:
          metadata[index].fileName ??
          cloudinaryResult.original_filename ??
          file.originalname ??
          'uploaded-file',
        filePath: cloudinaryResult.secure_url,
        fileSize: file.size,
        mimeType: file.mimetype,
        description: metadata[index].description,
        latitude: metadata[index].latitude,
        longitude: metadata[index].longitude
      };
    })
  );

  return uploadedDocuments;
};

/**
 * Normalize date to start of day in UTC (for comparison)
 * This ensures consistent date handling regardless of server timezone
 */
const normalizeDate = (date: Date): Date => {
  const normalized = new Date(date);
  normalized.setUTCHours(0, 0, 0, 0);
  return normalized;
};

/**
 * Create update with validation
 */
export const createUpdate = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) {
    throw new ValidationError('User information is required');
  }

  const { projectId, updateType, status, updateDate, updateDescription } = req.body;

  // Validate required fields
  if (!projectId || !updateType || !status) {
    throw new ValidationError('Project ID, update type (morning/evening), and status are required');
  }

  if (!Types.ObjectId.isValid(projectId)) {
    throw new ValidationError('Project ID must be a valid identifier');
  }

  if (!isValidUpdateType(updateType)) {
    throw new ValidationError('Update type must be either "morning" or "evening"');
  }

  // Validate project exists and is IN_PROGRESS
  const project = await Project.findById(projectId);
  if (!project) {
    throw new NotFoundError('Project');
  }

  if (project.status !== ProjectStatus.IN_PROGRESS) {
    throw new ValidationError(
      `Updates can only be posted for projects with status "in_progress". Current status: ${project.status}`
    );
  }

  // Check if user is part of project team
  const { isMember, contractorId } = await isUserInProjectTeam(req.user.id, projectId);
  if (!isMember || !contractorId) {
    throw new ForbiddenError('You must be a member of the project team to post updates');
  }

  // Parse and validate update date
  let parsedUpdateDate: Date;
  if (updateDate) {
    // If updateDate is in YYYY-MM-DD format, parse it as UTC to avoid timezone issues
    if (typeof updateDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(updateDate)) {
      // Parse as UTC midnight to avoid timezone shifts
      parsedUpdateDate = new Date(updateDate + 'T00:00:00.000Z');
    } else {
      parsedUpdateDate = new Date(updateDate);
    }
    if (Number.isNaN(parsedUpdateDate.getTime())) {
      throw new ValidationError('Update date must be a valid date');
    }
  } else {
    parsedUpdateDate = new Date();
  }

  // Normalize date to start of day in UTC for comparison
  const normalizedDate = normalizeDate(parsedUpdateDate);

  // Check if user already posted this type of update today
  // Since updateDate is normalized to start of day, we can do exact match
  const existingUpdate = await Update.findOne({
    postedBy: new Types.ObjectId(req.user.id),
    projectId: new Types.ObjectId(projectId),
    updateDate: normalizedDate,
    updateType
  });

  if (existingUpdate) {
    throw new ValidationError(
      `You have already posted a ${updateType} update for this project today`
    );
  }

  // Process uploaded files
  const uploadedByObjectId = new Types.ObjectId(req.user.id);
  const files = extractUploadedFiles(req);
  const metadataSource =
    req.body.documentMetadata ?? req.body.documentsMetadata ?? req.body.documentsMeta;
  const uploadedDocuments = await buildDocumentsFromUploads(
    files,
    uploadedByObjectId,
    metadataSource
  );
  const normalizedDocuments = normalizeDocumentsPayload(req.body.documents, uploadedByObjectId);
  const allDocuments = [...normalizedDocuments, ...uploadedDocuments];

  // Require at least one document/image
  if (allDocuments.length === 0) {
    throw new ValidationError('At least one image/document is required for each update');
  }

  const normalizedDescription =
    typeof updateDescription === 'string' ? updateDescription.trim() : undefined;

  // Create update with auto-logged timestamp
  // Note: updateDate is normalized to start of day for unique index, timestamp has exact time
  const update = await Update.create({
    projectId: new Types.ObjectId(projectId),
    contractorId: new Types.ObjectId(contractorId),
    postedBy: uploadedByObjectId,
    updateType,
    status,
    updateDate: normalizedDate, // Normalized to start of day for unique index
    timestamp: new Date(), // Auto-logged exact time
    updateDescription: normalizedDescription || undefined,
    documents: allDocuments
  });

  // Create or update attendance record
  const attendanceDate = normalizedDate; // Already normalized
  const attendance = await Attendance.findOneAndUpdate(
    {
      userId: uploadedByObjectId,
      projectId: new Types.ObjectId(projectId),
      date: attendanceDate
    },
    {
      userId: uploadedByObjectId,
      projectId: new Types.ObjectId(projectId),
      date: attendanceDate,
      ...(updateType === UpdateType.MORNING
        ? { morningUpdateId: update._id }
        : { eveningUpdateId: update._id })
      // Note: isPresent will be set by the pre-save hook based on both update IDs
    },
    {
      upsert: true,
      new: true
    }
  );

  // Save to trigger pre-save hook which will set isPresent correctly based on both update IDs
  await attendance.save();

  const populatedUpdate = await Update.findById(update._id)
    .populate('projectId', 'name description')
    .populate('contractorId', 'name email role')
    .populate('postedBy', 'name email role')
    .populate('documents.uploadedBy', 'name email role');

  res.status(201).json({
    success: true,
    data: populatedUpdate,
    message: 'Update created successfully'
  });
};

export const getUpdates = async (req: AuthRequest, res: Response): Promise<void> => {
  const { projectId, contractorId, postedBy, updateType, page, limit } = req.query;

  const filter: any = {};
  if (projectId) filter.projectId = projectId;
  if (contractorId) filter.contractorId = contractorId;
  if (postedBy) filter.postedBy = postedBy;
  if (updateType) filter.updateType = updateType;

  // Contractors and team members can only see updates from their projects
  if (req.user?.role === UserRole.CONTRACTOR || req.user?.role === UserRole.MEMBER) {
    // Find all projects where user is contractor or team member
    const teams = await Team.find({
      $or: [
        { contractorId: req.user.id },
        { members: req.user.id }
      ]
    });
    const projectIds = teams.map(t => t.projectId.toString());
    
    // Also include projects where user is the contractor
    const projects = await Project.find({
      $or: [
        { contractorId: req.user.id },
        { _id: { $in: projectIds } }
      ]
    });
    const allProjectIds = projects.map((p) => (p._id as Types.ObjectId).toString());
    
    filter.projectId = { $in: allProjectIds };
  }

  // Pagination parameters
  const pageNum = parseInt(page as string) || 1;
  const limitNum = parseInt(limit as string) || 10;
  const skip = (pageNum - 1) * limitNum;

  // Get total count for pagination metadata
  const total = await Update.countDocuments(filter);

  const updates = await Update.find(filter)
    .populate('projectId', 'name description')
    .populate('contractorId', 'name email role')
    .populate('postedBy', 'name email role')
    .populate('documents.uploadedBy', 'name email role')
    .sort({ updateDate: -1, createdAt: -1 })
    .skip(skip)
    .limit(limitNum);

  const totalPages = Math.ceil(total / limitNum);

  res.status(200).json({
    success: true,
    data: updates,
    count: updates.length,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages
    }
  });
};

export const getUpdateById = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  const update = await Update.findById(id)
    .populate('projectId', 'name description')
    .populate('contractorId', 'name email role')
    .populate('postedBy', 'name email role')
    .populate('documents.uploadedBy', 'name email role');

  if (!update) {
    throw new NotFoundError('Update');
  }

  // Check if user has access to this update
  if (req.user?.role === UserRole.CONTRACTOR || req.user?.role === UserRole.MEMBER) {
    const { isMember } = await isUserInProjectTeam(req.user.id, update.projectId.toString());
    if (!isMember) {
    throw new NotFoundError('Update');
    }
  }

  res.status(200).json({
    success: true,
    data: update
  });
};

export const addDocumentsToUpdate = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) {
    throw new ValidationError('User information is required');
  }

  const { id } = req.params;
  const { documents } = req.body;

  const update = await Update.findById(id);
  if (!update) {
    throw new NotFoundError('Update');
  }

  // Only the user who posted the update can add documents
  if (update.postedBy.toString() !== req.user.id) {
    throw new ForbiddenError('You can only modify your own updates');
  }

  const uploadedByObjectId = new Types.ObjectId(req.user.id);
  const files = extractUploadedFiles(req);
  const metadataSource =
    req.body.documentMetadata ?? req.body.documentsMetadata ?? req.body.documentsMeta;
  const uploadedDocuments = await buildDocumentsFromUploads(
    files,
    uploadedByObjectId,
    metadataSource
  );
  const normalizedDocuments = normalizeDocumentsPayload(documents, uploadedByObjectId);
  const combinedDocuments = [...normalizedDocuments, ...uploadedDocuments];

  if (combinedDocuments.length === 0) {
    throw new ValidationError('At least one document must be provided');
  }

  combinedDocuments.forEach((doc) => {
    update.documents.push(doc as any);
  });

  await update.save();

  const populatedUpdate = await Update.findById(update._id)
    .populate('projectId', 'name description')
    .populate('contractorId', 'name email role')
    .populate('postedBy', 'name email role')
    .populate('documents.uploadedBy', 'name email role');

  res.status(200).json({
    success: true,
    data: populatedUpdate,
    message: 'Documents added to update successfully'
  });
};
