import { Schema, model, Document } from 'mongoose';

export interface IEmail extends Document {
  to: string;
  subject: string;
  body: string;
  status: "queued" | "sent" | "failed";
  type: "welcome" | "password-reset" | "notification" | "custom";
  sentAt?: Date;
  errorMessage?: string;
  retryCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const EmailSchema = new Schema<IEmail>(
  {
    to: { type: String, required: true, index: true },
    subject: { type: String, required: true },
    body: { type: String, required: true },
    status: {
      type: String,
      required: true,
      default: "queued",
      enum: ["queued", "sent", "failed"],
    },
    type: {
      type: String,
      required: true,
      default: "custom",
      enum: ["welcome", "password-reset", "notification", "custom"],
    },
    sentAt: { type: Date },
    errorMessage: { type: String },
    retryCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Index for efficient querying
EmailSchema.index({ status: 1, createdAt: -1 });
EmailSchema.index({ type: 1, createdAt: -1 });

export const EmailModel = model<IEmail>('Email', EmailSchema);
