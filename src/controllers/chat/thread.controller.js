import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import { createOrGetDMThread } from "../../services/chat/thread.service.js";
import { getInbox } from "../../services/chat/thread.service.js";

//Create || Fetch DM THread

export const createDMThread = asyncHandler(async (req, res) => {

    const { receiverId } = req.body;

    if (!receiverId) {
        throw new ApiError(400, "receiverId is required");
    }

    const currentUserId = req.user.id;

    const thread = await createOrGetDMThread(currentUserId, receiverId);

    return sendSuccess(
        res,
        200,
        "Thread fetched Successfully",
        thread
    );



});

//Get Inbox

export const getInboxController = asyncHandler(async (req, res) => {

    const userId = req.user.id
    const threads = await getInbox(userId);

    return sendSuccess(
        res,
        200,
        "Inbox fetched successfully",
        threads
    )

})