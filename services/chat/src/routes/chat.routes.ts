import { Router } from 'express';
import { ChatModel } from '../models/chat.model';

const router = Router();

// post a chat message
router.post('/', async (req, res) => {
  const { from, to, roomId, message } = req.body;
  const doc = await ChatModel.create({ from, to, roomId, message });
  res.status(201).json(doc);
});

// fetch recent
router.get('/room/:roomId', async (req, res) => {
  const { roomId } = req.params;
  const msgs = await ChatModel.find({ roomId }).sort({ createdAt: -1 }).limit(50).lean();
  res.json(msgs);
});

export default router;
