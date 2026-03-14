import UserProfile from "../models/userProfile.model.js";
import User from "../models/user.model.js";
import Follow from "../models/social/follow.model.js";
import { uploadImage } from "../utils/uploadToCloudinary.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";


//GET PROFILE
export const getMyProfile = asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const profile = await UserProfile.findOne({ user: userId }).populate("user", "username email");

    if (!profile) {
        throw new ApiError(404, "Profile not found");
    }

    return sendSuccess(res, 200, "Profile retrieved successfully", profile);
});


//UPDATE PROFILE
export const updateProfile = asyncHandler(async (req, res) => {

    const allowedFields = [
        "name",
        "bio",
        "location",
        "website",
        "pronouns",
        "gender",
        "category",
        "isPrivate",
        "allowMessagesFromNonFollowers"
    ];

    const updates = {};

    allowedFields.forEach(field => {
        if (req.body[field] !== undefined) {
            updates[field] = req.body[field];
        }
    });

    const profile = await UserProfile.findOneAndUpdate(
        { user: req.user.id },
        { $set: updates },
        { new: true, runValidators: true }
    ).populate("user", "username email");

    if (!profile) {
        throw new ApiError(404, "Profile not found");
    }
    return sendSuccess(res, 200, "Profile updated successfully", profile);
});

//GET PROFILE BY USERNAME
//ebhacned with mongo agg pipe
export const getProfileByUsername = asyncHandler(async (req, res) => {

    const { username } = req.params;
    const currentUserId = req.user.id;

    const user = await User.findOne({ username }).select("_id username");

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    const profile = await UserProfile
        .findOne({ user: user._id })
        .populate("user", "username");

    if (!profile) {
        throw new ApiError(404, "Profile not found");
    }

    const mutualData = await Follow.aggregate([
        {
            $match: { following: user._id } // people who follow this profile
        },
        {
            $lookup: {
                from: "follows",
                let: { followerId: "$follower" },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ["$following", "$$followerId"] },
                                    { $eq: ["$follower", currentUserId] }
                                ]
                            }
                        }
                    }
                ],
                as: "mutual"
            }
        },
        {
            $match: { mutual: { $ne: [] } } // keep only mutuals
        },
        {
            $facet: {
                preview: [
                    { $limit: 3 },
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
                    { $unwind: "$profile" },
                    {
                        $project: {
                            _id: 0,
                            username: "$user.username",
                            profilePicture: "$profile.profilePicture"
                        }
                    }
                ],
                count: [
                    { $count: "total" }
                ]
            }
        }
    ]);

    const mutualFollowers = mutualData[0]?.preview || [];
    const mutualFollowersCount = mutualData[0]?.count[0]?.total || 0;

    return sendSuccess(res, 200, "Profile retrieved successfully", {
        profile,
        mutualFollowers,
        mutualFollowersCount
    });

});

//Image upload is handled in a separate route and controller for better separation of concerns.
export const updateProfilePhoto = asyncHandler(async (req, res) => {

    if (!req.file) {
        throw new ApiError(400, "Image file is required");
    }

    const result = await uploadImage(req.file);

    const profile = await UserProfile.findOneAndUpdate(
        { user: req.user.id },
        { profilePicture: result.secure_url },
        { new: true }
    );

    return sendSuccess(res, 200, "Profile photo updated", {
        profilePicture: profile.profilePicture
    });

});

//REMOVE PROFILE PHOTO
export const removeProfilePhoto = asyncHandler(async (req, res) => {

    const profile = await UserProfile.findOneAndUpdate(
        { user: req.user.id },
        { $set: { profilePicture: "https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y" } },
        { new: true }
    );

    if (!profile) {
        throw new ApiError(404, "Profile not found");
    }

    return sendSuccess(res, 200, "Profile photo removed successfully", {
        profilePicture: profile.profilePicture
    });


});