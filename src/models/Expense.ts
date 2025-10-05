import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IExpense extends Document {
  // Temel bilgiler
  title: string;
  description?: string;
  amount: number;
  currency: string;
  date: Date;
  
  // Kategori ve tip
  categoryId: Types.ObjectId;
  type: 'personal' | 'group';
  
  // Kullanıcı bilgileri
  userId: Types.ObjectId;
  groupId?: Types.ObjectId;
  
  // Grup harcaması için
  paidBy?: Types.ObjectId; // Kim ödedi
  splitBetween?: Types.ObjectId[]; // Kimler arasında bölünecek
  splitAmounts?: { userId: Types.ObjectId; amount: number }[]; // Kişi başı miktar
  
  // Medya
  attachments: {
    type: 'image' | 'document';
    url: string;
    filename: string;
    size: number;
  }[];
  
  // Konum (opsiyonel)
  location?: {
    name: string;
    coordinates: {
      latitude: number;
      longitude: number;
    };
  };
  
  // Etiketler
  tags: string[];
  
  // Durum
  status: 'active' | 'deleted' | 'archived';
  isRecurring: boolean;
  recurringPattern?: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
    interval: number; // Her kaç günde bir
    endDate?: Date;
    nextOccurrence?: Date;
  };
  
  // Sistem alanları
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

const expenseSchema = new Schema<IExpense>(
  {
    // Temel bilgiler
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01,
      max: 999999999.99
    },
    currency: {
      type: String,
      required: true,
      default: 'TRY',
      enum: ['TRY', 'USD', 'EUR', 'GBP']
    },
    date: {
      type: Date,
      required: true,
      default: Date.now
    },
    
    // Kategori ve tip
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: true
    },
    type: {
      type: String,
      required: true,
      enum: ['personal', 'group'],
      default: 'personal'
    },
    
    // Kullanıcı bilgileri
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    groupId: {
      type: Schema.Types.ObjectId,
      ref: 'Group'
    },
    
    // Grup harcaması için
    paidBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    splitBetween: [{
      type: Schema.Types.ObjectId,
      ref: 'User'
    }],
    splitAmounts: [{
      userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      amount: {
        type: Number,
        required: true,
        min: 0
      }
    }],
    
    // Medya
    attachments: [{
      type: {
        type: String,
        enum: ['image', 'document'],
        required: true
      },
      url: {
        type: String,
        required: true
      },
      filename: {
        type: String,
        required: true
      },
      size: {
        type: Number,
        required: true,
        min: 0
      }
    }],
    
    // Konum
    location: {
      name: {
        type: String,
        trim: true
      },
      coordinates: {
        latitude: {
          type: Number,
          min: -90,
          max: 90
        },
        longitude: {
          type: Number,
          min: -180,
          max: 180
        }
      }
    },
    
    // Etiketler
    tags: [{
      type: String,
      trim: true,
      maxlength: 30
    }],
    
    // Durum
    status: {
      type: String,
      enum: ['active', 'deleted', 'archived'],
      default: 'active'
    },
    isRecurring: {
      type: Boolean,
      default: false
    },
    recurringPattern: {
      frequency: {
        type: String,
        enum: ['daily', 'weekly', 'monthly', 'yearly']
      },
      interval: {
        type: Number,
        min: 1,
        default: 1
      },
      endDate: {
        type: Date
      },
      nextOccurrence: {
        type: Date
      }
    },
    
    // Sistem alanları
    deletedAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

// Index'ler
expenseSchema.index({ userId: 1, date: -1 });
expenseSchema.index({ groupId: 1, date: -1 });
expenseSchema.index({ categoryId: 1 });
expenseSchema.index({ type: 1 });
expenseSchema.index({ status: 1 });
expenseSchema.index({ amount: 1 });
expenseSchema.index({ tags: 1 });
expenseSchema.index({ 'location.coordinates': '2dsphere' });

// Compound index'ler
expenseSchema.index({ userId: 1, type: 1, date: -1 });
expenseSchema.index({ groupId: 1, status: 1, date: -1 });
expenseSchema.index({ userId: 1, categoryId: 1, date: -1 });

