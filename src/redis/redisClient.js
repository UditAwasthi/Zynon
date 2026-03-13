// lib/redis.js
import Redis from "ioredis";

const useTLS = process.env.REDIS_URL?.startsWith("rediss://");

export const redisConnection = {
  url: process.env.REDIS_URL,
  tls: useTLS ? {} : undefined,
  maxRetriesPerRequest: null,
  keepAlive: 10000,
  enableOfflineQueue: true,
  retryStrategy: (times) => {
    if (times > 10) return null;
    return Math.min(times * 500, 3000);
  },
};

const redis = new Redis(process.env.REDIS_URL, redisConnection);

redis.once("connect", () => console.log("Redis connected"));
redis.on("error", (err) => console.error("Redis error:", err.message));
redis.on("reconnecting", () => console.log("Redis reconnecting..."));

export default redis;