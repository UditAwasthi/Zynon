import express from "express";

import {
  getNotifications,
  getUnreadCount,
  markNotificationsRead,
  markAllRead
} from "../../controllers/notifications/notification.controller.js";

import { protect } from "../../middleware/auth.middleware.js";

const router = express.Router();

router.get("/", protect, getNotifications);

router.get("/unread-count", protect, getUnreadCount);

router.patch("/read", protect, markNotificationsRead);

router.patch("/read-all", protect, markAllRead);

export default router;