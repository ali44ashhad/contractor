import mongoose, { Document, Schema } from 'mongoose';

/**
 * Project status enum
 */
export enum ProjectStatus {
  PLANNING = 'planning',
  IN_PROGRESS = 'in_progress',
  ON_HOLD = 'on_hold',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

/**
 * Project interface
 */
export interface IProject extends Document {
  name: string;
  description: string;
  adminId: mongoose.Types.ObjectId; // Admin who created the project
  contractorId?: mongoose.Types.ObjectId; // Assigned contractor
  status: ProjectStatus;
  startDate?: Date;
  endDate?: Date;
  budget?: number;
  location?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Project schema definition
 */
const ProjectSchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Project name is required'],
      trim: true
    },
    description: {
      type: String,
      required: [true, 'Project description is required'],
      trim: true
    },
    adminId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Admin ID is required']
    },
    contractorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    status: {
      type: String,
      enum: Object.values(ProjectStatus),
      default: ProjectStatus.PLANNING
    },
    startDate: {
      type: Date
    },
    endDate: {
      type: Date
    },
    budget: {
      type: Number,
      min: [0, 'Budget cannot be negative']
    },
    location: {
      type: String,
      trim: true
    }
  },
  {
    timestamps: true,
    collection: 'projects'
  }
);

// Indexes for faster queries
ProjectSchema.index({ adminId: 1 });
ProjectSchema.index({ contractorId: 1 });
ProjectSchema.index({ status: 1 });

export const Project = mongoose.model<IProject>('Project', ProjectSchema);

