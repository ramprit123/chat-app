import { Schema, model, Document, Types } from 'mongoose';

export interface IChatMessage extends Document {
  from: Types.ObjectId;
  to?: Types.ObjectId;
  roomId?: string;
  message: string;
  createdAt: Date;
}

const ChatSchema = new Schema<IChatMessage>({
  from: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  to: { type: Schema.Types.ObjectId, ref: 'User' },
  roomId: { type: String },
  message: { type: String, required: true },
}, { timestamps: { createdAt: true, updatedAt: false }});

export const ChatModel = model<IChatMessage>('ChatMessage', ChatSchema);
