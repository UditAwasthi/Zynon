import express from "express";
import { createDMThread, getInboxController ,createGroupController,addMemberController,removeMemberController} from "../../controllers/chat/thread.controller.js";
import { protect } from "../../middleware/auth.middleware.js";
import { getMessagesController, sendMessageController, markMessagesSeenController,addReactionController,generateChatUploadSignature,forwardMessageController,pinMessageController,searchMessagesController,deleteMessageController,editMessageController } from "../../controllers/chat/message.controller.js";

const router = express.Router();
//create or get thread
router.post("/thread/dm", protect, createDMThread);
//get inbox
router.get("/inbox", protect, getInboxController);
//get cloudinary upload signature
router.get("/media/signature", protect, generateChatUploadSignature);
//search messages — must be above /:threadId to avoid route conflict
router.get("/messages/search", protect, searchMessagesController)
//get messages
router.get("/messages/:threadId", protect, getMessagesController);
//send messages
router.post("/message", protect, sendMessageController);
//read receipt
router.post("/message/seen", protect, markMessagesSeenController);
//add reaction
router.post("/reaction", protect, addReactionController);
// forward message
router.post("/message/forward", protect, forwardMessageController)

// pin message
router.post("/message/pin", protect, pinMessageController)

// delete message
router.delete("/message", protect, deleteMessageController)

// edit message
router.patch("/message", protect, editMessageController)

// create group
router.post("/thread/group", protect, createGroupController)

// add member
router.post("/thread/add-member", protect, addMemberController)

// remove member
router.post("/thread/remove-member", protect, removeMemberController)
export default router;