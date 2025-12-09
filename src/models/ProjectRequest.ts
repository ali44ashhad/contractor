import mongoose, { Document, Schema } from 'mongoose';

/**
 * Request type enum
 */
export enum RequestType {
  COMPLETION = 'completion',
  EXTENSION = 'extension'
}

/**
 * Request status enum
 */
export enum RequestStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected'
}

/**
 * Project Request interface
 */
export interface IProjectRequest extends Document {
  projectId: mongoose.Types.ObjectId;
  requestedBy: mongoose.Types.ObjectId; // Contractor who made the request
  type: RequestType;
  status: RequestStatus;
  requestedEndDate?: Date; // For extension requests - the new end date requested
  approvedEndDate?: Date; // For extension requests - the end date approved by admin (can be modified)
  reason?: string; // Reason for the request
  adminNotes?: string; // Admin's notes when approving/rejecting
  reviewedBy?: mongoose.Types.ObjectId; // Admin who reviewed the request
  reviewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Project Request schema definition
 */
const ProjectRequestSchema: Schema = new Schema(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: [true, 'Project ID is required']
    },
    requestedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Requested by user ID is required']
    },
    type: {
      type: String,
      enum: Object.values(RequestType),
      required: [true, 'Request type is required']
    },
    status: {
      type: String,
      enum: Object.values(RequestStatus),
      default: RequestStatus.PENDING
    },
    requestedEndDate: {
      type: Date
    },
    approvedEndDate: {
      type: Date
    },
    reason: {
      type: String,
      trim: true
    },
    adminNotes: {
      type: String,
      trim: true
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    reviewedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true,
    collection: 'project_requests'
  }
);

// Indexes for faster queries
ProjectRequestSchema.index({ projectId: 1 });
ProjectRequestSchema.index({ requestedBy: 1 });
ProjectRequestSchema.index({ status: 1 });
ProjectRequestSchema.index({ type: 1 });
ProjectRequestSchema.index({ projectId: 1, status: 1 });
ProjectRequestSchema.index({ requestedBy: 1, status: 1 });

export const ProjectRequest = mongoose.model<IProjectRequest>(
  'ProjectRequest',
  ProjectRequestSchema
);

