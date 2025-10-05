import mongoose, { Document, Schema, Types } from 'mongoose';

export interface INotification extends Document {
  // Alıcı
  userId: Types.ObjectId;
  
  // Bildirim içeriği
  title: string;
  message: string;
  type: 'expense' | 'group' | 'budget' | 'system' | 'reminder';
  
  // İlişkili veriler
  relatedId?: Types.ObjectId; // Expense, Group, Budget ID'si
  relatedType?: 'expense' | 'group' | 'budget' | 'user';
  
  // Görsel ve aksiyon
  icon?: string;
  actionUrl?: string;
  actionText?: string;
  
  // Durum
  isRead: boolean;
  isPushed: boolean; // Push notification gönderildi mi
  
  // Zamanlama
  scheduledFor?: Date; // Gelecekte gönderilecek bildirimler için
  expiresAt?: Date; // Bildirim süresi
  
  // Sistem alanları
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    // Alıcı
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    
    // Bildirim içeriği
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500
    },
    type: {
      type: String,
      required: true,
      enum: ['expense', 'group', 'budget', 'system', 'reminder'],
      index: true
    },
    
    // İlişkili veriler
    relatedId: {
      type: Schema.Types.ObjectId,
      index: true
    },
    relatedType: {
      type: String,
      enum: ['expense', 'group', 'budget', 'user']
    },
    
    // Görsel ve aksiyon
    icon: {
      type: String,
      default: '🔔'
    },
    actionUrl: {
      type: String,
      trim: true
    },
    actionText: {
      type: String,
      trim: true,
      maxlength: 50
    },
    
    // Durum
    isRead: {
      type: Boolean,
      default: false,
      index: true
    },
    isPushed: {
      type: Boolean,
      default: false
    },
    
    // Zamanlama
    scheduledFor: {
      type: Date,
      index: true
    },
    expiresAt: {
      type: Date,
      index: true
    }
  },
  {
    timestamps: true
  }
);

// Index'ler
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ type: 1, createdAt: -1 });
notificationSchema.index({ scheduledFor: 1, isPushed: 1 });
notificationSchema.index({ expiresAt: 1 });

// Compound index'ler
notificationSchema.index({ userId: 1, type: 1, isRead: 1 });
notificationSchema.index({ userId: 1, createdAt: -1 });

// Virtual fields
notificationSchema.virtual('isExpired').get(function() {
  return this.expiresAt && new Date() > this.expiresAt;
});

notificationSchema.virtual('isScheduled').get(function() {
  return this.scheduledFor && new Date() < this.scheduledFor;
});

notificationSchema.virtual('isReadyToSend').get(function() {
  return !this.isPushed && (!this.scheduledFor || new Date() >= this.scheduledFor);
});

// Pre-save middleware
notificationSchema.pre('save', function (next) {
  // Varsayılan icon'ları ayarla
  if (!this.icon) {
    switch (this.type) {
      case 'expense':
        this.icon = '💰';
        break;
      case 'group':
        this.icon = '👥';
        break;
      case 'budget':
        this.icon = '📊';
        break;
      case 'system':
        this.icon = '⚙️';
        break;
      case 'reminder':
        this.icon = '⏰';
        break;
      default:
        this.icon = '🔔';
    }
  }
  
  // Varsayılan süre (7 gün)
  if (!this.expiresAt) {
    this.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  }
  
  next();
});

// Instance methods
notificationSchema.methods.markAsRead = function() {
  this.isRead = true;
  return this.save();
};

notificationSchema.methods.markAsPushed = function() {
  this.isPushed = true;
  return this.save();
};

// Static methods
notificationSchema.statics.getUserNotifications = function(
  userId: Types.ObjectId, 
  options: {
    limit?: number;
    skip?: number;
    unreadOnly?: boolean;
    type?: string;
  } = {}
) {
  const query: any = { 
    userId,
    expiresAt: { $gt: new Date() } // Süresi dolmamış
  };
  
  if (options.unreadOnly) {
    query.isRead = false;
  }
  
  if (options.type) {
    query.type = options.type;
  }
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(options.limit || 50)
    .skip(options.skip || 0);
};

notificationSchema.statics.createExpenseNotification = function(
  userId: Types.ObjectId,
  expenseId: Types.ObjectId,
  title: string,
  message: string
) {
  return this.create({
    userId,
    title,
    message,
    type: 'expense',
    relatedId: expenseId,
    relatedType: 'expense',
    actionUrl: `/expenses/${expenseId}`
  });
};

notificationSchema.statics.createGroupNotification = function(
  userId: Types.ObjectId,
  groupId: Types.ObjectId,
  title: string,
  message: string
) {
  return this.create({
    userId,
    title,
    message,
    type: 'group',
    relatedId: groupId,
    relatedType: 'group',
    actionUrl: `/groups/${groupId}`
  });
};

notificationSchema.statics.createBudgetNotification = function(
  userId: Types.ObjectId,
  budgetId: Types.ObjectId,
  title: string,
  message: string
) {
  return this.create({
    userId,
    title,
    message,
    type: 'budget',
    relatedId: budgetId,
    relatedType: 'budget',
    actionUrl: `/budgets/${budgetId}`
  });
};

notificationSchema.statics.createReminderNotification = function(
  userId: Types.ObjectId,
  title: string,
  message: string,
  scheduledFor: Date,
  relatedId?: Types.ObjectId,
  relatedType?: string
) {
  return this.create({
    userId,
    title,
    message,
    type: 'reminder',
    scheduledFor,
    relatedId,
    relatedType
  });
};

notificationSchema.statics.markAllAsRead = function(userId: Types.ObjectId) {
  return this.updateMany(
    { userId, isRead: false },
    { isRead: true }
  );
};

notificationSchema.statics.getUnreadCount = function(userId: Types.ObjectId) {
  return this.countDocuments({
    userId,
    isRead: false,
    expiresAt: { $gt: new Date() }
  });
};

notificationSchema.statics.cleanupExpired = function() {
  return this.deleteMany({
    expiresAt: { $lt: new Date() }
  });
};

export const Notification = mongoose.model<INotification>('Notification', notificationSchema);
