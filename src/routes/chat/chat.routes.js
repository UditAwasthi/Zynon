import express from "express";
import { createDMThread, getInboxController } from "../../controllers/chat/thread.controller.js";
import { protect } from "../../middleware/auth.middleware.js";
import { getMessagesController, sendMessageController, markMessagesSeenController,addReactionController,generateChatUploadSignature } from "../../controllers/chat/message.controller.js";

const router = express.Router();
//create or get thread
router.post("/thread/dm", protect, createDMThread);
//get inbox
router.get("/inbox", protect, getInboxController);
//get cloudinary upload signature
router.get("/media/signature", protect, generateChatUploadSignature);
//get messages
router.get("/messages/:threadId", protect, getMessagesController);
//send messages
router.post("/message", protect, sendMessageController);
//read receipt
router.post("/message/seen", protect, markMessagesSeenController);
//add reaction
router.post("/reaction", protect, addReactionController);
export default router;