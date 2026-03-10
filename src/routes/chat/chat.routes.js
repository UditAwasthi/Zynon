import express from "express";
import { createDMThread, getInboxController } from "../../controllers/chat/thread.controller.js";
import { protect } from "../../middleware/auth.middleware.js";
import { getMessagesController, sendMessageController } from "../../controllers/chat/message.controller.js";

const router = express.Router();

router.post("/thread/dm", protect, createDMThread);
router.get("/inbox", protect, getInboxController);

router.get("/messages/:threadId", protect, getMessagesController);
router.post("/message", protect, sendMessageController);

export default router;