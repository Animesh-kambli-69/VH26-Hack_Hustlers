import redisClient from '../redisClient.js';

export const cacheMiddleware = (duration = 3600) => {
    return async (req, res, next) => {
        if (req.method !== 'GET') {
            return next();
        }

        const key = `cache:${req.originalUrl || req.url}`;
        
        try {
            const cachedResponse = await redisClient.get(key);
            if (cachedResponse) {
                console.log(`[Cache Hit] ${key}`);
                return res.json(JSON.parse(cachedResponse));
            }

            console.log(`[Cache Miss] ${key}`);
            
            // Override res.json to cache the response
            const originalJson = res.json;
            res.json = (body) => {
                // only cache if status is 2xx
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    redisClient.setex(key, duration, JSON.stringify(body))
                        .catch(err => console.error('Redis Set Ex Error:', err));
                }
                return originalJson.call(res, body);
            };
            
            next();
        } catch (error) {
            console.error('Redis Cache Middleware Error:', error);
            // On error, bypass cache
            next();
        }
    };
};
