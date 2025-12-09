import mongoose, { Document, Schema } from 'mongoose';

/**
 * Attendance interface
 */
export interface IAttendance extends Document {
  userId: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId;
  date: Date; // Date of attendance (without time)
  morningUpdateId?: mongoose.Types.ObjectId; // Reference to morning update
  eveningUpdateId?: mongoose.Types.ObjectId; // Reference to evening update
  isPresent: boolean; // Derived: true if both morning and evening updates exist
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Attendance schema definition
 */
const AttendanceSchema: Schema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required']
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: [true, 'Project ID is required']
    },
    date: {
      type: Date,
      required: [true, 'Date is required']
    },
    morningUpdateId: {
      type: Schema.Types.ObjectId,
      ref: 'Update',
      default: null
    },
    eveningUpdateId: {
      type: Schema.Types.ObjectId,
      ref: 'Update',
      default: null
    },
    isPresent: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true,
    collection: 'attendances'
  }
);

// Virtual to calculate isPresent based on update IDs
AttendanceSchema.virtual('calculatedIsPresent').get(function () {
  return !!(this.morningUpdateId && this.eveningUpdateId);
});

// Normalize date to start of day and ensure isPresent is set before saving
AttendanceSchema.pre('save', function (next) {
  // Normalize date to start of day
  if (this.date instanceof Date) {
    const normalized = new Date(this.date);
    normalized.setHours(0, 0, 0, 0);
    this.date = normalized;
  }
  // Set isPresent based on update IDs
  this.isPresent = !!(this.morningUpdateId && this.eveningUpdateId);
  next();
});

// Indexes for faster queries
AttendanceSchema.index({ userId: 1 });
AttendanceSchema.index({ projectId: 1 });
AttendanceSchema.index({ date: 1 });
AttendanceSchema.index({ userId: 1, projectId: 1 });
AttendanceSchema.index({ userId: 1, projectId: 1, date: 1 }, { unique: true }); // One attendance record per user per project per day

export const Attendance = mongoose.model<IAttendance>('Attendance', AttendanceSchema);

