import Thread from "../../models/chat/thread.model.js";
import User from "../../models/user.model.js";
import mongoose from "mongoose";
import { ApiError } from "../../utils/ApiError.js";

/*
Generate deterministic dmKey
*/
const generateDmKey = (userA, userB) => {
    const sorted = [userA.toString(), userB.toString()].sort();
    return `${sorted[0]}_${sorted[1]}`;
};


/*
Create or fetch DM thread
*/
export const createOrGetDMThread = async (currentUserId, receiverId) => {

    if (!mongoose.Types.ObjectId.isValid(receiverId)) {
        throw new ApiError(400, "Invalid receiverId");
    }

    if (currentUserId.toString() === receiverId.toString()) {
        throw new ApiError(400, "You cannot create a chat with yourself");
    }

    /*
    Check if receiver exists
    */
    const receiver = await User.findById(receiverId).select("_id");

    if (!receiver) {
        throw new ApiError(404, "Receiver not found");
    }

    /*
    Generate unique dmKey
    */
    const dmKey = generateDmKey(currentUserId, receiverId);

    /*
    Check if thread already exists
    */
    let thread = await Thread.findOne({ dmKey });

    if (thread) {
        return thread;
    }

    /*
    Create new thread
    */
    thread = await Thread.create({
        type: "dm",
        dmKey,
        participants: [
            { userId: currentUserId },
            { userId: receiverId }
        ]
    });

    return thread;
};

export const getInbox = async (userId, { limit = 20, cursor } = {}) => {

    if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new ApiError(400, "Invalid userId");
    }

    const objectUserId = new mongoose.Types.ObjectId(userId);

    const query = {
        "participants.userId": objectUserId,
        deletedFor: { $ne: objectUserId }
    };

    /*
    Cursor pagination (optional)
    */
    if (cursor) {
        query.lastActivity = { $lt: new Date(cursor) };
    }

    const threads = await Thread.find(query)
        .sort({ lastActivity: -1 })
        .limit(limit)
        .populate({
            path: "participants.userId",
            select: "username"
        })
        .lean();

    /*
    Transform response:
    return only the other participant in DM threads
    */
    const inbox = threads.map(thread => {

        let otherUser = null;

        if (thread.type === "dm") {
            const otherParticipant = thread.participants
                .filter(p => p.userId)
                .find(p => p.userId._id.toString() !== userId.toString());

            otherUser = otherParticipant?.userId || null;
        }

        return {
            threadId: thread._id,
            type: thread.type,
            user: otherUser,
            lastMessage: thread.lastMessage || null,
            lastActivity: thread.lastActivity,
            messageCount: thread.messageCount
        };
    });
    return inbox;
};