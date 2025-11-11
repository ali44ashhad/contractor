import mongoose, { Document as MongooseDocument, Schema } from 'mongoose';

/**
 * Document type enum
 */
export enum DocumentType {
  REQUIREMENT = 'requirement',
  STATUS = 'status',
  OTHER = 'other'
}

/**
 * Document interface
 */
export interface IDocument extends MongooseDocument {
  projectId: mongoose.Types.ObjectId;
  uploadedBy: mongoose.Types.ObjectId;
  type: DocumentType;
  fileName: string;
  filePath: string;
  fileSize?: number;
  mimeType?: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Document schema definition
 */
const DocumentSchema: Schema = new Schema(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: [true, 'Project ID is required']
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Uploader ID is required']
    },
    type: {
      type: String,
      enum: Object.values(DocumentType),
      required: [true, 'Document type is required']
    },
    fileName: {
      type: String,
      required: [true, 'File name is required'],
      trim: true
    },
    filePath: {
      type: String,
      required: [true, 'File path is required']
    },
    fileSize: {
      type: Number,
      min: [0, 'File size cannot be negative']
    },
    mimeType: {
      type: String,
      trim: true
    },
    description: {
      type: String,
      trim: true
    }
  },
  {
    timestamps: true,
    collection: 'documents'
  }
);

// Indexes for faster queries
DocumentSchema.index({ projectId: 1 });
DocumentSchema.index({ uploadedBy: 1 });
DocumentSchema.index({ type: 1 });
DocumentSchema.index({ projectId: 1, type: 1 });

export const Document = mongoose.model<IDocument>('Document', DocumentSchema);

