import Thread from "../../models/chat/thread.model.js";
import User from "../../models/user.model.js";
import mongoose from "mongoose";
import { ApiError } from "../../utils/ApiError.js";
import { getIO } from "../../socket/socket.js";

/*
  Generate deterministic dmKey so there's always only one DM thread
  between any two users regardless of who initiates.
*/
const generateDmKey = (userA, userB) => {
    const sorted = [userA.toString(), userB.toString()].sort();
    return `${sorted[0]}_${sorted[1]}`;
};

/* =====================================
   CREATE OR GET DM THREAD
===================================== */

export const createOrGetDMThread = async (currentUserId, receiverId) => {

    if (!mongoose.Types.ObjectId.isValid(receiverId)) {
        throw new ApiError(400, "Invalid receiverId");
    }

    if (currentUserId.toString() === receiverId.toString()) {
        throw new ApiError(400, "You cannot create a chat with yourself");
    }

    const receiver = await User.findById(receiverId).select("_id");

    if (!receiver) {
        throw new ApiError(404, "Receiver not found");
    }

    const dmKey = generateDmKey(currentUserId, receiverId);

    let thread = await Thread.findOne({ dmKey });

    if (thread) {
        return thread;
    }

    thread = await Thread.create({
        type: "dm",
        dmKey,
        participants: [
            { userId: currentUserId },
            { userId: receiverId }
        ],
        lastActivity: new Date()
    });

    // Notify the receiver in real-time so their inbox updates without refresh
    const io = getIO();
    const receiverObjectId = new mongoose.Types.ObjectId(receiverId);

    io.to(receiverId.toString()).emit("thread_created", {
        threadId: thread._id,
        type: "dm",
        initiatedBy: currentUserId
    });

    return thread;
};

/* =====================================
   GET INBOX
===================================== */

export const getInbox = async (userId, { limit = 20, cursor } = {}) => {

    if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new ApiError(400, "Invalid userId");
    }

    const objectUserId = new mongoose.Types.ObjectId(userId);

    const query = {
        "participants.userId": objectUserId,
        // FIX: $nin correctly checks if userId is NOT in the deletedFor array
        deletedFor: { $nin: [objectUserId] }
    };

    if (cursor) {
        query.lastActivity = { $lt: new Date(cursor) };
    }

    const threads = await Thread.find(query)
        .sort({ lastActivity: -1 })
        .limit(Number(limit))
        .populate({
            path: "participants.userId",
            select: "username avatar"
        })
        .lean();

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
            messageCount: thread.messageCount,
            pinnedMessages: thread.pinnedMessages || []
        };
    });

    return inbox;
};

/* =====================================
   CREATE GROUP THREAD
===================================== */

export const createGroupThread = async (creatorId, { name, members }) => {

    if (!name?.trim()) {
        throw new ApiError(400, "Group name is required");
    }

    if (!members || members.length < 2) {
        throw new ApiError(400, "Group must have at least 2 members besides the creator");
    }

    // Validate all member IDs
    for (const memberId of members) {
        if (!mongoose.Types.ObjectId.isValid(memberId)) {
            throw new ApiError(400, `Invalid memberId: ${memberId}`);
        }
    }

    const now = new Date();

    const participants = [
        { userId: creatorId, role: "owner" },
        ...members.map(id => ({ userId: id, role: "member" }))
    ];

    const thread = await Thread.create({
        type: "group",
        name: name.trim(),
        participants,
        createdBy: creatorId,
        lastActivity: now
    });

    const threadPayload = {
        threadId: thread._id,
        type: "group",
        user: null,
        name: thread.name,
        avatar: thread.avatar ?? null,
        lastMessage: null,
        lastActivity: thread.lastActivity,
        messageCount: 0,
        createdBy: creatorId
    };

    // Notify all members in real-time so the group appears in their inbox immediately
    const io = getIO();

    for (const memberId of members) {
        io.to(memberId.toString()).emit("thread_created", {
            ...threadPayload,
            addedBy: creatorId
        });
    }

    return threadPayload;
};

/* =====================================
   ADD MEMBER TO GROUP
===================================== */

export const addMember = async (userId, { threadId, memberId }) => {

    if (!mongoose.Types.ObjectId.isValid(threadId)) {
        throw new ApiError(400, "Invalid threadId");
    }

    if (!mongoose.Types.ObjectId.isValid(memberId)) {
        throw new ApiError(400, "Invalid memberId");
    }

    const thread = await Thread.findById(threadId);

    if (!thread) throw new ApiError(404, "Thread not found");

    if (thread.type !== "group") throw new ApiError(400, "Can only add members to group threads");

    const isAdmin = thread.participants.some(
        p => p.userId.toString() === userId.toString() && ["admin", "owner"].includes(p.role)
    );

    if (!isAdmin) throw new ApiError(403, "Only admins can add members");

    // Prevent duplicate membership
    const alreadyMember = thread.participants.some(
        p => p.userId.toString() === memberId.toString()
    );

    if (alreadyMember) throw new ApiError(409, "User is already a member of this group");

    const newMember = await User.findById(memberId).select("_id username").lean();
    if (!newMember) throw new ApiError(404, "User not found");

    await Thread.updateOne(
        { _id: threadId },
        { $addToSet: { participants: { userId: memberId, role: "member" } } }
    );

    const io = getIO();

    // Tell the new member about the group so it appears in their inbox
    io.to(memberId.toString()).emit("thread_created", {
        threadId: thread._id,
        type: "group",
        name: thread.name,
        avatar: thread.avatar ?? null,
        lastMessage: thread.lastMessage || null,
        lastActivity: thread.lastActivity,
        messageCount: thread.messageCount,
        addedBy: userId
    });

    // Tell existing members that someone was added
    io.to(threadId.toString()).emit("member_added", {
        threadId,
        memberId,
        addedBy: userId,
        member: newMember
    });

    return { success: true };
};

/* =====================================
   REMOVE MEMBER FROM GROUP
===================================== */

export const removeMember = async (userId, { threadId, memberId }) => {

    if (!mongoose.Types.ObjectId.isValid(threadId)) {
        throw new ApiError(400, "Invalid threadId");
    }

    if (!mongoose.Types.ObjectId.isValid(memberId)) {
        throw new ApiError(400, "Invalid memberId");
    }

    const thread = await Thread.findById(threadId);

    if (!thread) throw new ApiError(404, "Thread not found");

    if (thread.type !== "group") throw new ApiError(400, "Can only remove members from group threads");

    const isAdmin = thread.participants.some(
        p => p.userId.toString() === userId.toString() && ["admin", "owner"].includes(p.role)
    );

    if (!isAdmin) throw new ApiError(403, "Only admins can remove members");

    // Cannot remove the owner
    const targetParticipant = thread.participants.find(
        p => p.userId.toString() === memberId.toString()
    );

    if (!targetParticipant) throw new ApiError(404, "Member not found in this group");

    if (targetParticipant.role === "owner") {
        throw new ApiError(403, "Cannot remove the group owner");
    }

    await Thread.updateOne(
        { _id: threadId },
        { $pull: { participants: { userId: memberId } } }
    );

    const io = getIO();

    // Tell all members in the room
    io.to(threadId.toString()).emit("member_removed", {
        threadId,
        memberId,
        removedBy: userId
    });

    // Tell the removed member their access was revoked
    io.to(memberId.toString()).emit("removed_from_group", {
        threadId,
        removedBy: userId
    });

    return { success: true };
};