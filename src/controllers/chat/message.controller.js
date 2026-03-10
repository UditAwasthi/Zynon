import { asyncHandler } from "../../utils/asyncHandler.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import { getMessages, sendMessage } from "../../services/chat/message.service.js";

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

    const { threadId, content } = req.body;
    const message = await sendMessage(req.user.id, { threadId, content });

    return sendSuccess(
        res,
        201,
        "Message sent successfully",
        message
    );
});