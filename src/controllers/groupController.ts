import { Request, Response } from 'express';
import { Group } from '../models/Group';
import { User } from '../models/User';

export const createGroup = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description, members } = req.body;
    const createdBy = req.user._id;

    const group = new Group({
      name,
      description,
      members: [...members, createdBy],
      createdBy
    });

    await group.save();

    // Add group to users' groups
    await User.updateMany(
      { _id: { $in: [...members, createdBy] } },
      { $push: { groups: group._id } }
    );

    res.status(201).json(group);
  } catch (error) {
    res.status(500).json({ message: 'Error creating group', error });
  }
};

export const getGroups = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user._id;

    const groups = await Group.find({ members: userId })
      .populate('members', 'name email')
      .populate('createdBy', 'name email');

    res.json(groups);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching groups', error });
  }
};

export const getGroupDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const { groupId } = req.params;
    const userId = req.user._id;

    const group = await Group.findOne({ _id: groupId, members: userId })
      .populate('members', 'name email')
      .populate('createdBy', 'name email');

    if (!group) {
      res.status(404).json({ message: 'Group not found' });
      return;
    }

    res.json(group);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching group details', error });
  }
};

export const addMemberToGroup = async (req: Request, res: Response): Promise<void> => {
  try {
    const { groupId } = req.params;
    const { memberId } = req.body;
    const userId = req.user._id;

    const group = await Group.findOne({ _id: groupId, members: userId });
    if (!group) {
      res.status(404).json({ message: 'Group not found' });
      return;
    }

    if (group.members.includes(memberId)) {
      res.status(400).json({ message: 'User is already a member' });
      return;
    }

    group.members.push(memberId);
    await group.save();

    await User.findByIdAndUpdate(memberId, {
      $push: { groups: groupId }
    });

    res.json(group);
  } catch (error) {
    res.status(500).json({ message: 'Error adding member to group', error });
  }
}; 