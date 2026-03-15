import express from "express";
import {
    createDMThread,
    getInboxController,
    createGroupController,
    addMemberController,
    removeMemberController
} from "../../controllers/chat/thread.controller.js";
import { protect } from "../../middleware/auth.middleware.js";
import {
    getMessagesController,
    sendMessageController,
    markMessagesSeenController,
    addReactionController,
    generateChatUploadSignature,
    forwardMessageController,
    pinMessageController,
    searchMessagesController,
    deleteMessageController,
    editMessageController
} from "../../controllers/chat/message.controller.js";

const router = express.Router();

// ── Thread routes ─────────────────────────────────────────────────────────────
router.post("/thread/dm",            protect, createDMThread);
router.post("/thread/group",         protect, createGroupController);
router.post("/thread/add-member",    protect, addMemberController);
router.post("/thread/remove-member", protect, removeMemberController);
router.get("/inbox",                 protect, getInboxController);

// ── Media ─────────────────────────────────────────────────────────────────────
router.get("/media/signature", protect, generateChatUploadSignature);

// ── Message — SPECIFIC routes first, generic last ────────────────────────────
// GET: search must be above /:threadId
router.get("/messages/search",      protect, searchMessagesController);
router.get("/messages/:threadId",   protect, getMessagesController);

// POST: specific sub-paths before bare /message
router.post("/message/seen",    protect, markMessagesSeenController);
router.post("/message/forward", protect, forwardMessageController);
router.post("/message/pin",     protect, pinMessageController);
router.post("/message",         protect, sendMessageController);   // ← last POST /message/*

// PUT/PATCH/DELETE
router.delete("/message", protect, deleteMessageController);
router.patch("/message",  protect, editMessageController);

// ── Reaction ──────────────────────────────────────────────────────────────────
router.post("/reaction", protect, addReactionController);

export default router;