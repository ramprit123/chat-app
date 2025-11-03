import { Router } from 'express';
import { EmailModel } from '../models/email.model';
import { rabbitmq } from '../lib/rabbitmq';

const router = Router();

// queue email
router.post('/send', async (req, res) => {
  const { to, subject, body } = req.body;
  const email = await EmailModel.create({ to, subject, body, status: 'queued' });
  // publish to rabbit for email worker
  rabbitmq.publish('email_queue', { emailId: email._id });
  res.status(202).json({ id: email._id });
});

export default router;
