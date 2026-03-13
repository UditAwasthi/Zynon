import { Queue } from "bullmq";
import { redisConnection } from "../redis/redisClient.js";

export const searchQueue = new Queue("search-index", {
  connection: redisConnection,
});