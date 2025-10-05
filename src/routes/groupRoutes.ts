import { Router } from 'express';
import { createGroup, getGroups, getGroupDetails, addMemberToGroup } from '../controllers/groupController';
import { auth } from '../middlewares/authMiddleware';

const router = Router();

router.use(auth);

router.post('/', createGroup);
router.get('/', getGroups);
router.get('/:groupId', getGroupDetails);
router.post('/:groupId/members', addMemberToGroup);

export default router; 