import { Response } from 'express';
import type { Express } from 'express';
import { Types } from 'mongoose';
import { DocumentType, Update } from '../models/Update';
import { Project } from '../models/Project';
import { AuthRequest } from '../middleware/auth';
import { ForbiddenError, NotFoundError, ValidationError } from '../utils/errors';
import { UserRole } from '../models/User';
import { uploadBufferToCloudinary } from '../utils/cloudinary';

const ensureContractorRole = (
  req: AuthRequest
): AuthRequest['user'] & { role: UserRole.CONTRACTOR } => {
  const user = req.user;

  if (!user || user.role !== UserRole.CONTRACTOR) {
    throw new ForbiddenError('Only contractors can create or modify updates');
  }

  return {
    ...user,
    role: UserRole.CONTRACTOR
  };
};

type DocumentPayload = {
  uploadedBy: Types.ObjectId;
  type: DocumentType;
  fileName: string;
  filePath: string;
  fileSize?: number;
  mimeType?: string;
  description?: string;
};

type DocumentMetadataInput = {
  type: DocumentType;
  description?: string;
  fileName?: string;
};

const isValidDocumentType = (type: unknown): type is DocumentType =>
  typeof type === 'string' && (Object.values(DocumentType) as string[]).includes(type);

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
    throw new ValidationError('Documents must be provided as an array of objects');
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

    return {
      uploadedBy,
      type,
      fileName: fileName.trim(),
      filePath: filePath.trim(),
      fileSize,
      mimeType: mimeType ? (mimeType as string).trim() : undefined,
      description: description ? (description as string).trim() : undefined
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

    const { type, description, fileName } = item as Record<string, unknown>;

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

    return {
      type,
      description: description ? (description as string).trim() : undefined,
      fileName: fileName ? (fileName as string).trim() : undefined
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
  console.log("METADATA:",metadata);
  

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
        description: metadata[index].description
      };
    })
  );

  return uploadedDocuments;
};

export const createUpdate = async (req: AuthRequest, res: Response): Promise<void> => {
  const user = ensureContractorRole(req);

  const { projectId, status, updateDate, timestamp, documents, updateDescription } = req.body;

  if (!projectId || !status || !updateDate) {
    throw new ValidationError('Project ID, status, and update date are required');
  }

  if (!Types.ObjectId.isValid(projectId)) {
    throw new ValidationError('Project ID must be a valid identifier');
  }

  const project = await Project.findById(projectId);
  if (!project) {
    throw new NotFoundError('Project');
  }

  const parsedUpdateDate = new Date(updateDate);
  if (Number.isNaN(parsedUpdateDate.getTime())) {
    throw new ValidationError('Update date must be a valid date');
  }

  let parsedTimestamp: Date | null = null;
  if (timestamp) {
    parsedTimestamp = new Date(timestamp);
    if (Number.isNaN(parsedTimestamp.getTime())) {
      throw new ValidationError('Timestamp must be a valid date');
    }
  }

  const projectObjectId = new Types.ObjectId(projectId);
  const uploadedByObjectId = new Types.ObjectId(user.id);
  const files = extractUploadedFiles(req);
  console.log("FILES:",files);
  const metadataSource =
    req.body.documentMetadata ?? req.body.documentsMetadata ?? req.body.documentsMeta;
  const uploadedDocuments = await buildDocumentsFromUploads(files, uploadedByObjectId, metadataSource);
  const normalizedDocuments = normalizeDocumentsPayload(documents, uploadedByObjectId);
  const normalizedDescription =
    typeof updateDescription === 'string' ? updateDescription.trim() : undefined;

    console.log("TESTINGGGGG:",uploadedDocuments);
    

  const update = await Update.create({
    projectId: projectObjectId,
    contractorId: user.id,
    status,
    updateDate: parsedUpdateDate,
    timestamp: parsedTimestamp ?? new Date(),
    updateDescription: normalizedDescription ? normalizedDescription : undefined,
    documents: [...normalizedDocuments, ...uploadedDocuments]
  });

  const populatedUpdate = await Update.findById(update._id)
    .populate('projectId', 'name description')
    .populate('contractorId', 'name email role')
    .populate('documents.uploadedBy', 'name email role');

  res.status(201).json({
    success: true,
    data: populatedUpdate,
    message: 'Update created successfully'
  });
};

export const getUpdates = async (req: AuthRequest, res: Response): Promise<void> => {
  const { projectId, contractorId } = req.query;

  const filter: any = {};
  if (projectId) filter.projectId = projectId;
  if (contractorId) filter.contractorId = contractorId;

  if (req.user?.role === UserRole.CONTRACTOR) {
    filter.contractorId = req.user.id;
  }

  const updates = await Update.find(filter)
    .populate('projectId', 'name description')
    .populate('contractorId', 'name email role')
    .populate('documents.uploadedBy', 'name email role')
    .sort({ updateDate: -1, createdAt: -1 });

  res.status(200).json({
    success: true,
    data: updates,
    count: updates.length
  });
};

export const getUpdateById = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  const update = await Update.findById(id)
    .populate('projectId', 'name description')
    .populate('contractorId', 'name email role')
    .populate('documents.uploadedBy', 'name email role');

  if (!update) {
    throw new NotFoundError('Update');
  }

  if (req.user?.role === UserRole.CONTRACTOR && update.contractorId.toString() !== req.user.id) {
    throw new NotFoundError('Update');
  }

  res.status(200).json({
    success: true,
    data: update
  });
};

export const addDocumentsToUpdate = async (req: AuthRequest, res: Response): Promise<void> => {
  const user = ensureContractorRole(req);

  const { id } = req.params;
  const { documents } = req.body;

  const update = await Update.findById(id);
  if (!update) {
    throw new NotFoundError('Update');
  }

  if (update.contractorId.toString() !== user.id) {
    throw new ForbiddenError('You can only modify your own updates');
  }

  const uploadedByObjectId = new Types.ObjectId(user.id);
  const files = extractUploadedFiles(req);
  const metadataSource =
    req.body.documentMetadata ?? req.body.documentsMetadata ?? req.body.documentsMeta;
  const uploadedDocuments = await buildDocumentsFromUploads(files, uploadedByObjectId, metadataSource);
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
    .populate('documents.uploadedBy', 'name email role');

  res.status(200).json({
    success: true,
    data: populatedUpdate,
    message: 'Documents added to update successfully'
  });
};


