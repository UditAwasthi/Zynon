import { asyncHandler } from "../../utils/asyncHandler.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import {
    getMessages,
    sendMessage,
    markMessagesSeen,
    addReaction,
    removeReaction,
    forwardMessage,
    pinMessage,
    unpinMessage,
    searchMessages,
    deleteMessage,
    editMessage,
} from "../../services/chat/message.service.js";

import cloudinary from "cloudinary";

// Get messages for a thread (paginated via cursor)
export const getMessagesController = asyncHandler(async (req, res) => {

    const { threadId } = req.params;
    const { limit, cursor } = req.query;

    const messages = await getMessages(
        req.user.id,
        threadId,
        { limit, cursor }
    );

    return sendSuccess(res, 200, "Messages fetched successfully", messages);
});

// Send a new message
export const sendMessageController = asyncHandler(async (req, res) => {

    const { threadId, content, attachments, postId, forwardMessageId, replyTo } = req.body;

    const message = await sendMessage(req.user.id, {
        threadId,
        content,
        attachments,
        postId,
        forwardMessageId,
        replyTo
    });

    return sendSuccess(res, 201, "Message sent successfully", message);
});

// Mark messages as seen (read receipts)
export const markMessagesSeenController = asyncHandler(async (req, res) => {

    const result = await markMessagesSeen(req.user.id, req.body);

    return sendSuccess(res, 200, "Messages marked as seen", result);
});

// Add emoji reaction to a message
export const addReactionController = asyncHandler(async (req, res) => {

    const result = await addReaction(req.user.id, req.body);

    return sendSuccess(res, 200, "Reaction added", result);
});

// Remove emoji reaction from a message
export const removeReactionController = asyncHandler(async (req, res) => {

    const result = await removeReaction(req.user.id, req.body);

    return sendSuccess(res, 200, "Reaction removed", result);
});

// Generate Cloudinary upload signature for chat media
export const generateChatUploadSignature = asyncHandler(async (req, res) => {

    const timestamp = Math.round(Date.now() / 1000);

    const signature = cloudinary.utils.api_sign_request(
        { timestamp, folder: "zynon/messages" },
        process.env.CLOUDINARY_API_SECRET
    );

    return sendSuccess(res, 200, "Signature generated", {
        timestamp,
        signature,
        apiKey: process.env.CLOUDINARY_API_KEY,
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
        folder: "zynon/messages"
    });
});

// Forward a message to another thread
export const forwardMessageController = asyncHandler(async (req, res) => {

    const { messageId, threadId } = req.body;

    const result = await forwardMessage(req.user.id, { messageId, threadId });

    return sendSuccess(res, 201, "Message forwarded successfully", result);
});

// Pin a message in a thread
export const pinMessageController = asyncHandler(async (req, res) => {

    const { messageId } = req.body;

    const result = await pinMessage(req.user.id, { messageId });

    return sendSuccess(res, 200, "Message pinned successfully", result);
});

// Unpin a message in a thread
export const unpinMessageController = asyncHandler(async (req, res) => {

    const { messageId } = req.body;

    const result = await unpinMessage(req.user.id, { messageId });

    return sendSuccess(res, 200, "Message unpinned successfully", result);
});

// Search messages across all user's threads
export const searchMessagesController = asyncHandler(async (req, res) => {

    const { query } = req.query;

    const messages = await searchMessages(req.user.id, { query });

    return sendSuccess(res, 200, "Search results fetched successfully", messages);
});

// Soft-delete a message
export const deleteMessageController = asyncHandler(async (req, res) => {

    const { messageId } = req.body;

    const result = await deleteMessage(req.user.id, { messageId });

    return sendSuccess(res, 200, "Message deleted successfully", result);
});

// Edit a message's text content
export const editMessageController = asyncHandler(async (req, res) => {

    const { messageId, content } = req.body;

    const result = await editMessage(req.user.id, { messageId, content });

    return sendSuccess(res, 200, "Message edited successfully", result);
});