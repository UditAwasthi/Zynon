// ── Imports (all at top) ──────────────────────────────────────────────────────
import "../config/env.js";
import mongoose from "mongoose";
import { Worker } from "bullmq";
import { redisConnection } from "../redis/redisClient.js";
import redis from "../redis/redisClient.js";
import Notification from "../models/notifications/notifications.model.js";
import Follow from "../models/social/follow.model.js";
import { getIO } from "../socket/socket.js";
import { NOTIFICATION_JOBS } from "../modules/notifications/notification.jobs.js";

// ── DB Connection ─────────────────────────────────────────────────────────────
if (mongoose.connection.readyState === 0) {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ Worker MongoDB connected");
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function isDuplicate(key, ttl = 15) {
  if (await redis.get(key)) return true;
  await redis.set(key, "1", "EX", ttl);
  return false;
}

async function emitToUser(recipientId, notification) {
  await redis.incr(`notif:unread:${recipientId}`);
  const socketId = await redis.get(`user:socket:${recipientId}`);
  if (socketId) getIO().to(socketId).emit("notification:new", notification);
}

// ── Job Handlers ──────────────────────────────────────────────────────────────

const handlers = {
  [NOTIFICATION_JOBS.POST_LIKE]: async ({ actorId, recipientId, postId }) => {
    if (await isDuplicate(`notif:like:${postId}:${actorId}:${recipientId}`)) return;
    return Notification.create({ recipient: recipientId, actor: actorId, type: "POST_LIKE", entityType: "post", entityId: postId });
  },

  [NOTIFICATION_JOBS.COMMENT_LIKE]: async ({ actorId, recipientId, commentId, postId }) => {
    if (await isDuplicate(`notif:comment_like:${commentId}:${actorId}:${recipientId}`)) return;
    return Notification.create({ recipient: recipientId, actor: actorId, type: "COMMENT_LIKE", entityType: "comment", entityId: commentId, metadata: { postId } });
  },

  [NOTIFICATION_JOBS.POST_COMMENT]: async ({ actorId, recipientId, commentId, postId }) => {
    if (await isDuplicate(`notif:comment:${postId}:${actorId}:${recipientId}`, 10)) return;
    return Notification.create({ recipient: recipientId, actor: actorId, type: "POST_COMMENT", entityType: "comment", entityId: commentId, metadata: { postId } });
  },

  [NOTIFICATION_JOBS.NEW_MESSAGE]: async ({ actorId, recipientId, messageId, threadId }) => {
    return Notification.create({ recipient: recipientId, actor: actorId, type: "NEW_MESSAGE", entityType: "message", entityId: messageId, metadata: { threadId } });
  },

  // Public follow — "started following you"
  [NOTIFICATION_JOBS.FOLLOW]: async ({ actorId, recipientId }) => {
    if (await isDuplicate(`notif:follow:${actorId}:${recipientId}`, 30)) return;
    return Notification.create({ recipient: recipientId, actor: actorId, type: "FOLLOW", entityType: "follow" });
  },

  // Private follow — "sent you a follow request"
  [NOTIFICATION_JOBS.FOLLOW_REQUEST]: async ({ actorId, recipientId }) => {
    if (await isDuplicate(`notif:follow_req:${actorId}:${recipientId}`, 30)) return;
    return Notification.create({ recipient: recipientId, actor: actorId, type: "FOLLOW_REQUEST", entityType: "follow" });
  },

  [NOTIFICATION_JOBS.FOLLOW_ACCEPTED]: async ({ actorId, recipientId }) => {
    if (await isDuplicate(`notif:follow_acc:${actorId}:${recipientId}`, 30)) return;
    return Notification.create({ recipient: recipientId, actor: actorId, type: "FOLLOW_ACCEPTED", entityType: "follow" });
  },

  [NOTIFICATION_JOBS.MENTION]: async ({ actorId, recipientId, postId }) => {
    return Notification.create({ recipient: recipientId, actor: actorId, type: "MENTION", entityType: "post", entityId: postId });
  },

  [NOTIFICATION_JOBS.NEW_POST]: async ({ actorId, postId }) => {
    const followers = await Follow.find({ following: actorId, status: "active" }).select("follower");
    if (!followers.length) return;

    const notifications = await Notification.insertMany(
      followers.map(({ follower }) => ({
        recipient: follower, actor: actorId,
        type: "NEW_POST", entityType: "post", entityId: postId,
      }))
    );

    // Fix: use n.recipient per notification, not the outer recipientId (undefined for NEW_POST)
    await Promise.all(notifications.map(n => emitToUser(n.recipient.toString(), n)));
  },
};

// ── Worker ────────────────────────────────────────────────────────────────────

const worker = new Worker(
  "notifications",
  async (job) => {
    const { actorId, recipientId } = job.data;

    if (recipientId && actorId.toString() === recipientId.toString()) return;

    const handler = handlers[job.name];
    if (!handler) return;

    const notification = await handler(job.data);

    // NEW_POST fans out to many recipients and calls emitToUser internally
    // for each follower — skip the outer emit (recipientId is also undefined).
    if (notification && job.name !== NOTIFICATION_JOBS.NEW_POST) {
      await emitToUser(recipientId, notification);
    }
  },
  { connection: redisConnection, concurrency: 5 }
);

worker.on("completed", (job) => console.log(`✅ Notification job completed: ${job.id}`));
worker.on("failed", (job, err) => console.error(`❌ Notification job failed: ${job?.id} | ${err.message}`));
worker.on("error", (err) => console.error("❌ Worker error:", err.message));