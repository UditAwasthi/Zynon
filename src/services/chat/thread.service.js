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
            name: thread.type === "group" ? (thread.name ?? null) : null,
            avatar: thread.type === "group" ? (thread.avatar ?? null) : null,
            lastMessage: thread.lastMessage || null,
            lastActivity: thread.lastActivity,
            messageCount: thread.messageCount
        };
    });
    return inbox;
};
//create group
export const createGroupThread = async (creatorId, { name, members }) => {

  if (!members || members.length < 2)
    throw new ApiError(400, "Group must have at least 2 members");

  const now = new Date();

  const participants = [
    { userId: creatorId, role: "owner" },
    ...members.map(id => ({ userId: id, role: "member" }))
  ];

  const thread = await Thread.create({
    type: "group",
    name,
    participants,
    createdBy: creatorId,
    lastActivity: now   // ← set so inbox sort works immediately
  });

  // Return inbox-compatible shape so frontend can prepend without shape mismatch
  return {
    threadId: thread._id,
    type: "group",
    user: null,
    name: thread.name,
    avatar: thread.avatar ?? null,
    lastMessage: null,
    lastActivity: thread.lastActivity,
    messageCount: 0
  };
};

//add memeber to group
export const addMember = async (userId, { threadId, memberId }) => {

  const thread = await Thread.findById(threadId);

  if (!thread) throw new ApiError(404, "Thread not found");

  const isAdmin = thread.participants.some(
    p => p.userId.toString() === userId.toString() && ["admin","owner"].includes(p.role)
  );

  if (!isAdmin) throw new ApiError(403, "Only admins can add members");

  await Thread.updateOne(
    { _id: threadId },
    {
      $addToSet: {
        participants: { userId: memberId, role: "member" }
      }
    }
  );

  return { success: true };
};

//kick member
export const removeMember = async (userId, { threadId, memberId }) => {

  const thread = await Thread.findById(threadId);

  if (!thread) throw new ApiError(404, "Thread not found");

  const isAdmin = thread.participants.some(
    p => p.userId.toString() === userId.toString() && ["admin","owner"].includes(p.role)
  );

  if (!isAdmin) throw new ApiError(403, "Only admins can remove members");

  await Thread.updateOne(
    { _id: threadId },
    { $pull: { participants: { userId: memberId } } }
  );

  return { success: true };
};