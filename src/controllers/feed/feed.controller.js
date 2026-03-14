import Follow from "../../models/social/follow.model.js";
import { fetchHomeFeed, fetchReelsFeed, fetchExploreFeed } from "../../services/feed/feed.service.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import { ApiError } from "../../utils/ApiError.js";
import { asyncHandler } from "../../utils/asyncHandler.js";


//Home feed
export const getHomeFeed = asyncHandler(async (req, res) => {

    const userId = req.user.id;
    const { cursor } = req.query;

    const following = await Follow.find({ follower: userId })
        .select("following")
        .lean();

    const followingIds = following.map(f => f.following);

    if (!followingIds.length) {
        return sendSuccess(res, 200, "No posts available", []);
    }

    const posts = await fetchHomeFeed(followingIds, cursor);

    return sendSuccess(res, 200, "Home feed retrieved", posts);

});


//reels feeed
export const getReelsFeed = asyncHandler(async (req, res) => {

    const { cursor } = req.query;

    const reels = await fetchReelsFeed(cursor);

    return sendSuccess(res, 200, "Reels feed retrieved", reels);

});


//explore feed
export const getExploreFeed = asyncHandler(async (req, res) => {

    const { cursor } = req.query;

    const posts = await fetchExploreFeed(cursor);

    return sendSuccess(res, 200, "Explore feed retrieved", posts);

});