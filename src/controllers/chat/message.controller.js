import { asyncHandler } from "../../utils/asyncHandler.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import { getMessages, sendMessage, markMessagesSeen, addReaction } from "../../services/chat/message.service.js";
import cloudinary from "cloudinary";

//getinbox

export const getMessagesController = asyncHandler(async (req, res) => {

    const { threadId } = req.params;
    const { limit, cursor } = req.query;

    const messages = await getMessages(
        req.user.id,
        threadId,
        { limit, cursor }
    );

    return sendSuccess(
        res,
        200,
        "Messages fetched successfully",
        messages
    );
});

//send message

export const sendMessageController = asyncHandler(async (req, res) => {

    const { threadId, content, mediaUrl, mediaType, mediaMeta } = req.body;
    const message = await sendMessage(req.user.id, { threadId, content, mediaUrl, mediaType, mediaMeta });

    return sendSuccess(
        res,
        201,
        "Message sent successfully",
        message
    );
});

//read receipt
export const markMessagesSeenController = asyncHandler(async (req, res) => {

  const result = await markMessagesSeen(req.user.id, req.body);

  return sendSuccess(
    res,
    200,
    "Messages marked as seen",
    result
  );
});

//react to message
export const addReactionController = asyncHandler(async (req, res) => {

  const result = await addReaction(req.user.id, req.body);

  return sendSuccess(
    res,
    200,
    "Reaction added",
    result
  );

});

// Generate Cloudinary upload signature for chat media
export const generateChatUploadSignature = asyncHandler(async (req, res) => {
    const timestamp = Math.round(Date.now() / 1000);

    const signature = cloudinary.utils.api_sign_request(
        {
            timestamp,
            folder: "zynon/messages"
        },
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