import { Worker } from "bullmq";
import { redisConnection } from "../redis/redisClient.js";
import Notification from "../models/notifications/notifications.model.js";
import Follow from "../models/social/follow.model.js"; // ✅ added
import { getIO } from "../socket/socket.js";
import redis from "../redis/redisClient.js";
import { NOTIFICATION_JOBS } from "../modules/notifications/notification.jobs.js";
const worker = new Worker(
  "notifications",
  async job => {

    const { actorId, recipientId } = job.data;

    // Guard only for jobs that have a recipientId (NEW_POST fans out to followers instead)
    if (recipientId && actorId.toString() === recipientId.toString()) return;

    let notification;

    switch (job.name) {

      case NOTIFICATION_JOBS.POST_LIKE:


        const key = `notif:like:${job.data.postId}:${recipientId}`;

        const exists = await redis.get(key);

        if (exists) {
          return; // skip duplicate notification
        }

        await redis.set(key, "1", "EX", 15);

        notification = await Notification.create({
          recipient: recipientId,
          actor: actorId,
          type: "POST_LIKE",
          entityType: "post",
          entityId: job.data.postId
        });

        break;

      case NOTIFICATION_JOBS.COMMENT_LIKE:

        const key1 = `notif:comment_like:${job.data.commentId}:${recipientId}`;

        const exists12 = await redis.get(key1); // ✅ was wrongly using `key` from POST_LIKE scope

        if (exists12) {
          return; // skip duplicate notification
        }

        await redis.set(key1, "1", "EX", 15);

        notification = await Notification.create({
          recipient: recipientId,
          actor: actorId,
          type: "COMMENT_LIKE",
          entityType: "comment",
          entityId: job.data.commentId,
          metadata: {
            postId: job.data.postId
          }
        });

        break;

      case NOTIFICATION_JOBS.POST_COMMENT:

        const commentKey = `notif:comment:${job.data.postId}:${recipientId}`;

        const exists1 = await redis.get(commentKey);

        if (exists1) {
          return; // skip duplicate comment notification within TTL
        }

        await redis.set(commentKey, "1", "EX", 10); // prevent duplicates for 10 seconds

        notification = await Notification.create({
          recipient: recipientId,
          actor: actorId,
          type: "POST_COMMENT",
          entityType: "comment",
          entityId: job.data.commentId,
          metadata: { postId: job.data.postId }
        });

        break;

      case NOTIFICATION_JOBS.NEW_MESSAGE:
        notification = await Notification.create({
          recipient: recipientId,
          actor: actorId,
          type: "NEW_MESSAGE",
          entityType: "message",
          entityId: job.data.messageId,
          metadata: { threadId: job.data.threadId }
        });
        break;

      case NOTIFICATION_JOBS.FOLLOW_REQUEST:
        notification = await Notification.create({
          recipient: recipientId,
          actor: actorId,
          type: "FOLLOW_REQUEST",
          entityType: "follow"
        });
        break;

      case NOTIFICATION_JOBS.FOLLOW_ACCEPTED:
        notification = await Notification.create({
          recipient: recipientId,
          actor: actorId,
          type: "FOLLOW_ACCEPTED",
          entityType: "follow"
        });
        break;

      case NOTIFICATION_JOBS.MENTION:
        notification = await Notification.create({
          recipient: recipientId,
          actor: actorId,
          type: "MENTION",
          entityType: "post",
          entityId: job.data.postId
        });
        break;

      case NOTIFICATION_JOBS.NEW_POST:

        const followers = await Follow.find({
          following: actorId
        }).select("follower");

        const notifications = followers.map(f => ({
          recipient: f.follower,
          actor: actorId,
          type: "NEW_POST",
          entityType: "post",
          entityId: job.data.postId
        }));

        const inserted = await Notification.insertMany(notifications);

        const io = getIO();

        for (const notif of inserted) {

          await redis.incr(`notif:unread:${notif.recipient}`);

          const socketId = await redis.get(`user:socket:${notif.recipient}`);

          if (socketId) {
            io.to(socketId).emit("notification:new", notif);
          }

        }

        break;
    }

    if (!notification) return;

    // increment unread counter
    await redis.incr(`notif:unread:${recipientId}`);

    // send realtime notification
    const socketId = await redis.get(`user:socket:${recipientId}`);

    if (socketId) {
      const io = getIO();
      io.to(socketId).emit("notification:new", notification);
    }

  },
  {
    connection : redisConnection,
    concurrency: 5
  }
);

worker.on("completed", job => {
  console.log(`✅ Notification job completed: ${job.id}`);
});

worker.on("failed", (job, err) => {
  console.error(`❌ Notification job failed: ${job.id}`, err.message);
});