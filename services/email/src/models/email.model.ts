import { Schema, model, Document } from 'mongoose';

export interface IEmail extends Document {
  to: string;
  subject: string;
  body: string;
  status: 'queued' | 'sent' | 'failed';
  createdAt: Date;
  updatedAt: Date;
}

const EmailSchema = new Schema<IEmail>({
  to: { type: String, required: true, index: true },
  subject: { type: String, required: true },
  body: { type: String, required: true },
  status: { type: String, required: true, default: 'queued' },
}, { timestamps: true });

export const EmailModel = model<IEmail>('Email', EmailSchema);
