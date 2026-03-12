import "dotenv/config"  // ← must be first

import { Worker } from "bullmq";
import { connection } from "../queues/connection.js";
import { indexUsernameSearch } from "../utils/indexUsernameSearch.js";

const worker = new Worker(
  "search-index",
  async job => {

    if (job.name === "index-username") {
      await indexUsernameSearch(job.data.username)
    }

  },
  { connection }
);

worker.on("completed", job => {
  console.log(`Search job completed: ${job.id}`)
});

worker.on("failed", (job, err) => {
  console.error(`Search job failed: ${job.id}`, err.message)
});