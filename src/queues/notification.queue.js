import { Queue } from "bullmq";
import { connection } from "./connection.js";

export const notificationQueue = new Queue("notifications", {
  connection
});