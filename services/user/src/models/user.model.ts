import { Schema, model, Document } from 'mongoose';

export interface IUser extends Document {
  email: string;
  name?: string;
  passwordHash?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>({
  email: { type: String, required: true, unique: true, index: true },
  name: { type: String },
  passwordHash: { type: String },
}, { timestamps: true });

export const UserModel = model<IUser>('User', UserSchema);
