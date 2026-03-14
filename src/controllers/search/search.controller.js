import User from "../../models/user.model.js"
import UserProfile from "../../models/userProfile.model.js";
import Post from "../../models/content/post.model.js";

import { asyncHandler } from "../../utils/asyncHandler.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import { ApiError } from "../../utils/ApiError.js";

import redis from "../../redis/redisClient.js"

// Search
export const search = asyncHandler(async (req, res) => {
    const q = req.query.q?.trim()

    if (!q) {
        throw new ApiError(400, "Search query required")
    }

    const cacheKey = `search:${q.toLowerCase().replace(/\s+/g, " ")}`

    // Cache check
    const cached = await redis.get(cacheKey)
    if (cached) {
        return sendSuccess(res, 200, "Search results fetched (cache)", JSON.parse(cached))
    }

    // ── Username prefix search ────────────────────────────────────────────────
    const users = await User.find({
        username: { $regex: `^${q}`, $options: "i" }
    })
        .limit(10)
        .select("_id username")

    const userIds = users.map(u => u._id)

    const profiles = await UserProfile.find({
        user: { $in: userIds }
    }).select("user name profilePicture isVerified followersCount")

    const profileMap = new Map()
    profiles.forEach(p => profileMap.set(p.user.toString(), p))

    const usernameResults = users.map(u => {
        const p = profileMap.get(u._id.toString())
        return {
            _id: u._id,
            username: u.username,
            name: p?.name || null,
            avatar: p?.profilePicture || null,
            isVerified: p?.isVerified || false,
            followersCount: p?.followersCount || 0
        }
    })

    // ── Name / bio full-text search ───────────────────────────────────────────
    const profileResults = await UserProfile.find(
        { $text: { $search: q } },
        { score: { $meta: "textScore" } }
    )
        .sort({ score: { $meta: "textScore" } })
        .limit(10)
        .populate("user", "username")

    const textResults = profileResults
        // Fix: filter out orphaned UserProfile docs whose User was deleted
        .filter(p => p.user != null)
        .map(p => ({
            _id: p.user._id,
            username: p.user.username,
            name: p.name,
            avatar: p.profilePicture,
            isVerified: p.isVerified,
            followersCount: p.followersCount
        }))

    // Fix: deduplicate — a user can appear in both usernameResults and textResults
    const seenIds = new Set(usernameResults.map(u => u._id.toString()))
    const uniqueTextResults = textResults.filter(u => !seenIds.has(u._id.toString()))

    const usersFinal = [...usernameResults, ...uniqueTextResults]

    // ── Post caption search ───────────────────────────────────────────────────
    const posts = await Post.find({
        caption: { $regex: q, $options: "i" }
    })
        .limit(10)
        .populate("author", "username")

    const result = { users: usersFinal, posts }

    await redis.set(cacheKey, JSON.stringify(result), "EX", 60)

    return sendSuccess(res, 200, "Search results fetched", result)
})

// Search suggestions
export const searchUserSuggestions = asyncHandler(async (req, res) => {
    const { q } = req.query

    if (!q || q.length < 1) {
        return sendSuccess(res, 200, "Suggestions", [])
    }

    const key = `search:user:${q.toLowerCase()}`

    const usernames = await redis.zrange(key, 0, 9)

    if (!usernames.length) {
        return sendSuccess(res, 200, "Suggestions", [])
    }

    const users = await User.find({
        username: { $in: usernames }
    }).select("_id username")

    return sendSuccess(res, 200, "Suggestions fetched", users)
})