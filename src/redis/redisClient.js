import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL || "redis://127.0.0.1:6379");

redis.once("connect", () => {
  console.log("Redis connected");
});
redis.on("error", (err) => {
  console.error("Redis error:", err);
});

export default redis;