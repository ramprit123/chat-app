import Redis from 'ioredis';
import dotenv from 'dotenv';
dotenv.config();

const host = process.env.REDIS_HOST || '127.0.0.1';
const port = parseInt(process.env.REDIS_PORT || '6379', 10);

export const redisClient = new Redis({ host, port });

redisClient.on('error', (err) => {
  console.error('Redis error', err);
});
