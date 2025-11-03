import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

export async function connectMongo() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error('MONGO_URI not set in env');
  }
  mongoose.set('strictQuery', false);
  await mongoose.connect(uri, { });
  console.log('MongoDB connected');
  return mongoose;
}
