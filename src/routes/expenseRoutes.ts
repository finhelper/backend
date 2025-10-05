import { Router } from 'express';
import { createExpense, getExpenses, getExpenseStats } from '../controllers/expenseController';
import { auth } from '../middlewares/authMiddleware';

const router = Router();

router.use(auth);

router.post('/', createExpense);
router.get('/', getExpenses);
router.get('/stats', getExpenseStats);

export default router; 