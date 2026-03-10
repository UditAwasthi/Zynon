import mongoose from "mongoose";
import Message from "../../models/chat/message.model.js";
import Thread from "../../models/chat/thread.model.js";
import { ApiError } from "../../utils/ApiError.js";
import { getIO } from "../../socket/socket.js";
import redis from "../../redis/redisClient.js";

// Safe redis helper — never throws, just logs
const safeRedis = async (fn) => {
    try {
        return await fn();
    } catch (err) {
        console.error("Redis error (non-fatal):", err.message);
        return null;
    }
};

/* =====================================
   GET MESSAGES
===================================== */

export const getMessages = async (
    userId,
    threadId,
    { limit = 30, cursor } = {}
) => {

    if (!mongoose.Types.ObjectId.isValid(threadId)) {
        throw new ApiError(400, "invalid threadId");
    }

    const objectThreadId = new mongoose.Types.ObjectId(threadId);

    const thread = await Thread.findOne({
        _id: objectThreadId,
        "participants.userId": userId
    });

    if (!thread) {
        throw new ApiError(403, "You are not allowed to access this conversation");
    }

    const query = {
        threadId: objectThreadId,
        isDeleted: false
    };

    if (cursor) {
        query.createdAt = { $lt: new Date(cursor) };
    }

    const messages = await Message.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate("senderId", "username")
        .populate("replyTo", "content senderId")
        .lean();

    // Reset unread counter when chat opened
    await safeRedis(() => redis.del(`unread:${threadId}:${userId}`));

    return messages.reverse();
};

/* =====================================
   SEND MESSAGE
===================================== */

export const sendMessage = async (userId, { threadId, content }) => {

    if (!mongoose.Types.ObjectId.isValid(threadId)) {
        throw new ApiError(400, "Invalid threadId");
    }

    if (!content || !content.trim()) {
        throw new ApiError(400, "Message content cannot be empty");
    }

    const objectThreadId = new mongoose.Types.ObjectId(threadId);

    const thread = await Thread.findOne({
        _id: objectThreadId,
        "participants.userId": userId
    });

    if (!thread) {
        throw new ApiError(403, "You are not part of this conversation");
    }

    const message = await Message.create({
        threadId: objectThreadId,
        senderId: userId,
        content,
        type: "text",
        isDeleted: false
    });

    // Update thread metadata
    await Thread.updateOne(
        { _id: objectThreadId },
        {
            $set: {
                lastActivity: new Date(),
                lastMessage: {
                    messageId: message._id,
                    senderId: userId,
                    content,
                    createdAt: message.createdAt
                }
            },
            $inc: { messageCount: 1 }
        }
    );

    // Populate sender for socket payload
    const populatedMessage = await Message.findById(message._id)
        .populate("senderId", "username")
        .lean();

    const io = getIO();

    // Realtime message delivery
    io.to(objectThreadId.toString()).emit("new_message", populatedMessage);

    // Update unread counters for other participants
    const receivers = thread.participants
        .map(p => p.userId.toString())
        .filter(id => id !== userId.toString());

    for (const receiverId of receivers) {
        await safeRedis(() => redis.incr(`unread:${threadId}:${receiverId}`));

        const receiverSocketId = await safeRedis(() =>
            redis.get(`user:socket:${receiverId}`)
        );

        if (receiverSocketId) {
            io.to(receiverSocketId).emit("unread_update", {
                threadId,
                userId: receiverId
            });
        }
    }

    return populatedMessage;
};

/* =====================================
   READ RECEIPTS
===================================== */

export const markMessagesSeen = async (userId, { threadId, messageIds }) => {

    if (!mongoose.Types.ObjectId.isValid(threadId)) {
        throw new ApiError(400, "Invalid threadId");
    }

    if (!Array.isArray(messageIds) || messageIds.length === 0) {
        throw new ApiError(400, "messageIds are required");
    }

    const objectThreadId = new mongoose.Types.ObjectId(threadId);

    const thread = await Thread.findOne({
        _id: objectThreadId,
        "participants.userId": userId
    });

    if (!thread) {
        throw new ApiError(403, "You are not part of this conversation");
    }

    await Message.updateMany(
        {
            _id: { $in: messageIds },
            threadId: objectThreadId
        },
        {
            $addToSet: { seenBy: userId }
        }
    );

    const io = getIO();
    io.to(threadId.toString()).emit("messages_seen", {
        messageIds,
        seenBy: userId
    });

    return { success: true };
};

/* =====================================
   REACT TO MESSAGES
===================================== */

export const addReaction = async (userId, { messageId, emoji }) => {

    const message = await Message.findById(messageId);

    if (!message) {
        throw new ApiError(404, "Message not found");
    }

    const thread = await Thread.findOne({
        _id: message.threadId,
        "participants.userId": userId
    });

    if (!thread) throw new ApiError(403, "You are not part of this conversation");

    const threadId = message.threadId;

    await Message.updateOne(
        { _id: messageId },
        [
            {
                $set: {
                    reactions: {
                        $filter: {
                            input: "$reactions",
                            cond: { $ne: ["$$this.userId", userId] }
                        }
                    }
                }
            },
            { $push: { reactions: { userId, emoji } } }
        ]
    );

    const io = getIO();
    io.to(threadId.toString()).emit("reaction_update", {
        messageId,
        userId,
        emoji
    });

    return { success: true };
};