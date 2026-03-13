// search.worker.js
import "dotenv/config"
import { Worker } from "bullmq";
import { redisConnection} from "../redis/redisClient.js";
import { indexUsernameSearch } from "../utils/indexUsernameSearch.js";

const worker = new Worker(
  "search-index",
  async job => {
    console.log("Job received:", job.name, job.data);
    if (job.name === "index-username") {
      await indexUsernameSearch(job.data.username);
    }
  },
  {
    connection : redisConnection,
    concurrency: 5,
  }
);

worker.on("completed", job => {
  console.log(`✅ Search job done: ${job.id} — "${job.data.username}" indexed`)
});

worker.on("failed", (job, err) => {
  console.error(`❌ Search job failed: ${job.id}`, err.message)
});

worker.on("error", err => {
  console.error("Worker connection : redisConnection error (non-fatal):", err.message)
});