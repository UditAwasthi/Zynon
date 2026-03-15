import mongoose from "mongoose";
import Message from "../../models/chat/message.model.js";
import Thread from "../../models/chat/thread.model.js";
import { ApiError } from "../../utils/ApiError.js";
import { getIO } from "../../socket/socket.js";
import redis from "../../redis/redisClient.js";
import { notificationService } from "../notification.service.js";

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

export const getMessages = async (userId, threadId, { limit = 30, cursor } = {}) => {

    if (!mongoose.Types.ObjectId.isValid(threadId)) {
        throw new ApiError(400, "Invalid threadId");
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
        .limit(Number(limit))
        .populate("senderId", "username")
        .populate("replyTo", "content senderId")
        .lean();

    // Reset unread counter when chat is opened
    await safeRedis(() => redis.del(`unread:${threadId}:${userId}`));

    return messages.reverse();
};

/* =====================================
   SEND MESSAGE
===================================== */

export const sendMessage = async (userId, {
    threadId,
    content,
    attachments,
    postId,
    forwardMessageId,
    replyTo
}) => {

    if (!mongoose.Types.ObjectId.isValid(threadId)) {
        throw new ApiError(400, "Invalid threadId");
    }

    if (!content?.trim() && (!attachments || attachments.length === 0) && !postId && !forwardMessageId) {
        throw new ApiError(400, "Message must contain text, attachment, or post");
    }

    const objectThreadId = new mongoose.Types.ObjectId(threadId);

    const thread = await Thread.findOne({
        _id: objectThreadId,
        "participants.userId": userId
    });

    if (!thread) {
        throw new ApiError(403, "You are not part of this conversation");
    }

    const messageData = {
        threadId: objectThreadId,
        senderId: userId,
        type: "text",
        isDeleted: false
    };

    if (content?.trim()) {
        messageData.content = content.trim();
    }

    if (attachments?.length) {
        messageData.attachments = attachments;
        messageData.type = "media";
    }

    if (postId) {
        messageData.postId = postId;
        messageData.type = "post";
    }

    if (forwardMessageId) {
        const original = await Message.findById(forwardMessageId);

        if (!original) throw new ApiError(404, "Original message not found");

        messageData.forwardedFrom = {
            messageId: original._id,
            senderId: original.senderId
        };

        messageData.type = "forward";

        // Copy original payload so the model pre-save validation passes
        if (original.content)             messageData.content     = original.content;
        if (original.attachments?.length) messageData.attachments = original.attachments;
        if (original.postId)              messageData.postId      = original.postId;
    }

    if (replyTo) {
        if (!mongoose.Types.ObjectId.isValid(replyTo)) {
            throw new ApiError(400, "Invalid replyTo messageId");
        }
        messageData.replyTo = replyTo;
    }

    const message = await Message.create(messageData);

    // Update thread metadata
    const lastMessageContent = content?.trim()
        || (attachments?.length ? "[media]" : postId ? "[post]" : "[forwarded message]");

    await Thread.updateOne(
        { _id: objectThreadId },
        {
            $set: {
                lastActivity: new Date(),
                lastMessage: {
                    messageId: message._id,
                    senderId: userId,
                    content: lastMessageContent,
                    mediaType: attachments?.[0]?.type || undefined,
                    createdAt: message.createdAt
                }
            },
            $inc: { messageCount: 1 }
        }
    );

    // Populate sender for socket payload
    const populatedMessage = await Message.findById(message._id)
        .populate("senderId", "username")
        .populate("replyTo", "content senderId")
        .lean();

    const io = getIO();

    // Emit new_message so all participants in the room get it in real-time
    io.to(objectThreadId.toString()).emit("new_message", populatedMessage);
    io.to(objectThreadId.toString()).emit("thread_update", {
        threadId,
        lastMessage: {
            messageId: message._id,
            senderId: userId,
            content: lastMessageContent,
            mediaType: attachments?.[0]?.type || undefined,
            createdAt: message.createdAt
        }
    });

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

        // Fire-and-forget push notification
        notificationService.sendMessageNotification({
            actorId: userId,
            recipientId: receiverId,
            messageId: message._id,
            threadId
        }).catch(err => console.error("Message notification failed:", err.message));
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
            threadId: objectThreadId,
            isDeleted: false
        },
        {
            $addToSet: { seenBy: userId }
        }
    );

    // Also reset unread counter
    await safeRedis(() => redis.del(`unread:${threadId}:${userId}`));

    const io = getIO();
    io.to(objectThreadId.toString()).emit("messages_seen", {
        messageIds,
        seenBy: userId,
        threadId
    });

    return { success: true };
};

