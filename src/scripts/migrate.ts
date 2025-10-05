import mongoose from 'mongoose';
import { config } from '../config/config';
import { connectDB, createIndexes, seedDefaultData } from '../config/database';

// Migration script to update existing data structure
const migrateData = async (): Promise<void> => {
  try {
    console.log('Starting data migration...');
    
    // Connect to database
    await connectDB();
    
    // Create indexes
    await createIndexes();
    
    // Seed default data
    await seedDefaultData();
    
    // Migrate existing users
    await migrateUsers();
    
    // Migrate existing expenses
    await migrateExpenses();
    
    // Migrate existing groups
    await migrateGroups();
    
    console.log('Data migration completed successfully');
    
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
  }
};

const migrateUsers = async (): Promise<void> => {
  try {
    const { User } = await import('../models/User');
    
    console.log('Migrating users...');
    
    // Update existing users with new fields
    const result = await User.updateMany(
      {
        $or: [
          { currency: { $exists: false } },
          { timezone: { $exists: false } },
          { preferences: { $exists: false } },
          { stats: { $exists: false } }
        ]
      },
      {
        $set: {
          currency: 'TRY',
          timezone: 'Europe/Istanbul',
          preferences: {
            notifications: true,
            darkMode: false,
            language: 'tr'
          },
          stats: {
            totalExpenses: 0,
            totalGroups: 0,
            joinDate: new Date(),
            lastActiveDate: new Date()
          }
        }
      }
    );
    
    console.log(`Updated ${result.modifiedCount} users`);
    
  } catch (error) {
    console.error('Error migrating users:', error);
    throw error;
  }
};

const migrateExpenses = async (): Promise<void> => {
  try {
    const { Expense } = await import('../models/Expense');
    const { Category } = await import('../models/Category');
    
    console.log('Migrating expenses...');
    
    // Get default categories
    const defaultCategories = await Category.find({ isDefault: true });
    const defaultCategoryId = defaultCategories.find(c => c.name === 'Diğer')?._id;
    
    if (!defaultCategoryId) {
      throw new Error('Default category not found');
    }
    
    // Update existing expenses with new fields
    const result = await Expense.updateMany(
      {
        $or: [
          { categoryId: { $exists: false } },
          { currency: { $exists: false } },
          { status: { $exists: false } },
          { title: { $exists: false } }
        ]
      },
      {
        $set: {
          categoryId: defaultCategoryId,
          currency: 'TRY',
          status: 'active',
          title: '$description' // Use description as title
        }
      }
    );
    
    console.log(`Updated ${result.modifiedCount} expenses`);
    
    // Update expenses that have description but no title
    await Expense.updateMany(
      { title: { $regex: /^\$description$/ } },
      [
        {
          $set: {
            title: '$description'
          }
        }
      ]
    );
    
  } catch (error) {
    console.error('Error migrating expenses:', error);
    throw error;
  }
};

const migrateGroups = async (): Promise<void> => {
  try {
    const { Group } = await import('../models/Group');
    
    console.log('Migrating groups...');
    
    // Update existing groups with new structure
    const groups = await Group.find({
      $or: [
        { 'members.0': { $exists: false } },
        { settings: { $exists: false } },
        { stats: { $exists: false } }
      ]
    });
    
    for (const group of groups) {
      // Convert old members array to new structure
      if (group.members && group.members.length > 0 && typeof group.members[0] === 'string') {
        const oldMembers = group.members as any[];
        group.members = oldMembers.map(memberId => ({
          userId: memberId,
          role: 'member',
          joinedAt: group.createdAt,
          isActive: true
        }));
      }
      
      // Add default settings
      if (!group.settings) {
        group.settings = {
          allowMemberInvites: true,
          requireApprovalForExpenses: false,
          defaultCurrency: 'TRY',
          splitMethod: 'equal',
          notifications: {
            newExpense: true,
            newMember: true,
            expenseReminder: false
          }
        };
      }
      
      // Add default stats
      if (!group.stats) {
        group.stats = {
          totalExpenses: 0,
          totalAmount: 0,
          memberCount: group.members.length,
          lastActivity: group.updatedAt
        };
      }
      
      // Add default icon and color
      if (!group.icon) {
        group.icon = '👥';
      }
      if (!group.color) {
        group.color = '#3B82F6';
      }
      
      await group.save();
    }
    
    console.log(`Updated ${groups.length} groups`);
    
  } catch (error) {
    console.error('Error migrating groups:', error);
    throw error;
  }
};

// Run migration if this file is executed directly
if (require.main === module) {
  migrateData()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

export { migrateData };
