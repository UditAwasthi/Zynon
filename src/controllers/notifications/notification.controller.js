import Notification from "../../models/notifications/notifications.model.js";
import redis from "../../redis/redisClient.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { sendSuccess } from "../../utils/apiResponse.js";

// GET NOTIFICATIONS
export const getNotifications = asyncHandler(async (req, res) => {

    const userId = req.user.id;

    const limit = parseInt(req.query.limit) || 20;
    const cursor = req.query.cursor;

    const query = { recipient: userId };

    if (cursor) {
        query.createdAt = { $lt: new Date(cursor) };
    }

    const notifications = await Notification.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate("actor", "username profilePicture")
        .lean();

    const nextCursor =
        notifications.length > 0
            ? notifications[notifications.length - 1].createdAt
            : null;

    return sendSuccess(
        res,
        200,
        "Notifications retrieved successfully",
        {
            notifications,
            nextCursor
        }
    );
});


// GET UNREAD COUNT
export const getUnreadCount = asyncHandler(async (req, res) => {

    const userId = req.user.id;

    const count = await redis.get(`notif:unread:${userId}`);

    return sendSuccess(
        res,
        200,
        "Unread notification count retrieved",
        {
            unread: parseInt(count || "0")
        }
    );
});


// MARK SELECTED NOTIFICATIONS AS READ
export const markNotificationsRead = asyncHandler(async (req, res) => {

    const userId = req.user.id;
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids)) {
        throw new ApiError(400, "Notification ids are required");
    }

    await Notification.updateMany(
        {
            _id: { $in: ids },
            recipient: userId
        },
        {
            $set: { read: true }
        }
    );

    await redis.decrby(`notif:unread:${userId}`, ids.length);

    return sendSuccess(
        res,
        200,
        "Notifications marked as read",
        null
    );
});


// MARK ALL AS READ
export const markAllRead = asyncHandler(async (req, res) => {

    const userId = req.user.id;

    await Notification.updateMany(
        {
            recipient: userId,
            read: false
        },
        {
            $set: { read: true }
        }
    );

    await redis.set(`notif:unread:${userId}`, 0);

    return sendSuccess(
        res,
        200,
        "All notifications marked as read",
        null
    );
});