/* =====================================
   REACT TO MESSAGES
===================================== */

export const addReaction = async (userId, { messageId, emoji }) => {

    if (!mongoose.Types.ObjectId.isValid(messageId)) {
        throw new ApiError(400, "Invalid messageId");
    }

    if (!emoji?.trim()) {
        throw new ApiError(400, "Emoji is required");
    }

    const message = await Message.findById(messageId);

    if (!message || message.isDeleted) {
        throw new ApiError(404, "Message not found");
    }

    const thread = await Thread.findOne({
        _id: message.threadId,
        "participants.userId": userId
    });

    if (!thread) throw new ApiError(403, "You are not part of this conversation");

    const threadId = message.threadId;

    // Remove any existing reaction from this user, then add the new one atomically
    await Message.updateOne(
        { _id: messageId },
        { $pull: { reactions: { userId } } }
    );
    await Message.updateOne(
        { _id: messageId },
        { $push: { reactions: { userId, emoji } } }
    );

    const io = getIO();
    io.to(threadId.toString()).emit("reaction_update", {
        messageId,
        userId,
        emoji,
        threadId
    });

    return { success: true };
};

/* =====================================
   REMOVE REACTION
===================================== */

export const removeReaction = async (userId, { messageId }) => {

    if (!mongoose.Types.ObjectId.isValid(messageId)) {
        throw new ApiError(400, "Invalid messageId");
    }

    const message = await Message.findById(messageId);

    if (!message || message.isDeleted) {
        throw new ApiError(404, "Message not found");
    }

    const thread = await Thread.findOne({
        _id: message.threadId,
        "participants.userId": userId
    });

    if (!thread) throw new ApiError(403, "You are not part of this conversation");

    await Message.updateOne(
        { _id: messageId },
        { $pull: { reactions: { userId } } }
    );

    const io = getIO();
    io.to(message.threadId.toString()).emit("reaction_removed", {
        messageId,
        userId,
        threadId: message.threadId
    });

    return { success: true };
};

/* =====================================
   FORWARD MESSAGE
===================================== */

export const forwardMessage = async (userId, { messageId, threadId }) => {

    if (!mongoose.Types.ObjectId.isValid(messageId)) {
        throw new ApiError(400, "Invalid messageId");
    }

    if (!mongoose.Types.ObjectId.isValid(threadId)) {
        throw new ApiError(400, "Invalid threadId");
    }

    const message = await Message.findById(messageId);

    if (!message || message.isDeleted) throw new ApiError(404, "Message not found");

    // Verify the user is a participant of the source thread too
    const sourceThread = await Thread.findOne({
        _id: message.threadId,
        "participants.userId": userId
    });

    if (!sourceThread) throw new ApiError(403, "You are not part of the source conversation");

    // sendMessage handles target thread auth + socket emit + unread updates
    return sendMessage(userId, {
        threadId,
        forwardMessageId: messageId
    });
};

/* =====================================
   PIN MESSAGE
===================================== */

export const pinMessage = async (userId, { messageId }) => {

    if (!mongoose.Types.ObjectId.isValid(messageId)) {
        throw new ApiError(400, "Invalid messageId");
    }

    const message = await Message.findById(messageId);

    if (!message || message.isDeleted) throw new ApiError(404, "Message not found");

    const thread = await Thread.findOne({
        _id: message.threadId,
        "participants.userId": userId
    });

    if (!thread) throw new ApiError(403, "Not allowed");

    const now = new Date();

    // Update the message with pinnedBy / pinnedAt metadata
    await Message.updateOne(
        { _id: messageId },
        { $set: { pinnedBy: userId, pinnedAt: now } }
    );

    // Track pinned messages on the thread
    await Thread.updateOne(
        { _id: message.threadId },
        { $addToSet: { pinnedMessages: messageId } }
    );

    const io = getIO();
    io.to(message.threadId.toString()).emit("message_pinned", {
        messageId,
        threadId: message.threadId,
        pinnedBy: userId,
        pinnedAt: now
    });

    return { success: true };
};

/* =====================================
   UNPIN MESSAGE
===================================== */

