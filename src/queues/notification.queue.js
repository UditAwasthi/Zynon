import { Queue } from "bullmq";
import { redisConnection } from "../redis/redisClient.js";

export const notificationQueue = new Queue("notifications", {
  connection: redisConnection,
});