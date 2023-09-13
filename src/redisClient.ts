import { createClient } from 'redis';

export const redisClient = createClient({
    url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`
});

redisClient.connect()
    .then(() => console.log('Redis client connected'))
    .catch((err) => console.error('Redis client connection failed', err));
