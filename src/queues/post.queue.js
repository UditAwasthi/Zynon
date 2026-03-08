import { Queue } from "bullmq";
import connection from "../config/redis.js";

export const postQueue = new Queue("post-upload", {
  connection
});