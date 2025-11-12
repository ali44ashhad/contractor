import multer, { MulterError } from 'multer';
import type { Express } from 'express';
import { Request } from 'express';

const MAX_FILE_SIZE = Number(process.env.MAX_UPLOAD_SIZE_BYTES ?? 15 * 1024 * 1024); // 15MB default

const allowedMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
]);

const storage = multer.memoryStorage();

const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (allowedMimeTypes.has(file.mimetype)) {
    cb(null, true);
    return;
  }

  const error = new MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname);
  error.message = `Unsupported file type for field "${file.fieldname}": ${file.mimetype}`;

  cb(error);
};

export const uploadDocuments = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: Number(process.env.MAX_UPLOAD_FILES ?? 10)
  },
  fileFilter
}).array('documents');


