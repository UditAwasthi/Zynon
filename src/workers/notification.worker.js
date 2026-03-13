import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Worker MongoDB connected");
}

import { Worker } from "bullmq";
import { redisConnection } from "../redis/redisClient.js";
import Notification from "../models/notifications/notifications.model.js";
import Follow from "../models/social/follow.model.js";
import { getIO } from "../socket/socket.js";
import redis from "../redis/redisClient.js";
import { NOTIFICATION_JOBS } from "../modules/notifications/notification.jobs.js";

const worker = new Worker(
  "notifications",
  async job => {

    const { actorId, recipientId } = job.data;

    if (recipientId && actorId.toString() === recipientId.toString()) return;

    let notification;

    switch (job.name) {

      case NOTIFICATION_JOBS.POST_LIKE:
        const key = `notif:like:${job.data.postId}:${recipientId}`;
        if (await redis.get(key)) return;
        await redis.set(key, "1", "EX", 15);
        notification = await Notification.create({
          recipient: recipientId, actor: actorId,
          type: "POST_LIKE", entityType: "post", entityId: job.data.postId
        });
        break;

      case NOTIFICATION_JOBS.COMMENT_LIKE:
        const key1 = `notif:comment_like:${job.data.commentId}:${recipientId}`;
        if (await redis.get(key1)) return;
        await redis.set(key1, "1", "EX", 15);
        notification = await Notification.create({
          recipient: recipientId, actor: actorId,
          type: "COMMENT_LIKE", entityType: "comment", entityId: job.data.commentId,
          metadata: { postId: job.data.postId }
        });
        break;

      case NOTIFICATION_JOBS.POST_COMMENT:
        const commentKey = `notif:comment:${job.data.postId}:${recipientId}`;
        if (await redis.get(commentKey)) return;
        await redis.set(commentKey, "1", "EX", 10);
        notification = await Notification.create({
          recipient: recipientId, actor: actorId,
          type: "POST_COMMENT", entityType: "comment", entityId: job.data.commentId,
          metadata: { postId: job.data.postId }
        });
        break;

      case NOTIFICATION_JOBS.NEW_MESSAGE:
        notification = await Notification.create({
          recipient: recipientId, actor: actorId,
          type: "NEW_MESSAGE", entityType: "message", entityId: job.data.messageId,
          metadata: { threadId: job.data.threadId }
        });
        break;

      case NOTIFICATION_JOBS.FOLLOW_REQUEST:
        notification = await Notification.create({
          recipient: recipientId, actor: actorId,
          type: "FOLLOW_REQUEST", entityType: "follow"
        });
        break;

      case NOTIFICATION_JOBS.FOLLOW_ACCEPTED:
        notification = await Notification.create({
          recipient: recipientId, actor: actorId,
          type: "FOLLOW_ACCEPTED", entityType: "follow"
        });
        break;

      case NOTIFICATION_JOBS.MENTION:
        notification = await Notification.create({
          recipient: recipientId, actor: actorId,
          type: "MENTION", entityType: "post", entityId: job.data.postId
        });
        break;

      case NOTIFICATION_JOBS.NEW_POST:
        const followers = await Follow.find({ following: actorId }).select("follower");
        if (followers.length === 0) break;

        const inserted = await Notification.insertMany(
          followers.map(f => ({
            recipient: f.follower, actor: actorId,
            type: "NEW_POST", entityType: "post", entityId: job.data.postId
          }))
        );

        const io = getIO();
        for (const notif of inserted) {
          await redis.incr(`notif:unread:${notif.recipient}`);
          const socketId = await redis.get(`user:socket:${notif.recipient}`);
          if (socketId) io.to(socketId).emit("notification:new", notif);
        }
        break;
    }

    if (!notification) return;

    await redis.incr(`notif:unread:${recipientId}`);
    const socketId = await redis.get(`user:socket:${recipientId}`);
    if (socketId) {
      const io = getIO();
      io.to(socketId).emit("notification:new", notification);
    }

  },
  { connection: redisConnection, concurrency: 5 }
);

worker.on("completed", (job) => console.log(`✅ Notification job completed: ${job.id}`));
worker.on("failed", (job, err) => console.error(`❌ Notification job failed: ${job?.id} | ${err.message}`));
worker.on("error", (err) => console.error("❌ Worker error:", err.message));