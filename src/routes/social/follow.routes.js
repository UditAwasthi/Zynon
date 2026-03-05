import express from "express";
import {
    followUser,
    unfollowUser,
    getFollowers,
    getFollowing,
    checkFollowing,
    getFollowRequests,
    acceptFollowRequest,
    rejectFollowRequest,
    getFollowStatus,
    cancelFollowRequest
} from "../../controllers/social/follow.controller.js";

import { protect } from "../../middleware/auth.middleware.js";

const router = express.Router();

// follow actions
router.post("/:userId/follow", protect, followUser);
router.delete("/:userId/unfollow", protect, unfollowUser);
router.delete("/:userId/cancel-request", protect, cancelFollowRequest);

// private account requests
router.get("/requests", protect, getFollowRequests);
router.post("/:userId/accept", protect, acceptFollowRequest);
router.post("/:userId/reject", protect, rejectFollowRequest);

// relationship status
router.get("/:userId/status", protect, getFollowStatus);
router.get("/:userId/is-following", protect, checkFollowing);

// lists
router.get("/:userId/followers", getFollowers);
router.get("/:userId/following", getFollowing);

export default router;