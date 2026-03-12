import Redis from "ioredis";

const useTLS = process.env.REDIS_URL?.startsWith("rediss://");

export const connection = new Redis(process.env.REDIS_URL, {
    tls: useTLS ? {} : undefined,
    maxRetriesPerRequest: null,
    enableOfflineQueue: false,
    retryStrategy: (times) => {
        if (times > 3) return null;
        return Math.min(times * 500, 2000);
    },
});