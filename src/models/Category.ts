import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ICategory extends Document {
  name: string;
  description?: string;
  icon: string;
  color: string;
  type: 'expense' | 'income';
  isDefault: boolean;
  isActive: boolean;
  userId?: Types.ObjectId; // null ise sistem kategorisi
  parentCategory?: Types.ObjectId;
  subcategories: Types.ObjectId[];
  
  // İstatistikler
  usageCount: number;
  totalAmount: number;
  
  createdAt: Date;
  updatedAt: Date;
}

const categorySchema = new Schema<ICategory>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50
    },
    description: {
      type: String,
      trim: true,
      maxlength: 200
    },
    icon: {
      type: String,
      required: true,
      default: '📦'
    },
    color: {
      type: String,
      required: true,
      default: '#3B82F6',
      match: /^#[0-9A-F]{6}$/i
    },
    type: {
      type: String,
      required: true,
      enum: ['expense', 'income'],
      default: 'expense'
    },
    isDefault: {
      type: Boolean,
      default: false
    },
    isActive: {
      type: Boolean,
      default: true
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    parentCategory: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      default: null
    },
    subcategories: [{
      type: Schema.Types.ObjectId,
      ref: 'Category'
    }],
    
    // İstatistikler
    usageCount: {
      type: Number,
      default: 0
    },
    totalAmount: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

// Index'ler
categorySchema.index({ userId: 1, type: 1 });
categorySchema.index({ isDefault: 1 });
categorySchema.index({ parentCategory: 1 });
categorySchema.index({ name: 'text', description: 'text' });

// Compound index
categorySchema.index({ userId: 1, isActive: 1 });

// Virtual fields
categorySchema.virtual('isSystemCategory').get(function() {
  return this.userId === null;
});

categorySchema.virtual('hasSubcategories').get(function() {
  return this.subcategories.length > 0;
});

// Pre-save middleware
categorySchema.pre('save', function (next) {
  // Eğer parent category ise, kendisini subcategory olarak ekleme
  if (this.parentCategory && this.parentCategory.equals(this._id)) {
    return next(new Error('Category cannot be its own parent'));
  }
  next();
});

// Static methods
categorySchema.statics.getDefaultCategories = function() {
  return this.find({ isDefault: true, isActive: true });
};

categorySchema.statics.getUserCategories = function(userId: Types.ObjectId) {
  return this.find({ 
    $or: [
      { userId: userId },
      { isDefault: true }
    ],
    isActive: true 
  }).sort({ isDefault: 1, name: 1 });
};

export const Category = mongoose.model<ICategory>('Category', categorySchema);

