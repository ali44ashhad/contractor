import mongoose, { Document, Schema } from 'mongoose';

/**
 * Team interface
 */
export interface ITeam extends Document {
  projectId: mongoose.Types.ObjectId;
  contractorId: mongoose.Types.ObjectId;
  teamName: string;
  members: mongoose.Types.ObjectId[]; // References to User documents
  createdBy: mongoose.Types.ObjectId; // Admin who added the team
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Team schema definition
 */
const TeamSchema: Schema = new Schema(
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
    teamName: {
      type: String,
      required: [true, 'Team name is required'],
      trim: true
    },
    members: {
      type: [Schema.Types.ObjectId],
      ref: 'User',
      default: []
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Created by admin is required']
    }
  },
  {
    timestamps: true,
    collection: 'teams'
  }
);

// Indexes for faster queries
TeamSchema.index({ projectId: 1 });
TeamSchema.index({ contractorId: 1 });
TeamSchema.index({ 'projectId': 1, 'contractorId': 1 });
TeamSchema.index({ members: 1 });

export const Team = mongoose.model<ITeam>('Team', TeamSchema);

