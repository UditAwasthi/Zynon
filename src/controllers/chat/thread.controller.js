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


//create gorup

export const createGroupController = asyncHandler(async (req, res) => {

  const { name, members } = req.body;

  const thread = await createGroupThread(req.user.id, {
    name,
    members
  });

  return sendSuccess(
    res,
    201,
    "Group created successfully",
    thread
  );

});

//add member to gp

export const addMemberController = asyncHandler(async (req, res) => {

  const result = await addMember(req.user.id, req.body);

  return sendSuccess(
    res,
    200,
    "Member added successfully",
    result
  );

});

//kick member
export const removeMemberController = asyncHandler(async (req, res) => {

  const result = await removeMember(req.user.id, req.body);

  return sendSuccess(
    res,
    200,
    "Member removed successfully",
    result
  );

});