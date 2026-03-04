import UserProfile from "../models/userProfile.model.js";
import User from "../models/user.model.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";


//GET PROFILE
export const getMyProfile = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    console.log("User ID from token:", userId);
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
        "profilePicture",
        "coverPhoto",
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
    const {username} = req.params;
    const user = await User.findOne({ username })

    if (!user) {
        throw new ApiError(404, "User not found");
    }
    const profile = await UserProfile.findOne({ user: user._id }).populate("user", "username");

    if (!profile) {
        throw new ApiError(404, "Profile not found");
    }
    return sendSuccess(res, 200, "Profile retrieved successfully", profile);


});