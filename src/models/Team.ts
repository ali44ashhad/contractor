import mongoose, { Document, Schema } from 'mongoose';

/**
 * Team member interface (embedded in Team)
 */
export interface ITeamMember {
  name: string;
  role: string;
  email?: string;
  phone?: string;
  specialization?: string;
}

/**
 * Team interface
 */
export interface ITeam extends Document {
  projectId: mongoose.Types.ObjectId;
  contractorId: mongoose.Types.ObjectId;
  teamName: string;
  members: ITeamMember[];
  createdBy: mongoose.Types.ObjectId; // Admin who added the team
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Team member schema (embedded)
 */
const TeamMemberSchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Team member name is required'],
      trim: true
    },
    role: {
      type: String,
      required: [true, 'Team member role is required'],
      trim: true
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address']
    },
    phone: {
      type: String,
      trim: true
    },
    specialization: {
      type: String,
      trim: true
    }
  },
  { _id: false }
);

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
      type: [TeamMemberSchema],
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

export const Team = mongoose.model<ITeam>('Team', TeamSchema);

