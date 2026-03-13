import Follow from "../../models/social/follow.model.js";
import UserProfile from "../../models/userProfile.model.js";
import { ApiError } from "../../utils/ApiError.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import mongoose from "mongoose";
// FOLLOW USER
export const followUser = asyncHandler(async (req, res) => {

    const currentUserId = req.user.id;
    const targetUserId = req.params.userId;

    if (currentUserId === targetUserId) {
        throw new ApiError(400, "You cannot follow yourself");
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {

        const existingFollow = await Follow.findOne({
            follower: currentUserId,
            following: targetUserId
        }).session(session);

        if (existingFollow) {
            throw new ApiError(400, "Follow request already exists");
        }

        const targetProfile = await UserProfile.findOne({ user: targetUserId }).session(session);

        if (!targetProfile) {
            throw new ApiError(404, "User profile not found");
        }

        const status = targetProfile.isPrivate ? "pending" : "active";

        await Follow.create([{
            follower: currentUserId,
            following: targetUserId,
            status
        }], { session });

        if (status === "active") {

            await UserProfile.updateOne(
                { user: targetUserId },
                { $inc: { followersCount: 1 } },
                { session }
            );

            await UserProfile.updateOne(
                { user: currentUserId },
                { $inc: { followingCount: 1 } },
                { session }
            );

        }

        await session.commitTransaction();
        session.endSession();
        try {
            notificationService.sendFollowRequestNotification({
                actorId: req.user.id,
                recipientId: targetUserId
            });
        } catch (err) {
            console.error("Follow request notification failed:", err.message);
        }
        return sendSuccess(
            res,
            201,
            status === "pending" ? "Follow request sent" : "User followed"
        );

    } catch (error) {

        await session.abortTransaction();
        session.endSession();
        throw error;

    }

});

// UNFOLLOW USER
export const unfollowUser = asyncHandler(async (req, res) => {

    const currentUserId = req.user.id;
    const targetUserId = req.params.userId;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {

        const follow = await Follow.findOneAndDelete({
            follower: currentUserId,
            following: targetUserId
        }).session(session);

        if (!follow) {
            throw new ApiError(404, "You are not following this user");
        }

        if (follow.status === "active") {

            await UserProfile.updateOne(
                { user: targetUserId },
                { $inc: { followersCount: -1 } },
                { session }
            );

            await UserProfile.updateOne(
                { user: currentUserId },
                { $inc: { followingCount: -1 } },
                { session }
            );

        }

        await session.commitTransaction();
        session.endSession();

        return sendSuccess(res, 200, "User unfollowed successfully");

    } catch (error) {

        await session.abortTransaction();
        session.endSession();
        throw error;

    }

});

// GET FOLLOWERS
export const getFollowers = asyncHandler(async (req, res) => {

    const { userId } = req.params;

    const followers = await Follow.aggregate([
        {
            $match: {
                following: new mongoose.Types.ObjectId(userId),
                status: "active"
            }
        },

        {
            $lookup: {
                from: "users",
                localField: "follower",
                foreignField: "_id",
                as: "user"
            }
        },
        { $unwind: "$user" },

        {
            $lookup: {
                from: "userprofiles",
                localField: "user._id",
                foreignField: "user",
                as: "profile"
            }
        },
        { $unwind: { path: "$profile", preserveNullAndEmptyArrays: true } },

        {
            $project: {
                _id: "$user._id",
                username: "$user.username",
                name: "$profile.name",
                profilePicture: "$profile.profilePicture"
            }
        }
    ]);

    return sendSuccess(res, 200, "Followers fetched", followers);

});

// GET FOLLOWING
export const getFollowing = asyncHandler(async (req, res) => {

    const { userId } = req.params;

    const following = await Follow.aggregate([
        {
            $match: {
                follower: new mongoose.Types.ObjectId(userId),
                status: "active"
            }
        },

        {
            $lookup: {
                from: "users",
                localField: "following",
                foreignField: "_id",
                as: "user"
            }
        },
        { $unwind: "$user" },

        {
            $lookup: {
                from: "userprofiles",
                localField: "user._id",
                foreignField: "user",
                as: "profile"
            }
        },
        { $unwind: { path: "$profile", preserveNullAndEmptyArrays: true } },

        {
            $project: {
                _id: "$user._id",
                username: "$user.username",
                name: "$profile.name",
                profilePicture: "$profile.profilePicture"
            }
        }
    ]);

    return sendSuccess(res, 200, "Following fetched", following);

});

// CHECK IF FOLLOWING
export const checkFollowing = asyncHandler(async (req, res) => {

    const currentUserId = req.user.id;
    const { userId } = req.params;

    const follow = await Follow.findOne({
        follower: currentUserId,
        following: userId
    });

    return sendSuccess(res, 200, "Follow status fetched", {
        isFollowing: !!follow
    });
});

//approve follow request
export const acceptFollowRequest = asyncHandler(async (req, res) => {

    const currentUserId = req.user.id;
    const requestUserId = req.params.userId;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {

        const follow = await Follow.findOne({
            follower: requestUserId,
            following: currentUserId,
            status: "pending"
        }).session(session);

        if (!follow) {
            throw new ApiError(404, "Follow request not found");
        }

        follow.status = "active";
        await follow.save({ session });

        await UserProfile.updateOne(
            { user: currentUserId },
            { $inc: { followersCount: 1 } },
            { session }
        );

        await UserProfile.updateOne(
            { user: requestUserId },
            { $inc: { followingCount: 1 } },
            { session }
        );

        await session.commitTransaction();
        session.endSession();
        try {
            notificationService.sendFollowAcceptedNotification({
                actorId: currentUserId,
                recipientId: requestUserId
            });
        } catch (err) {
            console.error("Follow accepted notification failed:", err.message);
        }
        return sendSuccess(res, 200, "Follow request accepted");

    } catch (error) {

        await session.abortTransaction();
        session.endSession();
        throw error;

    }

});
//reject follow request
export const rejectFollowRequest = asyncHandler(async (req, res) => {

    const currentUserId = req.user.id;
    const requestUserId = req.params.userId;

    const follow = await Follow.findOneAndDelete({
        follower: requestUserId,
        following: currentUserId,
        status: "pending"
    });

    if (!follow) {
        throw new ApiError(404, "Follow request not found");
    }

    return sendSuccess(res, 200, "Follow request rejected");

});

//get pending follow requests
export const getFollowRequests = asyncHandler(async (req, res) => {

    const currentUserId = req.user.id;

    const requests = await Follow.find({
        following: currentUserId,
        status: "pending"
    })
        .populate("follower", "username")
        .sort({ createdAt: -1 });

    return sendSuccess(res, 200, "Follow requests fetched", requests);
});

//GET FOLLLOW REQUESTS SENT
export const getFollowStatus = asyncHandler(async (req, res) => {

    const currentUserId = req.user.id;
    const { userId } = req.params;

    const follow = await Follow.findOne({
        follower: currentUserId,
        following: userId
    });

    let status = "not_following";

    if (follow) {
        status = follow.status === "pending" ? "requested" : "following";
    }

    return sendSuccess(res, 200, "Follow status fetched", { status });
});
//CANCEL FOLLOW REQUEST
export const cancelFollowRequest = asyncHandler(async (req, res) => {

    const currentUserId = req.user.id;
    const { userId } = req.params;

    const follow = await Follow.findOneAndDelete({
        follower: currentUserId,
        following: userId,
        status: "pending"
    });

    if (!follow) {
        throw new ApiError(404, "Follow request not found");
    }

    return sendSuccess(res, 200, "Follow request cancelled");

});