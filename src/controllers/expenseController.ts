import { Request, Response } from 'express';
import { Expense } from '../models/Expense';
import { Group } from '../models/Group';

export const createExpense = async (req: Request, res: Response): Promise<void> => {
  try {
    const { amount, description, category, date, groupId, type } = req.body;
    const userId = req.user._id;

    const expense = new Expense({
      amount,
      description,
      category,
      date,
      userId,
      groupId,
      type,
    });

    await expense.save();

    if (type === 'group' && groupId) {
      await Group.findByIdAndUpdate(groupId, {
        $inc: { totalExpense: amount },
      });
    }

    res.status(201).json(expense);
  } catch (error) {
    res.status(500).json({ message: 'Error creating expense', error });
  }
};

export const getExpenses = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user._id;
    const { type, groupId, startDate, endDate } = req.query;

    const query: any = { userId };

    if (type) query.type = type;
    if (groupId) query.groupId = groupId;
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate as string),
        $lte: new Date(endDate as string),
      };
    }

    const expenses = await Expense.find(query).sort({ date: -1 }).populate('groupId', 'name');

    res.json(expenses);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching expenses', error });
  }
};

export const getExpenseStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user._id;
    const { startDate, endDate } = req.query;

    const query: any = { userId };
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate as string),
        $lte: new Date(endDate as string),
      };
    }

    const stats = await Expense.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$category',
          total: { $sum: '$amount' },
        },
      },
    ]);

    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching expense stats', error });
  }
};
