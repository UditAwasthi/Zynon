
import { URL } from "url";

const redisUrl = new URL(process.env.REDIS_URL);

export const connection = {
  host: redisUrl.hostname,
  port: Number(redisUrl.port) || 6379,
  password: redisUrl.password || undefined,
  tls: process.env.REDIS_URL?.startsWith("rediss://") ? {} : undefined,
  maxRetriesPerRequest: null,
  keepAlive: 10000,              // ← add this
  retryStrategy: (times) => {
    if (times > 10) return null;
    return Math.min(times * 500, 3000);
  },
};