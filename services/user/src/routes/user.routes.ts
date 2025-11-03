import { Router } from 'express';
import { UserModel } from '../models/user.model';

const router = Router();

// create user
router.post('/', async (req, res) => {
  const { email, name } = req.body;
  const u = await UserModel.create({ email, name });
  res.status(201).json(u);
});

// list users
router.get('/', async (req, res) => {
  const users = await UserModel.find().limit(50).lean();
  res.json(users);
});

export default router;
