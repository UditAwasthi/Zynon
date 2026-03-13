// src/redis/redisClient.js
import Redis from "ioredis";

if (!process.env.REDIS_URL) throw new Error("❌ REDIS_URL is not defined");

const REDIS_URL = process.env.REDIS_PRIVATE_URL || process.env.REDIS_URL;
const useTLS = REDIS_URL.startsWith("rediss://");

const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
  keepAlive: 10000,
  enableOfflineQueue: true,
  tls: useTLS ? {} : undefined,
  retryStrategy: (times) => {
    if (times > 10) return null;
    return Math.min(times * 500, 3000);
  },
});

redis.once("connect", () => console.log("✅ Redis connected"));
redis.on("error", (err) => console.error("Redis error:", err.message));
redis.on("reconnecting", () => console.log("Redis reconnecting..."));

export const redisConnection = redis; // ← same instance, BullMQ gets a real Redis instance
export default redis;