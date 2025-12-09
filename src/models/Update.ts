import mongoose, { Document, Schema, Types } from 'mongoose';

export enum DocumentType {
  REQUIREMENT = 'requirement',
  STATUS = 'status',
  OTHER = 'other'
}

/**
 * Update type enum for morning/evening updates
 */
export enum UpdateType {
  MORNING = 'morning',
  EVENING = 'evening'
}

export interface IUpdateDocument extends Types.Subdocument {
  uploadedBy: Types.ObjectId;
  type: DocumentType;
  fileName: string;
  filePath: string;
  fileSize?: number;
  mimeType?: string;
  description?: string;
  latitude: number;
  longitude: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUpdate extends Document {
  projectId: mongoose.Types.ObjectId;
  contractorId: mongoose.Types.ObjectId;
  postedBy: mongoose.Types.ObjectId; // User who posted the update (team member)
  updateType: UpdateType; // MORNING or EVENING
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
    },
    latitude: {
      type: Number,
      required: [true, 'Latitude is required'],
      min: [-90, 'Latitude must be between -90 and 90'],
      max: [90, 'Latitude must be between -90 and 90']
    },
    longitude: {
      type: Number,
      required: [true, 'Longitude is required'],
      min: [-180, 'Longitude must be between -180 and 180'],
      max: [180, 'Longitude must be between -180 and 180']
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
    postedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Posted by user ID is required']
    },
    updateType: {
      type: String,
      enum: Object.values(UpdateType),
      required: [true, 'Update type (morning/evening) is required']
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
      default: [],
      validate: {
        validator: function (docs: any[]) {
          return docs.length > 0;
        },
        message: 'At least one document/image is required for each update'
      }
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
UpdateSchema.index({ postedBy: 1 });
UpdateSchema.index({ updateDate: 1 });
UpdateSchema.index({ updateType: 1 });
UpdateSchema.index({ postedBy: 1, projectId: 1, updateDate: 1, updateType: 1 }, { unique: true }); // Prevent duplicate morning/evening updates per user per day
UpdateSchema.index({ 'documents.type': 1 });

export const Update = mongoose.model<IUpdate>('Update', UpdateSchema);

