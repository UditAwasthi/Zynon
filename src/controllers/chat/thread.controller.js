import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { sendSuccess } from "../../utils/apiResponse.js";

import {
    createOrGetDMThread,
    getInbox,
    createGroupThread,
    addMember,
    removeMember
} from "../../services/chat/thread.service.js";

// Create or fetch an existing DM thread
export const createDMThread = asyncHandler(async (req, res) => {

    const { receiverId } = req.body;

    if (!receiverId) {
        throw new ApiError(400, "receiverId is required");
    }

    const thread = await createOrGetDMThread(req.user.id, receiverId);

    return sendSuccess(res, 200, "Thread fetched successfully", thread);
});

// Get all threads for the current user (inbox), with optional cursor pagination
export const getInboxController = asyncHandler(async (req, res) => {

    const { limit, cursor } = req.query;

    // FIX: Pass limit and cursor so pagination actually works
    const threads = await getInbox(req.user.id, { limit, cursor });

    return sendSuccess(res, 200, "Inbox fetched successfully", threads);
});

// Create a new group thread
export const createGroupController = asyncHandler(async (req, res) => {

    const { name, members } = req.body;

    const thread = await createGroupThread(req.user.id, { name, members });

    return sendSuccess(res, 201, "Group created successfully", thread);
});

// Add a member to a group thread
export const addMemberController = asyncHandler(async (req, res) => {

    const result = await addMember(req.user.id, req.body);

    return sendSuccess(res, 200, "Member added successfully", result);
});

// Remove (kick) a member from a group thread
export const removeMemberController = asyncHandler(async (req, res) => {

    const result = await removeMember(req.user.id, req.body);

    return sendSuccess(res, 200, "Member removed successfully", result);
});