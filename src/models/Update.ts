import mongoose, { Document, Schema, Types } from 'mongoose';

export enum DocumentType {
  REQUIREMENT = 'requirement',
  STATUS = 'status',
  OTHER = 'other'
}

export interface IUpdateDocument extends Types.Subdocument {
  uploadedBy: Types.ObjectId;
  type: DocumentType;
  fileName: string;
  filePath: string;
  fileSize?: number;
  mimeType?: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUpdate extends Document {
  projectId: mongoose.Types.ObjectId;
  contractorId: mongoose.Types.ObjectId;
  status: string;
  updateDate: Date;
  timestamp: Date;
  updateDescription?: string;
  documents: Types.DocumentArray<IUpdateDocument>;
  createdAt: Date;
  updatedAt: Date;
}

const UpdateDocumentSchema = new Schema<IUpdateDocument>(
  {
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
    _id: true,
    timestamps: true
  }
);

const UpdateSchema: Schema = new Schema(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: [true, 'Project ID is required']
    },
    contractorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Contractor ID is required']
    },
    status: {
      type: String,
      required: [true, 'Status is required'],
      trim: true
    },
    updateDate: {
      type: Date,
      required: [true, 'Update date is required']
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    updateDescription: {
      type: String,
      trim: true
    },
    documents: {
      type: [UpdateDocumentSchema],
      default: []
    }
  },
  {
    timestamps: true,
    collection: 'updates'
  }
);

UpdateSchema.index({ projectId: 1 });
UpdateSchema.index({ contractorId: 1 });
UpdateSchema.index({ projectId: 1, contractorId: 1 });
UpdateSchema.index({ 'documents.type': 1 });

export const Update = mongoose.model<IUpdate>('Update', UpdateSchema);

