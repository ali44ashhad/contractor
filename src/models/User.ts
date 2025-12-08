import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

/**
 * User roles in the system
 */
export enum UserRole {
  DEVELOPER = 'developer',
  ADMIN = 'admin',
  ACCOUNTS = 'accounts',
  CONTRACTOR = 'contractor',
  MEMBER = 'member'
}

/**
 * User interface
 */
export interface IUser extends Document {
  email: string;
  password: string;
  name: string;
  role: UserRole;
  phone?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

/**
 * User schema definition
 */
const UserSchema: Schema = new Schema(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address']
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters long'],
      select: false // Don't include password in queries by default
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      required: [true, 'User role is required'],
      default: UserRole.DEVELOPER
    },
    phone: {
      type: String,
      trim: true
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true,
    collection: 'users'
  }
);

/**
 * Hash password before saving
 */
UserSchema.pre('save', async function (next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) {
    return next();
  }

  try {
    // Hash password with cost of 12
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(String(this.password), salt);
    next();
  } catch (error: any) {
    next(error);
  }
});

/**
 * Compare password method
 */
UserSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// Index for faster queries
UserSchema.index({ email: 1 });
UserSchema.index({ role: 1 });

export const User = mongoose.model<IUser>('User', UserSchema);

