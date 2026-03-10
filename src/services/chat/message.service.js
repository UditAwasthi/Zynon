
import mongoose from "mongoose";
import Message from "../../models/chat/message.model.js";
import Thread from "../../models/chat/thread.model.js";
import { ApiError } from "../../utils/ApiError.js";

//get messages

export const getMessages = async (
    userId,
    threadId,
    { limit = 30, cursor } = {}) => {


    if (!mongoose.Types.ObjectId.isValid(threadId)) {
        throw new ApiError(400, 'invalid threadId');
    }

    const objectThreadId = new mongoose.Types.ObjectId(threadId);

    //Ensure user is a participant in thread

    const thread = await Thread.findOne(
        {
            _id: objectThreadId,
            "participants.userId": userId
        }
    );

    if (!thread) {
        throw new ApiError(403, "You are not allowed to access this conversation")
    }

    //Build query

    const query = {
        threadId: objectThreadId,
        isDeleted: false
    }

    //cuesor pagination

    if (cursor) {
        query.createdAt = { $lt: new Date(cursor) };
    }

    const messages = await Message.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate({
            path: "senderId",
            select: "username"
        })
        .populate({
            path: "replyTo",
            select: "content senderId"
        })
        .lean();

    return messages.reverse(); //order new to old


}




export const sendMessage = async (userId, { threadId, content }) => {

    if (!mongoose.Types.ObjectId.isValid(threadId)) {
        throw new ApiError(400, "Invalid threadId");
    }

    if (!content || !content.trim()) {
        throw new ApiError(400, "Message content cannot be empty");
    }

    const objectThreadId = new mongoose.Types.ObjectId(threadId);

    /*
    Ensure user belongs to thread
    */
    const thread = await Thread.findOne({
        _id: objectThreadId,
        "participants.userId": userId
    });

    if (!thread) {
        throw new ApiError(403, "You are not part of this conversation");
    }

    /*
    Create message
    */
    const message = await Message.create({
        threadId: objectThreadId,
        senderId: userId,
        content,
        type: "text"
    });

    /*
    Update thread metadata
    */
    await Thread.updateOne(
        { _id: objectThreadId },
        {
            $set: {
                lastActivity: new Date(),
                lastMessage: {
                    messageId: message._id,
                    senderId: userId,
                    content: content,
                    createdAt: message.createdAt
                }
            },
            $inc: { messageCount: 1 }
        }
    );

    return message;
};