export const unpinMessage = async (userId, { messageId }) => {

    if (!mongoose.Types.ObjectId.isValid(messageId)) {
        throw new ApiError(400, "Invalid messageId");
    }

    const message = await Message.findById(messageId);

    if (!message) throw new ApiError(404, "Message not found");

    const thread = await Thread.findOne({
        _id: message.threadId,
        "participants.userId": userId
    });

    if (!thread) throw new ApiError(403, "Not allowed");

    await Message.updateOne(
        { _id: messageId },
        { $unset: { pinnedBy: "", pinnedAt: "" } }
    );

    await Thread.updateOne(
        { _id: message.threadId },
        { $pull: { pinnedMessages: message._id } }
    );

    const io = getIO();
    io.to(message.threadId.toString()).emit("message_unpinned", {
        messageId,
        threadId: message.threadId,
        unpinnedBy: userId
    });

    return { success: true };
};

/* =====================================
   DELETE MESSAGE  (soft delete)
   - sender can always delete their own
   - group admin/owner can delete any message in their group
===================================== */

export const deleteMessage = async (userId, { messageId }) => {

    if (!mongoose.Types.ObjectId.isValid(messageId)) {
        throw new ApiError(400, "Invalid messageId");
    }

    const message = await Message.findById(messageId);

    if (!message || message.isDeleted) throw new ApiError(404, "Message not found");

    const thread = await Thread.findOne({
        _id: message.threadId,
        "participants.userId": userId
    });

    if (!thread) throw new ApiError(403, "You are not part of this conversation");

    const isSender = message.senderId.toString() === userId.toString();

    const isAdminOrOwner = thread.participants.some(
        p => p.userId.toString() === userId.toString() &&
            ["admin", "owner"].includes(p.role)
    );

    if (!isSender && !isAdminOrOwner) {
        throw new ApiError(403, "You are not allowed to delete this message");
    }

    // Soft delete — preserves message record for thread integrity
    await Message.updateOne(
        { _id: messageId },
        {
            $set: {
                isDeleted: true,
                deletedAt: new Date(),
                // Wipe sensitive content but keep metadata
                content: null,
                attachments: [],
                postId: null,
                reactions: []
            }
        }
    );

    // If this was the last message, clear it from thread metadata
    if (thread.lastMessage?.messageId?.toString() === messageId.toString()) {
        await Thread.updateOne(
            { _id: message.threadId },
            { $unset: { lastMessage: "" } }
        );
    }

    // Remove from pinned messages if pinned
    await Thread.updateOne(
        { _id: message.threadId },
        { $pull: { pinnedMessages: message._id } }
    );

    const io = getIO();
    io.to(message.threadId.toString()).emit("message_deleted", {
        messageId,
        threadId: message.threadId,
        deletedBy: userId
    });

    return { success: true };
};

/* =====================================
   EDIT MESSAGE
   - only the sender can edit
   - text and forward messages with text content can be edited
===================================== */

export const editMessage = async (userId, { messageId, content }) => {

    if (!mongoose.Types.ObjectId.isValid(messageId)) {
        throw new ApiError(400, "Invalid messageId");
    }

    if (!content?.trim()) {
        throw new ApiError(400, "Content is required");
    }

    const message = await Message.findById(messageId);

    if (!message || message.isDeleted) throw new ApiError(404, "Message not found");

    if (message.senderId.toString() !== userId.toString()) {
        throw new ApiError(403, "You can only edit your own messages");
    }

    // Allow editing text messages and forwarded messages that carry text
    const editableTypes = ["text", "forward"];
    if (!editableTypes.includes(message.type) || !message.content) {
        throw new ApiError(400, "Only text messages can be edited");
    }

    const now = new Date();

    const updated = await Message.findByIdAndUpdate(
        messageId,
        {
            $set: {
                content: content.trim(),
                isEdited: true,
                editedAt: now
            }
        },
        { new: true }
    )
        .populate("senderId", "username")
        .lean();

    const io = getIO();
    io.to(message.threadId.toString()).emit("message_edited", {
        messageId,
        content: updated.content,
        isEdited: true,
        editedAt: updated.editedAt,
        threadId: message.threadId
    });

    return updated;
};

/* =====================================
   SEARCH MESSAGES
===================================== */

export const searchMessages = async (userId, { query }) => {

    if (!query?.trim()) {
        throw new ApiError(400, "Query is required");
    }

    const threads = await Thread.find({
        "participants.userId": userId
    }).select("_id");

    const threadIds = threads.map(t => t._id);

    // Use the text index for efficient full-text search
    const messages = await Message.find({
        threadId: { $in: threadIds },
        isDeleted: false,
        $text: { $search: query.trim() }
    }, {
        score: { $meta: "textScore" }
    })
        .sort({ score: { $meta: "textScore" } })
        .limit(20)
        .populate("senderId", "username")
        .lean();

    return messages;
};