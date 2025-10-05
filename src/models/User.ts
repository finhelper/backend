import mongoose, { Document, Schema, Types } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  // Temel bilgiler
  email: string;
  password: string;
  name: string;
  username?: string;
  
  // Profil bilgileri
  profileImage?: string;
  phoneNumber?: string;
  birthDate?: Date;
  gender?: 'male' | 'female' | 'other';
  currency: string; // Varsayılan para birimi
  timezone: string;
  
  // Güvenlik
  isEmailVerified: boolean;
  emailVerificationToken?: string;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  lastLogin?: Date;
  
  // Ayarlar
  preferences: {
    notifications: boolean;
    darkMode: boolean;
    language: string;
    monthlyBudget?: number;
    weeklyBudget?: number;
  };
  
  // İstatistikler (computed fields)
  stats: {
    totalExpenses: number;
    totalGroups: number;
    joinDate: Date;
    lastActiveDate: Date;
  };
  
  // İlişkiler
  groups: Types.ObjectId[];
  categories: Types.ObjectId[];
  budgets: Types.ObjectId[];
  
  // Sistem alanları
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  
  // Metodlar
  comparePassword(candidatePassword: string): Promise<boolean>;
  generatePasswordResetToken(): string;
  toJSON(): any;
}

const userSchema = new Schema<IUser>(
  {
    // Temel bilgiler
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true
    },
    password: {
      type: String,
      required: true,
      minlength: 8,
      select: false // Varsayılan olarak password'ü döndürme
    },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 50
    },
    username: {
      type: String,
      unique: true,
      sparse: true, // null değerlere izin ver ama unique olsun
      trim: true,
      minlength: 3,
      maxlength: 30,
      match: /^[a-zA-Z0-9_]+$/
    },
    
    // Profil bilgileri
    profileImage: {
      type: String,
      default: null
    },
    phoneNumber: {
      type: String,
      match: /^\+?[1-9]\d{1,14}$/
    },
    birthDate: {
      type: Date
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other']
    },
    currency: {
      type: String,
      default: 'TRY',
      enum: ['TRY', 'USD', 'EUR', 'GBP']
    },
    timezone: {
      type: String,
      default: 'Europe/Istanbul'
    },
    
    // Güvenlik
    isEmailVerified: {
      type: Boolean,
      default: false
    },
    emailVerificationToken: {
      type: String,
      select: false
    },
    passwordResetToken: {
      type: String,
      select: false
    },
    passwordResetExpires: {
      type: Date,
      select: false
    },
    lastLogin: {
      type: Date
    },
    
    // Ayarlar
    preferences: {
      notifications: {
        type: Boolean,
        default: true
      },
      darkMode: {
        type: Boolean,
        default: false
      },
      language: {
        type: String,
        default: 'tr',
        enum: ['tr', 'en']
      },
      monthlyBudget: {
        type: Number,
        min: 0
      },
      weeklyBudget: {
        type: Number,
        min: 0
      }
    },
    
    // İstatistikler
    stats: {
      totalExpenses: {
        type: Number,
        default: 0
      },
      totalGroups: {
        type: Number,
        default: 0
      },
      joinDate: {
        type: Date,
        default: Date.now
      },
      lastActiveDate: {
        type: Date,
        default: Date.now
      }
    },
    
    // İlişkiler
    groups: [{
      type: Schema.Types.ObjectId,
      ref: 'Group'
    }],
    categories: [{
      type: Schema.Types.ObjectId,
      ref: 'Category'
    }],
    budgets: [{
      type: Schema.Types.ObjectId,
      ref: 'Budget'
    }],
    
    // Sistem alanları
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Index'ler
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });
userSchema.index({ 'stats.lastActiveDate': -1 });
userSchema.index({ createdAt: -1 });

// Virtual fields
userSchema.virtual('age').get(function() {
  if (!this.birthDate) return null;
  const today = new Date();
  const birthDate = new Date(this.birthDate);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
});

// Pre-save middleware
userSchema.pre('save', async function (next) {
  // Password hash'leme
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Pre-save middleware - stats güncelleme
userSchema.pre('save', function (next) {
  if (this.isModified('groups')) {
    this.stats.totalGroups = this.groups.length;
  }
  next();
});

// Metodlar
userSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.generatePasswordResetToken = function (): string {
  const resetToken = require('crypto').randomBytes(32).toString('hex');
  this.passwordResetToken = require('crypto').createHash('sha256').update(resetToken).digest('hex');
  this.passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 dakika
  return resetToken;
};

userSchema.methods.toJSON = function () {
  const userObject = this.toObject();
  delete userObject.password;
  delete userObject.emailVerificationToken;
  delete userObject.passwordResetToken;
  delete userObject.passwordResetExpires;
  return userObject;
};

export const User = mongoose.model<IUser>('User', userSchema);