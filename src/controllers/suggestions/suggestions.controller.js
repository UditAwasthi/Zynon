
import Follow from "../../models/social/follow.model.js";
import { ApiError } from "../../utils/ApiError.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { sendSuccess } from "../../utils/apiResponse.js";

// get profile suggestions
export const getUserSuggestions = asyncHandler(async (req, res) => {

    const userId = req.user.id;

    const suggestions = await Follow.aggregate([
        // users I follow
        {
            $match: { follower: userId }
        },

        // who they follow
        {
            $lookup: {
                from: "follows",
                localField: "following",
                foreignField: "follower",
                as: "theirFollowing"
            }
        },

        { $unwind: "$theirFollowing" },

        {
            $group: {
                _id: "$theirFollowing.following",
                score: { $sum: 1 }
            }
        },

        // remove myself
        {
            $match: { _id: { $ne: userId } }
        },

        // remove users I already follow
        {
            $lookup: {
                from: "follows",
                let: { suggested: "$_id" },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ["$follower", userId] },
                                    { $eq: ["$following", "$$suggested"] }
                                ]
                            }
                        }
                    }
                ],
                as: "alreadyFollowing"
            }
        },

        {
            $match: {
                alreadyFollowing: { $eq: [] }
            }
        },

        // attach user data
        {
            $lookup: {
                from: "users",
                localField: "_id",
                foreignField: "_id",
                as: "user"
            }
        },

        { $unwind: "$user" },

        // attach profile
        {
            $lookup: {
                from: "userprofiles",
                localField: "user._id",
                foreignField: "user",
                as: "profile"
            }
        },

        { $unwind: "$profile" },

        {
            $project: {
                _id: 0,
                userId: "$user._id",
                username: "$user.username",
                name: "$profile.name",
                profilePicture: "$profile.profilePicture",
                score: 1
            }
        },

        { $sort: { score: -1 } },

        { $limit: 10 }
    ]);

    return sendSuccess(res, 200, "Suggestions fetched successfully", suggestions);
});