// Text search index
expenseSchema.index({ 
  title: 'text', 
  description: 'text', 
  tags: 'text' 
});

// Virtual fields
expenseSchema.virtual('isGroupExpense').get(function() {
  return this.type === 'group' && this.groupId;
});

expenseSchema.virtual('isPersonalExpense').get(function() {
  return this.type === 'personal';
});

expenseSchema.virtual('formattedAmount').get(function() {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: this.currency
  }).format(this.amount);
});

// Pre-save middleware
expenseSchema.pre('save', function (next) {
  // Grup harcaması için splitBetween kontrolü
  if (this.type === 'group' && this.splitBetween && this.splitBetween.length > 0) {
    // Eğer splitAmounts yoksa, eşit böl
    if (!this.splitAmounts || this.splitAmounts.length === 0) {
      const amountPerPerson = this.amount / this.splitBetween.length;
      this.splitAmounts = this.splitBetween.map(userId => ({
        userId,
        amount: Math.round(amountPerPerson * 100) / 100 // 2 ondalık basamak
      }));
    }
  }
  
  // Recurring expense için nextOccurrence hesapla
  if (this.isRecurring && this.recurringPattern) {
    this.calculateNextOccurrence();
  }
  
  next();
});

// Pre-save middleware - soft delete
expenseSchema.pre('save', function (next) {
  if (this.isModified('status') && this.status === 'deleted') {
    this.deletedAt = new Date();
  }
  next();
});

// Instance methods
expenseSchema.methods.calculateNextOccurrence = function() {
  if (!this.recurringPattern) return;
  
  const now = new Date();
  const currentDate = this.date;
  const frequency = this.recurringPattern.frequency;
  const interval = this.recurringPattern.interval;
  
  let nextDate = new Date(currentDate);
  
  switch (frequency) {
    case 'daily':
      nextDate.setDate(nextDate.getDate() + interval);
      break;
    case 'weekly':
      nextDate.setDate(nextDate.getDate() + (interval * 7));
      break;
    case 'monthly':
      nextDate.setMonth(nextDate.getMonth() + interval);
      break;
    case 'yearly':
      nextDate.setFullYear(nextDate.getFullYear() + interval);
      break;
  }
  
  // End date kontrolü
  if (this.recurringPattern.endDate && nextDate > this.recurringPattern.endDate) {
    this.isRecurring = false;
    this.recurringPattern.nextOccurrence = undefined;
  } else {
    this.recurringPattern.nextOccurrence = nextDate;
  }
};

// Static methods
expenseSchema.statics.getUserExpenses = function(userId: Types.ObjectId, filters: any = {}) {
  const query = { userId, status: 'active', ...filters };
  return this.find(query)
    .populate('categoryId', 'name icon color')
    .populate('groupId', 'name')
    .populate('paidBy', 'name')
    .sort({ date: -1 });
};

expenseSchema.statics.getGroupExpenses = function(groupId: Types.ObjectId, filters: any = {}) {
  const query = { groupId, status: 'active', ...filters };
  return this.find(query)
    .populate('categoryId', 'name icon color')
    .populate('paidBy', 'name')
    .populate('splitBetween', 'name')
    .sort({ date: -1 });
};

expenseSchema.statics.getExpenseStats = function(userId: Types.ObjectId, startDate: Date, endDate: Date) {
  return this.aggregate([
    {
      $match: {
        userId,
        status: 'active',
        date: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: '$categoryId',
        totalAmount: { $sum: '$amount' },
        count: { $sum: 1 },
        averageAmount: { $avg: '$amount' }
      }
    },
    {
      $lookup: {
        from: 'categories',
        localField: '_id',
        foreignField: '_id',
        as: 'category'
      }
    },
    {
      $unwind: '$category'
    },
    {
      $sort: { totalAmount: -1 }
    }
  ]);
};

export const Expense = mongoose.model<IExpense>('Expense', expenseSchema);