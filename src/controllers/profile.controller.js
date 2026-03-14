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

export const getProfileByUsername = asyncHandler(async (req, res) => {

    const { username } = req.params;
    const currentUserId = req.user.id;

    const user = await User.findOne({ username });

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    const profile = await UserProfile
        .findOne({ user: user._id })
        .populate("user", "username");

    if (!profile) {
        throw new ApiError(404, "Profile not found");
    }

    // followers of the profile owner
    const theirFollowers = await Follow.find({ following: user._id })
        .select("follower");

    const followerIds = theirFollowers.map(f => f.follower);

    // mutual followers
    const mutual = await Follow.find({
        follower: currentUserId,
        following: { $in: followerIds }
    }).populate({
        path: "following",
        select: "username",
    });

    const mutualFollowers = await UserProfile.find({
        user: { $in: mutual.map(m => m.following._id) }
    })
        .populate("user", "username")
        .select("profilePicture");

    const formattedMutuals = mutualFollowers.map(p => ({
        username: p.user.username,
        profilePicture: p.profilePicture
    }));

    return sendSuccess(res, 200, "Profile retrieved successfully", {
        profile,
        mutualFollowersCount: formattedMutuals.length,
        mutualFollowers: formattedMutuals
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