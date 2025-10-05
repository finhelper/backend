import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IBudget extends Document {
  // Temel bilgiler
  name: string;
  description?: string;
  amount: number;
  currency: string;
  
  // Tip ve kapsam
  type: 'personal' | 'group' | 'category';
  period: 'daily' | 'weekly' | 'monthly' | 'yearly';
  
  // İlişkiler
  userId: Types.ObjectId;
  groupId?: Types.ObjectId;
  categoryId?: Types.ObjectId;
  
  // Tarih aralığı
  startDate: Date;
  endDate: Date;
  
  // Ayarlar
  settings: {
    alertThreshold: number; // % cinsinden uyarı eşiği
    isActive: boolean;
    autoReset: boolean;
    resetDay?: number; // Ayın kaçıncı günü reset olacak
  };
  
  // İstatistikler
  stats: {
    spentAmount: number;
    remainingAmount: number;
    percentageUsed: number;
    daysRemaining: number;
    averageDailySpent: number;
    lastUpdated: Date;
  };
  
  // Durum
  status: 'active' | 'completed' | 'exceeded' | 'paused' | 'cancelled';
  
  // Sistem alanları
  createdAt: Date;
  updatedAt: Date;
}

const budgetSchema = new Schema<IBudget>(
  {
    // Temel bilgiler
    name: {
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
      min: 0.01
    },
    currency: {
      type: String,
      required: true,
      default: 'TRY',
      enum: ['TRY', 'USD', 'EUR', 'GBP']
    },
    
    // Tip ve kapsam
    type: {
      type: String,
      required: true,
      enum: ['personal', 'group', 'category']
    },
    period: {
      type: String,
      required: true,
      enum: ['daily', 'weekly', 'monthly', 'yearly']
    },
    
    // İlişkiler
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    groupId: {
      type: Schema.Types.ObjectId,
      ref: 'Group'
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: 'Category'
    },
    
    // Tarih aralığı
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    },
    
    // Ayarlar
    settings: {
      alertThreshold: {
        type: Number,
        default: 80,
        min: 0,
        max: 100
      },
      isActive: {
        type: Boolean,
        default: true
      },
      autoReset: {
        type: Boolean,
        default: false
      },
      resetDay: {
        type: Number,
        min: 1,
        max: 31
      }
    },
    
    // İstatistikler
    stats: {
      spentAmount: {
        type: Number,
        default: 0
      },
      remainingAmount: {
        type: Number,
        default: 0
      },
      percentageUsed: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
      },
      daysRemaining: {
        type: Number,
        default: 0
      },
      averageDailySpent: {
        type: Number,
        default: 0
      },
      lastUpdated: {
        type: Date,
        default: Date.now
      }
    },
    
    // Durum
    status: {
      type: String,
      enum: ['active', 'completed', 'exceeded', 'paused', 'cancelled'],
      default: 'active'
    }
  },
  {
    timestamps: true
  }
);

// Index'ler
budgetSchema.index({ userId: 1, status: 1 });
budgetSchema.index({ groupId: 1, status: 1 });
budgetSchema.index({ categoryId: 1, status: 1 });
budgetSchema.index({ startDate: 1, endDate: 1 });
budgetSchema.index({ type: 1, period: 1 });

// Compound index'ler
budgetSchema.index({ userId: 1, type: 1, status: 1 });
budgetSchema.index({ groupId: 1, type: 1, status: 1 });

// Virtual fields
budgetSchema.virtual('isExpired').get(function() {
  return new Date() > this.endDate;
});

budgetSchema.virtual('isOverBudget').get(function() {
  return this.stats.spentAmount > this.amount;
});

budgetSchema.virtual('daysElapsed').get(function() {
  const now = new Date();
  const start = this.startDate;
  const diffTime = Math.abs(now.getTime() - start.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Pre-save middleware
budgetSchema.pre('save', function (next) {
  // İstatistikleri hesapla
  this.calculateStats();
  
  // Durumu güncelle
  this.updateStatus();
  
  next();
});

// Instance methods
budgetSchema.methods.calculateStats = async function() {
  const Expense = mongoose.model('Expense');
  
  // Harcama sorgusu oluştur
  const expenseQuery: any = {
    userId: this.userId,
    status: 'active',
    date: { $gte: this.startDate, $lte: this.endDate }
  };
  
  if (this.groupId) {
    expenseQuery.groupId = this.groupId;
  }
  
  if (this.categoryId) {
    expenseQuery.categoryId = this.categoryId;
  }
  
  // Harcamaları topla
  const expenses = await Expense.aggregate([
    { $match: expenseQuery },
    {
      $group: {
        _id: null,
        totalSpent: { $sum: '$amount' }
      }
    }
  ]);
  
  this.stats.spentAmount = expenses.length > 0 ? expenses[0].totalSpent : 0;
  this.stats.remainingAmount = Math.max(0, this.amount - this.stats.spentAmount);
  this.stats.percentageUsed = (this.stats.spentAmount / this.amount) * 100;
  
  // Kalan günleri hesapla
  const now = new Date();
  const endDate = this.endDate;
  const diffTime = endDate.getTime() - now.getTime();
  this.stats.daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  
  // Günlük ortalama harcama
  const daysElapsed = this.daysElapsed;
  this.stats.averageDailySpent = daysElapsed > 0 ? this.stats.spentAmount / daysElapsed : 0;
  
  this.stats.lastUpdated = new Date();
};

budgetSchema.methods.updateStatus = function() {
  if (this.status === 'cancelled' || this.status === 'paused') {
    return;
  }
  
  if (this.isExpired) {
    this.status = this.isOverBudget ? 'exceeded' : 'completed';
  } else if (this.isOverBudget) {
    this.status = 'exceeded';
  } else {
    this.status = 'active';
  }
};

budgetSchema.methods.shouldAlert = function(): boolean {
  return this.stats.percentageUsed >= this.settings.alertThreshold && 
         this.status === 'active';
};

budgetSchema.methods.getProgressColor = function(): string {
  const percentage = this.stats.percentageUsed;
  
  if (percentage >= 100) return '#EF4444'; // Kırmızı
  if (percentage >= 80) return '#F59E0B';  // Sarı
  if (percentage >= 60) return '#3B82F6';  // Mavi
  return '#10B981'; // Yeşil
};

// Static methods
budgetSchema.statics.getUserBudgets = function(userId: Types.ObjectId, filters: any = {}) {
  const query = { userId, ...filters };
  return this.find(query)
    .populate('groupId', 'name')
    .populate('categoryId', 'name icon color')
    .sort({ startDate: -1 });
};

budgetSchema.statics.getActiveBudgets = function(userId: Types.ObjectId) {
  return this.find({
    userId,
    status: 'active',
    'settings.isActive': true,
    startDate: { $lte: new Date() },
    endDate: { $gte: new Date() }
  })
  .populate('groupId', 'name')
  .populate('categoryId', 'name icon color')
  .sort({ startDate: -1 });
};

budgetSchema.statics.getBudgetsNeedingAlert = function() {
  return this.find({
    status: 'active',
    'settings.isActive': true,
    startDate: { $lte: new Date() },
    endDate: { $gte: new Date() }
  });
};

export const Budget = mongoose.model<IBudget>('Budget', budgetSchema);
