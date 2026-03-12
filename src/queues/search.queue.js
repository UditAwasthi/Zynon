import { Queue } from "bullmq";
import { connection } from "./connection.js";

export const searchQueue = new Queue("search-index", {
  connection
});