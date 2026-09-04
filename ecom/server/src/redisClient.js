import Redis from 'ioredis';
import { REDIS_URL } from './config.js';

// If no REDIS_URL is provided, it tries to connect to localhost:6379 by default
const redisClient = new Redis(REDIS_URL || 'redis://localhost:6379', {
    lazyConnect: true,
});

redisClient.on('error', (err) => {
    console.error('Redis Client Error:', err);
});

redisClient.on('connect', () => {
    console.log('✅ Redis client connected');
});

export const connectRedis = async () => {
    try {
        await redisClient.connect();
    } catch (err) {
        console.error('Failed to connect to Redis:', err);
    }
};

export default redisClient;
