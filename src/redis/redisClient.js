import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL, {
    tls: {}, // ← required for Upstash (rediss://)
    maxRetriesPerRequest: null,
    enableOfflineQueue: false,
    retryStrategy: (times) => {
        if (times > 3) return null;
        return Math.min(times * 500, 2000);
    },
});

redis.once("connect", () => console.log("Redis connected"));
redis.on("error", (err) => {
    console.error("Redis error:", err.message);
});

export default redis;